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

  this.workers = [];
  for (let i = 0; i < nWorker; i += 1) {
    this.workers.push(new Container('spark-wk', image, {
      command: ['run', 'worker'],
      env: {
        MASTER: `spark://${this.master.getHostname()}:7077`,
      },
    }));
  }

  allow(this.workers, this.workers, 7077);
  allow(this.workers, this.master, 7077);

  this.exposeUIToPublic = function exposeUIToPublic() {
    allow(publicInternet, this.master, 8080);
    allow(publicInternet, this.workers, 8081);

    // XXX: This is only necessary so that spark nodes can ask an external
    // service what their public IP is.  Once this information can be passed in
    // through an environment variable, these ACLs should be removed.
    publicInternet.allowFrom(this.workers, 80);
    publicInternet.allowFrom(this.master, 80);
    return this;
  };

  this.deploy = function deploy(deployment) {
    this.master.deploy(deployment);
    this.workers.forEach(worker => worker.deploy(deployment));
  };
}

exports.setImage = setImage;
exports.Spark = Spark;
