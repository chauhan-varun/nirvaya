import { LanguageSelector } from "@/components/shell/language-selector"
import { AuthClerkProvider } from "@/features/auth/components/clerk-provider-wrapper"
import { Brand } from "@/components/shell/brand"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthClerkProvider>
      <div className="flex min-h-screen flex-col bg-muted/30">
        <header className="border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
            <Brand />
            <LanguageSelector />
            <Link
              href="/"
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              ← Back to home
            </Link>
          </div>
        </header>
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center p-4 md:p-8"
        >
          {children}
        </main>
      </div>
    </AuthClerkProvider>
  )
}
