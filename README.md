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
  "hobbies": [ "riding", "painting" ]
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
    {
      name: 'hobbies',
      type: 'array',
      arrayOf: {
        type: 'string',
      },
    },
  ],
};
```

You can find a full list of available field types in the [API Reference](#api-reference).

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
    hobbies: ['riding', 'painting'],
  },
  {
    id: 223456789,
    firstName: 'Jane',
    lastName: 'Doe',
    sex: 'female',
    hobbies: ['tennis', 'clarinet', 'sci-fi'],
  },
  // ...etc
];

const payload = pack(persons, schema);
```

The `pack()` function returns an `ArrayBuffer`, which you can then send over the network.

For the sake of comparison: if you sent the above array of two objects in minified JSON, it would have a payload size of **208 bytes**. Processed with BytePacker, this drops to **70 bytes** (66% decrease in size).

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

- [Field Types](#field-types)
- [interface Schema](#interface-schema)
- [type Field](#type-field)
- [function pack()](#function-pack)
- [function unpack()](#function-unpack)

## **Field Types**

| **name**  | **description**                                                                    |
| --------- | ---------------------------------------------------------------------------------- |
| `int8`    | Signed 8-bit integer (-128 .. 127)                                                 |
| `uint8`   | Unsigned 8-bit integer (0 .. 255)                                                  |
| `int16`   | Signed 16-bit integer (-32 768 .. 32 767)                                          |
| `uint16`  | Unsigned 16-bit integer (0 .. 65 535)                                              |
| `int32`   | Signed 32-bit integer (-2 147 483 648 .. 2 147 483 647)                            |
| `uint32`  | Unsigned 32-bit integer (0 .. 4 294 967 295)                                       |
| `varint`  | Variable-length unsigned integer (0 .. 1 112 063)                                  |
| `float`   | 32-bit floating-point                                                              |
| `boolean` | `true` or `false`                                                                  |
| `string`  | String (encoded in UTF-8 with null terminator)                                     |
| `enum`    | One of a predefined list of options, stored as an index [(see below)](#type-field) |
| `date`    | Date, optionally with time [(see below)](#type-field)                              |
| `array`   | Array of elements with a predefined type [(see below)](#type-field)                |

The `varint` type is useful if you expect values to randomly fall anywhere within the allowed range, from single-digits to the hundreds of thousands. Storing them as variable-length instead of `uint32` can help you shave a few more bytes off the payload by using fewer bytes for lower values.

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
} & (SimpleType | EnumType | DateType | ArrayType);

type SimpleType = {
  type:
    | 'int8'
    | 'int16'
    | 'int32'
    | 'uint8'
    | 'uint16'
    | 'uint32'
    | 'varint'
    | 'float'
    | 'boolean'
    | 'string';
};

type EnumType = {
  type: 'enum';
  enumOf: string[];
};

type DateType = {
  type: 'date';
  precision?: 'day' | 'minute' | 'second' | 'ms';
};

type ArrayType = {
  type: 'array';
  arrayOf: {
    nullable?: boolean;
  } & (SimpleType | EnumType | DateType | ArrayType);
};
```

Describes a field in the schema.

- All fields must have a `name` and `type` specified.
- The `nullable` flag is assumed to be `false` if omitted.
- **Fields with a type of `enum`** _must_ also have an `enumOf` property, which is an array of strings that contains all possible values of the field.
- **Fields with a type of `date`** _may_ also have a `precision` propety, which specifies whether time data should also be stored, and if yes, to what precision. If not specified, defaults to `day` (i.e. no time data).
  - Dates are be converted to UTC when packed.
  - Less precision requires fewer bytes to store.
  - Time data that is not covered by the specified precision will be nondeterministic at unpacking.
- **Fields with a type of `array`** _must_ also have an `arrayOf` property, which specifies of the type of the items in the array. This property works exactly like a proper field definition, with the exception that it does not have a name. The array is only allowed to contain `null` values if the `nullable` property of `arrayOf` is set to true.

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

| **data**       |      **length** | **description**                                                                                                                                                                                                        |
| -------------- | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **field type** |              1B | The five least significant bits of this byte represent the field type. The most significant bit is 1 for nullable fields and 0 for non-nullables. Additional bits may be set to indicate other features in the future. |
| **field name** | _(varies)_ + 1B | Field names (and all strings in general) are encoded in UTF-8 and followed by a null terminator (a byte value of 0).                                                                                                   |

The numeric codes for the field types are as follows:

| **type**  | **code** |
| --------- | -------: |
| `int8`    |        1 |
| `int16`   |        2 |
| `int32`   |        3 |
| `float`   |        4 |
| `boolean` |        5 |
| `string`  |        6 |
| `enum`    |        7 |
| `varint`  |        8 |
| `uint8`   |        9 |
| `uint16`  |       10 |
| `uint32`  |       11 |
| `date`    |       12 |
| `array`   |       13 |

**Fields with the type `enum`** have additional information following the type and name:

| **data**              |                         **length** | **description**                                                      |
| --------------------- | ---------------------------------: | -------------------------------------------------------------------- |
| **enum option count** |                                 1B | The number of possible enum values (max. 255).                       |
| **enum options**      | (_(varies)_ + 1B) x (option count) | Each enum option is listed as a UTF-8 string with a null terminator. |

**Fields with the type `date`** must also specify the required precision with a numeric code after the type and name:

| **precision** | **code** |
| ------------: | -------: |
|         `day` |        1 |
|      `minute` |        2 |
|      `second` |        3 |
|          `ms` |        4 |

**Fields with the type `array`** must also specify the type of the array items. This is described exactly the same as a proper field definition, with the name set to an empty string.

## Object definitions

The feature byte and optional header are followed immediately by the object definitions. These chunks contain the raw data of the packed objects' fields, in the same order as listed in the schema.

| **field type**     | **value length** | **note**                                                                                    |
| ------------------ | ---------------: | ------------------------------------------------------------------------------------------- |
| `int8` / `uint8`   |               1B |
| `int16` / `uint16` |               2B |
| `int32` / `uint32` |               4B |
| `float`            |               4B |
| `boolean`          |               1B |
| `string`           |  _(varies)_ + 1B | Encoded in UTF-8 + null terminator                                                          |
| `enum`             |               1B | Index of the value within the array of options listed in the `enumOf` property of the field |
| `varint`           |       _(varies)_ | (See below)                                                                                 |
| `date`             |       _(varies)_ | (See below)                                                                                 |
| `array`            |       _(varies)_ | (See below)                                                                                 |

**`varint` values**

The length of a `varint` value depends on the value itself. These values are encoded the same way as UTF-8 characters.

|        **value** | **value length** |
| ---------------: | ---------------: |
|         0 .. 127 |               1B |
|      128 .. 2047 |               2B |
|    2048 .. 65535 |               3B |
| 65536 .. 1112064 |               4B |

**`date` values**

The length and data of `date` values depends on the precision:

| **value** | **value length** | **description** | **precision**            |
| --------: | ---------------: | --------------- | ------------------------ |
|   0..9999 |               2B | Year            | _all_                    |
|     0..11 |               1B | Month           | _all_                    |
|     1..31 |               1B | Day             | _all_                    |
|     0..23 |               1B | Hours           | `minute`, `second`, `ms` |
|     0..59 |               1B | Minutes         | `minute`, `second`, `ms` |
|     0..59 |               1B | Seconds         | `second`, `ms`           |
|    0..999 |               2B | Milliseconds    | `ms`                     |

Thus, the `day` precision requires 4 bytes (2B year + 1B month + 1B day), the `minute` precision requires 6 bytes (`day` precision + 1B hours + 1B minutes), and so on.

**`array` values**

Arrays are packed as follows:

- First, the length of the array is packed as a `varint` value.
- If the `nullable` flag in the `arrayOf` type definition was set to true, then the length is followed by a byte sequence that indicates which items of the array are null. See below for details.
- Finally, the non-null items of the array are encoded according to the `arrayOf` type definition.

### Null values

**In objects**

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

**In arrays**

Null values in arrays are encoded in a similar, but simpler manner. In this case, each bit in the sequence corresponds to an element in the array; thus, the total number of null bytes will be the length of the complete array, divided by 8 and rounded up. If the n-th least significant bit is set, it means the n-th item in the array is `null`.

Consider the following example:

```typescript
const schema = {
  fields: [
    {
      name: 'numbers',
      type: 'array',
      arrayOf: {
        type: 'int8',
        nullable: true,
      },
    },
  ],
};

const input = [{ numbers: [null, 1, 2, null, 3, null, null, 4, 5, 6] }];
```

With this schema, the value of the field `numbers` in the object will be encoded as follows:

```
10 0b0000000001101001 1 2 3 4 5 6
```

1. First, the length of the array is encoded as a `varint`; here, this is `10`.
2. Next are the null bytes, here shown in binary. Because the array has 10 items, 2 null bytes are required (10 divided by 8, rounded up to 2). The first, fourth, sixth and seventh item of the array is `null`; therefore the 1st, 4th, 6th and 7th least significant bits of the sequence are set.
3. Finally, after the null bytes, the non-null values are encoded normally.

# To-Do's and Roadmap

The following sections describe potential improvements to the library. Feel free to offer comments or suggestions as Issues.

## Tests

Currently, tests are written in plain NodeJS, and only serve to test basic functionality. A more thorough suite of tests in one of the more professional testing frameworks would be desirable.

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

## Cursors

```typescript
interface Cursor<T = any> {
  new (payload: ArrayBuffer, schema?: Schema): Cursor;

  [Symbol.iterator]: Iterator<T>;

  get length(): number;
  forEach(callback: T => void);
  get(index: number): T;

  getSchema(): Schema;
}
```

Instead of using `unpack` to get all objects at the same time, a `Cursor` can allow client code to get individual objects, either directly by index, or via a loop.
