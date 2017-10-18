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

function getHostname(c) {
  return c.getHostname();
}

/**
 * Spark represents a Spark cluster (a set of connected Spark masters and
 * workers).
 *
 * @param {number} nMaster The number of masters to boot.
 * @param {number} nWorker The number of workers to boot.
 * @param {Container[]} [zookeeper] The Zookeeper containers used to coordinate the
 * Spark masters.
 */
function Spark(nMaster, nWorker, zookeeper) {
  this.masters = [];
  for (let i = 0; i < nMaster; i += 1) {
    this.masters.push(new Container('spark-ms', image, {
      command: ['run', 'master'],
    }));
  }

  if (zookeeper) {
    const zooHosts = zookeeper.containers.map(getHostname);
    const zooHostsStr = zooHosts.join(',');
    this.masters.forEach((master) => {
      master.setEnv('ZOO', zooHostsStr);
    });
  }

  const masterHosts = this.masters.map(getHostname);
  this.workers = [];
  for (let i = 0; i < nWorker; i += 1) {
    this.workers.push(new Container('spark-wk', image, {
      command: ['run', 'worker'],
      env: {
        MASTERS: masterHosts.join(','),
      },
    }));
  }

  allow(this.workers, this.workers, 7077);
  allow(this.workers, this.masters, 7077);
  if (zookeeper) {
    allow(this.masters, zookeeper, 2181);
  }

  this.job = function job(command) {
    this.masters.forEach((master) => {
      master.setEnv('JOB', command);
    });
    return this;
  };

  this.exposeUIToPublic = function exposeUIToPublic() {
    allow(publicInternet, this.masters, 8080);
    allow(publicInternet, this.workers, 8081);
    return this;
  };

  this.deploy = function deploy(deployment) {
    this.masters.forEach(master => master.deploy(deployment));
    this.workers.forEach(worker => worker.deploy(deployment));
  };
}

exports.setImage = setImage;
exports.Spark = Spark;
