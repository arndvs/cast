"use client"

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

/**
 * Cast theme provider — thin wrapper around `next-themes` so app code has
 * a single client boundary to import. Props pass straight through to
 * `next-themes`; callers (see `app/layout.tsx`) are responsible for
 * configuring `attribute`, `defaultTheme`, `enableSystem`, etc.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
