import { Schema, Field, TypeCodes, DatePrecisions, TypeName } from './schema';
import { validatePack, validateValue } from './validate';

type Validator = (value: any) => void;
type Packer = (value: any, view?: DataView, i?: number) => number;
type PackerFactory = (field: Field) => Packer;

interface PackingSchema extends Schema {
  nullBytes: number;
  validators: Record<string, Validator>;
  packers: Record<string, Packer>;
}

export function pack<T = any>(rows: T[], inSchema: Schema): ArrayBuffer {
  validatePack(rows, inSchema);

  const schema = createPackingSchema(inSchema);
  const length = measure(schema, rows);

  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  let i = 1;
  if (schema.selfDescribing) {
    i += packSchema(schema.fields, view, i);
  }
  for (const row of rows) {
    i += packRow(schema, row, view, i);
  }
  return buffer;
}

// Preparation

function createPackingSchema(inSchema: Schema): PackingSchema {
  const nullBytes = countNullables(inSchema.fields);
  const validators = {};
  const packers = {};
  for (const field of inSchema.fields) {
    packers[field.name] = createPacker(field);
    validators[field.name] = createValidator(field);
  }

  return {
    ...inSchema,
    nullBytes,
    validators,
    packers,
  };
}

function createPacker(field: Field): Packer {
  const packer = Packers[field.type](field);
  return (value, view, i) => {
    if (value === null || value === undefined) return 0;
    return packer(value, view, i);
  };
}

function createValidator(field: Field): Validator {
  return value => {
    validateValue(value, field);
  };
}

// Measurement

function measure<T = any>(schema: PackingSchema, rows: T[]): number {
  const { fields, selfDescribing } = schema;
  const headerLength = selfDescribing
    ? 2 + 1 + fields.reduce((total, field) => total + measureField(field), 0)
    : 0;
  const bodyLength = rows.reduce(
    (total, row) => total + measureRow(schema, row),
    0,
  );

  return 1 + headerLength + bodyLength;
}

function countNullables(fields: Field[]): number {
  return Math.ceil(
    fields.reduce(
      (counter, field) => counter + Number(field.nullable || false),
      0,
    ) / 8,
  );
}

function measureField(field: Field): number {
  let bytes = 1 + packString(field.name);

  if (field.type === 'enum') {
    bytes +=
      1 + field.enumOf.reduce((total, value) => total + packString(value), 0);
  } else if (field.type === 'date') {
    bytes += 1;
  } else if (field.type === 'array') {
    bytes += measureField({ ...field.arrayOf, name: '' });
  } else if (field.type === 'object') {
    bytes +=
      1 + field.fields.reduce((total, sub) => total + measureField(sub), 0);
  }
  return bytes;
}

function measureRow(inSchema: PackingSchema, row: any): number {
  const { nullBytes, fields, validators, packers } = inSchema;
  let bytes = nullBytes;

  for (let field of fields) {
    const value = row[field.name];
    validators[field.name](value);
    bytes += packers[field.name](value);
  }

  return bytes;
}

// Packing - Header

const HIGH_1 = 0b10000000;
const LOW_BITS = 0b00111111;

function packSchema(fields: Field[], view: DataView, i0: number): number {
  view.setUint8(0, view.getUint8(0) | HIGH_1);
  view.setUint8(i0 + 2, fields.length);

  let i = i0 + 3;
  for (const field of fields) {
    i += packField(field, view, i);
  }

  const headerLength = i - i0;
  view.setUint16(i0, headerLength);
  return headerLength;
}

function packField(field: Field, view: DataView, i0: number): number {
  view.setUint8(
    i0,
    (field.nullable ? HIGH_1 : 0) | TypeCodes.indexOf(field.type),
  );

  let i = i0 + 1;
  i += packString(field.name, view, i);

  if (field.type === 'enum') {
    view.setUint8(i, field.enumOf.length);

    i++;
    for (const value of field.enumOf) {
      i += packString(value, view, i);
    }
  } else if (field.type === 'date') {
    view.setUint8(i, DatePrecisions.indexOf(field.precision));
    i++;
  } else if (field.type === 'array') {
    i += packField({ ...field.arrayOf, name: '' }, view, i);
  } else if (field.type === 'object') {
    view.setUint8(i, field.fields.length);
    i++;
    for (const sub of field.fields) {
      i += packField(sub, view, i);
    }
  }
  return i - i0;
}

// Packing - rows and values

function packRow(
  { fields, nullBytes, packers }: PackingSchema,
  row: any,
  view?: DataView,
  i0?: number,
): number {
  i0 = i0 || 0;
  let i = i0 + nullBytes;

  let nullables = 0;
  let nullFlags = 0;
  for (let field of fields) {
    const value = row[field.name];

    if (field.nullable) {
      if (value === null || value === undefined) {
        nullFlags |= 1 << nullables;
      }
      nullables++;
    }
    i += packers[field.name](value, view, i);
  }

  if (view) {
    for (let b = nullBytes - 1; b >= 0; b--) {
      view.setUint8(i0 + b, nullFlags & 0xff);
      nullFlags = nullFlags >>> 8;
    }
  }

  return i - i0;
}

const Packers: Record<TypeName, PackerFactory> = {
  // Primitives

  int8: () => (value, view, i) => {
    view && view.setInt8(i, value);
    return 1;
  },
  int16: () => (value, view, i) => {
    view && view.setInt16(i, value);
    return 2;
  },
  int32: () => (value, view, i) => {
    view && view.setInt32(i, value);
    return 4;
  },
  uint8: () => (value, view, i) => {
    view && view.setUint8(i, value);
    return 1;
  },
  uint16: () => (value, view, i) => {
    view && view.setUint16(i, value);
    return 2;
  },
  uint32: () => (value, view, i) => {
    view && view.setUint32(i, value);
    return 4;
  },
  boolean: () => (value, view, i) => {
    view && view.setInt8(i, Number(!!value));
    return 1;
  },
  float: () => (value, view, i) => {
    view && view.setFloat32(i, value);
    return 4;
  },
  varint: () => (value, view, i) => {
    return packVarInt(value, view, i);
  },
  string: () => (value, view, i) => {
    return packString(value, view, i);
  },

  // Complex types

  enum: field => {
    const { enumOf } = field as any;
    return (value, view, i) => {
      view && view.setUint8(i, enumOf.indexOf(value));
      return 1;
    };
  },

  date: field => {
    const precIndex = DatePrecisions.indexOf((field as any).precision);
    return (value, view, i) => packDate(value, precIndex, view, i);
  },

  array: field => {
    const { arrayOf } = field as any;
    const packer = createPacker(arrayOf);
    return (value, view, i) =>
      packArray(value, arrayOf.nullable, packer, view, i);
  },

  object: field => {
    const { fields } = field as any;
    const subSchema = createPackingSchema({ fields });
    return (value, view, i) => packRow(subSchema, value, view, i);
  },
};

function packString(value: string, view?: DataView, i0?: number): number {
  let bytes = 0;
  for (let c = 0; c < value.length; c++) {
    const i = i0 + bytes;
    const code = value.codePointAt(c);
    bytes += packVarInt(code, view, i);
  }
  if (view) {
    view.setUint8(i0 + bytes, 0);
  }
  return bytes + 1;
}

function packVarInt(value: number, view: DataView, i: number): number {
  if (value < 0x80) {
    if (view) {
      view.setUint8(i, value);
    }
    return 1;
  } else if (value < 0x800) {
    if (view) {
      view.setUint8(i, 0b11000000 | (value >>> 6));
      view.setUint8(i + 1, HIGH_1 | (value & LOW_BITS));
    }
    return 2;
  } else if (value < 0x10000) {
    if (view) {
      view.setUint8(i, 0b11100000 | (value >>> 12));
      view.setUint8(i + 1, HIGH_1 | ((value >>> 6) & LOW_BITS));
      view.setUint8(i + 2, HIGH_1 | (value & LOW_BITS));
    }
    return 3;
  } else if (value < 0x10ffff) {
    if (view) {
      view.setUint8(i, 0b11110000 | (value >>> 18));
      view.setUint8(i + 1, HIGH_1 | ((value >>> 12) & LOW_BITS));
      view.setUint8(i + 2, HIGH_1 | ((value >>> 6) & LOW_BITS));
      view.setUint8(i + 3, HIGH_1 | (value & LOW_BITS));
    }
    return 4;
  }
}

function packDate(
  value: Date,
  precIndex: number,
  view?: DataView,
  i0?: number,
): number {
  let bytes = 4;
  if (view) {
    view.setUint16(i0, value.getUTCFullYear());
    view.setUint8(i0 + 2, value.getUTCMonth());
    view.setUint8(i0 + 3, value.getUTCDate());
  }

  if (precIndex > 1) {
    bytes += 2;
    if (view) {
      view.setUint8(i0 + 4, value.getUTCHours());
      view.setUint8(i0 + 5, value.getUTCMinutes());
    }
  }
  if (precIndex > 2) {
    bytes += 1;
    if (view) {
      view.setUint8(i0 + 6, value.getUTCSeconds());
    }
  }
  if (precIndex > 3) {
    bytes += 2;
    if (view) {
      view.setUint16(i0 + 7, value.getUTCMilliseconds());
    }
  }
  return bytes;
}

function packArray(
  values: any[],
  nullable: boolean,
  packItem: Packer,
  view?: DataView,
  i0?: number,
) {
  i0 = i0 || 0;
  let i = i0;
  i += packVarInt(values.length, view, i0);

  const nullOffset = i;
  const nullBytes = Math.ceil(values.length / 8);
  if (nullable) {
    i += nullBytes;
  }

  for (let j = 0; j < values.length; j++) {
    const value = values[j];
    if (view && (value === null || value === undefined)) {
      const nullByte = nullOffset + nullBytes - 1 - Math.trunc(j / 8);
      const nullBit = j % 8;
      const nullFlags = view.getUint8(nullByte);
      view.setUint8(nullByte, nullFlags | (1 << nullBit));
    } else {
      i += packItem(value, view, i);
    }
  }

  return i - i0;
}
