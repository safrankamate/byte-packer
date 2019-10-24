import { Schema, Types, Field } from './schema';

export function fail(message: string): never {
  throw Error(`byte-packer: ${message}`);
}

const FieldTypes = new Set<string>(Object.values(Types));

export function validatePack(rows: any[], schema: Schema) {
  if (!Array.isArray(rows)) {
    fail('First argument of pack() must be an array.');
  }
  if (schema) {
    validateSchema(schema);
  }
}

export function validateSchema(schema: Schema) {
  if (!Array.isArray(schema.fields)) fail('Schema must contain field specs.');

  const names = new Set<string>();
  for (const field of schema.fields) {
    const error = rejectField(field, names);
    if (error) fail(error);
    names.add(field.name);
  }
}

export function validateValue(value: any, field: Field) {
  const error = field.nullable
    ? value !== null && value !== undefined && rejectValue(value, field)
    : rejectNull(value, field) || rejectValue(value, field);
  if (error) fail(`${error} in field ${field.name}`);
}

// Schema validation

type EnumDetails = { enumOf: string[] };
type ArrayDetails = { arrayOf: any };

const rejectField = ({ name, type, ...field }: Field, names: Set<string>) =>
  (!name && 'Fields must have a name property.') ||
  (!type && `Field ${name} has no type specified.`) ||
  (names.has(name) && `Duplicate field name in schema: ${name}`) ||
  (!FieldTypes.has(type) && `Field ${name} has invalid type ${type}`) ||
  (type === 'enum' && rejectEnum(name, (field as EnumDetails).enumOf)) ||
  (type === 'array' && rejectArray(name, (field as ArrayDetails).arrayOf));

const rejectEnum = (name: string, enumOf: string[]) =>
  (!Array.isArray(enumOf) &&
    `Field ${name} has enum type but no enumOf property`) ||
  (enumOf.length === 1 && `Field ${name} has empty array for enumOf`) ||
  (enumOf.some(option => typeof option !== 'string') &&
    `Field ${name} contains invalid enum options`) ||
  (new Set(enumOf).size !== enumOf.length &&
    `Field ${name} must contain unique enum options.`);

const rejectArray = (name: string, arrayOf: any) =>
  (typeof arrayOf !== 'object' &&
    `Field ${name} must have a valid arrayOf property`) ||
  rejectField({ name: `${name}'s type definition`, ...arrayOf }, new Set());

// Input validation

const rejectNull = (value: any, { nullable }: Field) =>
  !nullable &&
  (value === null || value === undefined) &&
  'Unallowed nullish value';

const IntegerTypes = new Set([
  'int8',
  'int16',
  'int32',
  'uint8',
  'uin16',
  'uint32',
  'varint',
]);

const rejectValue = (value: any, { type, nullable, ...field }: Field) =>
  (IntegerTypes.has(type) &&
    !Number.isInteger(value) &&
    `Non-integer value ${value}`) ||
  (type === 'int8' &&
    (value < -128 || value > 127) &&
    `Out-of-range value ${value}`) ||
  (type === 'int16' &&
    (value < -32768 || value > 32767) &&
    `Out-of-range value ${value}`) ||
  (type === 'uint8' &&
    (value < 0 || value > 255) &&
    `Out-of-range value ${value}`) ||
  (type === 'uint16' &&
    (value < 0 || value > 65535) &&
    `Out-of-range value ${value}`) ||
  (type === 'varint' &&
    (value < 0 || value > 0x10ffff) &&
    `Out-of-range value ${value}`) ||
  (type === 'float' &&
    !Number.isFinite(value) &&
    `Non-numeric value ${value}`) ||
  (type === 'string' &&
    typeof value !== 'string' &&
    `Non-string value ${value}`) ||
  (type === 'enum' &&
    !(field as EnumDetails).enumOf.includes(value) &&
    `Value ${value} not listed in enum options`) ||
  (type === 'date' &&
    !(value instanceof Date) &&
    `Value ${value} is not a Date object`) ||
  (type === 'array' &&
    !Array.isArray(value) &&
    `Value ${value} is not an array`);
