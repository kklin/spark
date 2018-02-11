// This file contains the base infrastructure used for the travis build.
function infraGetter(kelda) {
  const vmTemplate = new kelda.Machine({ provider: 'Amazon' });
  return new kelda.Infrastructure({
    masters: vmTemplate,
    workers: vmTemplate.replicate(3),
  });
}

module.exports = infraGetter;
