import { CreateUserData, UpdateUserData, User } from "@/types/user";
import { fetchAPI } from "../fetch-api";

/**
 * User service for managing user data
 * All endpoints are prefixed with /api/v1
 */
const userServices = {
  /**
   * Sign in user with GitHub token
   * POST /api/v1/users/signin
   */
  signIn: async (data: CreateUserData): Promise<User> => {
    const response = await fetchAPI<User>("/api/v1/users/signin", {
      method: 'POST',
      body: data,
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data!;
  },

  /**
   * Get current user data
   * GET /api/v1/users/me
   */
  getUser: async (): Promise<User> => {
    const response = await fetchAPI<User>("/api/v1/users/me", {
      method: 'GET',
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data!;
  },

  /**
   * Complete user onboarding
   * POST /api/v1/users/onboarding/complete
   */
  completeOnboarding: async (data: UpdateUserData): Promise<User> => {
    const response = await fetchAPI<User>("/api/v1/users/onboarding/complete", {
      method: 'POST',
      body: data,
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data!;
  },
};

export default userServices;
