import { ClerkProvider } from "@clerk/nextjs"

export function AuthClerkProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    return <>{children}</>
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
      appearance={{
        variables: {
          colorPrimary: "oklch(0.55 0.14 150)", // Brand emerald
          borderRadius: "0.5rem",
        },
        elements: {
          card: "shadow-sm border border-border bg-card text-card-foreground",
          formButtonPrimary:
            "bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm shadow-none",
          formFieldInput:
            "border-input bg-background focus:ring-ring focus:border-ring text-foreground text-sm",
          footerActionLink: "text-primary hover:underline font-medium",
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
