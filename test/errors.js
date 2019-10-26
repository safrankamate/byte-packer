const run = require('./run');

module.exports = function() {
  console.log('\n--- Validation\n');

  const results = [
    runForError('Invalid input', 'invalid', {}),
    runForError('No fields in schema', [], {}),
    runForError('Invalid fields member in schema', [], { fields: ['invalid'] }),

    runForError('No field name', [], { fields: [{}] }),
    runForError('No field type', [], { fields: [{ name: 'foo' }] }),
    runForError('Duplicate field name', [], {
      fields: [{ name: 'foo', type: 'int8' }, { name: 'foo', type: 'int16' }],
    }),
    runForError('Invalid field type', [], {
      fields: [{ name: 'foo', type: 'invalid' }],
    }),
    runForError('Missing enum options', [], {
      fields: [{ name: 'foo', type: 'enum' }],
    }),
    runForError('Invalid enum options', [], {
      fields: [{ name: 'foo', type: 'enum', enumOf: ['one', 2] }],
    }),
    runForError('Duplicate enum options', [], {
      fields: [{ name: 'foo', type: 'enum', enumOf: ['one', 'two', 'one'] }],
    }),

    runForError('Nullish value in non-nullable field', [{}], {
      fields: [{ name: 'foo', type: 'int8' }],
    }),
    runForError('Non-integer value in integer field', [{ foo: 1.2 }], {
      fields: [{ name: 'foo', type: 'int8' }],
    }),
    runForError('Out-of-range value in int8 field', [{ foo: 200 }], {
      fields: [{ name: 'foo', type: 'int8' }],
    }),
    runForError('Out-of-range value in int16 field', [{ foo: 40000 }], {
      fields: [{ name: 'foo', type: 'int8' }],
    }),
    runForError('Non-numeric value in float field', [{ foo: 'bar' }], {
      fields: [{ name: 'foo', type: 'float' }],
    }),
    runForError('Non-string value in string field', [{ foo: 13 }], {
      fields: [{ name: 'foo', type: 'string' }],
    }),
    runForError('Unlisted value in enum field', [{ foo: 'invalid' }], {
      fields: [{ name: 'foo', type: 'enum', enumOf: ['bar', 'baz'] }],
    }),

    runForError('No arrayOf in array field', [{}], {
      fields: [{ name: 'foo', type: 'array' }],
    }),
    runForError('Invalid arrayOf in array field', [{}], {
      fields: [{ name: 'foo', type: 'array', arrayOf: 'invalid' }],
    }),
    runForError('Invalid type definition in array field', [{}], {
      fields: [{ name: 'foo', type: 'array', arrayOf: { type: 'enum' } }],
    }),
    runForError('Invalid type definition in nested array field', [{}], {
      fields: [
        {
          name: 'foo',
          type: 'array',
          arrayOf: {
            type: 'array',
            arrayOf: { type: 'enum' },
          },
        },
      ],
    }),
  ];

  return results.every(Boolean);
};

function runForError(name, input, schema) {
  run(name, input, schema, () => {
    console.error('!!! No error caught !!!');
    return false;
  });
  return true;
}
