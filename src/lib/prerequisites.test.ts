import { test } from "node:test";
import assert from "node:assert/strict";
import { STANDARD_PREREQUISITE_CODES, normaliseCourseCode, splitPrerequisiteRows, hasPrerequisiteDetails, type PrerequisiteRow } from "./prerequisites";

const row = (code: string, extra: Partial<PrerequisiteRow> = {}): PrerequisiteRow =>
  ({ nzccCourseCode: code, equivalentCourseCode: "", grade: "", institution: "", year: "", ...extra });

test("standard codes are the client's 8, in order", () => {
  assert.deepEqual([...STANDARD_PREREQUISITE_CODES], ["HUMBIO1", "HUMBIO2", "LIFESCI1", "LIFESCI2", "BIOMECP", "ELECTIVE 1", "ELECTIVE 2", "ELECTIVE 3"]);
});

test("normaliseCourseCode ignores case and spaces", () => {
  assert.equal(normaliseCourseCode(" humbio 1 "), "HUMBIO1");
  assert.equal(normaliseCourseCode("Elective 2"), normaliseCourseCode("ELECTIVE 2"));
});

test("empty input yields 8 empty standard rows and no legacy rows", () => {
  const { standard, legacy } = splitPrerequisiteRows([]);
  assert.equal(standard.length, 8);
  assert.deepEqual(standard.map((r) => r.nzccCourseCode), [...STANDARD_PREREQUISITE_CODES]);
  assert.ok(standard.every((r) => !hasPrerequisiteDetails(r)));
  assert.equal(legacy.length, 0);
});

test("loosely-typed codes fill the standard row under the standard spelling", () => {
  const { standard, legacy } = splitPrerequisiteRows([row("humbio 1", { grade: "A" })]);
  assert.equal(standard[0].nzccCourseCode, "HUMBIO1");
  assert.equal(standard[0].grade, "A");
  assert.equal(legacy.length, 0);
});

test("unknown codes and duplicates become legacy rows, never dropped", () => {
  const { standard, legacy } = splitPrerequisiteRows([
    row("CHEM101", { grade: "B" }),
    row("HUMBIO2", { grade: "A" }),
    row("humbio2", { grade: "C" }),
  ]);
  assert.equal(standard[1].grade, "A");
  assert.deepEqual(legacy.map((r) => [r.nzccCourseCode, r.grade]), [["CHEM101", "B"], ["humbio2", "C"]]);
});

test("hasPrerequisiteDetails ignores the code itself", () => {
  assert.equal(hasPrerequisiteDetails(row("HUMBIO1")), false);
  assert.equal(hasPrerequisiteDetails(row("HUMBIO1", { year: "2024" })), true);
  assert.equal(hasPrerequisiteDetails(row("HUMBIO1", { grade: "  " })), false);
});
