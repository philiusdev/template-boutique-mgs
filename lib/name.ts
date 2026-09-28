export function getNameMonogram(fullName: string, fallback = "") {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toLocaleUpperCase("fr-FR");
  }
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("fr-FR");
  return fallback.trim().slice(0, 1).toLocaleUpperCase("fr-FR") || "?";
}
