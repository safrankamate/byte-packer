export interface Schema {
    fields: Field[];
    selfDescribing?: boolean;
}
export declare type Field = {
    name: string;
    nullable?: boolean;
} & TypeDef;
export declare type TypeName = SimpleName | EnumName | DateName | ArrayName | ObjectName;
declare type TypeDef = SimpleType | EnumType | DateType | ArrayType | ObjectType;
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
declare type ArrayName = 'array';
declare type ArrayType = {
    type: ArrayName;
    arrayOf: {
        nullable?: boolean;
    } & (SimpleType | EnumType | DateType | ArrayType | ObjectType);
};
declare type ObjectName = 'object';
declare type ObjectType = {
    type: ObjectName;
    fields: Field[];
};
export declare const Types: Record<string, TypeName>;
export declare const TypeCodes: TypeName[];
export declare const DatePrecisions: DatePrecision[];
export {};
