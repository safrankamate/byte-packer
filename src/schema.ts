export interface Schema {
  fields: Field[];
  selfDescribing?: boolean;
}

export type Field = {
  name: string;
  nullable?: boolean;
} & TypeDef;

export type FieldType = SimpleType | EnumType;

export type SimpleType =
  | 'int8'
  | 'int16'
  | 'int32'
  | 'float'
  | 'boolean'
  | 'string';
export type EnumType = 'enum';

export type TypeDef =
  | {
      type: SimpleType;
    }
  | {
      type: EnumType;
      enumOf: string[];
    };

export const Types: Record<string, FieldType> = {
  Int8: 'int8',
  Int16: 'int16',
  Int32: 'int32',
  Float: 'float',
  Boolean: 'boolean',
  String: 'string',
  Enum: 'enum',
};
