import { parsePhoneNumber, type CountryCode } from "libphonenumber-js";

const DEFAULT_COUNTRY: CountryCode = "FR";

/**
 * Normalize a phone number to E.164 format (+33612345678).
 * Handles formats like 0612345678, 0033612345678, +33612345678, 33 6 12 34 56 78.
 * Falls back to basic cleanup if libphonenumber can't parse the input.
 */
export function normalizePhone(
  phone: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string {
  if (!phone?.trim()) return "";

  const cleaned = phone.trim();

  try {
    const parsed = parsePhoneNumber(cleaned, defaultCountry);
    if (parsed?.isValid()) {
      return parsed.format("E.164");
    }
  } catch {
    // libphonenumber couldn't parse; fall through to manual cleanup
  }

  // Fallback: strip spaces, convert leading 00 to +
  let fallback = cleaned.replace(/\s/g, "").replace(/^00/, "+");
  if (!fallback.startsWith("+") && fallback.length >= 9) {
    fallback = `+${defaultCountry === "FR" ? "33" : ""}${fallback.replace(/^0/, "")}`;
  }
  return fallback;
}

/**
 * Extract the last 9 significant digits for fuzzy matching.
 * Useful for French numbers where +33612345678 and 0612345678 share the last 9 digits.
 */
export function last9Digits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-9);
}
