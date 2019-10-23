const run = require('./run');

module.exports = function() {
  return run('\n--- Arrays\n', input, schema, checkArrays);
};

const schema = {
  fields: [
    {
      name: 'ints',
      type: 'array',
      arrayOf: {
        type: 'uint8',
      },
    },
    {
      name: 'enums',
      type: 'array',
      arrayOf: {
        type: 'enum',
        enumOf: [ 'one', 'two', 'three' ],
      },
    },
    {
      name: 'strings',
      type: 'array',
      arrayOf: {
        type: 'string',
      },
    },
    {
      name: 'arrays',
      type: 'array',
      arrayOf: {
        type: 'array',
        arrayOf: {
          type: 'uint8',
        },
      },
    },
    {
      name: 'nullable',
      type: 'array',
      itemsNullable: true,
      arrayOf: {
        type: 'uint8',
      },
    }
  ]
};

const input = [{
  ints: [ 1, 2, 3 ],
  enums: [ 'one', 'three', 'two', 'one' ],
  strings: [ 'Máté', 'Safranka', 'is', 'pretty damn awesome.' ],
  arrays: [
    [ 1, 2, 3, 4 ],
    [ 10, 20, 30, 40 ],
    [ 100, 200 ],
  ],
  nullable: [ null, 1, 2, 3, null, null, 4, null, 5 ],
}];

function checkArrays([input], [result]) {
  let ok = true;
  for (const field in input) {
    const expected = input[field];
    const got = result[field];
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== got[i]) {
        console.error(`  Mismatch in ${field} at index ${i}:`);
        console.error(`    Expected ${expected[i]}`);
        console.error(`    Got ${got[i]}`);
        ok = false;
      }
    }
  }
  return ok;
}
