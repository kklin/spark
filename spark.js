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
 * @param {number} memoryGB - The amount of memory that each Spark executor should
 *   be configured to use. See the Spark class documentation for more on how to
 *   set this.
 * @returns {Object.<String,String>} Spark configuration files that should be added
 *   to all masters and workers in a Spark cluster.  The files are returned in the
 *   format expected by the Container filepathToContents argument (i.e., as a mapping
 *   of filenames to the contents of that file).
 */
function getConfigFiles(memoryGB) {
  // Set a spark-env.sh file on each machine, which will be sourced before starting
  // any Spark processes.
  const sparkEnvContent = fs.readFileSync(path.join(__dirname, 'spark-env.sh'),
    { encoding: 'utf8' });
  // Add a spark-defaults.conf, which can be used to configure the default job
  // configuration.
  let sparkConfContent = fs.readFileSync(path.join(__dirname, 'spark-defaults.conf'),
    { encoding: 'utf8' });
  // Add configuration for how much memory Spark should use. Convert the memory to MB,
  // because Spark doesn't accept fractional values, and rounding to the nearest GB
  // loses too much accuracy.
  const memoryMB = Math.round(1024 * memoryGB);
  sparkConfContent += `\nspark.executor.memory ${memoryMB}m`;

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
   * @param {number} nWorker The number of Spark worker containers to create.
   * @param {number} [memoryGB=1] The amount of memory (in GB) that each Spark executor should be
   *   given.  When Spark is running in isolation, this should be set to roughly 90%
   *   of the memory on the worker machine (to leave room for the worker process, the OS, etc.).
   */
  constructor(nWorker, memoryGB = 1) {
    const sparkConfigFiles = getConfigFiles(memoryGB);

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
      'To run a Spark job:\n(1) Use `kelda show` to find the ID of the container ' +
      `with hostname "${driverHostname}"\n(2) Use \`kelda ssh\` to login to that ` +
      'container\n(3) Run a job, e.g., by running `spark-submit` or `spark-shell`');
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
exports.Spark = Spark;
