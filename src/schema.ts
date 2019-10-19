export interface Schema {
  fields: Field[];
  selfDescribing?: boolean;
}

export type Field = {
  name: string;
  nullable?: boolean;
} & TypeDef;

type TypeName = SimpleName | EnumName;
type TypeDef = SimpleType | EnumType;

type SimpleName =
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

type SimpleType = {
  type: SimpleName;
};

type EnumName = 'enum';

type EnumType = {
  type: EnumName;
  enumOf: string[];
};

export const Types: Record<string, TypeName> = {
  Int8: 'int8',
  UInt8: 'uint8',
  Int16: 'int16',
  UInt16: 'uint16',
  Int32: 'int32',
  UInt32: 'uint32',
  VarInt: 'varint',
  Float: 'float',
  Boolean: 'boolean',
  String: 'string',
  Enum: 'enum',
};

export const TypeCodes: TypeName[] = [
  undefined,
  'int8',
  'int16',
  'int32',
  'float',
  'boolean',
  'string',
  'enum',
  'varint',
  'uint8',
  'uint16',
  'uint32',
];
