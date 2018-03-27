const kelda = require('kelda');
const spark = require('./spark.js');

const defaultWorkerOpts = {
  provider: 'Amazon',
  ram: new kelda.Range(4),
  cpu: new kelda.Range(2),
};
const inf = new kelda.Infrastructure({
  masters: new kelda.Machine({ provider: 'Amazon', size: 'm3.medium' }),
  workers: [
    new kelda.Machine(defaultWorkerOpts),
    new kelda.Machine(Object.assign(defaultWorkerOpts, { provider: 'Google' })),
    new kelda.Machine(Object.assign(defaultWorkerOpts, { provider: 'DigitalOcean' })),
  ],
});

const s = new spark.Spark(inf.workers.length - 1,
  { memoryMiB: spark.getWorkerMemoryMiB(inf.workers[0]) });
s.exposeUIToPublic();

s.deploy(inf);
