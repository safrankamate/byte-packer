import { Schema, Field, TypeCodes, DatePrecisions, TypeName } from './schema';
import { validateSchema, assert } from './validate';

type Unpacker = (view: DataView, i: number) => [any, number];
type UnpackerFactory = (field: Field) => Unpacker;

interface UnpackingSchema extends Schema {
  nullBytes: number;
  unpackers: Record<string, Unpacker>;
}

export function unpack<T = any>(buffer: ArrayBuffer, inSchema?: Schema): T[] {
  const view = new DataView(buffer);
  let i = 1;
  if (hasSchema(view)) {
    inSchema = { fields: [] };
    i += 2;
    i += unpackSchema(view, inSchema.fields, i);
  } else if (!inSchema) {
    throw Error(
      'unpack() - The schema parameter can only be omitted for self-describing payloads.',
    );
  } else {
    validateSchema(inSchema);
  }

  const schema = createUnpackingSchema(inSchema);
  const rows: T[] = [];
  while (i < buffer.byteLength) {
    i += unpackRow(schema, view, i, rows);
  }
  return rows;
}

const schemaCache = new WeakMap<Schema, UnpackingSchema>();

function createUnpackingSchema(inSchema: Schema): UnpackingSchema {
  if (!schemaCache.has(inSchema)) {
    const nullBytes = inSchema ? countNullables(inSchema.fields) : 0;
    const unpackers = {};
    for (const field of inSchema.fields) {
      unpackers[field.name] = Unpackers[field.type](field);
    }

    schemaCache.set(inSchema, {
      ...inSchema,
      nullBytes,
      unpackers,
    });
  }
  return schemaCache.get(inSchema);
}

function createUnpacker(field: Field): Unpacker {
  const unpack = Unpackers[field.type](field);
  return (view, i) => unpack(view, i);
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

// Schema unpacking

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
  assert(!!type, `Invalid type byte ${typeByte} at index ${i0}`);

  const nullable = !!(typeByte & HIGH_1);
  const [name, nameLength] = unpackString(view, i0 + 1);

  const field: Partial<Field> = { name, type, nullable };

  let i = i0 + 1 + nameLength;
  if (field.type === 'enum') {
    field.enumOf = [];
    const optionCount = view.getUint8(i++);
    assert(
      optionCount > 0,
      `Enum field ${name} in self-describing schema has option count 0.`,
    );

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

// Input unpacking

function unpackRow<T = any>(
  schema: UnpackingSchema,
  view: DataView,
  i: number,
  rows: T[],
): number {
  const { fields, nullBytes, unpackers } = schema;

  const row: Partial<T> = {};
  let bytes = nullBytes;
  let nullables = 0;
  for (const field of fields) {
    if (field.nullable && isNull(view, i, nullBytes, nullables++)) {
      row[field.name] = null;
    } else {
      const [value, length] = unpackers[field.name](view, i + bytes);
      row[field.name] = value;
      bytes += length;
    }
  }
  rows.push(row as T);

  return bytes;
}

const Unpackers: Record<TypeName, UnpackerFactory> = {
  int8: () => (view, i) => [view.getInt8(i), 1],
  int16: () => (view, i) => [view.getInt16(i), 2],
  int32: () => (view, i) => [view.getInt32(i), 4],
  uint8: () => (view, i) => [view.getUint8(i), 1],
  uint16: () => (view, i) => [view.getUint16(i), 2],
  uint32: () => (view, i) => [view.getUint32(i), 4],
  float: () => (view, i) => [view.getFloat32(i), 4],
  boolean: () => (view, i) => [!!view.getUint8(i), 1],
  string: () => (view, i) => unpackString(view, i),

  varint: () => (view, i) => {
    const drop = [];
    const bytes = unpackVarInt(view, i, drop);
    return [drop[0], bytes];
  },
  enum: field => {
    const { enumOf } = field as any;
    return (view, i) => [enumOf[view.getUint8(i)], 1];
  },
  date: field => {
    const precIndex = DatePrecisions.indexOf((field as any).precision);
    return (view, i) => unpackDate(view, i, precIndex);
  },
  array: field => {
    const { arrayOf } = field as any;
    const unpackItem = createUnpacker(arrayOf);
    return (view, i) => unpackArray(view, i, arrayOf.nullable, unpackItem);
  },
  object: field => {
    const { fields } = field as any;
    const subSchema = createUnpackingSchema({ fields });
    return (view, i0) => {
      const drop = [];
      let i = i0;
      i += unpackRow(subSchema, view, i, drop);
      return [drop[0], i - i0];
    };
  },
};

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
    assert(
      (byte & 0b11000000) === HIGH_1,
      `Byte at index ${i + b} is not part of a valid UTF-8 sequence.`,
    );

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
  nullable: boolean,
  unpack: Unpacker,
): [any[], number] {
  let i = i0;

  const drop = [];
  i += unpackVarInt(view, i0, drop);
  const [length] = drop;

  const nullBytes = Math.ceil(length / 8);
  const nullOffset = i;
  const values = [];
  if (nullable) {
    i += nullBytes;
  }

  for (let j = 0; j < length; j++) {
    const nullByte = Math.trunc(j / 8);
    const nullBit = j % 8;
    const isNull =
      nullable &&
      (view.getUint8(nullOffset + nullBytes - 1 - nullByte) >>> nullBit) & 1;

    if (isNull) {
      values.push(null);
    } else {
      const [value, valueBytes] = unpack(view, i);
      values.push(value);
      i += valueBytes;
    }
  }

  return [values, i - i0];
}
