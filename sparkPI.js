const {
  Machine,
  createDeployment,
  githubKeys,
} = require('kelda');
const spark = require('./spark.js');

const deployment = createDeployment({});

// We will have three worker machines.
const nWorker = 3;

// Application
// sprk.exposeUIToPublic says that the the public internet should be able
// to connect to the Spark web interface. sprk.job causes Spark to run that
// job when it boots.
const sprk = new spark.Spark(nWorker)
  .exposeUIToPublic()
  .job('run-example SparkPi');

// Infrastructure
const baseMachine = new Machine({
  provider: 'Amazon',
  region: 'us-west-1',
  size: 'm4.large',
  diskSize: 32,
  sshKeys: githubKeys('ejj'), // Replace with your GitHub username.
});
deployment.deploy(baseMachine.asMaster());
deployment.deploy(baseMachine.asWorker().replicate(nWorker + 1));
sprk.deploy(deployment);
