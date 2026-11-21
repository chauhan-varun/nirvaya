import "server-only"
import { eq } from "drizzle-orm"
import { getDb } from "../index"
import { users, type User } from "../schema/users"

export async function findUserByClerkSubject(
  clerkSubject: string
): Promise<User | null> {
  const db = getDb()
  const result = await db
    .select()
    .from(users)
    .where(eq(users.clerkSubject, clerkSubject))
    .limit(1)

  return result[0] ?? null
}

export async function upsertUserFromClerk(params: {
  clerkSubject: string
  preferredLocale?: string
}): Promise<User> {
  const db = getDb()
  const existing = await findUserByClerkSubject(params.clerkSubject)

  if (existing) {
    if (
      params.preferredLocale &&
      existing.preferredLocale !== params.preferredLocale
    ) {
      const [updated] = await db
        .update(users)
        .set({
          preferredLocale: params.preferredLocale,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning()
      return updated ?? existing
    }
    return existing
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkSubject: params.clerkSubject,
      preferredLocale: params.preferredLocale ?? "en",
    })
    .returning()

  return created
}
