import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: {
    default: "SugarGuard CareBridge | Your next step to better health",
    template: "%s | SugarGuard CareBridge",
  },
  description:
    "An English-first metabolic-health companion with optional Indian-language translation. Understand your risk, build daily habits, and bring your care circle closer. Interface preview only.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ClerkProvider>
          <ThemeProvider defaultTheme="light" enableSystem={false}>
            <a
              href="#main-content"
              className="sr-only z-50 rounded-lg bg-background p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              Skip to content
            </a>
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
