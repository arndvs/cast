import { Topbar } from "@/components/cast/topbar"
import { S1Shell } from "@/components/cast/s1-shell"
import { loadDemoBrief } from "@/lib/cast/server/brief-loader"
import {
  listBrandSlugs,
  tryLoadBrand,
} from "@/lib/cast/server/brand-loader"
import { toBrandLoadErrorInfo } from "@/lib/cast/brand-hints"

export default async function Page() {
  const brief = await loadDemoBrief()

  // Parallel: brand-load and the available-slugs list run independently.
  // `tryLoadBrand` returns a discriminated value instead of throwing so the
  // editor can render with a `MissingBrandBanner` when the fixture is bad.
  // The slug list is UX-only (powers the banner's "available brands" hint),
  // so we degrade to `[]` if it fails rather than tanking the whole page.
  const [brandResult, slugsResult] = await Promise.allSettled([
    tryLoadBrand(brief.brand),
    listBrandSlugs(),
  ])
  if (brandResult.status === "rejected") throw brandResult.reason
  const brand = brandResult.value
  const brandsAvailable =
    slugsResult.status === "fulfilled" ? slugsResult.value : []

  return (
    <div className="flex min-h-svh flex-col">
      <Topbar crumb={`${brief.brand} · ${brief.campaign}`} />
      <S1Shell
        initialBrief={brief}
        brand={
          brand.ok
            ? {
                defaultLogoId: brand.profile.defaultLogoId,
                // Strip server-only fields (`path` is an absolute fs path
                // resolved via `safeJoin`) before crossing the
                // server→client boundary. The editor only needs the
                // identifying triple to render variant tiles.
                logoVariants: brand.profile.logoVariants.map((v) => ({
                  id: v.id,
                  displayName: v.displayName,
                  theme: v.theme,
                })),
              }
            : null
        }
        brandLoadError={brand.ok ? null : toBrandLoadErrorInfo(brand.error)}
        brandsAvailable={brandsAvailable}
      />
    </div>
  )
}
