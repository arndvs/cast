import type { Metadata } from "next"
import { DM_Sans, Geist_Mono, Outfit } from "next/font/google"
import Script from "next/script"

import { Toaster } from "@/components/ui/sonner"

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
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <Toaster richColors closeButton position="bottom-right" />
        {process.env.NEXT_PUBLIC_DROPBOX_APP_KEY && (
          <Script
            src="https://www.dropbox.com/static/api/2/dropins.js"
            data-app-key={process.env.NEXT_PUBLIC_DROPBOX_APP_KEY}
            strategy="lazyOnload"
            id="dropboxjs"
          />
        )}
      </body>
    </html>
  )
}
