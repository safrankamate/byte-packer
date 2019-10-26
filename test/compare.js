const { pack } = require('../dist/pack');

module.exports = function() {
  const persons = [
    {
      id: 123456789,
      name: 'John Doe',
      sex: 'male',
      hobbies: ['riding', 'painting'],
      contact: {
        email: 'john.doe@example.com',
        phone: '555-9323',
      },
    },
    {
      id: 223456789,
      name: 'Jane Doe',
      sex: 'female',
      hobbies: ['tennis', 'clarinet', 'sci-fi'],
      contact: {
        email: 'jane.doe@example.com',
        phone: '555-4876',
      },
    },
  ];

  const payload = pack(persons, {
    fields: [
      {
        name: 'id',
        type: 'int32',
      },
      {
        name: 'name',
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
      {
        name: 'contact',
        type: 'object',
        fields: [
          {
            name: 'email',
            type: 'string',
          },
          {
            name: 'phone',
            type: 'string',
          },
        ],
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
