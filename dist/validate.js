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
    if (schema.asSingleton) {
        assert(!Array.isArray(rows), 'First argument of pack() must be an object for singleton payloads.');
    }
    else {
        assert(Array.isArray(rows), 'First argument of pack() must be an array for non-singleton payloads.');
    }
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
function createValidator(field) {
    const validate = Validators[field.type](field);
    return value => {
        if (field.nullable && (value === null || value === undefined))
            return;
        assertField(field.name, value !== null && value !== undefined, 'Unallowed nullish value');
        validate(value);
    };
}
exports.createValidator = createValidator;
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
const Validators = {
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
        assertField(field.name, Number.isFinite(value), `Non-numeric value ${value}`);
    },
    boolean: field => value => {
        assertField(field.name, !!value === value, `Non-boolean value ${value}`);
    },
    string: field => value => {
        assertField(field.name, typeof value === 'string', `Non-string value ${value}`);
    },
    enum: field => value => {
        assertField(field.name, typeof value === 'string', `Non-string value ${value}`);
        assertField(field.name, field.enumOf.includes(value), `Value ${value} not listed in enum options`);
    },
    date: field => value => {
        assertField(field.name, value instanceof Date, `Value ${value} is not a Date object`);
    },
    array: field => value => {
        assertField(field.name, Array.isArray(value), `Value ${value} is not an array`);
        assertField(field.name, field.arrayOf.nullable ||
            value.every((item) => item !== null), `Null value in non-nullable array`);
    },
    object: field => value => {
        assertField(field.name, typeof value === 'object', `Non-object value ${value}`);
    },
};
function assertInteger(name, value) {
    assertField(name, Number.isInteger(value), `Non-integer value ${value}`);
}
function assertRange(name, value, from, to) {
    assertField(name, value >= from && value <= to, `Out-of-range value ${value}`);
}
