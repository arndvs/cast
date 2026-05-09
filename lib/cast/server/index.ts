/**
 * Server module barrel export — the public API surface.
 *
 * Everything exported here becomes the Fastify service API when the backend
 * migrates from Next.js API routes. Route handlers in `app/api/` are thin
 * pass-throughs that map HTTP → these functions → HTTP responses.
 *
 * Import rules:
 *   ✅ app/api/*  → lib/cast/server/*  (routes call server functions)
 *   ✅ lib/cast/server/* → lib/cast/*   (server uses shared schemas/types)
 *   ❌ app/api/*  → node:fs/promises   (no direct I/O in route handlers)
 *   ❌ app/api/*  → @azure/*           (no direct Azure calls in routes)
 *   ❌ components/ → lib/cast/server/*  (client code never imports server)
 */

// -- Config (env var accessors) ---------------------------------------------
// `getGenAIMode` is deliberately excluded — use the re-export from
// pipeline/genai which wraps it with the canonical GenAIMode type.
export {
  getOpenAIApiKey,
  type StorageBackend,
  getStorageBackend,
  getAzureConnectionString,
  isAzureEnabled,
  getQdrantUrl,
  getQdrantApiKey,
  isQdrantEnabled,
  getFatigueThreshold,
  type AdsProvider,
  getAdsProvider,
  getApiBaseUrl,
} from "./config"

// -- Helpers ----------------------------------------------------------------
export * from "./api-helpers"
export * from "./magic-bytes"
export * from "./safe-join"
export * from "./retry"

// -- Loaders ----------------------------------------------------------------
export * from "./brand-loader"
export * from "./brief-loader"

// -- Storage ----------------------------------------------------------------
export * from "./storage"
export {
  type Container,
  type StorageAdapter,
  getStorageAdapter,
} from "./storage-adapter"
// AzureBlobAdapter is NOT re-exported — it is lazy-loaded by
// getStorageAdapter() via dynamic import(). Eagerly re-exporting it
// would pull in @azure/storage-blob for every consumer of this barrel.
export type { AzureBlobAdapter } from "./azure-blob-adapter"

// -- Metadata ---------------------------------------------------------------
export * from "./metadata"

// -- NDJSON streaming -------------------------------------------------------
export * from "./ndjson-emit"

// -- Pipeline stages --------------------------------------------------------
export * from "./pipeline/compose"
export * from "./pipeline/compliance"
export * from "./pipeline/genai"
export * from "./pipeline/manifest-builder"
export * from "./pipeline/resize"
export * from "./pipeline/resolve"
export * from "./pipeline/write"

// -- MCP tools --------------------------------------------------------------
export * from "./mcp-tools"
