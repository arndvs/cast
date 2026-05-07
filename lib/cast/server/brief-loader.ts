/**
 * Server-only brief loader.
 *
 * Reads `inputs/brief.json` from the repo root and validates with
 * `briefSchema`. This is the seed for the reducer's initial state.
 */

import { readFile } from "node:fs/promises"
import path from "node:path"

import { briefSchema, type Brief } from "@/lib/cast/schemas"

export async function loadDemoBrief(): Promise<Brief> {
  const file = path.join(process.cwd(), "inputs", "brief.json")
  const raw = await readFile(file, "utf8")
  const json = JSON.parse(raw) as unknown
  return briefSchema.parse(json)
}
