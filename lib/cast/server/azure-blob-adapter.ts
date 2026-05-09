/**
 * AzureBlobAdapter — Azure Blob Storage implementation of StorageAdapter.
 *
 * Maps logical containers to Azure Blob containers:
 *   - "inputs"  → cast-inputs
 *   - "outputs" → cast-outputs
 *
 * Uses @azure/storage-blob SDK. Connection string sourced from config module.
 * Keys are normalized to forward-slash blob names.
 */

import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  type BlobDownloadResponseParsed,
} from "@azure/storage-blob"
import type { Container, StorageAdapter } from "@/lib/cast/server/storage-adapter"
import { getAzureConnectionString } from "@/lib/cast/server/config"

// ---------------------------------------------------------------------------
// Container name mapping
// ---------------------------------------------------------------------------

const AZURE_CONTAINER_MAP: Record<Container, string> = {
  inputs: "cast-inputs",
  outputs: "cast-outputs",
} as const

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class AzureBlobAdapter implements StorageAdapter {
  private readonly serviceClient: BlobServiceClient
  private readonly containerClients = new Map<Container, ContainerClient>()

  constructor(connectionString?: string) {
    const cs = connectionString ?? getAzureConnectionString()
    this.serviceClient = BlobServiceClient.fromConnectionString(cs)
  }

  private getContainerClient(container: Container): ContainerClient {
    let client = this.containerClients.get(container)
    if (!client) {
      const azureName = AZURE_CONTAINER_MAP[container]
      client = this.serviceClient.getContainerClient(azureName)
      this.containerClients.set(container, client)
    }
    return client
  }

  /** Normalize key to a valid blob name (forward slashes, no leading slash). */
  private normalizeBlobName(key: string): string {
    return key
      .split(/[/\\]/)
      .filter(Boolean)
      .join("/")
  }

  async readFile(container: Container, key: string): Promise<Buffer> {
    const blobName = this.normalizeBlobName(key)
    const blobClient = this.getContainerClient(container).getBlobClient(blobName)
    const response: BlobDownloadResponseParsed = await blobClient.download(0)
    const body = response.readableStreamBody
    if (!body) {
      throw new Error(`Empty response body for blob "${blobName}" in "${container}"`)
    }
    return streamToBuffer(body)
  }

  async writeFile(
    container: Container,
    key: string,
    data: Buffer | string,
    contentType?: string,
  ): Promise<void> {
    const blobName = this.normalizeBlobName(key)
    const blockBlobClient = this.getContainerClient(container)
      .getBlockBlobClient(blobName)
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data
    await blockBlobClient.upload(buf, buf.length, {
      blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
    })
  }

  async deleteFile(container: Container, key: string): Promise<void> {
    const blobName = this.normalizeBlobName(key)
    const blobClient = this.getContainerClient(container).getBlobClient(blobName)
    await blobClient.deleteIfExists()
  }

  async deletePrefix(container: Container, prefix: string): Promise<void> {
    const normalizedPrefix = this.normalizeBlobName(prefix)
    const containerClient = this.getContainerClient(container)
    // List all blobs under the prefix and delete each.
    // Azure Blob does not have native "delete directory" — iterate blobs.
    for await (const blob of containerClient.listBlobsFlat({ prefix: normalizedPrefix })) {
      await containerClient.getBlobClient(blob.name).deleteIfExists()
    }
  }

  async listFiles(container: Container, prefix: string): Promise<string[]> {
    const normalizedPrefix = this.normalizeBlobName(prefix)
    const containerClient = this.getContainerClient(container)
    const keys: string[] = []
    for await (const blob of containerClient.listBlobsFlat({ prefix: normalizedPrefix })) {
      keys.push(blob.name)
    }
    return keys
  }

  async fileExists(container: Container, key: string): Promise<boolean> {
    const blobName = this.normalizeBlobName(key)
    const blobClient = this.getContainerClient(container).getBlobClient(blobName)
    return blobClient.exists()
  }

  getPublicUrl(container: Container, key: string): string {
    const blobName = this.normalizeBlobName(key)

    switch (container) {
      case "outputs": {
        // Generate a read-only SAS URL valid for 1 hour.
        const containerClient = this.getContainerClient(container)
        const blobClient = containerClient.getBlobClient(blobName)

        // If the service client was created from a connection string with
        // an account key, we can generate SAS tokens. Otherwise fall back
        // to the blob URL (works for public containers).
        const credential = this.extractCredential()
        if (credential) {
          const expiresOn = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
          const sas = generateBlobSASQueryParameters(
            {
              containerName: AZURE_CONTAINER_MAP[container],
              blobName,
              permissions: BlobSASPermissions.parse("r"),
              expiresOn,
            },
            credential,
          ).toString()
          return `${blobClient.url}?${sas}`
        }

        // Fallback: assume public container access.
        return blobClient.url
      }
      case "inputs":
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

  /**
   * Attempt to extract the shared-key credential from the service client.
   * Returns null if the client uses a different auth mechanism (e.g. managed identity).
   */
  private extractCredential(): StorageSharedKeyCredential | null {
    // BlobServiceClient stores the credential on a private property.
    // The SDK doesn't expose a public accessor, but the credential is
    // available when constructed from a connection string with AccountKey.
    const cred = (this.serviceClient as unknown as { credential?: unknown }).credential
    if (cred instanceof StorageSharedKeyCredential) return cred
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function streamToBuffer(readable: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array))
  }
  return Buffer.concat(chunks)
}
