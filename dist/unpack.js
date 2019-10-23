"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("./schema");
const validate_1 = require("./validate");
function unpack(buffer, inSchema) {
    const schema = {
        ...inSchema,
        nullBytes: inSchema ? countNullables(inSchema.fields) : 0,
    };
    const view = new DataView(buffer);
    let i = 1;
    if (hasSchema(view)) {
        schema.fields = [];
        i += unpackSchema(view, schema.fields, i);
        schema.nullBytes = countNullables(schema.fields);
    }
    else if (!inSchema) {
        throw Error('unpack() - The schema parameter can only be omitted for self-describing payloads.');
    }
    else {
        validate_1.validateSchema(inSchema);
    }
    const rows = [];
    while (i < buffer.byteLength) {
        i += unpackRow(schema, view, i, rows);
    }
    return rows;
}
exports.unpack = unpack;
const HIGH_1 = 0b10000000;
function countNullables(fields) {
    return Math.ceil(fields.reduce((counter, field) => counter + Number(field.nullable || false), 0) / 8);
}
function hasSchema(view) {
    return !!(view.getUint8(0) & HIGH_1);
}
function unpackSchema(view, fields, i0) {
    const fieldCount = view.getUint8(i0 + 2);
    let i = i0 + 3;
    for (let c = 0; c < fieldCount; c++) {
        i += unpackField(view, fields, i);
    }
    return i - i0;
}
function unpackField(view, fields, i0) {
    const typeByte = view.getUint8(i0);
    const type = schema_1.TypeCodes[typeByte & 0b00001111];
    if (!type)
        validate_1.fail(`Invalid type byte ${typeByte} as index ${i0}`);
    const nullable = !!(typeByte & HIGH_1);
    const [name, nameLength] = unpackString(view, i0 + 1);
    const field = { name, type, nullable };
    let i = i0 + 1 + nameLength;
    if (field.type === 'enum') {
        field.enumOf = [];
        const optionCount = view.getUint8(i++);
        if (optionCount === 0)
            validate_1.fail(`Enum field ${name} in self-describing schema has option count 0.`);
        for (let o = 0; o < optionCount; o++) {
            const [option, optionLength] = unpackString(view, i);
            field.enumOf.push(option);
            i += optionLength;
        }
    }
    else if (field.type === 'date') {
        field.precision = schema_1.DatePrecisions[view.getUint8(i++)];
    }
    else if (field.type === 'array') {
        const drop = [];
        i += unpackField(view, drop, i);
        const [valueType] = drop;
        delete valueType.name;
        field.arrayOf = { ...valueType };
    }
    fields.push(field);
    return i - i0;
}
function unpackRow(schema, view, i, rows) {
    const { fields, nullBytes } = schema;
    const row = {};
    let bytes = nullBytes;
    let nullables = 0;
    for (const field of fields) {
        if (field.nullable && isNull(view, i, nullBytes, nullables++)) {
            row[field.name] = null;
        }
        else {
            const [value, length] = unpackValue(field, view, i + bytes);
            row[field.name] = value;
            bytes += length;
        }
    }
    rows.push(row);
    return bytes;
}
function isNull(view, rowStart, nullBytes, nullable) {
    const byteIndex = Math.trunc((nullBytes * 8 - nullable - 1) / 8);
    const bitIndex = nullable % 8;
    return !!(view.getUint8(rowStart + byteIndex) & (1 << bitIndex));
}
function unpackValue(field, view, i) {
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
            return unpackDate(view, i, schema_1.DatePrecisions.indexOf(field.precision));
        case 'array':
            return unpackArray(view, i, field);
    }
}
function unpackString(view, i0) {
    const codes = [];
    let i = i0;
    while (view.getUint8(i) !== 0) {
        i += unpackVarInt(view, i, codes);
        if (i === i0)
            break;
    }
    return [String.fromCharCode(...codes), i - i0 + 1];
}
function unpackVarInt(view, i, codes) {
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
            validate_1.fail(`Byte at index ${i + b} is not part of a valid UTF-8 sequence.`);
        value = (value << 6) | (byte & 0b00111111);
    }
    codes.push(value);
    return Math.max(1, bytes);
}
function unpackDate(view, i0, precIndex) {
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
function unpackArray(view, i0, field) {
    let i = i0;
    const drop = [];
    i += unpackVarInt(view, i0, drop);
    const [length] = drop;
    let nullFlags = 0;
    if (field.arrayOf.nullable) {
        const nullBytes = Math.ceil(length / 8);
        for (let j = 0; j < nullBytes; j++) {
            nullFlags = (nullFlags << 8) | view.getUint8(i + j);
        }
        i += nullBytes;
    }
    const values = [];
    for (let j = 0; j < length; j++) {
        if (nullFlags & 1) {
            values.push(null);
        }
        else {
            const [value, valueBytes] = unpackValue(field.arrayOf, view, i);
            values.push(value);
            i += valueBytes;
        }
        nullFlags = nullFlags >>> 1;
    }
    return [values, i - i0];
}
