import { Topbar } from "@/components/cast/topbar"
import { S1Shell } from "@/components/cast/s1-shell"
import { loadDemoBrief } from "@/lib/cast/server/brief-loader"

export default async function Page() {
  const brief = await loadDemoBrief()
  return (
    <div className="flex min-h-svh flex-col">
      <Topbar crumb={`${brief.brand} · ${brief.campaign}`} />
      <S1Shell initialBrief={brief} />
    </div>
  )
}
