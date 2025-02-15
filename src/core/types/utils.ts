import { ObjectId } from 'mongodb';

/**
 * Makes all properties in T optional except for those specified in K
 * @example
 * type User = { id: number; name: string; email: string; };
 * type UpdateUser = RequiredKeys<User, 'id'>; // { id: number; name?: string; email?: string; }
 */
export type RequiredKeys<T, K extends keyof T> = Required<Pick<T, K>> & Partial<Omit<T, K>>;

/**
 * Makes all properties in T required except for those specified in K
 * @example
 * type User = { id: number; name?: string; email?: string; };
 * type CompleteUser = OptionalKeys<User, 'email'>; // { id: number; name: string; email?: string; }
 */
export type OptionalKeys<T, K extends keyof T> = Partial<Pick<T, K>> & Required<Omit<T, K>>;

/**
 * Creates a type with only the specified keys from T
 * @example
 * type User = { id: number; name: string; email: string; };
 * type UserIdentity = PickKeys<User, 'id' | 'email'>; // { id: number; email: string; }
 */
export type PickKeys<T, K extends keyof T> = Pick<T, K>;

/**
 * Creates a type without the specified keys from T
 * @example
 * type User = { id: number; name: string; password: string; };
 * type PublicUser = OmitKeys<User, 'password'>; // { id: number; name: string; }
 */
export type OmitKeys<T, K extends keyof T> = Omit<T, K>;

/**
 * Makes all properties in T nullable
 * @example
 * type User = { id: number; name: string; };
 * type NullableUser = Nullable<User>; // { id: number | null; name: string | null; }
 */
export type Nullable<T> = { [P in keyof T]: T[P] | null };

/**
 * Makes all properties in T non-nullable
 * @example
 * type User = { id: number | null; name: string | null; };
 * type NonNullUser = NonNullable<User>; // { id: number; name: string; }
 */
export type NonNullableProperties<T> = { [P in keyof T]: NonNullable<T[P]> };

/**
 * Creates a type where all properties are readonly
 * @example
 * type User = { id: number; name: string; };
 * type ReadonlyUser = Immutable<User>; // { readonly id: number; readonly name: string; }
 */
export type Immutable<T> = { readonly [P in keyof T]: T[P] };

/**
 * Creates a type where all properties are mutable (removes readonly)
 * @example
 * type User = { readonly id: number; readonly name: string; };
 * type MutableUser = Mutable<User>; // { id: number; name: string; }
 */
export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Creates a type with only the methods from T
 * @example
 * type User = { id: number; getName(): string; setName(name: string): void; };
 * type UserMethods = Methods<User>; // { getName(): string; setName(name: string): void; }
 */
export type Methods<T> = Pick<T, { [P in keyof T]: T[P] extends Function ? P : never }[keyof T]>;

/**
 * Creates a type with only the properties (non-methods) from T
 * @example
 * type User = { id: number; name: string; getName(): string; };
 * type UserProps = Properties<User>; // { id: number; name: string; }
 */
export type Properties<T> = Pick<T, { [P in keyof T]: T[P] extends Function ? never : P }[keyof T]>;

/**
 * Creates a type that requires at least one of the properties from T
 * @example
 * type SearchParams = AtLeastOne<{ name: string; email: string; phone: string; }>;
 * // Must provide at least one of: name, email, or phone
 */
export type AtLeastOne<T> = { [K in keyof T]: Pick<T, K> }[keyof T];

/**
 * Creates a type that requires exactly one of the properties from T
 * @example
 * type UserIdentifier = ExactlyOne<{ id: number; email: string; phone: string; }>;
 * // Must provide exactly one of: id, email, or phone
 */
export type ExactlyOne<T> = { [K in keyof T]: Pick<T, K> & Partial<Record<Exclude<keyof T, K>, never>> }[keyof T];

/**
 * MongoDB ID type utilities
 */
export type WithMongoId<T> = T & { _id: ObjectId };
export type WithOptionalMongoId<T> = T & { _id?: ObjectId };
export type OmitMongoId<T> = Omit<T, '_id'>;

/**
 * Response type utilities
 */
export interface SuccessResponse<T = void> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = void> = SuccessResponse<T> | ErrorResponse;

/**
 * Pagination utilities
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Type guard utilities
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

export function isErrorResponse(response: ApiResponse<any>): response is ErrorResponse {
  return response.success === false;
}

export function isObjectId(value: unknown): value is ObjectId {
  return value instanceof ObjectId;
}

export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

/**
 * Deep partial type that makes all nested properties optional
 * @example
 * type User = { id: number; profile: { name: string; age: number; }; };
 * type PartialUser = DeepPartial<User>;
 * // { id?: number; profile?: { name?: string; age?: number; }; }
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep readonly type that makes all nested properties readonly
 * @example
 * type User = { id: number; profile: { name: string; }; };
 * type ReadonlyUser = DeepReadonly<User>;
 * // { readonly id: number; readonly profile: { readonly name: string; }; }
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Type that requires at least one property from T to be non-null/undefined
 * @example
 * type SearchFilters = RequireAtLeastOneNonNull<{
 *   name?: string | null;
 *   email?: string | null;
 *   phone?: string | null;
 * }>;
 */
export type RequireAtLeastOneNonNull<T> = {
  [K in keyof T]: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

/**
 * Type for function parameters that preserves parameter names
 * @example
 * type Params = Parameters<(name: string, age: number) => void>;
 * // [name: string, age: number]
 */
export type NamedParameters<T extends (...args: any[]) => any> = Parameters<T>;

/**
 * Type for async function return type that unwraps Promise
 * @example
 * type Result = AsyncReturnType<() => Promise<string>>;
 * // string
 */
export type AsyncReturnType<T extends (...args: any[]) => Promise<any>> = T extends (
  ...args: any[]
) => Promise<infer R>
  ? R
  : never;

/**
 * Type for validating string literal unions at runtime
 * @example
 * const Colors = ['red', 'blue', 'green'] as const;
 * type Color = ValidateUnion<typeof Colors[number]>;
 */
export type ValidateUnion<T extends string> = T extends string
  ? string extends T
    ? never
    : T
  : never;

/**
 * Type for creating a discriminated union based on a type property
 * @example
 * type Event = DiscriminatedUnion<'type', {
 *   click: { x: number; y: number; };
 *   keypress: { key: string; };
 * }>;
 */
export type DiscriminatedUnion<K extends string, T extends { [key in K]: string }> = {
  [P in T[K]]: T extends { [key in K]: P } ? T : never;
}[T[K]];

/**
 * Type for creating a record with specific key and value types, with validation
 * @example
 * type Config = ValidatedRecord<'env' | 'stage', string>;
 * // Record<'env' | 'stage', string> with runtime validation
 */
export type ValidatedRecord<K extends string | number | symbol, V> = {
  [P in K]: V;
} & Record<K, V>;

/**
 * Type for ensuring all properties of an object are of a specific type
 * @example
 * type NumericRecord = AllPropertiesOf<Record<string, number>>;
 */
export type AllPropertiesOf<T, V> = {
  [P in keyof T]: V;
}; 