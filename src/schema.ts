export interface Schema {
  fields: Field[];
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
