"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

/**
 * Cast theme provider — thin wrapper around `next-themes` so app code can
 * import a single client boundary. Default theme is light; system theme
 * detection is disabled to keep the demo deterministic.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
