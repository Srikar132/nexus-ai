import axios, { AxiosError } from "axios";
import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Axios instance for making authenticated requests to the backend
 */
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const session = await getSession();
    if (session?.accessToken) {
      console.log("User access token:", session.accessToken);
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; detail?: string }>) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.message ||
      "An error occurred";
    return Promise.reject(new Error(message));
  }
);

// Export axios types for convenience
export type { AxiosError };
