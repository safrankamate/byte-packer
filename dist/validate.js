"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("./schema");
function fail(message) {
    throw Error(`byte-packer: ${message}`);
}
const FieldTypes = new Set(Object.values(schema_1.Types));
function validatePack(rows, schema) {
    if (!Array.isArray(rows)) {
        fail('First argument of pack() must be an array.');
    }
    if (schema) {
        validateSchema(schema);
    }
}
exports.validatePack = validatePack;
function validateSchema(schema) {
    if (!Array.isArray(schema.fields))
        fail('Schema must contain field specs.');
    const names = new Set();
    for (const field of schema.fields) {
        const error = rejectField(field, names);
        if (error)
            fail(error);
        names.add(field.name);
    }
}
exports.validateSchema = validateSchema;
function validateValue(value, field) {
    const error = field.nullable
        ? value !== null && value !== undefined && rejectValue(value, field)
        : rejectNull(value, field) || rejectValue(value, field);
    if (error)
        fail(`${error} in field ${field.name}`);
}
exports.validateValue = validateValue;
const rejectField = ({ name, type, ...field }, names) => (!name && 'Fields must have a name property.') ||
    (!type && `Field ${name} has no type specified.`) ||
    (names.has(name) && `Duplicate field name in schema: ${name}`) ||
    (!FieldTypes.has(type) && `Field ${name} has invalid type ${type}`) ||
    (type === 'enum' && rejectEnum(name, field.enumOf));
const rejectEnum = (name, enumOf) => (!Array.isArray(enumOf) &&
    `Field ${name} has enum type but no enumOf property`) ||
    (enumOf.length === 1 && `Field ${name} has empty array for enumOf`) ||
    (enumOf.some(option => typeof option !== 'string') &&
        `Field ${name} contains invalid enum options`) ||
    (new Set(enumOf).size !== enumOf.length &&
        `Field ${name} must contain unique enum options.`);
// Input validation
const rejectNull = (value, { nullable }) => !nullable &&
    (value === null || value === undefined) &&
    'Unallowed nullish value';
const rejectValue = (value, { type, nullable, ...field }) => ((type === 'int8' || type === 'int16' || type === 'int32') &&
    !Number.isInteger(value) &&
    `Non-integer value ${value}`) ||
    (type === 'int8' &&
        (value < -128 || value > 127) &&
        `Out-of-range value ${value}`) ||
    (type === 'int16' &&
        (value < -32768 || value > 32767) &&
        `Out-of-range value ${value}`) ||
    (type === 'float' &&
        !Number.isFinite(value) &&
        `Non-numeric value ${value}`) ||
    (type === 'string' &&
        typeof value !== 'string' &&
        `Non-string value ${value}`) ||
    (type === 'enum' &&
        !field.enumOf.includes(value) &&
        `Value ${value} not listed in enum options`);
