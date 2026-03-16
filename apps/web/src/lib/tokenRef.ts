/**
 * Shared mutable token reference.
 *
 * Both `api.ts` (interceptors) and `auth.store.ts` (state actions)
 * import this module to read/write the access token without creating
 * a circular dependency between them.
 */

export const tokenRef: { current: string | null } = { current: null };
