const ALL_SUITES = [
  'trivial',
  'dates',
  'arrays',
  'complex',
  'errors',
  'compare',
];

const suites = process.argv.slice(2);
const toRun =
  suites.length === 0
    ? ALL_SUITES
    : ALL_SUITES.filter(suite => suites.includes(suite));

let pass = [];
let fail = [];
for (const name of toRun) {
  const suite = require(`./${name}`);
  const ok = suite();
  if (ok) {
    pass.push(name);
  } else {
    fail.push(name);
  }
}

console.log(`\n\n--- Ran ${toRun.length} suites`);
console.log(`Passed: ${pass.join(', ') || '[none]'}`);
console.log(`Failed: ${fail.join(', ') || '[none]'}`);
