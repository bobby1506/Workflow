import { auth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";

/**
 * Returns the current user's ID from the Clerk session.
 * Returns null if the user is not authenticated.
 */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Returns the current user's ID and throws if not authenticated.
 * Use this in protected API routes that require authentication.
 */
export async function requireUser(): Promise<{ userId: string; user: User }> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await currentUser();

  if (!user) {
    throw new Error("User not found");
  }

  return { userId, user };
}
