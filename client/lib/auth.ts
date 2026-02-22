import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
import GitHub from "next-auth/providers/github"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        GitHub({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: "read:user user:email repo",
                },
            },
        }),
    ],
    callbacks: {
        /**
         * JWT callback - runs when token is created or updated
         */
        async jwt({ token, user, account, trigger, session }): Promise<JWT> {
            if (account && user) {
                token.accessToken = account.access_token;
                token.id = user.id;
                token.email = user.email;
                token.username = user.username;
                token.onboardingCompleted = user.onboardingCompleted;
            }

            if (session?.onboardingCompleted !== undefined) {
                token.onboardingCompleted = session.onboardingCompleted;
            }

            return token;
        },

        /**
         * Session callback - runs when session is checked
         */
        async session({ session, token }): Promise<Session> {
            if (token.accessToken) {
                session.accessToken = token.accessToken as string;
            }

            if (session.user) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.username = token.username as string | undefined;
                session.user.onboardingCompleted = token.onboardingCompleted as boolean;
            }

            return session;
        },

        /**
         * SignIn callback - called server-side, must use plain fetch (not axios/getSession)
         */
        async signIn({ user, account }) {
            if (account?.provider === "github") {
                try {
                    if (!account.access_token) {
                        throw new Error("GitHub access token is missing");
                    }

                    // IMPORTANT: Use plain fetch here.
                    // This callback runs server-side — axios interceptors that call
                    // getSession() (a client-only API) will throw an error.
                    const apiUrl = process.env.API_URL || "http://127.0.0.1:8000";
                    const res = await fetch(`${apiUrl}/api/v1/users/signin`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ githubToken: account.access_token }),
                    });

                    if (!res.ok) {
                        throw new Error(`Backend signin failed with status: ${res.status}`);
                    }

                    const dbUser = await res.json();

                    // Attach backend user data to the user object for JWT
                    user.id = dbUser.id;
                    user.email = dbUser.email;
                    user.username = dbUser.username;
                    user.onboardingCompleted = dbUser.onboardingCompleted === 1;

                    return true;
                } catch (error) {
                    console.error("Error during sign in:", error);
                    return false;
                }
            }
            return true;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
});