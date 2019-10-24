const { pack } = require('../dist/pack');

module.exports = function() {
  const persons = [
    {
      id: 123456789,
      firstName: 'John',
      lastName: 'Doe',
      sex: 'male',
      hobbies: ['riding', 'painting'],
    },
    {
      id: 223456789,
      firstName: 'Jane',
      lastName: 'Doe',
      sex: 'female',
      hobbies: ['tennis', 'clarinet', 'sci-fi'],
    },
  ];

  const payload = pack(persons, {
    fields: [
      {
        name: 'id',
        type: 'int32',
      },
      {
        name: 'firstName',
        type: 'string',
      },
      {
        name: 'lastName',
        type: 'string',
      },
      {
        name: 'sex',
        type: 'enum',
        enumOf: ['male', 'female', 'undisclosed'],
      },
      {
        name: 'hobbies',
        type: 'array',
        arrayOf: {
          type: 'string',
        },
      },
    ],
  });

  const jsonSize = JSON.stringify(persons).length;
  const packedSize = payload.byteLength;

  console.log('JSON size:', jsonSize);
  console.log(
    'Packed size:',
    packedSize,
    Math.round(100 - 100 * (packedSize / jsonSize)),
  );

  return true;
};
