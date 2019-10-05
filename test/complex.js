const run = require('./run');

module.exports = function() {
  console.log('\n--- Complex cases\n');

  run(
    'persons',
    [
      {
        firstName: 'John',
        lastName: 'Doe',
        age: 33,
        sex: 'm',
      },
      {
        lastName: 'Sting',
        sex: 'm',
      },
      {
        lastName: 'Madonna',
        age: 21,
        sex: 'f',
      },
      {
        firstName: 'Cher',
        lastName: 'Bono',
        sex: 'nb',
      },
    ],
    {
      fields: [
        { name: 'firstName', type: 'string', nullable: true },
        { name: 'lastName', type: 'string' },
        { name: 'age', type: 'int8', nullable: true },
        { name: 'sex', type: 'enum', enumOf: ['m', 'f', 'nb', 'rns'] },
      ],
    },
  );
};
