/**
 * StorageAdapter — abstract interface for all file I/O.
 *
 * Every read/write in the pipeline goes through this interface. Two adapters:
 *   - LocalFsAdapter (default) — maps containers to filesystem roots
 *   - AzureBlobAdapter (future, Slice 2) — maps containers to Azure Blob
 *
 * Container names map to logical storage areas:
 *   - "inputs"  → product photos, uploaded assets
 *   - "outputs" → generated creatives, manifests, briefs
 *   - "brands"  → brand profiles, logos, fonts (future — currently under inputs/)
 */

import fs from "node:fs/promises"
import path from "node:path"
import { safeJoin, type RootKey } from "@/lib/cast/server/safe-join"
import { getStorageBackend, type StorageBackend } from "@/lib/cast/server/config"

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type Container = "inputs" | "outputs"

export interface StorageAdapter {
  /** Read a file as a Buffer. Throws if not found. */
  readFile(container: Container, key: string): Promise<Buffer>

  /** Write data to a file. Creates intermediate directories as needed. */
  writeFile(container: Container, key: string, data: Buffer | string, contentType?: string): Promise<void>

  /** Delete a single file. No-op if the file does not exist. */
  deleteFile(container: Container, key: string): Promise<void>

  /** Delete all files under a prefix (recursive). No-op if prefix does not exist. */
  deletePrefix(container: Container, prefix: string): Promise<void>

  /** List file keys under a prefix. Returns keys relative to the container root. */
  listFiles(container: Container, prefix: string): Promise<string[]>

  /** Check whether a file exists. */
  fileExists(container: Container, key: string): Promise<boolean>

  /** Get a URL suitable for serving the file to the client. */
  getPublicUrl(container: Container, key: string): string
}

// ---------------------------------------------------------------------------
// LocalFsAdapter
// ---------------------------------------------------------------------------

/**
 * Filesystem-backed adapter. Maps containers to `ROOTS` via `safeJoin`.
 * This is the default adapter for local development.
 */
export class LocalFsAdapter implements StorageAdapter {
  async readFile(container: Container, key: string): Promise<Buffer> {
    const segments = key.split(/[/\\]/).filter(Boolean)
    const abs = safeJoin(container as RootKey, ...segments)
    return fs.readFile(abs)
  }

  async writeFile(container: Container, key: string, data: Buffer | string): Promise<void> {
    const segments = key.split(/[/\\]/).filter(Boolean)
    const abs = safeJoin(container as RootKey, ...segments)
    const dir = path.dirname(abs)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(abs, data)
  }

  async deleteFile(container: Container, key: string): Promise<void> {
    const segments = key.split(/[/\\]/).filter(Boolean)
    const abs = safeJoin(container as RootKey, ...segments)
    await fs.rm(abs, { force: true })
  }

  async deletePrefix(container: Container, prefix: string): Promise<void> {
    const segments = prefix.split(/[/\\]/).filter(Boolean)
    const abs = safeJoin(container as RootKey, ...segments)
    await fs.rm(abs, { recursive: true, force: true })
  }

  async listFiles(container: Container, prefix: string): Promise<string[]> {
    const segments = prefix.split(/[/\\]/).filter(Boolean)
    const abs = safeJoin(container as RootKey, ...segments)
    let entries: string[]
    try {
      entries = await fs.readdir(abs)
    } catch {
      return []
    }
    return entries.map((e) => path.posix.join(prefix, e))
  }

  async fileExists(container: Container, key: string): Promise<boolean> {
    const segments = key.split(/[/\\]/).filter(Boolean)
    const abs = safeJoin(container as RootKey, ...segments)
    try {
      await fs.access(abs)
      return true
    } catch {
      return false
    }
  }

  getPublicUrl(container: Container, key: string): string {
    return `/api/outputs/${key}`
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let cached: StorageAdapter | null = null

/**
 * Returns the active StorageAdapter based on `CAST_STORAGE` env var.
 * Currently only `local` is implemented; `azure` will be added in Slice 2.
 */
export function getStorageAdapter(backend?: StorageBackend): StorageAdapter {
  if (cached) return cached
  const resolved = backend ?? getStorageBackend()
  switch (resolved) {
    case "local":
      cached = new LocalFsAdapter()
      break
    case "azure":
      throw new Error(
        "AzureBlobAdapter is not yet implemented (planned in Slice 2). " +
        "Set CAST_STORAGE=local or omit the variable.",
      )
    default:
      throw new Error(`Unknown storage backend: ${resolved}`)
  }
  return cached
}

/** Reset the cached adapter (test seam). */
export function _resetStorageAdapter(): void {
  cached = null
}
