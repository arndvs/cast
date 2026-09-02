/**
 * Magic-byte validation — re-exported from the canonical `asset-files`
 * module so the MIME→signature table can never drift from the accept list.
 *
 * Kept as a thin re-export for backward compatibility with existing imports;
 * new code should import `magicBytesMatch` from `@/lib/cast/asset-files`.
 */

export { magicBytesMatch } from "@/lib/cast/asset-files"
