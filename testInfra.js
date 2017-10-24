// This file contains the base infrastructure used for the travis build.
function infraGetter(quilt) {
  const inf = quilt.createDeployment({});
  const vmTemplate = new quilt.Machine({ provider: 'Amazon' });
  inf.deploy(vmTemplate.asMaster().replicate(1));
  inf.deploy(vmTemplate.asWorker().replicate(3));
  return inf;
}

module.exports = infraGetter;
