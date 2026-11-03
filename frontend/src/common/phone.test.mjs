import { describe, expect, test } from "@jest/globals";
import { isAustralianPhone } from "./phone.mjs";

describe("isAustralianPhone", () => {
  test.each([
    "0412345678",
    "0412 345 678",
    "+61 41 9826 157",
    "+61 4 1982 6157",
    " +61412 345678 ",
    "(02) 9999-8888",
    "02 9999 8888",
    "13 1234",
    "1800 123 456",
  ])("accepts %s regardless of spacing", (value) => {
    expect(isAustralianPhone(value)).toBe(true);
  });

  test.each([
    "",
    "12345",
    "letters",
    "0112345678",
    "+61 1 2345 6789",
    "0412  345 678",
    "02 9999  8888",
    null,
  ])("rejects %s", (value) => {
    expect(isAustralianPhone(value)).toBe(false);
  });
});
