/**
 * Central config — single source of truth for all environment variable access.
 *
 * All env reads go through this module. Pipeline code and API routes import
 * typed accessors instead of reading `process.env` directly.
 */

import type { GenAIMode } from "@/lib/cast/server/pipeline/genai"

// ---------------------------------------------------------------------------
// Required
// ---------------------------------------------------------------------------

export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY is not set")
  return key
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export type StorageBackend = "local" | "azure"

export function getStorageBackend(): StorageBackend {
  return process.env.CAST_STORAGE === "azure" ? "azure" : "local"
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
