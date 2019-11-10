import { Schema } from './schema';
export declare function pack<T = any>(rows: T[] | T, inSchema: Schema): ArrayBuffer;
