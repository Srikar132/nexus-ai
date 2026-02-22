import { getSession } from "next-auth/react";
import { auth } from "./auth";
import { getToken } from "next-auth/jwt";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * API Client that automatically includes NextAuth JWT token in requests
 * Now sends NextAuth JWT instead of GitHub access token
 */
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Get NextAuth JWT token for API requests
   * This gets the actual JWT token, not the GitHub access token
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      // For client-side, we need to get the raw JWT token
      if (typeof window !== "undefined") {
        // Client-side: Get the NextAuth JWT from cookie
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const session = await response.json();
          if (session) {
            // Get the JWT token from the cookie
            const tokenResponse = await fetch("/api/auth/token");
            if (tokenResponse.ok) {
              const { token } = await tokenResponse.json();
              return token;
            }
          }
        }
        return null;
      } else {
        // Server-side: We need to access the request to get the JWT
        // This will be handled differently in server components
        const session = await auth();
        if (session) {
          // For server-side, we'll need to pass the token differently
          // This is a placeholder - we'll handle server-side differently
          return null;
        }
        return null;
      }
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // API Methods
  async getCurrentUser() {
    return this.makeRequest("/api/v1/users/me");
  }

  async completeOnboarding(data: {
    preferred_stack: string;
    preferred_language: string;
    developer_level: string;
  }) {
    return this.makeRequest("/api/v1/users/onboarding/complete", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Add more API methods as needed...
}

// Export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;
