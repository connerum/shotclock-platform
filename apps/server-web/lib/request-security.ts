interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
): Response | null {
  const now = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const key = `${scope}:${ip}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  if (bucket.count <= limit) return null;
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return Response.json({ error: 'Too many attempts. Try again later.' }, {
    status: 429,
    headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' },
  });
}

export function requireJson(request: Request): Response | null {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.toLowerCase().startsWith('application/json')) return null;
  return Response.json({ error: 'Content-Type must be application/json' }, { status: 415 });
}
