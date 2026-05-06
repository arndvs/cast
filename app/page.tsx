import { Topbar } from "@/components/cast/topbar"
import { S1Shell } from "@/components/cast/s1-shell"
import { loadDemoBrief } from "@/lib/cast/server/brief-loader"
import { loadBrandProfile } from "@/lib/cast/server/brand-loader"
import {
  BrandIncompleteError,
  BrandInvalidError,
  BrandNotFoundError,
} from "@/lib/cast/errors"
import type { BrandProfile } from "@/lib/cast/schemas"

export default async function Page() {
  const brief = await loadDemoBrief()

  // Best-effort brand load. Failures fall back to `brand: null` so the editor
  // renders without the logo grid; the missing-brand banner ships in a
  // follow-up PR. Throw-back on unexpected (non-brand) errors.
  let brand: BrandProfile | null = null
  try {
    brand = await loadBrandProfile(brief.brand)
  } catch (err) {
    if (
      !(err instanceof BrandNotFoundError) &&
      !(err instanceof BrandIncompleteError) &&
      !(err instanceof BrandInvalidError)
    ) {
      throw err
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <Topbar crumb={`${brief.brand} · ${brief.campaign}`} />
      <S1Shell
        initialBrief={brief}
        brand={
          brand
            ? {
                defaultLogoId: brand.defaultLogoId,
                logoVariants: brand.logoVariants,
              }
            : null
        }
      />
    </div>
  )
}
