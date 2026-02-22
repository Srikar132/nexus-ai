"use server";

import { headers } from "next/headers";

interface FetchAPIOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  params?: Record<string, string>;
}

interface APIResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export async function fetchAPI<T = any>(
  path: string,
  options: FetchAPIOptions = {}
): Promise<APIResponse<T>> {
  const { method = 'GET', body, params = {} } = options;

  try {
    // Get the browser cookies (includes the NextAuth session cookie)
    const headersList = await headers();
    const cookie = headersList.get('cookie') || '';

    if (!cookie) {
      return {
        status: 401,
        error: 'Authentication required',
      };
    }

    // Construct the backend API URL
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const url = new URL(path, baseURL);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    // Prepare the request options — forward cookies as-is
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
    };

    // Add body for methods that support it
    if (body && method !== 'GET' && method !== 'DELETE') {
      requestOptions.body = JSON.stringify(body);
    }

    // Make the direct request to backend
    const response = await fetch(url.toString(), requestOptions);

    // Parse JSON response
    const data: T = await response.json();

    return {
      data: response.ok ? data : undefined,
      status: response.status,
      error: response.ok ? undefined : (data as any)?.error || 'Request failed',
    };

  } catch (error) {
    console.error('fetchAPI error:', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}