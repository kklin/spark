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

  this.job = function job(command) {
    this.master.setEnv('JOB', command);
    return this;
  };

  this.exposeUIToPublic = function exposeUIToPublic() {
    allow(publicInternet, this.master, 8080);
    allow(publicInternet, this.workers, 8081);
    return this;
  };

  this.deploy = function deploy(deployment) {
    this.master.deploy(deployment);
    this.workers.forEach(worker => worker.deploy(deployment));
  };
}

exports.setImage = setImage;
exports.Spark = Spark;
