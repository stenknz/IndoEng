"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const doFetch = async (): Promise<Response> => {
    const res = await fetch(path, {
      method,
      headers: {
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        "x-kak-request": "1",
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
    return res;
  };

  let res = await doFetch();
  if (res.status === 401) {
    const refresh = await fetch("/api/auth/refresh", { method: "POST", headers: { "x-kak-request": "1" }, credentials: "same-origin" });
    if (refresh.ok) res = await doFetch();
  }
  if (!res.ok) {
    let msg = "Request failed";
    try { const data = await res.json(); if (data && typeof data.error === "string") msg = data.error; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}
