/**
 * Stable import path for the slug + market regexes.
 *
 * The regexes themselves live in `lib/cast/schemas.ts` (where they bind the
 * Zod contracts). This module re-exports them so server code (`/api/upload`,
 * route handlers, safeJoin callers) has a stable, dedicated import path for
 * slug/market validation primitives.
 *
 * Both are pure regexes — safe to import from client code too if needed.
 */

export { SLUG_RE, MARKET_RE, slugify } from "../schemas"
