/**
 * Central config — single source of truth for all environment variable access.
 *
 * All env reads go through this module. Pipeline code and API routes import
 * typed accessors instead of reading `process.env` directly.
 */

import type { GenAIMode } from "@/lib/cast/server/pipeline/genai"

// Type-only reference to the OpenAI SDK — erased at compile time, so config.ts
// consumers never pull `openai` into their bundle unless they call the factory.
type OpenAI = import("openai").default

// ---------------------------------------------------------------------------
// Required
// ---------------------------------------------------------------------------

export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY is not set")
  return key
}

// ---------------------------------------------------------------------------
// OpenAI client factory (shared lazy singleton)
// ---------------------------------------------------------------------------

declare global {
  var __openaiClient: OpenAI | undefined
}

/**
 * Shared OpenAI SDK client — lazy singleton, the single construction site
 * for `new OpenAI(...)` in `lib/cast/server/`.
 *
 * Both the GenAI image pipeline (`pipeline/genai.ts`) and the vision metadata
 * analyzer (`metadata.ts`) previously built byte-identical clients privately.
 * Centering the factory means future hardening (timeouts, baseURL, auth
 * strategy) lands in one place and both callers share it by construction.
 *
 * OpenAI is imported lazily on first call so config.ts consumers that never
 * hit the client don't pull the SDK into their initial bundle — same pattern
 * as `AzureBlobAdapter` in storage-adapter.ts. The singleton is attached to
 * `globalThis` so it survives HMR without leaking a second client.
 */
export async function getOpenAIClient(): Promise<OpenAI> {
  const existing = globalThis.__openaiClient
  if (existing) return existing

  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({ apiKey: getOpenAIApiKey() })
  globalThis.__openaiClient = client
  return client
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export type StorageBackend = "local" | "azure"

const VALID_BACKENDS = new Set<string>(["local", "azure"])

export function getStorageBackend(): StorageBackend {
  const raw = process.env.CAST_STORAGE
  if (!raw) return "local"
  if (!VALID_BACKENDS.has(raw)) {
    throw new Error(
      `Invalid CAST_STORAGE="${raw}". Expected one of: ${[...VALID_BACKENDS].join(", ")}`,
    )
  }
  return raw as StorageBackend
}

export function getAzureConnectionString(): string {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!cs) throw new Error("AZURE_STORAGE_CONNECTION_STRING is required when CAST_STORAGE=azure")
  return cs
}

export function isAzureEnabled(): boolean {
  return getStorageBackend() === "azure"
}

// ---------------------------------------------------------------------------
// Vector DB (Qdrant) — optional, features degrade gracefully
// ---------------------------------------------------------------------------

export function getQdrantUrl(): string | undefined {
  return process.env.QDRANT_URL || undefined
}

export function getQdrantApiKey(): string | undefined {
  return process.env.QDRANT_API_KEY || undefined
}

export function isQdrantEnabled(): boolean {
  return !!getQdrantUrl()
}

// ---------------------------------------------------------------------------
// GenAI
// ---------------------------------------------------------------------------

export function getGenAIMode(): GenAIMode {
  return process.env.CAST_GENAI_MODE === "cheap" ? "cheap" : "default"
}

// ---------------------------------------------------------------------------
// Fatigue (optional — default threshold)
// ---------------------------------------------------------------------------

const DEFAULT_FATIGUE_THRESHOLD = 45

export function getFatigueThreshold(): number {
  const raw = process.env.CAST_FATIGUE_THRESHOLD
  if (!raw) return DEFAULT_FATIGUE_THRESHOLD
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FATIGUE_THRESHOLD
}

// ---------------------------------------------------------------------------
// Ads provider
// ---------------------------------------------------------------------------

export type AdsProvider = "manual" | "meta"

export function getAdsProvider(): AdsProvider {
  return process.env.CAST_ADS_PROVIDER === "meta" ? "meta" : "manual"
}

// ---------------------------------------------------------------------------
// API split (future — when Fastify repo exists)
// ---------------------------------------------------------------------------

export function getApiBaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_API_URL || undefined
}
