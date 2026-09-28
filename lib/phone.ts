export function formatBurkinaPhoneInput(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  const localDigits = digits.startsWith("226") && digits.length > 8
    ? digits.slice(3, 11)
    : digits.slice(0, 8);
  return localDigits.match(/.{1,2}/g)?.join(" ") ?? "";
}

export function toBurkinaPhoneNumber(value: string | null | undefined) {
  const formatted = formatBurkinaPhoneInput(value);
  return formatted ? `+226 ${formatted}` : "";
}

export function isValidBurkinaPhoneNumber(value: string) {
  return /^\+226 \d{2}( \d{2}){3}$/.test(value);
}

export function toSavedBurkinaPhoneNumber(value: string | null | undefined) {
  const formatted = toBurkinaPhoneNumber(value);
  return isValidBurkinaPhoneNumber(formatted) ? formatted : "";
}

export function toBurkinaPhoneHref(value: string | null | undefined) {
  const formatted = toSavedBurkinaPhoneNumber(value);
  return formatted ? `tel:${formatted.replace(/[^\d+]/g, "")}` : "";
}
