const run = require('./run');

module.exports = function() {
  console.log('\n--- Complex cases\n');

  const results = [
    run(
      'persons',
      [
        {
          firstName: 'John',
          lastName: 'Doe',
          age: 33,
          sex: 'm',
          hobbies: ['hiking', 'painting'],
        },
        {
          lastName: 'Sting',
          sex: 'm',
          hobbies: ['singing', 'yoga'],
        },
        {
          lastName: 'Madonna',
          age: 21,
          sex: 'f',
          hobbies: ['dancing', 'qabbalah', 'fashion'],
        },
        {
          firstName: 'Cher',
          lastName: 'Bono',
          sex: 'nb',
          hobbies: ['plastic surgery'],
        },
      ],
      {
        fields: [
          { name: 'firstName', type: 'string', nullable: true },
          { name: 'lastName', type: 'string' },
          { name: 'age', type: 'int8', nullable: true },
          { name: 'sex', type: 'enum', enumOf: ['m', 'f', 'nb', 'rns'] },
          { name: 'hobbies', type: 'array', arrayOf: { type: 'string' } },
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
