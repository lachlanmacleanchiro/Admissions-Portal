import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateOnly, toDateInputValue, formatSuburbCity, formatChiroExperience, formatEducationYears } from "./applicantDisplay";

test("DOB stored as UTC midnight shows the same calendar day", () => {
  assert.equal(formatDateOnly(new Date("2001-03-09T00:00:00.000Z")), "09/03/2001");
  assert.equal(formatDateOnly(null), "—");
});

test("toDateInputValue round-trips a date-only value", () => {
  assert.equal(toDateInputValue(new Date("2001-03-09T00:00:00.000Z")), "2001-03-09");
  assert.equal(toDateInputValue(null), "");
});

test("formatSuburbCity skips blanks", () => {
  assert.equal(formatSuburbCity("Mt Wellington", "Auckland"), "Mt Wellington, Auckland");
  assert.equal(formatSuburbCity(null, "Auckland"), "Auckland");
  assert.equal(formatSuburbCity(" ", null), "—");
});

test("formatChiroExperience labels each status", () => {
  assert.deepEqual(
    formatChiroExperience([{ chiropractorName: "Jess Francois", status: "OBSERVING" }, { chiropractorName: "Ana Lee", status: "UNDER_CARE" }]),
    ["Jess Francois (Observing)", "Ana Lee (Under care)"],
  );
});

test("formatEducationYears", () => {
  assert.equal(formatEducationYears(2018, 2022), "2018–2022");
  assert.equal(formatEducationYears(2023, null), "2023–present");
});
