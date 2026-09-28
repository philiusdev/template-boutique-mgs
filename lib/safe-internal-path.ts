const INTERNAL_ORIGIN = "https://atelier-naya.invalid";

export function safeInternalPath(value: string | null | undefined, fallback = "/mes-commandes") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }

  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return fallback;
    }
    if (decoded.includes("\\")) return fallback;
  }
  if (/%5c/i.test(decoded)) return fallback;

  try {
    const target = new URL(value, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN || target.username || target.password || target.pathname.startsWith("//")) {
      return fallback;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
