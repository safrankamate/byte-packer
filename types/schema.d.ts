export interface Schema {
    fields: Field[];
    selfDescribing?: boolean;
}
export declare type Field = {
    name: string;
    nullable?: boolean;
} & TypeDef;
declare type TypeName = SimpleName | EnumName | DateName;
declare type TypeDef = SimpleType | EnumType | DateType;
declare type SimpleName = 'int8' | 'int16' | 'int32' | 'uint8' | 'uint16' | 'uint32' | 'varint' | 'float' | 'boolean' | 'string';
declare type SimpleType = {
    type: SimpleName;
};
declare type EnumName = 'enum';
declare type EnumType = {
    type: EnumName;
    enumOf: string[];
};
declare type DateName = 'date';
declare type DatePrecision = 'day' | 'minute' | 'second' | 'ms';
declare type DateType = {
    type: DateName;
    precision?: DatePrecision;
};
export declare const Types: Record<string, TypeName>;
export declare const TypeCodes: TypeName[];
export declare const DatePrecisions: DatePrecision[];
export {};
