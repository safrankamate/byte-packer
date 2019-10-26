const { pack } = require('../dist/pack');
const { unpack } = require('../dist/unpack');

module.exports = function run(name, input, schema, check = compare) {
  console.log('\nCase', name);
  console.log('* with schema');
  const schemaOk = execute(input, schema, check);

  console.log('* self-describing');
  const selfOk = execute(input, { ...schema, selfDescribing: true }, check);

  return schemaOk && selfOk;
};

function execute(input, schema, check) {
  try {
    const buffer = pack(input, schema);
    const result = unpack(buffer, schema);
    return check(input, result);
  } catch (e) {
    console.error('*** Exception caught:', e.message);
    if (!e.message.startsWith('byte-packer')) {
      console.error(e);
    }
    return false;
  }
}

function compare(input, result) {
  let ok = true;
  for (let i = 0; i < input.length; i++) {
    let hasError = false;
    for (const key in input[i]) {
      if (result[i][key] !== input[i][key]) {
        console.error('  Key', key, 'has wrong value in object', i);
        hasError = true;
      }
    }
    for (const key in result[i]) {
      if (!(key in input[i]) && result[i][key] !== null) {
        console.error('  Superfluous key', key, 'in object', i);
        hasError = true;
      }
    }

    if (hasError) {
      console.log('  Compare:');
      console.log('    ', JSON.stringify(input[i]));
      console.log('    ', JSON.stringify(result[i]));
      ok = false;
    }
  }

  return ok;
}
