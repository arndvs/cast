"use server"

import fs from "node:fs/promises"
import { execFile } from "node:child_process"
import { safeJoin, PathTraversalError } from "@/lib/cast/server/safe-join"
import { MARKET_RE, ratioSchema, SLUG_RE, type AspectRatio } from "@/lib/cast/schemas"

/**
 * revealOutputFolder — open the per-campaign outputs folder in the OS file
 * manager. Privileged shell call, so every input is validated:
 *
 *   1. campaign matches SLUG_RE (no shell metacharacters survive this).
 *   2. safeJoin('outputs', campaign) — rejects traversal, absolute paths.
 *   3. fs.stat asserts the directory exists and is a directory.
 *   4. execFile (NEVER exec/shell) with explicit argv per platform.
 *
 * Returns a result discriminator instead of throwing — the client renders a
 * toast either way and we don't want a server-action error boundary to eat
 * it. explorer.exe exits non-zero on success on some Windows builds, so we
 * treat exit code 1 as success per Microsoft's documented behavior.
 */
export async function revealOutputFolder({
  campaign,
}: {
  campaign: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof campaign !== "string" || !SLUG_RE.test(campaign)) {
    return { ok: false, error: "invalid campaign slug" }
  }

  let target: string
  try {
    // TODO(symlink-hardening): re-validate with realpath before stat/execFile.
    target = safeJoin("outputs", campaign)
  } catch (err) {
    if (err instanceof PathTraversalError) {
      return { ok: false, error: "invalid campaign path" }
    }
    return { ok: false, error: errMessage(err) }
  }

  try {
    const stat = await fs.stat(target)
    if (!stat.isDirectory()) {
      return { ok: false, error: "campaign output folder not found" }
    }
  } catch (err) {
    if (isENOENT(err)) {
      return { ok: false, error: "campaign output folder not found" }
    }
    return { ok: false, error: errMessage(err) }
  }

  const platform = process.platform
  const argv: { cmd: string; args: string[] } =
    platform === "darwin"
      ? { cmd: "open", args: [target] }
      : platform === "win32"
        ? { cmd: "explorer.exe", args: [target] }
        : { cmd: "xdg-open", args: [target] }

  return await new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
    execFile(argv.cmd, argv.args, (err) => {
      if (err === null) {
        resolve({ ok: true })
        return
      }
      // explorer.exe routinely exits with code 1 on success.
      const code = (err as unknown as { code?: number | string }).code
      if (platform === "win32" && code === 1) {
        resolve({ ok: true })
        return
      }
      resolve({ ok: false, error: err.message })
    })
  })
}

function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  )
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

/**
 * resolveCreativeAbsolutePath — server-only helper for the creative detail dialog's
 * "Copy path" button. The manifest stores creative paths repo-relative
 * (POSIX), but operators want the OS-absolute path on the clipboard so
 * pasting it into a terminal or file dialog Just Works.
 *
 * Mirrors `revealOutputFolder`'s validation discipline:
 *   1. campaign / market / product slugs match SLUG_RE / MARKET_RE.
 *   2. ratio matches `ratioSchema`.
 *   3. safeJoin('outputs', …) — rejects traversal & absolute segments.
 *
 * Returns a result discriminator instead of throwing so the client can
 * surface a toast either way.
 */
export async function resolveCreativeAbsolutePath({
  campaign,
  market,
  product,
  ratio,
}: {
  campaign: string
  market: string
  product: string
  ratio: AspectRatio
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (typeof campaign !== "string" || !SLUG_RE.test(campaign)) {
    return { ok: false, error: "invalid campaign slug" }
  }
  if (typeof market !== "string" || !MARKET_RE.test(market)) {
    return { ok: false, error: "invalid market code" }
  }
  if (typeof product !== "string" || !SLUG_RE.test(product)) {
    return { ok: false, error: "invalid product slug" }
  }
  const ratioParsed = ratioSchema.safeParse(ratio)
  if (!ratioParsed.success) {
    return { ok: false, error: "invalid ratio" }
  }

  try {
    // TODO(symlink-hardening): re-validate with realpath before returning.
    const abs = safeJoin(
      "outputs",
      campaign,
      market,
      product,
      `${ratioParsed.data}.png`,
    )
    return { ok: true, path: abs }
  } catch (err) {
    if (err instanceof PathTraversalError) {
      return { ok: false, error: "invalid creative path" }
    }
    return { ok: false, error: errMessage(err) }
  }
}
