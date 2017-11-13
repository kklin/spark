const fs = require('fs');
const path = require('path');
const { Container, allow, publicInternet } = require('kelda');

let image = 'keldaio/spark';

/**
 * Change the Spark Docker image used to run the cluster.
 *
 * @param {string} newImage The Docker image used to run the cluster.
 */
function setImage(newImage) {
  image = newImage;
}

/**
 * Determine how much memory (in mebibytes) should be allocated to each Spark worker,
 * based on the properties of the given machine. This functionality is designed to
 * match how the Spark Standalone scheduler determines how much memory is available
 * on each worker: it determines the memory available on the machine, and then subtracts
 * 1GiB for the operating system to use (e.g., for the buffer cache).
 *
 * @param {Machine} machine - A virtual machine that Spark will be running on.
 * @returns {number} The amount of memory, in mebibytes, that Spark should use
 *   on the given machine.  One mebibyte is 1024 * 1024 bytes.
 */
function getWorkerMemoryMiB(machine) {
  const memoryGigabytes = machine.ram;
  // Convert the memory to mebibytes, which is what Spark expects (we use mebibytes
  // rather than gibibytes, because Spark only allows integer amounts of memory, so
  // we use mebibytes to allow finer-grained memory allocations).
  const memoryMebibytes = (memoryGigabytes * 1000 * 1000 * 1000) / (1024 * 1024);
  return memoryMebibytes - 1024;
}

/**
 * @param {int} memoryMiB - The amount of memory (in mebibytes) that each Spark
 *   executor should be configured to use. See the Spark class documentation for
 *   more on how to set this.
 * @returns {Object.<String,String>} Spark configuration files that should be added
 *   to all masters and workers in a Spark cluster.  The files are returned in the
 *   format expected by the Container filepathToContents argument (i.e., as a mapping
 *   of filenames to the contents of that file).
 */
function getConfigFiles(memoryMiB) {
  // Set a spark-env.sh file on each machine, which will be sourced before starting
  // any Spark processes.
  const sparkEnvContent = fs.readFileSync(path.join(__dirname, 'spark-env.sh'),
    { encoding: 'utf8' });
  // Add a spark-defaults.conf, which can be used to configure the default job
  // configuration.
  let sparkConfContent = fs.readFileSync(path.join(__dirname, 'spark-defaults.conf'),
    { encoding: 'utf8' });
  // Add configuration for how much memory Spark should use.
  sparkConfContent += `\nspark.executor.memory ${memoryMiB}m`;

  // Add the log4j configuration, which manages the log format and verbosity.
  const log4jConfigContent = fs.readFileSync(path.join(__dirname, 'log4j.properties'),
    { encoding: 'utf8' });
  const sparkConfigFiles = {
    '/spark/conf/spark-env.sh': sparkEnvContent,
    '/spark/conf/spark-defaults.conf': sparkConfContent,
    '/spark/conf/log4j.properties': log4jConfigContent,
  };
  return sparkConfigFiles;
}

class Spark {
  /**
   * Creates a Spark cluster. The cluster will include a collection of worker containers,
   * a master container (which handles scheduling), and a container that the user can use to
   * run a Spark application.
   *
   * @param {number} nWorker - The number of Spark worker containers to create.
   * @param {Object} opts - Optional additional arguments to configure Spark.
   * @param {number} [opts.memoryMiB=1024] - The amount of memory (in mebibytes) that each Spark
   *   worker (and each executor) should be given. The getWorkerMemoryMiB function can be used to
   *   determine an appropriate setting of this value for a particular machine.
   */
  constructor(nWorker, opts = {}) {
    let memoryMiB = opts.memoryMiB;
    if (memoryMiB === undefined) {
      memoryMiB = 1024;
    } else {
      // Spark only accepts integer values for the amount of memory, so round the input.
      memoryMiB = Math.round(memoryMiB);
    }
    const sparkConfigFiles = getConfigFiles(memoryMiB);

    this.master = new Container('spark-master', image, {
      command: ['/spark/bin/spark-class', 'org.apache.spark.deploy.master.Master'],
      filepathToContent: sparkConfigFiles,
    });
    this.masterPort = 7077;
    this.masterURL = `spark://${this.master.getHostname()}:${this.masterPort}`;

    this.workers = [];
    for (let i = 0; i < nWorker; i += 1) {
      this.workers.push(new Container('spark-worker', image, {
        command: [
          '/spark/bin/spark-class',
          'org.apache.spark.deploy.worker.Worker',
          '--memory',
          `${memoryMiB}MB`,
          this.masterURL,
        ],
        filepathToContent: sparkConfigFiles,
      }));
    }

    // Allow Spark workers to access the Spark Standalone Master.
    allow(this.workers, this.master, this.masterPort);
    // XXX: This is only necessary so that spark nodes can ask an external
    // service what their public IP is.  Once this information can be passed in
    // through an environment variable, these ACLs should be removed.
    publicInternet.allowFrom(this.workers, 80);
    publicInternet.allowFrom(this.master, 80);

    // Add a container to run the Spark Driver, which manages a particular
    // application. This container should be used to launch user jobs.
    // XXX: Currently this container will run on an arbitrary machine. It
    // should ideally run on the same machine that the master is running on
    // and not on a worker, where it may contend with the worker JVM.
    this.addDriver(sparkConfigFiles);
  }

  /**
   * Adds a container that users can use to run Spark jobs (e.g., by launching
   * spark-shell).
   *
   * @param {Object.<string, string>} configFiles - Map of filename to contents of the
   *   Spark configuration files that should be added to the driver.
   * @returns {void}
   */
  addDriver(configFiles) {
    this.driver = new Container('spark-driver', image, {
      // When we start the container, start the history server. The command to start the
      // history server starts it as a daemon, so we need to add a second, long-running command
      // to ensure that the container doesn't exit.
      command: ['sh', '-c', '/spark/sbin/start-history-server.sh && tail -f /dev/null'],
      filepathToContent: configFiles,
      env: { MASTER: this.masterURL },
    });

    // Allow the driver to connect to the standalone master.
    allow(this.driver, this.master, this.masterPort);

    // Allow Spark workers to access the Spark driver (this port is configured
    // in spark-defaults.conf).
    allow(this.workers, this.driver, 36666);

    // Allow Spark workers to access the Spark block manager, on both the
    // master and on all of the other Spark workers (this is used to fetch
    // task information from the master and to fetch data from other
    // workers). This port is configured in spark-defaults.conf.
    const sparkBlockManagerPort = 36667;
    allow(this.workers, this.workers, sparkBlockManagerPort);
    allow(this.workers, this.driver, sparkBlockManagerPort);
    allow(this.driver, this.workers, sparkBlockManagerPort);

    // XXX: This is only necessary so that the driver can learn its public IP
    // (see note above).
    publicInternet.allowFrom(this.driver, 80);

    const driverHostname = this.driver.hostname;
    console.log(`Spark driver started with hostname "${driverHostname}". ` +
      `To run a Spark job:\n(1) Use \`kelda ssh ${driverHostname}\` to login to the ` +
      'driver container\n(2) Run a job, e.g., by running `spark-submit` or `spark-shell`');
  }

  exposeUIToPublic() {
    // Expose the Standalone master UI (which shows all of the workers and all of
    // the applications that have run).
    allow(publicInternet, this.master, 8080);
    allow(publicInternet, this.workers, 8081);

    // Enable access to the history server, which shows information about jobs that
    // have run as part of applications that are now complete.
    allow(publicInternet, this.driver, 18080);

    // Expose the per-job UI (which shows each application).
    // This will only work when there's only one job; otherwise, the UI will use
    // increasing port numbers for the other jobs, and those will not be accessible.
    allow(publicInternet, this.driver, 4040);

    return this;
  }

  deploy(deployment) {
    this.master.deploy(deployment);
    this.driver.deploy(deployment);
    this.workers.forEach(worker => worker.deploy(deployment));
  }
}

exports.setImage = setImage;
exports.getWorkerMemoryMiB = getWorkerMemoryMiB;
exports.Spark = Spark;
