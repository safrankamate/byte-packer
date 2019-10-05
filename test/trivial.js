const run = require('./run');

module.exports = function() {
  console.log('\n--- Trivial cases\n');

  run('empty', [], { fields: [{ name: 'value', type: 'int8' }] });

  run('int8', [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }], {
    fields: [{ name: 'value', type: 'int8' }],
  });
  run(
    'int8 nullable',
    [{ value: 1 }, { value: 2 }, { value: null }, { value: 4 }],
    {
      fields: [{ name: 'value', type: 'int8', nullable: true }],
    },
  );

  run(
    'int8, int16',
    [
      { value8: 1, value16: 1000 },
      { value8: 2, value16: 2000 },
      { value8: 3, value16: 3000 },
    ],
    {
      fields: [
        { name: 'value8', type: 'int8' },
        { name: 'value16', type: 'int16' },
      ],
    },
  );

  run(
    'int8 nullable, int16 nullable',
    [
      { value8: 1, value16: 1000 },
      { value8: null, value16: 2000 },
      { value8: 3, value16: null },
      { value8: null, value16: null },
    ],
    {
      fields: [
        { name: 'value8', type: 'int8', nullable: true },
        { name: 'value16', type: 'int16', nullable: true },
      ],
    },
  );

  run(
    'enum',
    [{ value: 'one' }, { value: 'two' }, { value: 'three' }, { value: 'two' }],
    {
      fields: [
        { name: 'value', type: 'enum', enumOf: ['one', 'two', 'three'] },
      ],
    },
  );

  run(
    'string',
    [
      { value: '!' },
      { value: '0' },
      { value: 'A' },
      { value: 'a' },
      { value: 'abc' },
      { value: 'Mate Safranka' },
    ],
    {
      fields: [{ name: 'value', type: 'string' }],
    },
  );
};
