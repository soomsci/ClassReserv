import "server-only";

/**
 * 아주 단순한 메모리 기반 요청 제한.
 * 서버 인스턴스마다 따로 세므로 완벽하진 않지만, 장난성 대량 등록은 막아준다.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  // 메모리 누수 방지: 가끔 오래된 키 정리
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

export function clientKey(req: Request, suffix = ""): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || "local";
  return `${ip}:${suffix}`;
}
