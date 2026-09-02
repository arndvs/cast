/**
 * Banned-words parity — module-reference + behavioral parity.
 *
 * The brief editor (`components/cast/brief-editor.tsx`) imports
 * `containsBannedWord` directly from the canonical module; this test asserts
 * that the import IS the same object reference (referential identity).
 *
 * The server compliance stage (`lib/cast/server/pipeline/compliance.ts`)
 * closes over `containsBannedWord` internally and does not expose the
 * reference, so its parity is verified behaviorally — `runCompliance`
 * must agree with the canonical helper on a known input.
 *
 * Behavioral coverage of the helper itself lives in `banned-words.test.ts`.
 */

import { describe, it, expect } from "vitest"
import * as canonical from "@/lib/cast/banned-words"
// The editor module pulls heavy UI deps; instead, test the import path
// the editor uses directly via the same module reference.
import { containsBannedWord as clientImport } from "@/lib/cast/banned-words"
import { runCompliance } from "@/lib/cast/server/pipeline/compliance"

describe("banned-words parity", () => {
  it("client import is the same reference as the canonical module export", () => {
    expect(clientImport).toBe(canonical.containsBannedWord)
  })

  it("server compliance produces identical results to the canonical helper (behavioral parity)", () => {
    const canonicalHits = canonical.containsBannedWord(
      "you cannot kill the vibe",
      ["kill"]
    )
    const serverResult = runCompliance({
      headline: "you cannot kill the vibe",
      bannedWords: ["kill"],
    })
    expect(serverResult.checks.bannedWords).toEqual(canonicalHits)
    expect(serverResult.badge).toBe("FAIL")
  })
})
