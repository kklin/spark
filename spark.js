const { Container, Service, publicInternet } = require('@quilt/quilt');

let image = 'quilt/spark';

/**
 * Change the Spark Docker image used to run the cluster.
 *
 * @param {string} newImage The Docker image used to run the cluster.
 */
function setImage(newImage) {
  image = newImage;
}

/**
 * Spark represents a Spark cluster (a set of connected Spark masters and
 * workers).
 *
 * @param {number} nMaster The number of masters to boot.
 * @param {number} nWorker The number of workers to boot.
 * @param {Service} [zookeeper] The Zookeeper service used to coordinate the
 * Spark masters.
 */
function Spark(nMaster, nWorker, zookeeper) {
  const dkms = new Container(image, ['run', 'master']).replicate(nMaster);

  if (zookeeper) {
    const zooHosts = zookeeper.children().join(',');
    dkms.forEach((master) => {
      master.setEnv('ZOO', zooHosts);
    });
  }

  this.masters = new Service('spark-ms', dkms);

  const dkws = new Container(image, ['run', 'worker'])
    .withEnv({ MASTERS: this.masters.children().join(',') })
    .replicate(nWorker);
  this.workers = new Service('spark-wk', dkws);

  this.workers.allowFrom(this.workers, 7077);
  this.masters.allowFrom(this.workers, 7077);
  if (zookeeper) {
    zookeeper.allowFrom(this.masters, 2181);
  }

  this.job = function job(command) {
    this.masters.containers.forEach((master) => {
      master.setEnv('JOB', command);
    });
    return this;
  };

  this.exposeUIToPublic = function exposeUIToPublic() {
    this.masters.allowFrom(publicInternet, 8080);
    this.workers.allowFrom(publicInternet, 8081);
    return this;
  };

  this.deploy = function deploy(deployment) {
    deployment.deploy(this.masters);
    deployment.deploy(this.workers);
  };
}

exports.setImage = setImage;
exports.Spark = Spark;
