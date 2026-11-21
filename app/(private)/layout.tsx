import { LanguageSelector } from "@/components/shell/language-selector"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { AuthClerkProvider } from "@/features/auth/components/clerk-provider-wrapper"
import { TRPCReactProvider } from "@/trpc/client"
import { Brand } from "@/components/shell/brand"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const secretKey = process.env.CLERK_SECRET_KEY

  if (!publishableKey || !secretKey) {
    redirect("/sign-in?error=auth_not_configured")
  }

  const session = await auth()
  if (!session.userId) {
    redirect("/sign-in")
  }

  return (
    <AuthClerkProvider>
      <TRPCReactProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <header className="border-b bg-card/50 px-4 py-3 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <Brand />
                <nav className="hidden items-center gap-4 text-xs font-medium md:flex">
                  <Link
                    href="/dashboard"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/care-circle"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    Care circle
                  </Link>
                  <Link
                    href="/preview"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    Public preview
                  </Link>
                </nav>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <LanguageSelector />
                <UserButton />
              </div>
            </div>
          </header>
          <main id="main-content" className="flex-1 p-4 md:p-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </TRPCReactProvider>
    </AuthClerkProvider>
  )
}
