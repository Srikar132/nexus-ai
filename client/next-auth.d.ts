import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extended Session interface - only essential fields
   * Keep session lean for performance and security
   */
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      username?: string;
      onboardingCompleted: boolean;
    } & DefaultSession["user"];
  }

  /**
   * Extended User interface - full user data from backend
   * This is populated during sign-in but only minimal fields go into the session
   */
  interface User extends DefaultUser {
    id: string;
    githubId: string;
    email: string;
    username?: string;
    preferredStack?: string;
    preferredLanguage?: string;
    developerLevel: "beginner" | "intermediate" | "advanced" | "founder";
    onboardingCompleted: boolean;
    subscriptionTier: string;
    monthlyBuildsUsed: number;
    monthlyBuildsLimit: number;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extended JWT interface - only essential fields stored in token
   */
  interface JWT extends DefaultJWT {
    id: string;
    email: string;
    username?: string;
    onboardingCompleted: boolean;
  }
}
