import { test } from "node:test";
import assert from "node:assert/strict";
import { isYearLevel, parseDateOnly, parseChiropracticExperience, ProfileValidationError } from "./profileUpdate";

test("isYearLevel accepts only the two enum values", () => {
  assert.equal(isYearLevel("YEAR_2"), true);
  assert.equal(isYearLevel("YEAR_3"), false);
  assert.equal(isYearLevel(2), false);
});

test("parseDateOnly keeps the calendar day in UTC", () => {
  assert.equal(parseDateOnly("2001-03-09")!.toISOString(), "2001-03-09T00:00:00.000Z");
  assert.equal(parseDateOnly(""), null);
  assert.equal(parseDateOnly(undefined), undefined);
  assert.throws(() => parseDateOnly("09/03/2001"), ProfileValidationError);
});

test("absent chiropracticExperience means 'leave entries alone'", () => {
  assert.equal(parseChiropracticExperience(undefined), undefined);
});

test("chiropracticExperience is validated and trimmed", () => {
  assert.deepEqual(parseChiropracticExperience([{ chiropractorName: " Jess Francois ", status: "OBSERVING", date: "" }]),
    [{ chiropractorName: "Jess Francois", status: "OBSERVING", date: null }]);
  assert.deepEqual(parseChiropracticExperience([]), []);
  assert.throws(() => parseChiropracticExperience([{ chiropractorName: "", status: "OBSERVING" }]), ProfileValidationError);
  assert.throws(() => parseChiropracticExperience([{ chiropractorName: "A", status: "WATCHING" }]), ProfileValidationError);
  assert.throws(() => parseChiropracticExperience("nope"), ProfileValidationError);
});
