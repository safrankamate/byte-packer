"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("./schema");
function assert(condition, message) {
    if (!condition)
        throw Error(`byte-packer: ${message}`);
    return true;
}
exports.assert = assert;
function assertField(name, condition, message) {
    return assert(condition, `${message} in field ${name}`);
}
const FieldTypes = new Set(Object.values(schema_1.Types));
function validatePack(rows, schema) {
    assert(Array.isArray(rows), 'First argument of pack() must be an array.');
    if (schema) {
        validateSchema(schema);
    }
    return true;
}
exports.validatePack = validatePack;
function validateSchema(schema) {
    assert(Array.isArray(schema.fields), 'Schema must contain field specs.');
    const names = new Set();
    for (const field of schema.fields) {
        validateField(field, names);
        names.add(field.name);
    }
    return true;
}
exports.validateSchema = validateSchema;
function validateValue(value, field) {
    if (field.nullable && (value === null || value === undefined))
        return;
    assertField(field.name, value !== null && value !== undefined, 'Unallowed nullish value');
    validateValueType(value, field);
}
exports.validateValue = validateValue;
function validateField({ name, type, ...field }, names) {
    assert(!!name, 'Fields must have a name property.');
    assert(!!type, `Field ${name} has no type specified.`);
    assert(!names.has(name), `Duplicate field name in schema: ${name}`);
    assert(FieldTypes.has(type), `Field ${name} has invalid type ${type}`);
    if (type === 'enum')
        validateEnumField(name, field.enumOf);
    if (type === 'array')
        validateArrayField(name, field.arrayOf);
    if (type === 'object')
        validateSchema(field);
}
function validateEnumField(name, enumOf) {
    assert(Array.isArray(enumOf), `Field ${name} has enum type but no enumOf property`);
    assert(enumOf.length > 0, `Field ${name} has empty array for enumOf`);
    assert(enumOf.every(option => typeof option === 'string'), `Field ${name} contains invalid enum options`);
    assert(new Set(enumOf).size === enumOf.length, `Field ${name} must contain unique enum options.`);
}
function validateArrayField(name, arrayOf) {
    assert(typeof arrayOf === 'object', `Field ${name} must have a valid arrayOf property`);
    validateField({ name: `${name}'s type definition`, ...arrayOf }, new Set());
}
// Input validation
const IntegerTypes = new Set([
    'int8',
    'int16',
    'int32',
    'uint8',
    'uin16',
    'uint32',
    'varint',
]);
function validateValueType(value, { name, type, ...field }) {
    if (IntegerTypes.has(type)) {
        assertField(name, Number.isInteger(value), `Non-integer value ${value}`);
        assertField(name, (type === 'int8' && value >= -0x80 && value <= 0x7f) ||
            (type === 'uint8' && value >= 0 && value <= 0xff) ||
            (type === 'int16' && value >= -0x8000 && value <= 0x7fff) ||
            (type === 'uint16' && value >= 0 && value <= 0xffff) ||
            (type === 'int32' && value >= -0x80000000 && value <= 0x7fffffff) ||
            (type === 'uint32' && value >= 0 && value <= 0xffffffff) ||
            (type === 'varint' && value >= 0 && value <= 0x10ffff), `Out-of-range value ${value}`);
        return;
    }
    if (type === 'float') {
        assertField(name, Number.isFinite(value), `Non-numeric value ${value}`);
    }
    if (type === 'string') {
        assertField(name, typeof value === 'string', `Non-string value ${value}`);
    }
    if (type === 'enum') {
        assertField(name, typeof value === 'string', `Non-string value ${value}`);
        assertField(name, field.enumOf.includes(value), `Value ${value} not listed in enum options`);
    }
    if (type === 'date') {
        assertField(name, value instanceof Date, `Value ${value} is not a Date object`);
    }
    if (type === 'array') {
        assertField(name, Array.isArray(value), `Value ${value} is not an array`);
        assertField(name, field.arrayOf.nullable ||
            value.every((item) => item !== null), `Null value in non-nullable array`);
    }
}
