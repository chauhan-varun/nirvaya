import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { AuthClerkProvider } from "@/features/auth/components/clerk-provider-wrapper"
import { TRPCReactProvider } from "@/trpc/client"
import { PrivateHeader } from "@/components/shell/private-header"
import { AppFooter } from "@/components/shell/app-footer"

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
          <PrivateHeader />
          <main id="main-content" className="flex-1 p-4 md:p-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
          <AppFooter variant="compact" />
        </div>
      </TRPCReactProvider>
    </AuthClerkProvider>
  )
}
