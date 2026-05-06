import type { Metadata } from "next"
import { DM_Sans, Geist_Mono, Outfit } from "next/font/google"

import "./globals.css"

const fontDisplay = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["800", "900"],
})

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Cast — From brief to broadcast",
  description:
    "Creative Automation Studio Toolchain — turns a campaign brief into on-brand, localized social ad creatives at three aspect ratios.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
