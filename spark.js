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
 * Spark creates a Spark cluster (a master and a collection of workers).
 *
 * @param {number} nWorker The number of workers to boot.
 */
function Spark(nWorker) {
  // Set a spark-env.sh file on each machine, which will be sourced before starting
  // any Spark processes.
  const sparkEnvContent = fs.readFileSync(path.join(__dirname, 'spark-env.sh'),
    { encoding: 'utf8' });
  // Add a spark-defaults.conf, which can be used to configure the default job
  // configuration.
  const sparkConfContent = fs.readFileSync(path.join(__dirname, 'spark-defaults.conf'),
    { encoding: 'utf8' });
  const sparkConfigFiles = {
    '/spark/conf/spark-env.sh': sparkEnvContent,
    '/spark/conf/spark-defaults.conf': sparkConfContent,
  };

  this.master = new Container('spark-ms', image, {
    command: ['sh', '-c',
      '/spark/sbin/start-history-server.sh && ' +
      '/spark/bin/spark-class org.apache.spark.deploy.master.Master'],
    filepathToContent: sparkConfigFiles,
  });
  const masterURL = `spark://${this.master.getHostname()}:7077`;
  this.master.setEnv('MASTER', masterURL);

  this.workers = [];
  for (let i = 0; i < nWorker; i += 1) {
    this.workers.push(new Container('spark-wk', image, {
      command: [
        '/spark/bin/spark-class',
        'org.apache.spark.deploy.worker.Worker',
        masterURL,
      ],
      filepathToContent: sparkConfigFiles,
    }));
  }

  allow(this.workers, this.workers, 7077);
  // Allow Spark workers to access the Spark Standalone Master.
  allow(this.workers, this.master, 7077);
  // Allow Spark workers to access the Spark driver (this port is configured
  // in spark-defaults.conf).
  allow(this.workers, this.master, 36666);
  // Allow Spark workers to access the Spark block manager, on both the
  // master and on all of the other Spark workers (this is used to fetch
  // task information from the master and to fetch data from other
  // workers). This port is configured in spark-defaults.conf.
  const sparkBlockManagerPort = 36667;
  allow(this.workers, this.workers, sparkBlockManagerPort);
  allow(this.workers, this.master, sparkBlockManagerPort);
  allow(this.master, this.workers, sparkBlockManagerPort);

  // XXX: This is only necessary so that spark nodes can ask an external
  // service what their public IP is.  Once this information can be passed in
  // through an environment variable, these ACLs should be removed.
  publicInternet.allowFrom(this.workers, 80);
  publicInternet.allowFrom(this.master, 80);

  this.exposeUIToPublic = function exposeUIToPublic() {
    // Expose the Standalone master UI (which shows all of the workers and all of
    // the applications that have run).
    allow(publicInternet, this.master, 8080);
    allow(publicInternet, this.workers, 8081);
    allow(publicInternet, this.master, 18080);

    // Expose the per-job UI (which shows each application).
    // This will only work when there's only one job; otherwise, the UI will use
    // increasing port numbers for the other jobs, and those will not be accessible.
    allow(publicInternet, this.master, 4040);

    return this;
  };

  this.deploy = function deploy(deployment) {
    this.master.deploy(deployment);
    this.workers.forEach(worker => worker.deploy(deployment));
  };
}

exports.setImage = setImage;
exports.Spark = Spark;
