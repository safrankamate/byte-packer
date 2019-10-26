const run = require('./run');

module.exports = function() {
  console.log('\n--- Objects\n');
  const results = [
    run(
      'Primitive fields',
      [{ coords: { x: 13, y: 42 } }],
      {
        fields: [
          {
            name: 'coords',
            type: 'object',
            fields: [{ name: 'x', type: 'int8' }, { name: 'y', type: 'int8' }],
          },
        ],
      },
      checkObjects,
    ),
    run(
      'Array fields',
      [
        {
          theme: {
            fonts: ['Arial', 'Georgia'],
            dimensions: [8, 16, 24],
          },
        },
      ],
      {
        fields: [
          {
            name: 'theme',
            type: 'object',
            fields: [
              {
                name: 'fonts',
                type: 'array',
                arrayOf: { type: 'string' },
              },
              {
                name: 'dimensions',
                type: 'array',
                arrayOf: { type: 'uint8' },
              },
            ],
          },
        ],
      },
      checkObjects,
    ),
    run(
      'Object fields',
      [{ personal: { name: { first: 'John', last: 'Doe' } } }],
      {
        fields: [
          {
            name: 'personal',
            type: 'object',
            fields: [
              {
                name: 'name',
                type: 'object',
                fields: [
                  { name: 'first', type: 'string' },
                  { name: 'last', type: 'string' },
                ],
              },
            ],
          },
        ],
      },
      checkObjects,
    ),
    run(
      'Array of objects',
      [
        {
          children: [
            { name: 'Dave', age: 5 },
            { name: 'Debbie', age: 7 },
            { name: 'Slagathor', age: 9 },
          ],
        },
      ],
      {
        fields: [
          {
            name: 'children',
            type: 'array',
            arrayOf: {
              type: 'object',
              fields: [
                { name: 'name', type: 'string' },
                { name: 'age', type: 'uint8' },
              ],
            },
          },
        ],
      },
      checkObjects,
    ),
  ];
  return results.every(Boolean);
};

function checkObjects([input], [result]) {
  const inputJson = JSON.stringify(input);
  const resultJson = JSON.stringify(result);
  if (inputJson === resultJson) {
    return true;
  } else {
    console.error('Object mismatch:');
    console.error('Expected', inputJson);
    console.error('Got:', resultJson);
    return false;
  }
}
