import { SignUp } from "@clerk/nextjs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShieldCheck } from "lucide-react"

export default function SignUpPage() {
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  if (!isConfigured) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <ShieldCheck className="size-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Authentication setup
            </span>
          </div>
          <CardTitle>Sign-up not configured</CardTitle>
          <CardDescription>
            Clerk authentication credentials are not configured in this
            environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Please set{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              CLERK_SECRET_KEY
            </code>{" "}
            in your local{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              .env.local
            </code>{" "}
            file.
          </p>
          <p className="text-xs">
            Private health routes fail closed by design to prevent unauthorized
            access.
          </p>
        </CardContent>
      </Card>
    )
  }

  return <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
}
