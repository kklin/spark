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
  this.master = new Container('spark-ms', image,
      { command: ['run', 'master'] });
  const masterURL = `spark://${this.master.getHostname()}:7077`;
  this.master.setEnv('MASTER', masterURL);

  this.workers = [];
  for (let i = 0; i < nWorker; i += 1) {
    this.workers.push(new Container('spark-wk', image, {
      command: ['run', 'worker'],
      env: { MASTER: masterURL },
    }));
  }

  allow(this.workers, this.workers, 7077);
  allow(this.workers, this.master, 7077);

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
