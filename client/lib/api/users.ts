/**
 * lib/api/users.ts
 * 
 * User API endpoints
 */

import { apiFetch } from "./fetch";
import { API_ENDPOINTS } from "./config";
import type { User, CreateUserData, UpdateUserData } from "@/types/user";

export const usersAPI = {
  /**
   * Sign in with GitHub token
   * POST /api/v1/users/signin
   */
  signIn: async (data: CreateUserData) => {
    return apiFetch<User>(API_ENDPOINTS.users.signIn, {
      method: "POST",
      body: data,
    });
  },

  /**
   * Get current user
   * GET /api/v1/users/me
   */
  getCurrentUser: async () => {
    return apiFetch<User>(API_ENDPOINTS.users.me, {
      method: "GET",
    });
  },

  /**
   * Complete onboarding
   * POST /api/v1/users/onboarding/complete
   */
  completeOnboarding: async (data: UpdateUserData) => {
    return apiFetch<User>(API_ENDPOINTS.users.onboarding, {
      method: "POST",
      body: data,
    });
  },
};
