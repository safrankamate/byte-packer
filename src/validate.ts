import { Schema, Types, Field, TypeName } from './schema';

export type Validator = (value: any) => void;
type ValidatorFactory = (field: Field) => Validator;

export function assert(condition: boolean, message: string): boolean {
  if (!condition) throw Error(`byte-packer: ${message}`);
  return true;
}

function assertField(
  name: string,
  condition: boolean,
  message: string,
): boolean {
  return assert(condition, `${message} in field ${name}`);
}

const FieldTypes = new Set<string>(Object.values(Types));

export function validatePack(rows: any[], schema: Schema): boolean {
  assert(Array.isArray(rows), 'First argument of pack() must be an array.');

  if (schema) {
    validateSchema(schema);
  }
  return true;
}

export function validateSchema(schema: Schema): boolean {
  assert(Array.isArray(schema.fields), 'Schema must contain field specs.');

  const names = new Set<string>();
  for (const field of schema.fields) {
    validateField(field, names);
    names.add(field.name);
  }
  return true;
}

export function createValidator(field: Field): Validator {
  const validate = Validators[field.type](field);
  return value => {
    if (field.nullable && (value === null || value === undefined)) return;
    assertField(
      field.name,
      value !== null && value !== undefined,
      'Unallowed nullish value',
    );
    validate(value);
  };
}

// Schema validation

type EnumDetails = { enumOf: string[] };
type ArrayDetails = { arrayOf: any };

function validateField({ name, type, ...field }: Field, names: Set<string>) {
  assert(!!name, 'Fields must have a name property.');
  assert(!!type, `Field ${name} has no type specified.`);
  assert(!names.has(name), `Duplicate field name in schema: ${name}`);
  assert(FieldTypes.has(type), `Field ${name} has invalid type ${type}`);

  if (type === 'enum') validateEnumField(name, (field as EnumDetails).enumOf);
  if (type === 'array')
    validateArrayField(name, (field as ArrayDetails).arrayOf);
  if (type === 'object') validateSchema(field as Schema);
}

function validateEnumField(name: string, enumOf: string[]) {
  assert(
    Array.isArray(enumOf),
    `Field ${name} has enum type but no enumOf property`,
  );
  assert(enumOf.length > 0, `Field ${name} has empty array for enumOf`);
  assert(
    enumOf.every(option => typeof option === 'string'),
    `Field ${name} contains invalid enum options`,
  );
  assert(
    new Set(enumOf).size === enumOf.length,
    `Field ${name} must contain unique enum options.`,
  );
}

function validateArrayField(name: string, arrayOf: any) {
  assert(
    typeof arrayOf === 'object',
    `Field ${name} must have a valid arrayOf property`,
  );

  validateField({ name: `${name}'s type definition`, ...arrayOf }, new Set());
}

// Input validation

const Validators: Record<TypeName, ValidatorFactory> = {
  int8: field => value => {
    assertInteger(field.name, value);
    assertRange(field.name, value, -0x80, 0x7f);
  },
  int16: field => value => {
    assertInteger(field.name, value);
    assertRange(field.name, value, -0x8000, 0x7fff);
  },
  int32: field => value => {
    assertInteger(field.name, value);
    assertRange(field.name, value, -0x80000000, 0x7fffffff);
  },
  uint8: field => value => {
    assertInteger(field.name, value);
    assertRange(field.name, value, 0, 0xff);
  },
  uint16: field => value => {
    assertInteger(field.name, value);
    assertRange(field.name, value, 0, 0xffff);
  },
  uint32: field => value => {
    assertInteger(field.name, value);
    assertRange(field.name, value, 0, 0xffffffff);
  },
  varint: field => value => {
    assertInteger(field.name, value);
    assertRange(field.name, value, 0, 0x10ffff);
  },
  float: field => value => {
    assertField(
      field.name,
      Number.isFinite(value),
      `Non-numeric value ${value}`,
    );
  },
  boolean: field => value => {
    assertField(field.name, !!value === value, `Non-boolean value ${value}`);
  },
  string: field => value => {
    assertField(
      field.name,
      typeof value === 'string',
      `Non-string value ${value}`,
    );
  },
  enum: field => value => {
    assertField(
      field.name,
      typeof value === 'string',
      `Non-string value ${value}`,
    );
    assertField(
      field.name,
      (field as EnumDetails).enumOf.includes(value),
      `Value ${value} not listed in enum options`,
    );
  },
  date: field => value => {
    assertField(
      field.name,
      value instanceof Date,
      `Value ${value} is not a Date object`,
    );
  },
  array: field => value => {
    assertField(
      field.name,
      Array.isArray(value),
      `Value ${value} is not an array`,
    );
    assertField(
      field.name,
      (field as ArrayDetails).arrayOf.nullable ||
        value.every((item: any) => item !== null),
      `Null value in non-nullable array`,
    );
  },
  object: field => value => {
    assertField(
      field.name,
      typeof value === 'object',
      `Non-object value ${value}`,
    );
  },
};

function assertInteger(name: string, value: any) {
  assertField(name, Number.isInteger(value), `Non-integer value ${value}`);
}

function assertRange(name: string, value: number, from: number, to: number) {
  assertField(
    name,
    value >= from && value <= to,
    `Out-of-range value ${value}`,
  );
}
