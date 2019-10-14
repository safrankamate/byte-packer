"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const CodeTypes = [
    undefined,
    'int8',
    'int16',
    'int32',
    'float',
    'boolean',
    'string',
    'enum',
];
function unpackField(view, fields, i0) {
    const typeByte = view.getUint8(i0);
    const type = CodeTypes[typeByte & 0b00001111];
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
        case 'float':
            return [view.getFloat32(i), 4];
        case 'boolean':
            return [!!view.getInt8(i), 1];
        case 'enum':
            return [field.enumOf[view.getInt8(i)], 1];
        case 'string':
            return unpackString(view, i);
    }
}
function unpackString(view, i0) {
    const codes = [];
    let i = i0;
    while (view.getUint8(i) !== 0) {
        i += unpackChar(view, i, codes);
        if (i === i0)
            break;
    }
    return [String.fromCharCode(...codes), i - i0 + 1];
}
function unpackChar(view, i, codes) {
    let code = 0;
    let bytes = 0;
    let first = view.getUint8(i);
    while (first & HIGH_1) {
        bytes++;
        first = first << 1;
    }
    code = first >>> bytes;
    for (let b = 1; b < bytes; b++) {
        const byte = view.getUint8(i + b);
        if ((byte & 0b11000000) !== HIGH_1)
            validate_1.fail(`Byte at index ${i + b} is not part of a valid UTF-8 character.`);
        code = (code << 6) | (byte & 0b00111111);
    }
    codes.push(code);
    return Math.max(1, bytes);
}
