1. [Usage](#usage)
2. [Additional Features](#additional-features)
3. [API Reference](#api-reference)
4. [Payload Format Reference](#payload-format-reference)
5. [To-do's and Roadmap](#to-dos-and-roadmap)

**BytePacker** is a library designed to lessen network load by "packing" an array of objects with similar fields into a binary format that only contains raw values. The binary can then be "unpacked" on the receiving side to produce the same objects.

Suppose you have an API that allows users to search a database of person records. Your endpoint might return an array of objects like this:

```
{
  "id": 123456789,
  "firstName": "John",
  "lastName": "Doe",
  "sex": "male",
}
```

Transferring a large array of such objects in a JSON format entails a significant overhead, as the field names have to be included in every one of them. The `id` field could be represented as a 32-bit integer, but instead it has to be converted to a string, which greatly increases its length. Finally, there are all sorts of separators, such as `{}`, `"`, `:` and `,`, which may also add up if there's a lot of them.

BytePacker was created to solve these problems. To be clear, it does need to be used on both the sending and the receiving end, so it can't help you with third party API's. If your backend is not written in JavaScript, you can write your own implementation based on the [Payload Format Reference](#payload-format-reference) below.

# Usage

## 1. Define the schema

First, you need to specify the names and types of the fields that each object will have. You will probably want to do this as a constant that you can access from anywhere in your code:

```typescript
import { Schema } from 'byte-packer';

export const PersonSchema: Schema = {
  fields: [
    {
      name: 'id',
      type: 'int32',
    },
    {
      name: 'firstName',
      type: 'string',
    },
    {
      name: 'lastName',
      type: 'string',
    },
    {
      name: 'sex',
      type: 'enum',
      enumOf: ['male', 'female', 'undisclosed'],
    },
  ],
};
```

## 2. Pack the objects

On the sender side, call `pack()` with the array of objects as the first argument, and the schema as the second:

```typescript
import { pack } from 'byte-packer';
import { PersonSchema } from './PersonSchema';

const persons = [
  {
    id: 123456789,
    firstName: 'John',
    lastName: 'Doe',
    sex: 'male',
  },
  {
    id: 223456789,
    firstName: 'Jane',
    lastName: 'Doe',
    sex: 'female',
  },
  // ...etc
];

const payload = pack(persons, schema);
```

The `pack()` function returns an `ArrayBuffer`, which you can then send over the network.

For the sake of reference: if you sent the above array of two objects in minified JSON, it would have a payload size of **144 bytes**. Processed with BytePacker, this drops to **29 bytes** (80% decrease in size).

_Note: If any objects contain fields that are not listed in the schema, those fields will be silently ignored._

## 3. Unpack the buffer

On the receiving side, simply call `unpack()` with the received buffer as the first argument, and the schema as the second:

```typescript
import { unpack } from 'byte-packer';
import { PersonSchema } from './PersonSchema';

// ...somehow receive the payload

const persons = unpack(payload, schema);
```

The resulting array will contain the same objects, in the same order, as they were sent.

# Additional Features

## Nullable fields

By default, BytePacker expects all objects to have all the same fields. If this is not always true in your use case, you can specify any number of the fields as `nullable`:

```typescript
export const PersonSchema = {
  fields: [
    {
      name: 'firstName',
      type: 'string',
    },
    {
      name: 'lastName',
      type: 'string',
      nullable: true,
    },
  ],
};

const people = [
  { firstName: 'John', lastName: 'Doe' },
  { firstName: 'Sting' },
  { firstName: 'X', lastName: null },
];
```

Nullable fields can have `null` as their value, or completely omitted from the packed objects. On the receiving side, they will always be unpacked with `null` as their value.

_Note: Defining nullable fields will slightly increase the size of the payload; specifically, by 1 byte per object for every 8 nullable fields._

## Self-describing payload

By default, `unpack()` needs the schema as its second argument to unpack the objects. However, it is possible to create a self-describing payload by setting the `selfDescribing` property of the schema to `true`:

```typescript
import { Schema, pack } from 'byte-packer';

const coordinates = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 6 },
  { x: 0, y: 6 },
];

const payload = pack(coordinates, {
  selfDescribing: true,
  fields: [{ name: 'x', type: 'int8' }, { name: 'y', type: 'int8' }],
});
```

The resulting payload will now contain a header chunk that completely describes the fields of the schema. Such a payload can be unpacked without passing a schema:

```typescript
import { unpack } from 'byte-packer';

// ...somehow receive the payload

const coordinates = unpack(payload);
```

_Note: If `unpack()` is called with a self-describing payload **and** a schema object, it will use the schema that is included in the payload, and ignore the argument. The `selfDescribing` flag has no effect when unpacking._

# API Reference

- [interface Schema](#interface-schema)
- [type Field](#type-field)
- [function pack()](#function-pack)
- [function unpack()](#function-unpack)

## **`interface Schema`**

```typescript
interface Schema {
  fields: Field[];
  selfDescribing?: boolean;
}
```

Describes a schema used for packing and unpacking arrays of objects. BytePacker will only extract fields that are listed in the `fields` array of the schema; any other fields of the objects will be ignored.

## **`type Field`**

```typescript
type Field = {
  name: string;
  nullable?: boolean;
} & (SimpleType | EnumType);

type SimpleType = {
  type: 'int8' | 'int16' | 'int32' | 'float' | 'boolean' | 'string';
};

type EnumType = {
  type: 'enum';
  enumOf: string[];
};
```

Describes a field in the schema.

- All fields must have a `name` and `type` specified.
- The `nullable` flag is assumed to be `false` if omitted.
- Fields with a type of `enum` must also have an `enumOf` property, which is an array of strings that contains all possible values of the field.

## **`function pack()`**

```typescript
function pack<T = any>(objects: T[], schema: Schema): ArrayBuffer;
```

Packs the array of objects into an `ArrayBuffer`. For the detailed contents of the buffer, check the [Payload Format Reference](#payload-format-reference).

## **`function unpack()`**

```typescript
function unpack<T = any>(payload: ArrayBuffer, schema?: Schema): T[];
```

Unpacks an array of objects from an `ArrayBuffer`.

- If the payload is not self-describing, it uses the received `schema` to unpack its contents.
- If `schema` is omitted, the payload must contain a self-describing header. Otherwise, an `Error` is thrown.

# Payload Format Reference

If you need to create your own implementation of BytePacker for your non-JS backend, you can use the following spec to ensure it uses the correct format.

## Feature byte

| **data**         | **length** | **description**                                                                                                                                      |
| ---------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **feature byte** |         1B | The first byte of the payload is 0 if it's not self-describing, and 1 if it is. Additional bits may be set to indicate other features in the future. |

## Field definitions (optional)

If the payload is generated to be self-describing, the feature byte is followed by a header that contains the field definitions.

| **data**        | **length** | **description**                                                |
| --------------- | ---------: | -------------------------------------------------------------- |
| **header size** |         2B | Total size of the header, in bytes (including the header size) |
| **field count** |         1B | The number of fields (max. 255).                               |

After the header size and field count, each field is described as follows:

| **data**       |      **length** | **description**                                                                                                                                                                                                                                                                                                    |
| -------------- | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **field type** |              1B | The four least significant bits of this byte represent the field type: 1 = `int8`, 2 = `int16`, 3 = `int32`, 4 = `float`, 5 = `boolean`, 6 = `string`, 7 = `enum`. The most significant bit is 1 for nullable fields and 0 for non-nullables. Additional bits may be set to indicate other features in the future. |
| **field name** | _(varies)_ + 1B | Field names (and all strings in general) are encoded in UTF-8 and followed by a null terminator (a byte value of 0).                                                                                                                                                                                               |

Fields with a type of `enum` have additional information following the type and name:

| **data**              |                         **length** | **description**                                                      |
| --------------------- | ---------------------------------: | -------------------------------------------------------------------- |
| **enum option count** |                                 1B | The number of possible enum values (max. 255).                       |
| **enum options**      | (_(varies)_ + 1B) x (option count) | Each enum option is listed as a UTF-8 string with a null terminator. |

## Object definitions

The feature byte and optional header are followed immediately by the object definitions. These chunks contain the raw data of the packed objects' fields, in the same order as listed in the schema.

| **field type** | **value length** | **description**                                                                             |
| -------------- | ---------------: | ------------------------------------------------------------------------------------------- |
| `int8`         |               1B | 8-bit integer value                                                                         |
| `int16`        |               2B | 16-bit integer value                                                                        |
| `int32`        |               4B | 32-bit integer value                                                                        |
| `float`        |               4B | 32-bit floating point value                                                                 |
| `boolean`      |               1B | 1 for `true`, 0 for `false`                                                                 |
| `string`       |  _(varies)_ + 1B | UTF-8 encoded string with null terminator                                                   |
| `enum`         |               1B | Index of the value within the array of options listed in the `enumOf` property of the field |

### Null bytes

If the schema contains **nullable fields**, each object is _prefixed_ by a sequence of bytes (called _null bytes_) that indicate which fields are null. The number of null bytes per object is the number of nullable bytes in the schema, divided by 8, and rounded up. I.e., if there are 1 to 8 nullable fields, there will be 1 null byte per object; if there are 9 to 16, there will be 2, etc.

The sequence of null bytes is treated as a single array of bits during processing. If the n-th least significant bit is set, it means that the n-th nullable field has the value `null`. It is crucial to remember that **non-nullable fields do not have a corresponding bit in the null bytes**, only nullable ones.

Consider the following example:

```typescript
const schema = {
  fields: [
    { name: 'a', type: 'int8', nullable: true },
    { name: 'b', type: 'int8' },
    { name: 'c', type: 'int8', nullable: true },
    { name: 'd', type: 'int8' },
  ],
};

const objects = [
  { a: 1, b: 2, c: 3, d: 4 },

  { a: null, b: 2, c: 3, d: 4 },

  { a: 1, b: 2, c: null, d: 4 },

  { a: null, b: 2, c: null, d: 4 },
];
```

With this schema, each object will be prefixed with 1 null byte (2 nullable fields => 2 divided by 8, rounded up to 1). Here's how the four listed objects will appear in the payload (the null bytes are shown in binary, the value bytes in decimal):

```
0b00000000 1 2 3 4

0b00000001 2 3 4

0b00000010 1 2 4

0b00000011 2 4
```

1. In the first object, all fields have a numeric value. The null byte is all 0's, followed by the four byte values.
2. In the second object, `a` is `null`. Since `a` is the first _nullable_ field, the least significant bit of the null byte is set. The null byte is then followed by all the non-null values.
3. In the third object, `c` is `null`. Since `c` is the second _nullable_ field, the second least significant bit of the null byte is set. The null byte is then followed by all the non-null values.
4. In the fourth object, `a` and `c` are both `null`; thus, both the least and second least significant bits of the null byte are set. The null byte is then followed by all the non-null values.

# To-Do's and Roadmap

The following sections describe potential improvements to the library. Feel free to offer comments or suggestions as Issues.

## Tests

Currently, tests are written in plain NodeJS, and only serve to test basic functionality. A more thorough suite of tests would be desirable, adhering to the following requirements:

- It should be written in one of the popular testing frameworks.
- It should cover nontrivial and edge cases.
- It should cover error handling.

## Field type `date`

```typescript
type DateType = {
  type: 'date';
  precision?: 'day' | 'minute' | 'second' | 'ms';
};
```

Allow fields to contain date or date-time values as `Date` objects. The optional `precision` property should default to `day` if not specified.

In a self-describing header, the name of a date field should be followed by a single byte value indicating its precision: 1 = `day`, 2 = `minute`, 3 = `second`, 4 = `ms`.

In the payload, date values should be encoded depending on the specified precision:

| **value** | **bytes** | **description** | **precision**            |
| --------: | --------: | --------------- | ------------------------ |
|   0..9999 |        2B | Year            | _all_                    |
|     0..11 |        1B | Month           | _all_                    |
|     1..31 |        1B | Day             | _all_                    |
|     0..23 |        1B | Hours           | `minute`, `second`, `ms` |
|     0..59 |        1B | Minutes         | `minute`, `second`, `ms` |
|     0..59 |        1B | Seconds         | `second`, `ms`           |
|    0..999 |        2B | Milliseconds    | `ms`                     |

During unpacking, these sequences should be parsed back into `Date` objects.

Error handling:

- During unpacking, assert that all values are in their allowed ranges.

## Field type `array`

```typescript
type ArrayType = {
  type: 'array';
  arrayOf: SimpleType | EnumType | ArrayType | DateType;
};
```

Allow objects to contain arrays.

In a self-describing header, the name of an array field should be followed by the type of its items.

In the payload, an array value should consist of the number of items, followed by the item values, encoded according to the type specified in `arrayOf`. Since the number of items in an array should not be limited, but we also do not want to add unnecessary bytes to the payload by always using 16 or 32-bit integers, the number of items should be encoded in the same variable-length format as UTF-8 characters.

Open questions:

- Should `null` values be allowed in arrays?
  - How should they be encoded? One possible way is to use a bit string somehow, similar to null bytes at the start of objects.
  - If yes, it should still be controlled on a per-field basis, i.e. `ArrayType` should also contain an optional `itemsNullable` flag.

Error handling:

- When validating the schema, assert that `arrayOf` is specfied and is a valid field type specification.

## Field type `object`

```typescript
type ObjectType = {
  type: 'object';
  fields: Field[];
};
```

Allow objects to contain child objects. These child objects should have their own schema within the schema.

In a self-describing header, the name of an object field should be followed by, an embedded self-describing header, describing the schema of the object field. These should be able to be nested indefinitely.

In the payload, a nested object value should be encoded exactly the same way as an outer object.

Error handling:

- When validating the schema, assert that `fields` is specfied and is an array of valid field type specifications.
