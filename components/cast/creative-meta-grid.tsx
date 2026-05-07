import * as React from "react"

interface CreativeMetaGridProps {
  rows: readonly (readonly [string, string])[]
}

export function CreativeMetaGrid({ rows }: CreativeMetaGridProps) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="uppercase tracking-wider text-fg-3">{k}</dt>
          <dd className="text-fg-1">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}
