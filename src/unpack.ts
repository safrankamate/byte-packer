import { Schema, Field, TypeCodes, DatePrecisions } from './schema';
import { validateSchema, fail } from './validate';

interface SchemaPlus extends Schema {
  nullBytes: number;
}

export function unpack<T = any>(buffer: ArrayBuffer, inSchema?: Schema): T[] {
  const schema: SchemaPlus = {
    ...inSchema,
    nullBytes: inSchema ? countNullables(inSchema.fields) : 0,
  };

  const view = new DataView(buffer);
  let i = 1;
  if (hasSchema(view)) {
    schema.fields = [];
    i += 2;
    i += unpackSchema(view, schema.fields, i);
    schema.nullBytes = countNullables(schema.fields);
  } else if (!inSchema) {
    throw Error(
      'unpack() - The schema parameter can only be omitted for self-describing payloads.',
    );
  } else {
    validateSchema(inSchema);
  }

  const rows: T[] = [];
  while (i < buffer.byteLength) {
    i += unpackRow(schema, view, i, rows);
  }
  return rows;
}

const HIGH_1 = 0b10000000;

function countNullables(fields: Field[]): number {
  return Math.ceil(
    fields.reduce(
      (counter, field) => counter + Number(field.nullable || false),
      0,
    ) / 8,
  );
}

function hasSchema(view: DataView): boolean {
  return !!(view.getUint8(0) & HIGH_1);
}

function unpackSchema(view: DataView, fields: Field[], i0: number): number {
  const fieldCount = view.getUint8(i0);
  let i = i0 + 1;
  for (let c = 0; c < fieldCount; c++) {
    i += unpackField(view, fields, i);
  }
  return i - i0;
}

function unpackField(view: DataView, fields: Field[], i0: number): number {
  const typeByte = view.getUint8(i0);
  const type = TypeCodes[typeByte & 0b00001111];
  if (!type) fail(`Invalid type byte ${typeByte} at index ${i0}`);

  const nullable = !!(typeByte & HIGH_1);
  const [name, nameLength] = unpackString(view, i0 + 1);

  const field: Partial<Field> = { name, type, nullable };

  let i = i0 + 1 + nameLength;
  if (field.type === 'enum') {
    field.enumOf = [];
    const optionCount = view.getUint8(i++);
    if (optionCount === 0)
      fail(`Enum field ${name} in self-describing schema has option count 0.`);

    for (let o = 0; o < optionCount; o++) {
      const [option, optionLength] = unpackString(view, i);
      field.enumOf.push(option);
      i += optionLength;
    }
  } else if (field.type === 'date') {
    field.precision = DatePrecisions[view.getUint8(i++)];
  } else if (field.type === 'array') {
    const drop: Field[] = [];
    i += unpackField(view, drop, i);

    const [valueType] = drop;
    delete valueType.name;
    field.arrayOf = { ...valueType };
  } else if (field.type === 'object') {
    const subs: Field[] = [];
    i += unpackSchema(view, subs, i);
    field.fields = subs;
  }

  fields.push(field as Field);
  return i - i0;
}

function unpackRow<T = any>(
  schema: SchemaPlus,
  view: DataView,
  i: number,
  rows: T[],
): number {
  const { fields, nullBytes } = schema;

  const row: Partial<T> = {};
  let bytes = nullBytes;
  let nullables = 0;
  for (const field of fields) {
    if (field.nullable && isNull(view, i, nullBytes, nullables++)) {
      row[field.name] = null;
    } else {
      const [value, length] = unpackValue(field, view, i + bytes);
      row[field.name] = value;
      bytes += length;
    }
  }
  rows.push(row as T);

  return bytes;
}

function isNull(
  view: DataView,
  rowStart: number,
  nullBytes: number,
  nullable: number,
): boolean {
  const byteIndex = Math.trunc((nullBytes * 8 - nullable - 1) / 8);
  const bitIndex = nullable % 8;
  return !!(view.getUint8(rowStart + byteIndex) & (1 << bitIndex));
}

function unpackValue(field: Field, view: DataView, i: number): [any, number] {
  switch (field.type) {
    case 'int8':
      return [view.getInt8(i), 1];
    case 'int16':
      return [view.getInt16(i), 2];
    case 'int32':
      return [view.getInt32(i), 4];
    case 'uint8':
      return [view.getUint8(i), 1];
    case 'uint16':
      return [view.getUint16(i), 2];
    case 'uint32':
      return [view.getUint32(i), 4];
    case 'float':
      return [view.getFloat32(i), 4];
    case 'boolean':
      return [!!view.getInt8(i), 1];
    case 'enum':
      return [field.enumOf[view.getInt8(i)], 1];
    case 'string':
      return unpackString(view, i);
    case 'varint':
      const drop = [];
      const bytes = unpackVarInt(view, i, drop);
      return [drop[0], bytes];
    case 'date':
      return unpackDate(view, i, DatePrecisions.indexOf(field.precision));
    case 'array':
      return unpackArray(view, i, field);
    case 'object':
      return unpackObject(view, i, field.fields);
  }
}

function unpackString(view: DataView, i0: number): [string, number] {
  const codes = [];
  let i = i0;
  while (view.getUint8(i) !== 0) {
    i += unpackVarInt(view, i, codes);
    if (i === i0) break;
  }

  return [String.fromCharCode(...codes), i - i0 + 1];
}

function unpackVarInt(view: DataView, i: number, codes: number[]): number {
  let value = 0;
  let bytes = 0;

  let first = view.getUint8(i);
  while (first & HIGH_1) {
    bytes++;
    first = first << 1;
  }
  value = (first & 0xff) >>> bytes;

  for (let b = 1; b < bytes; b++) {
    const byte = view.getUint8(i + b);
    if ((byte & 0b11000000) !== HIGH_1)
      fail(`Byte at index ${i + b} is not part of a valid UTF-8 sequence.`);

    value = (value << 6) | (byte & 0b00111111);
  }

  codes.push(value);
  return Math.max(1, bytes);
}

function unpackDate(
  view: DataView,
  i0: number,
  precIndex: number,
): [Date, number] {
  const value = new Date();
  value.setUTCHours(0);
  value.setUTCMinutes(0);
  value.setUTCSeconds(0);
  value.setUTCMilliseconds(0);

  let bytes = 4;
  value.setUTCFullYear(view.getInt16(i0));
  value.setUTCMonth(view.getInt8(i0 + 2));
  value.setUTCDate(view.getInt8(i0 + 3));

  if (precIndex > 1) {
    bytes += 2;
    value.setUTCHours(view.getInt8(i0 + 4));
    value.setUTCMinutes(view.getInt8(i0 + 5));
  }
  if (precIndex > 2) {
    bytes += 1;
    value.setUTCSeconds(view.getInt8(i0 + 6));
  }
  if (precIndex > 3) {
    bytes += 2;
    value.setUTCMilliseconds(view.getInt16(i0 + 7));
  }
  return [value, bytes];
}

function unpackArray(
  view: DataView,
  i0: number,
  { arrayOf }: any,
): [any[], number] {
  let i = i0;

  const drop = [];
  i += unpackVarInt(view, i0, drop);
  const [length] = drop;

  const nullBytes = Math.ceil(length / 8);
  const nullOffset = i;
  const values = [];
  if (arrayOf.nullable) {
    i += nullBytes;
  }

  for (let j = 0; j < length; j++) {
    const nullByte = Math.trunc(j / 8);
    const nullBit = j % 8;
    const isNull =
      arrayOf.nullable &&
      (view.getUint8(nullOffset + nullBytes - 1 - nullByte) >>> nullBit) & 1;

    if (isNull) {
      values.push(null);
    } else {
      const [value, valueBytes] = unpackValue(arrayOf, view, i);
      values.push(value);
      i += valueBytes;
    }
  }

  return [values, i - i0];
}

function unpackObject(
  view: DataView,
  i0: number,
  fields: Field[],
): [any, number] {
  let i = i0;
  const drop = [];
  const schema: SchemaPlus = {
    fields,
    nullBytes: countNullables(fields),
  };
  i += unpackRow(schema, view, i, drop);
  return [drop[0], i - i0];
}
