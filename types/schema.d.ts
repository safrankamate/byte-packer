export interface Schema {
    fields: Field[];
    selfDescribing?: boolean;
}
export declare type Field = {
    name: string;
    nullable?: boolean;
} & TypeDef;
export declare type FieldType = SimpleType | EnumType;
export declare type SimpleType = 'int8' | 'int16' | 'int32' | 'float' | 'boolean' | 'string';
export declare type EnumType = 'enum';
export declare type TypeDef = {
    type: SimpleType;
} | {
    type: EnumType;
    enumOf: string[];
};
export declare const Types: Record<string, FieldType>;
