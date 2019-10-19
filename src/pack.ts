import { Schema, Field, TypeCodes } from './schema';
import { validatePack, validateValue } from './validate';

interface SchemaPlus extends Schema {
  nullBytes: number;
}

export function pack<T = any>(rows: T[], inSchema: Schema): ArrayBuffer {
  validatePack(rows, inSchema);

  const schema: SchemaPlus = {
    ...inSchema,
    nullBytes: countNullables(inSchema.fields),
  };
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

// Measurement

function measure<T = any>(
  { fields, nullBytes, selfDescribing }: SchemaPlus,
  rows: T[],
): number {
  const headerLength = selfDescribing
    ? 2 + 1 + fields.reduce((total, field) => total + measureField(field), 0)
    : 0;
  const bodyLength = rows.reduce(
    (total, row) => total + nullBytes + measureRow(fields, row),
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
  return (
    1 +
    packString(field.name) +
    (field.type === 'enum' &&
      1 + field.enumOf.reduce((total, value) => total + packString(value), 0))
  );
}

function measureRow(fields: Field[], row: any): number {
  return fields.reduce(
    (total, field) => total + measureValue(field, row[field.name]),
    0,
  );
}

function measureValue(field: Field, value: any): number {
  if (field.nullable && (value === null || value === undefined)) return 0;
  return packValue(field, value);
}

// Packing

const HIGH_1 = 0b10000000;

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
  }
  return i - i0;
}

function packRow(
  { fields, nullBytes }: SchemaPlus,
  row: any,
  view: DataView,
  i0: number,
): number {
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
    i += packValue(field, value, view, i);
  }

  for (let b = nullBytes - 1; b >= 0; b--) {
    view.setUint8(i0 + b, nullFlags & 0xff);
    nullFlags = nullFlags >>> 8;
  }
  return i - i0;
}

function packValue(
  field: Field,
  value: any,
  view?: DataView,
  i?: number,
): number {
  validateValue(value, field);

  if (value === null || value === undefined) {
    return 0;
  }

  switch (field.type) {
    case 'int8':
      view && view.setInt8(i, value);
      return 1;
    case 'int16':
      view && view.setInt16(i, value);
      return 2;
    case 'int32':
      view && view.setInt32(i, value);
      return 4;
    case 'float':
      view && view.setFloat32(i, value);
      return 4;
    case 'boolean':
      view && view.setUint8(i, Number(value));
      return 1;
    case 'enum':
      view && view.setUint8(i, field.enumOf.indexOf(value));
      return 1;
    case 'string':
      return packString(value, view, i);
  }

  return 0;
}

function packString(value: string, view?: DataView, i0?: number): number {
  let bytes = 0;
  for (let c = 0; c < value.length; c++) {
    const i = i0 + bytes;
    const code = value.codePointAt(c);
    if (code < 0x80) {
      bytes += 1;
      if (view) {
        view.setUint8(i, code);
      }
    } else if (code < 0x800) {
      bytes += 2;
      if (view) {
        view.setUint8(i, 0b11000000 & (code >>> 6));
        view.setUint8(i + 1, HIGH_1 & code);
      }
    } else if (code < 0x10000) {
      bytes += 3;
      if (view) {
        view.setUint8(i, 0b11100000 & (code >>> 12));
        view.setUint8(i + 1, HIGH_1 & (code >>> 6));
        view.setUint8(i + 2, HIGH_1 & code);
      }
    } else if (code < 0x11000) {
      bytes += 4;
      if (view) {
        view.setUint8(i, 0b11110000 & (code >>> 18));
        view.setUint8(i + 1, HIGH_1 & (code >>> 12));
        view.setUint8(i + 2, HIGH_1 & (code >>> 6));
        view.setUint8(i + 3, HIGH_1 & code);
      }
    }
  }
  if (view) {
    view.setUint8(i0 + bytes, 0);
  }
  return bytes + 1;
}
