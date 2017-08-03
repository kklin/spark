const {createDeployment, Machine, publicInternet, githubKeys, enough} = require("@quilt/quilt");
var spark = require("./spark.js");

var deployment = createDeployment({});

// We will have three worker machines.
var nWorker = 3;

// Application
// sprk.exclusive enforces that no two Spark containers should be on the same
// node. sprk.exposeUIToPublic says that the the public internet should be able
// to connect to the Spark web interface. sprk.job causes Spark to run that
// job when it boots.
var sprk = new spark.Spark(1, nWorker)
    .exclusive()
    .exposeUIToPublic()
    .job("run-example SparkPi");

// Infrastructure
var baseMachine = new Machine({
    provider: "Amazon",
    region: "us-west-1",
    size: "m4.large",
    diskSize: 32,
    sshKeys: githubKeys("ejj"), // Replace with your GitHub username.
});
deployment.deploy(baseMachine.asMaster())
deployment.deploy(baseMachine.asWorker().replicate(nWorker + 1))
deployment.deploy(sprk);

deployment.assert(publicInternet.canReach(sprk.masters), true);
deployment.assert(enough, true);
