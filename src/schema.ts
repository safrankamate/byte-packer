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

type SimpleName = 'int8' | 'int16' | 'int32' | 'float' | 'boolean' | 'string';

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
  Int16: 'int16',
  Int32: 'int32',
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
];
