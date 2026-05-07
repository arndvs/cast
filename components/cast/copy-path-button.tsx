"use client"

import * as React from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { resolveCreativeAbsolutePath } from "@/app/actions/reveal"
import type { Creative } from "@/lib/cast/schemas"

interface CopyPathButtonProps {
  campaign: string
  market: string
  product: string
  ratio: Creative["ratio"]
}

export function CopyPathButton({ campaign, market, product, ratio }: CopyPathButtonProps) {
  const [pending, setPending] = React.useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        try {
          const res = await resolveCreativeAbsolutePath({
            campaign,
            market,
            product,
            ratio,
          })
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          await navigator.clipboard.writeText(res.path)
          toast.success("Path copied")
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err))
        } finally {
          setPending(false)
        }
      }}
    >
      <Copy className="mr-1 h-3 w-3" />
      Copy path
    </Button>
  )
}
