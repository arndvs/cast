/**
 * StorageAdapter — abstract interface for all file I/O.
 *
 * Every read/write in the pipeline goes through this interface. Two adapters:
 *   - LocalFsAdapter (default) — maps containers to filesystem roots
 *   - AzureBlobAdapter — maps containers to Azure Blob Storage containers
 *
 * Container names map to logical storage areas:
 *   - "inputs"  → product photos, uploaded assets
 *   - "outputs" → generated creatives, manifests, briefs
 */

import fs from "node:fs/promises"
import path from "node:path"
import { safeJoin, type RootKey } from "@/lib/cast/server/safe-join"
import { getStorageBackend, type StorageBackend } from "@/lib/cast/server/config"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class StorageNotFoundError extends Error {
  readonly container: Container
  readonly key: string
  constructor(container: Container, key: string) {
    super(`File not found: ${container}/${key}`)
    this.name = "StorageNotFoundError"
    this.container = container
    this.key = key
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type Container = "inputs" | "outputs"

export interface StorageAdapter {
  /** Read a file as a Buffer. Throws `StorageNotFoundError` if not found. */
  readFile(container: Container, key: string): Promise<Buffer>

  /** Write data to a file. Creates intermediate directories as needed. */
  writeFile(container: Container, key: string, data: Buffer | string, contentType?: string): Promise<void>

  /** Delete a single file. No-op if the file does not exist. */
  deleteFile(container: Container, key: string): Promise<void>

  /** Delete all files under a prefix (recursive). No-op if prefix does not exist. */
  deletePrefix(container: Container, prefix: string): Promise<void>

  /** List all file keys under a prefix (recursive). Returns keys relative to the container root. */
  listFiles(container: Container, prefix: string): Promise<string[]>

  /** List immediate child directory names under a prefix (non-recursive). */
  listPrefixes(container: Container, prefix: string): Promise<string[]>

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
    // TODO(symlink-hardening): safeJoin is lexical-only — harden with realpath check
    const abs = safeJoin(container as RootKey, ...segments)
    try {
      return await fs.readFile(abs)
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageNotFoundError(container, key)
      }
      throw err
    }
  }

  async writeFile(container: Container, key: string, data: Buffer | string, _contentType?: string): Promise<void> {
    const segments = key.split(/[/\\]/).filter(Boolean)
    // TODO(symlink-hardening): safeJoin is lexical-only — harden with realpath check
    const abs = safeJoin(container as RootKey, ...segments)
    const dir = path.dirname(abs)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(abs, data)
  }

  async deleteFile(container: Container, key: string): Promise<void> {
    const segments = key.split(/[/\\]/).filter(Boolean)
    // TODO(symlink-hardening): safeJoin is lexical-only — harden with realpath check
    const abs = safeJoin(container as RootKey, ...segments)
    await fs.rm(abs, { force: true })
  }

  async deletePrefix(container: Container, prefix: string): Promise<void> {
    const segments = prefix.split(/[/\\]/).filter(Boolean)
    // TODO(symlink-hardening): safeJoin is lexical-only — harden with realpath check
    const abs = safeJoin(container as RootKey, ...segments)
    await fs.rm(abs, { recursive: true, force: true })
  }

  async listFiles(container: Container, prefix: string): Promise<string[]> {
    const segments = prefix.split(/[/\\]/).filter(Boolean)
    // TODO(symlink-hardening): safeJoin is lexical-only — harden with realpath check
    const abs = safeJoin(container as RootKey, ...segments)
    let entries: import("node:fs").Dirent[]
    try {
      entries = await fs.readdir(abs, { withFileTypes: true })
    } catch (err: unknown) {
      // Only treat ENOENT (missing directory) as "no files".
      // Rethrow permission errors (EACCES/EPERM) and other I/O failures.
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return []
      }
      throw err
    }
    const results: string[] = []
    for (const entry of entries) {
      const entryPath = path.posix.join(prefix, entry.name)
      if (entry.isFile()) {
        results.push(entryPath)
      } else if (entry.isDirectory()) {
        const nested = await this.listFiles(container, entryPath)
        results.push(...nested)
      }
    }
    return results
  }

  async listPrefixes(container: Container, prefix: string): Promise<string[]> {
    const segments = prefix.split(/[/\\]/).filter(Boolean)
    // TODO(symlink-hardening): safeJoin is lexical-only; add fs.realpath
    // re-validation before production use.
    const abs = safeJoin(container as RootKey, ...segments)
    let entries: import("node:fs").Dirent[]
    try {
      entries = await fs.readdir(abs, { withFileTypes: true })
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return []
      }
      throw err
    }
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
  }

  async fileExists(container: Container, key: string): Promise<boolean> {
    const segments = key.split(/[/\\]/).filter(Boolean)
    // TODO(symlink-hardening): safeJoin is lexical-only — harden with realpath check
    const abs = safeJoin(container as RootKey, ...segments)
    try {
      await fs.access(abs)
      return true
    } catch (err: unknown) {
      // Only treat ENOENT (missing file) as "not found".
      // Rethrow permission errors (EACCES/EPERM) and other I/O failures.
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return false
      }
      throw err
    }
  }

  getPublicUrl(container: Container, key: string): string {
    // Percent-encode each path segment for safe URL construction.
    const encoded = key
      .split(/[/\\]/)
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join("/")

    switch (container) {
      case "outputs":
        return `/api/outputs/${encoded}`
      case "inputs":
        // Inputs are not publicly served; throw to catch misuse early.
        throw new Error(
          `getPublicUrl() does not support the "inputs" container — ` +
          `only "outputs" assets have public proxy URLs.`,
        )
      default: {
        const _exhaustive: never = container
        throw new Error(`Unknown container: ${_exhaustive}`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const adapterCache = new Map<StorageBackend, StorageAdapter>()

/**
 * Returns the active StorageAdapter based on `CAST_STORAGE` env var.
 * - `local` (default): LocalFsAdapter (filesystem-backed)
 * - `azure`: AzureBlobAdapter (Azure Blob Storage-backed, lazy-loaded)
 *
 * Caches per backend key so an explicit override doesn't return a
 * previously cached adapter for a different backend.
 *
 * Async because the Azure SDK is loaded dynamically to avoid pulling
 * @azure/storage-blob at module init when CAST_STORAGE=local.
 */
export async function getStorageAdapter(backend?: StorageBackend): Promise<StorageAdapter> {
  const resolved = backend ?? getStorageBackend()
  const existing = adapterCache.get(resolved)
  if (existing) return existing
  let adapter: StorageAdapter
  switch (resolved) {
    case "local":
      adapter = new LocalFsAdapter()
      break
    case "azure": {
      const { AzureBlobAdapter } = await import("@/lib/cast/server/azure-blob-adapter")
      adapter = new AzureBlobAdapter()
      break
    }
    default:
      throw new Error(`Unknown storage backend: ${resolved}`)
  }
  adapterCache.set(resolved, adapter)
  return adapter
}

/** Reset the cached adapter(s) (test seam). */
export function _resetStorageAdapter(): void {
  adapterCache.clear()
}
