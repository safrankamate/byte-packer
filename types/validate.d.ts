import { Schema, Field } from './schema';
export declare function assert(condition: boolean, message: string): boolean;
export declare function validatePack(rows: any[], schema: Schema): boolean;
export declare function validateSchema(schema: Schema): boolean;
export declare function validateValue(value: any, field: Field): void;
