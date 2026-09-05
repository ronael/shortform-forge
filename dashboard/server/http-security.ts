export function sameHostOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestHostname = (host ?? "").split(":")[0];
    return originUrl.hostname === requestHostname || (isLoopback(originUrl.hostname) && isLoopback(requestHostname));
  } catch {
    return false;
  }
}

export function parseByteRange(header: string | undefined, size: number): { start: number; end: number } | undefined {
  const match = header?.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return undefined;
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) throw new RangeError("Plage vidéo invalide.");
  return { start, end };
}

export function isLoopback(value?: string): boolean {
  return value === "127.0.0.1" || value === "::1" || value === "localhost" || value?.startsWith("::ffff:127.") === true;
}
