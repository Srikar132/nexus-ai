import { auth } from "@/lib/auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Client-side session provider that wraps the app
 * Provides authentication context to all client components
 */
export async function SessionProvider({ children }: SessionProviderProps) {
  const session = await auth();
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
