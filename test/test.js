const ALL_SUITES = ['trivial', 'dates', 'complex', 'errors'];

const suites = process.argv.slice(2);
const toRun =
  suites.length === 0
    ? ALL_SUITES
    : ALL_SUITES.filter(suite => suites.includes(suite));

for (const name of toRun) {
  const suite = require(`./${name}`);
  suite();
}
