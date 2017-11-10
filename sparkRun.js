const kelda = require('kelda');
const spark = require('./spark.js');

const inf = kelda.baseInfrastructure();

const workerVMs = inf.machines.filter(machine => machine.role === 'Worker');
const workerMemoryGb = workerVMs[0].ram;

const s = new spark.Spark(workerVMs.length - 1, workerMemoryGb * 0.9);
s.exposeUIToPublic();

s.deploy(inf);
