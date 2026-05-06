import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Topbar } from "@/components/cast/topbar"

export default function Page() {
  return (
    <div className="min-h-svh flex flex-col">
      <Topbar crumb="skeleton · v1" />
      <main className="flex-1 px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-3xl tracking-[-0.02em]">
                Cast skeleton ready
              </CardTitle>
              <CardDescription className="font-mono text-xs uppercase tracking-[0.12em]">
                brand · brisa &nbsp;·&nbsp; mode ·{" "}
                {process.env.NEXT_PUBLIC_CAST_GENAI_MODE ?? "default"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              From brief to broadcast. The runtime shell is wired — design
              tokens, fonts, and the wordmark match{" "}
              <code className="font-mono text-xs">
                docs/design/cast-brand-guidelines.html
              </code>
              . Next slice (V2): the S1 brief editor.
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
