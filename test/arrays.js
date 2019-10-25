const run = require('./run');

module.exports = function() {
  console.log('\n---Arrays\n');
  const results = [
    run(
      'ints',
      [{ ints: [1, 2, 3] }],
      {
        fields: [
          {
            name: 'ints',
            type: 'array',
            arrayOf: {
              type: 'uint8',
            },
          },
        ],
      },
      checkArrays,
    ),
    run(
      'enums',
      [{ enums: ['one', 'three', 'two', 'one'] }],
      {
        fields: [
          {
            name: 'enums',
            type: 'array',
            arrayOf: {
              type: 'enum',
              enumOf: ['one', 'two', 'three'],
            },
          },
        ],
      },
      checkArrays,
    ),
    run(
      'strings',
      [{ strings: ['Máté', 'Safranka', 'is', 'pretty damn awesome.'] }],
      {
        fields: [
          {
            name: 'strings',
            type: 'array',
            arrayOf: {
              type: 'string',
            },
          },
        ],
      },
      checkArrays,
    ),
    run(
      'arrays',
      [{ arrays: [[1, 2, 3, 4], [10, 20, 30, 40], [100, 200]] }],
      {
        fields: [
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
        ],
      },
      checkArrays,
    ),
    run(
      'nullable ints',
      [{ nullable: [null, 1, 2, 3, null, null, 4, null, 5] }],
      {
        fields: [
          {
            name: 'nullable',
            type: 'array',
            arrayOf: {
              type: 'uint8',
              nullable: true,
            },
          },
        ],
      },
      checkArrays,
    ),
  ];

  return results.every(Boolean);
};

function checkArrays([input], [result]) {
  let ok = true;
  for (const field in input) {
    const expected = input[field];
    const got = result[field];
    for (let i = 0; i < expected.length; i++) {
      const expectedValue = String(expected[i]);
      const gotValue = String(got[i]);
      if (expectedValue !== gotValue) {
        console.error(`  Mismatch in field "${field}" at index ${i}:`);
        console.error(`    Expected ${expectedValue}`);
        console.error(`    Got ${gotValue}`);
        ok = false;
      }
    }
  }
  return ok;
}
