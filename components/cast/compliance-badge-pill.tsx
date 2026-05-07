"use client"

import { Badge } from "@/components/ui/badge"

interface ComplianceBadgePillProps {
  badge: "OK" | "WARN" | "FAIL"
}

export function ComplianceBadgePill({ badge }: ComplianceBadgePillProps) {
  if (badge === "OK") {
    return <Badge className="bg-ok/15 text-ok hover:bg-ok/15">OK</Badge>
  }
  if (badge === "WARN") {
    return <Badge className="bg-warn/15 text-warn hover:bg-warn/15">WARN</Badge>
  }
  return <Badge variant="destructive">FAIL</Badge>
}
