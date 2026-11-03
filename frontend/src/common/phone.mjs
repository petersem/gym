/**
 * Check an Australian phone number, ignoring single spaces and the separators
 * ( ) . - . Two or more consecutive whitespace characters are rejected.
 * Mirrors the backend validation.
 *
 * @param {string} value Phone number as typed.
 * @returns {boolean} True when the number is a valid Australian number.
 */
export function isAustralianPhone(value) {
  const text = String(value ?? "").trim();
  return (
    !/\s{2,}/.test(text) &&
    /^(?:0[23478]\d{8}|\+61[23478]\d{8}|13\d{4}|(?:1300|1800)\d{6})$/.test(
      text.replace(/[\s().-]/g, ""),
    )
  );
}
