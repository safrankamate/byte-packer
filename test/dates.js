const { pack } = require('../dist/pack');
const { unpack } = require('../dist/unpack');

module.exports = function() {
  console.log('\n--- Dates\n');

  const { schema, input, expected } = build();
  console.log('* with schema');
  run(input, expected, schema);

  console.log('* self-describing');
  run(input, expected, { ...schema, selfDescribing: true });
};

const DateLengths = {
  day: 10,
  minute: 15,
  second: 18,
  ms: 22,
};

function run(input, expected, schema) {
  const buffer = pack(input, schema);
  const [result] = unpack(buffer, schema);
  for (const key in result) {
    const resultDate = result[key].toISOString().slice(0, DateLengths[key]);
    const expectedDate = expected[key];
    if (resultDate !== expectedDate) {
      console.error(`Incorrect date in case ${key}`);
      console.error(
        `expected ${expectedDate.toString()}, got ${resultDate.toString()}`,
      );
    }
  }
}

function build() {
  const schema = {
    fields: [
      { name: 'day', type: 'date', precision: 'day' },
      { name: 'minute', type: 'date', precision: 'minute' },
      { name: 'second', type: 'date', precision: 'second' },
      { name: 'ms', type: 'date', precision: 'ms' },
    ],
  };

  const now = new Date();
  const input = [
    {
      day: now,
      minute: now,
      second: now,
      ms: now,
    },
  ];
  const expected = {
    day: now.toISOString().slice(0, DateLengths.day),
    minute: now.toISOString().slice(0, DateLengths.minute),
    second: now.toISOString().slice(0, DateLengths.second),
    ms: now.toISOString().slice(0, DateLengths.ms),
  };

  return { schema, input, expected };
}
