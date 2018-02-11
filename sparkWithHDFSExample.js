const kelda = require('kelda');
const spark = require('./spark.js');
const hadoop = require('@kelda/hadoop');

const numSparkWorkers = 2;
const machine = new kelda.Machine({ provider: 'Amazon', size: 'm4.large' });
const inf = new kelda.Infrastructure({
  masters: machine,
  workers: machine.replicate(numSparkWorkers + 1),
});

const hdfs = new hadoop.HDFS(numSparkWorkers);
hdfs.exposeUIToPublic();

const s = new spark.Spark(numSparkWorkers, {
  memoryMiB: spark.getWorkerMemoryMiB(machine),
  hdfs,
});
s.exposeUIToPublic();

hdfs.deploy(inf);
s.deploy(inf);
