export function formatBurkinaPhoneInput(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  // L'indicatif est retire des qu'il est present, et non seulement quand le
  // total depasse 8 chiffres. La valeur du formulaire vaut deja « +226 7 » des
  // la premiere frappe : un seuil a 8 chiffres faisait donc passer « 226 » pour
  // des chiffres du numero, et le champ affichait « 22 67 00 00 00 » au lieu de
  // « 70 00 00 00 ». Aucun numero burkinabe ne commence par 226, le retirer
  // systematiquement ne peut donc pas ecraser une saisie legitime.
  const localDigits = digits.startsWith("226") ? digits.slice(3) : digits;
  return localDigits.slice(0, 8).match(/.{1,2}/g)?.join(" ") ?? "";
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
