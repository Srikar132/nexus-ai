/**
 * lib/client-fetch.ts
 *
 * Client-side fetch wrapper — used ONLY inside hooks and client components.
 *
 * Auth: Next.js rewrites proxy /api/v1/* → FastAPI (next.config.ts).
 * Browser sees same-origin so authjs.session-token cookie is sent
 * automatically with credentials: "include". No token reading needed.
 */

export interface ClientFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string>;
}

export interface ClientFetchResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export async function clientFetch<T = unknown>(
  path: string,
  options: ClientFetchOptions = {}
): Promise<ClientFetchResponse<T>> {
  const { method = "GET", body, params } = options;

  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include", // sends authjs.session-token cookie — same origin via rewrite
  };

  if (body && method !== "GET" && method !== "DELETE") {
    init.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url.toString(), init);
    const data: T = await res.json();
    return {
      data: res.ok ? data : undefined,
      error: res.ok ? undefined : (data as any)?.detail ?? (data as any)?.error ?? "Request failed",
      status: res.status,
    };
  } catch (err) {
    return {
      status: 500,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Helper for SSE — returns raw URL (credentials handled by EventSource/fetch caller) */
export function clientUrl(path: string): string {
  return path; // same-origin via rewrite, no base URL needed
}
