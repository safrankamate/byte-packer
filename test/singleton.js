const run = require('./run');

module.exports = function() {
  console.log('\n--- Singletons\n');
  const results = [
    run('basic', searchResults, schema, (input, result) => {
      return JSON.stringify(input) === JSON.stringify(result);
    }),
  ];

  return results.every(Boolean);
};

const schema = {
  asSingleton: true,
  fields: [
    {
      name: 'pagination',
      type: 'object',
      fields: [
        { name: 'currentPage', type: 'uint8' },
        { name: 'pageCount', type: 'uint8' },
        { name: 'recordsPerPage', type: 'uint8' },
        { name: 'recordCount', type: 'uint32' },
      ],
    },
    {
      name: 'records',
      type: 'array',
      arrayOf: {
        type: 'object',
        fields: [
          { name: 'firstName', type: 'string' },
          { name: 'lastName', type: 'string' },
          { name: 'age', type: 'uint8' },
        ],
      },
    },
  ],
};

const searchResults = {
  pagination: {
    currentPage: 1,
    pageCount: 2,
    recordsPerPage: 3,
    recordCount: 5,
  },
  records: [
    {
      firstName: 'John',
      lastName: 'Doe',
      age: 33,
    },
    {
      firstName: 'Jane',
      lastName: 'Doe',
      age: 35,
    },
    {
      firstName: 'Jackie',
      lastName: 'Doe',
      age: 26,
    },
  ],
};
