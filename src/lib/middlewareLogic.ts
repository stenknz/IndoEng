import "server-only";
import { loadConfig } from "@/lib/config";

const PUBLIC_AUTH = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/health"]);

export function shouldGate(pathname: string): boolean {
  if (!pathname.startsWith("/api")) return false;
  return !PUBLIC_AUTH.has(pathname);
}

export function isSafeMutation(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  if (request.headers.get("x-kak-request") === "1") return true;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(loadConfig().appUrl).host;
    } catch {
      return false;
    }
  }
  return false;
}
