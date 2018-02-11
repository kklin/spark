const kelda = require('kelda');
const spark = require('./spark.js');

const inf = kelda.baseInfrastructure();

const s = new spark.Spark(inf.workers.length - 1,
  { memoryMiB: spark.getWorkerMemoryMiB(inf.workers[0]) });
s.exposeUIToPublic();

s.deploy(inf);
