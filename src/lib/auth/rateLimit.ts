import "server-only";

interface Bucket { count: number; resetAt: number }

export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();
  const sweep = () => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  };
  return (key: string): { allowed: boolean; retryAfterMs: number } => {
    sweep();
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (b.count >= max) return { allowed: false, retryAfterMs: b.resetAt - now };
    b.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  };
}

export function clientIp(request: Request, trustProxy: boolean, directIp?: string | null): string {
  if (trustProxy) {
    const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return xff || directIp || "unknown";
  }
  // Never trust X-Forwarded-For unless the deployment declares a trusted
  // proxy: it is client-controllable and lets an attacker rotate IPs to
  // bypass rate limiting.
  return directIp || "unknown";
}
