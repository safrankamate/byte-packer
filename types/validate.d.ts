import { Schema, Field } from './schema';
export declare type Validator = (value: any) => void;
export declare function assert(condition: boolean, message: string): boolean;
export declare function validatePack(rows: any | any[], schema: Schema): boolean;
export declare function validateSchema(schema: Schema): boolean;
export declare function createValidator(field: Field): Validator;
