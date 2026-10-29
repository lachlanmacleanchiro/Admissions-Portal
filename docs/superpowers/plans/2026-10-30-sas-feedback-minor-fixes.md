# SAS Feedback: Minor Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship every minor, cosmetic and small-logic fix from the client's October 2026 SAS test feedback without a schema change.

**Architecture:**
- Pure logic goes into small `src/lib/*.ts` modules with unit tests:
  - prerequisite row merging
  - Content-Disposition building
  - profile-update validation
  - applicant display formatting
- UI and route changes consume those modules.
- Screen-level behaviour is verified with `tsc` and by hand in the running app, because the repo has no component-test setup.

**Tech Stack:** Next.js 16.2.9 (App Router), React 19, Prisma 7 (PostgreSQL), TypeScript 5, Tailwind 4, `tsx` + `node:test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-10-30-sas-feedback-minor-fixes-design.md`. Read it alongside this plan. Section numbers (§n) and client item numbers (#n) refer to it.

## Global Constraints

- **No schema or migration changes.** `prisma/schema.prisma` and `prisma/migrations/` must not change.
- **Next.js version:** read the relevant guide in `node_modules/next/dist/docs/` before changing routing, layouts or refresh behaviour. This Next.js version differs from older ones (`AGENTS.md`).
- **Style:**
  - Match the existing code: inline `style={{…}}` colours, green `#114E3B`, gold `#C79A3B`, muted text `#666` / `#888` / `#999`.
  - Card header: `px-5 py-3.5`, with an `text-[11px] font-semibold uppercase tracking-widest` title.
  - Use the UI components in `src/components/ui`.
- **Staff writes:** every staff write route uses `permissionGuard(...)` and records a `logAudit(...)` call.
- **Exact copy from the spec:**
  - "NZ Domestic"
  - "International"
  - "Intake year *"
  - "Please provide details"
  - "Please provide details of your support need."
  - "Suburb *"
  - "Suburb is required."
  - "Please list all courses taken."
  - "250 words max."
  - "Personal statement must be 250 words or fewer."
  - "Please select your applicant type."
  - "Please select an intake year."
  - "Score (%)"
  - "Essay Score (%)"
  - "No education history entered."
  - "Overall Grade Average"
  - "Prerequisites met"
- **Standard prerequisite codes, in order:** `HUMBIO1, HUMBIO2, LIFESCI1, LIFESCI2, BIOMECP, ELECTIVE 1, ELECTIVE 2, ELECTIVE 3`.
- **Branch:** work on `feature/sas-feedback-minor-fixes`, not `main`.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **DOB shifting by a day.** A `YYYY-MM-DD` date is stored as UTC midnight. Formatting it in NZ local time, or with a local-time `Date` in the edit form, can show the wrong day. Use UTC for both display and form value. Test owner: Task 5 (`formatDateOnly`, `toDateInputValue`).
2. **Unusual filenames in downloads.** Filenames with quotes, non-ASCII characters (`Māori essay.docx`) or commas must not break the header or the download name. Test owner: Task 2.
3. **Editing profile fields must not wipe chiropractic experience.** A profile PATCH without a `chiropracticExperience` key must leave existing entries alone. Only an explicit array replaces them. Test owner: Task 3 (`parseChiropracticExperience(undefined)` → `undefined`).
4. **Invalid year level or experience status.** These must get a 400 response, not a Prisma 500. Test owner: Task 3.
5. **Free-text prerequisite codes and duplicates.** Old rows typed as "humbio 1", or the same code entered twice, must land in the right row and never be dropped on save. Test owner: Task 1.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | add `test` script |
| `src/lib/prerequisites.ts` (new) | standard codes, code normalisation, splitting saved rows into standard/legacy |
| `src/lib/contentDisposition.ts` (new) | build a safe `Content-Disposition` value |
| `src/lib/profileUpdate.ts` (new) | validate and parse staff profile-update input |
| `src/lib/applicantDisplay.ts` (new) | display formatters for Details / Academic cards |
| `src/lib/*.test.ts` (new) | unit tests for the four modules above |
| `src/app/api/files/[...key]/route.ts` | real filename and inline/attachment |
| `src/app/(auth)/apply/ApplyWizard.tsx`, `src/app/api/apply/route.ts` | #2–7 |
| `src/app/api/admin/applicants/[id]/profile/route.ts` | new fields, validation |
| `src/app/(admin)/admin/applicants/[id]/YearLevelEditor.tsx` (new), `layout.tsx` | #10, #11 |
| `src/app/(admin)/admin/applicants/[id]/EditApplicantForm.tsx` | #19 |
| `src/lib/applicantWidgets.ts`, `src/app/(admin)/admin/applicants/[id]/page.tsx` | #12–15, #17, #18, #20–23 |
| `src/app/(admin)/admin/applicants/[id]/PrerequisitesPanel.tsx`, `src/app/api/admin/applicants/[id]/prerequisites/route.ts` | #28–30 |
| `EssayReviewPanel.tsx`, `essay-review/route.ts`, `export/route.ts` | #32 |
| `src/components/shared/MailThreadsPanel.tsx`, `communications/page.tsx`, new `RefreshOnMount.tsx` | #33 |

---

### Task 1: Test runner and prerequisite row logic

**Files:**
- Modify: `package.json` (scripts)
- Create: `src/lib/prerequisites.ts`
- Test: `src/lib/prerequisites.test.ts`

**Interfaces:**
- Produces:
  - `STANDARD_PREREQUISITE_CODES: readonly string[]`, the 8 codes in order.
  - `normaliseCourseCode(code: string): string`, which upper-cases and strips all whitespace (`"humbio 1"` → `"HUMBIO1"`, `"Elective 1"` → `"ELECTIVE1"`).
  - `interface PrerequisiteRow { nzccCourseCode: string; equivalentCourseCode: string; grade: string; institution: string; year: string }`, where all values are strings for form binding.
  - `splitPrerequisiteRows(saved: PrerequisiteRow[]): { standard: PrerequisiteRow[]; legacy: PrerequisiteRow[] }`:
    - `standard` always has 8 rows in standard order, using the **standard** spelling of `nzccCourseCode`. Each takes the first saved row whose normalised code matches, or is empty.
    - `legacy` holds non-matching rows plus any second or later match for the same code, in original order.
  - `hasPrerequisiteDetails(row: PrerequisiteRow): boolean`, true if any of equivalentCourseCode, grade, institution or year is non-blank.

- [ ] **Step 1: Create the branch and add the test script**

Run `git checkout -b feature/sas-feedback-minor-fixes`. In `package.json` scripts, add `"test": "tsx --test \"src/**/*.test.ts\""`.

- [ ] **Step 2: Write the failing tests** in `src/lib/prerequisites.test.ts`, using `node:test` and `node:assert/strict`.

```ts
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
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL, because the `./prerequisites` module can't be found.

- [ ] **Step 4: Implement `src/lib/prerequisites.ts`** with the exports listed under Interfaces. Each standard row is a fresh object, so callers can mutate rows safely.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test`
Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/prerequisites.ts src/lib/prerequisites.test.ts
git commit -m "Add unit test runner and prerequisite course row logic"
```

---

### Task 2: Documents open or download with their real filename (#31)

**Files:**
- Create: `src/lib/contentDisposition.ts`
- Test: `src/lib/contentDisposition.test.ts`
- Modify: `src/app/api/files/[...key]/route.ts`

**Interfaces:**
- Produces: `buildContentDisposition(filename: string, mimeType: string): string`.
  - **Disposition type:** `inline` when `mimeType` is `application/pdf` or starts with `image/`, otherwise `attachment`.
  - **Form:** `` `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encodeRFC5987(filename)}` ``.
  - **`asciiFallback`:** replaces non-ASCII characters, `"` and `\` with `_`.
  - **`encodeRFC5987`:** `encodeURIComponent`, plus percent-encoding of `'()*`.

- [ ] **Step 1: Write the failing tests** in `src/lib/contentDisposition.test.ts`.

```ts
test("PDF and images are inline", () => {
  assert.match(buildContentDisposition("a.pdf", "application/pdf"), /^inline;/);
  assert.match(buildContentDisposition("a.png", "image/png"), /^inline;/);
});
test("Word documents download as attachments with their real name", () => {
  const v = buildContentDisposition("Acceptance receipt YR 13 (UE note).docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.match(v, /^attachment;/);
  assert.ok(v.includes('filename="Acceptance receipt YR 13 (UE note).docx"'));
  assert.ok(v.includes("filename*=UTF-8''Acceptance%20receipt%20YR%2013%20%28UE%20note%29.docx"));
});
test("quotes and non-ASCII are made safe in the fallback but kept in filename*", () => {
  const v = buildContentDisposition('Māori "essay".docx', "application/msword");
  assert.ok(v.includes('filename="M_ori _essay_.docx"'));
  assert.ok(v.includes("filename*=UTF-8''M%C4%81ori%20%22essay%22.docx"));
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL, because the module can't be found.

- [ ] **Step 3: Implement `buildContentDisposition`** in `src/lib/contentDisposition.ts`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Update the files route**

- **Lookup:** look up the document for every role:
  - students: `prisma.document.findFirst({ where: { storageKey: filename, application: { studentId } } })`, returning 404 if missing, as today
  - staff: `findFirst({ where: { storageKey: filename } })`
  - select `filename` and `mimeType`
- **Content-Type:** `document?.mimeType` when present, otherwise the existing extension map.
- **Content-Disposition:**
  - with a document row: `buildContentDisposition(document.filename, contentType)`
  - without one (staff only): `buildContentDisposition(path.basename(filename), contentType)`
- Keep the path-traversal check and the 401 check unchanged.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/contentDisposition.ts src/lib/contentDisposition.test.ts "src/app/api/files/[...key]/route.ts"
git commit -m "Serve uploaded documents under their original filename"
```

---

### Task 3: Profile update validation and API (#10, #19 backend)

**Files:**
- Create: `src/lib/profileUpdate.ts`
- Test: `src/lib/profileUpdate.test.ts`
- Modify: `src/app/api/admin/applicants/[id]/profile/route.ts`

**Interfaces:**
- Produces:
  - `isYearLevel(v: unknown): v is "YEAR_1" | "YEAR_2"`
  - `parseDateOnly(v: unknown): Date | null | undefined`:
    - `undefined` → `undefined`
    - `""` or `null` → `null`
    - `"YYYY-MM-DD"` → `new Date(Date.UTC(y, m-1, d))`
    - anything else throws `ProfileValidationError`
  - `interface ChiroExperienceInput { chiropractorName: string; status: "OBSERVING" | "UNDER_CARE"; date: Date | null }`
  - `parseChiropracticExperience(v: unknown): ChiroExperienceInput[] | undefined`:
    - `undefined` → `undefined`
    - otherwise it must be an array; each item needs a non-blank trimmed `chiropractorName`, a `status` in the enum, and `date` parsed with `parseDateOnly`
    - throws `ProfileValidationError` otherwise
  - `class ProfileValidationError extends Error`
- The route accepts these new body keys: `yearLevel`, `dateOfBirth`, `citizenshipCountry`, `suburb`, `guardianRelation`, `chiropracticExperience`.

- [ ] **Step 1: Write the failing tests** in `src/lib/profileUpdate.test.ts`.

```ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL, because the module can't be found.

- [ ] **Step 3: Implement `src/lib/profileUpdate.ts`.**

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Update the profile route**

- **Validation:** before any write, validate the new keys. Any failure (`ProfileValidationError`, or `yearLevel !== undefined && !isYearLevel(yearLevel)`) returns `400 { error: message }`. Use "Invalid year level." for a bad year level.
- **Application update:** add the following to the `application.update` data, only when the key is defined:
  - `yearLevel`
  - `dateOfBirth` (the parsed value)
  - `citizenshipCountry`
  - `suburb`
  - `guardianRelation`
- **Chiropractic experience:** when the parsed value is an array, add to the same `$transaction`:
  - `prisma.chiropracticExperienceEntry.deleteMany({ where: { applicationId: id } })`
  - then `createMany`, only if the array is non-empty
- **Unchanged:** keep every existing key, including `gpaScore` and `prerequisitesMet`, and the single `logAudit` call.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/profileUpdate.ts src/lib/profileUpdate.test.ts "src/app/api/admin/applicants/[id]/profile/route.ts"
git commit -m "Accept year level, DOB, citizenship, suburb and chiropractic experience in staff profile edits"
```

---

### Task 4: Year level control and header tidy-up (#10, #11)

**Files:**
- Create: `src/app/(admin)/admin/applicants/[id]/YearLevelEditor.tsx`
- Modify: `src/app/(admin)/admin/applicants/[id]/layout.tsx:88-96`

**Interfaces:**
- Consumes: the profile PATCH from Task 3, `{ yearLevel: "YEAR_1" | "YEAR_2" }`.
- Produces: `YearLevelEditor({ applicationId, yearLevel, canEdit }: { applicationId: string; yearLevel: "YEAR_1" | "YEAR_2"; canEdit: boolean })`, a client component.

- [ ] **Step 1: Implement `YearLevelEditor`**

- **Read-only:** when `!canEdit`, render plain text "Year 1" or "Year 2".
- **Editable:** otherwise render a compact native `<select>`:
  - options "Year 1" / "Year 2"
  - transparent background, inherited font size and colour
  - underline or border only on hover or focus
  - `aria-label="Year level"`
- **On change:** PATCH, then `router.refresh()`. Disable the select while saving. On failure, revert and show `title`/inline error text "Couldn't save year level".
- Follow the structure of `FlagEditor.tsx`.

- [ ] **Step 2: Wire it into the layout**

In `layout.tsx`:
- remove the `applicantNumber` span and the `·` separator that follows it
- remove `applicantNumber` from the `select`
- replace `<span>Year …</span>` with `<YearLevelEditor applicationId={id} yearLevel={app.yearLevel} canEdit={canEditProfile} />`

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Check it in the app**

Run `npm run dev` and open a Year 1 applicant as a staff user with `EDIT_APPLICANT_PROFILE`. Expected:
- the header reads `Domestic · [Year 1 ▾] · 2026 INTAKE`, with no `#00xx`
- changing it to Year 2 makes the Prerequisite Courses widget appear on Overview
- the Audit Log shows "Staff updated profile fields: yearLevel"
- a user without the permission sees plain text

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/applicants/[id]/YearLevelEditor.tsx" "src/app/(admin)/admin/applicants/[id]/layout.tsx"
git commit -m "Let staff change year level from the applicant header; drop application number"
```

---

### Task 5: Overview: widget layout, Application Details and Academic Background (#12–15, #17, #18, #20–23)

**Files:**
- Create: `src/lib/applicantDisplay.ts`
- Test: `src/lib/applicantDisplay.test.ts`
- Modify: `src/lib/applicantWidgets.ts:13-28`
- Modify: `src/app/(admin)/admin/applicants/[id]/page.tsx`

**Interfaces:**
- Produces:
  - `formatDateOnly(d: Date | null | undefined): string`, giving the `en-NZ` date formatted with `timeZone: "UTC"`, or `"—"`.
  - `toDateInputValue(d: Date | null | undefined): string`, giving `YYYY-MM-DD` from the UTC parts, or `""`. Task 6 uses it.
  - `formatSuburbCity(suburb: string | null, city: string | null): string`, giving the non-blank parts joined by `", "`, or `"—"`.
  - `formatChiroExperience(entries: { chiropractorName: string; status: "OBSERVING" | "UNDER_CARE" }[]): string[]`, which gives `"Name (Observing)"` / `"Name (Under care)"`.
  - `formatEducationYears(started: number, completed: number | null): string`, giving `"2018–2022"`, or `"2018–present"` when `completed` is null.

- [ ] **Step 1: Write the failing tests** in `src/lib/applicantDisplay.test.ts`.

```ts
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
  assert.deepEqual(formatChiroExperience([{ chiropractorName: "Jess Francois", status: "OBSERVING" }, { chiropractorName: "Ana Lee", status: "UNDER_CARE" }]),
    ["Jess Francois (Observing)", "Ana Lee (Under care)"]);
});
test("formatEducationYears", () => {
  assert.equal(formatEducationYears(2018, 2022), "2018–2022");
  assert.equal(formatEducationYears(2023, null), "2023–present");
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL, because the module can't be found.

- [ ] **Step 3: Implement `src/lib/applicantDisplay.ts`.**

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Update the default widget layout** in `APPLICANT_WIDGETS`. The order and default widths are:

| Widget | Width |
|---|---|
| progress | full |
| stage-documents | full |
| details | half |
| notes | half |
| academic | half |
| disclosures | half |
| prerequisites | full |
| statement | half |
| tasks | half |
| offer | half |
| interview | half |
| essay | half |
| account | full |

Delete the `documents` entry.

- [ ] **Step 6: Update `page.tsx`**

- **Includes:**
  - add `educationHistory: { orderBy: [{ yearStarted: "desc" }, { createdAt: "asc" }] }`
  - drop `documents`, together with the `canViewDocs`, `canVerifyDocs` and `DocumentVerifyButtons` usage when it becomes unused
- **Documents widget:** remove the `documents` widget entry.
- **Details rows,** in exactly this order:

| Label | Value |
|---|---|
| Date Submitted | `app.submittedAt?.toLocaleDateString("en-NZ", { timeZone: "Pacific/Auckland" }) ?? "—"` |
| Mobile | `app.phone ?? "—"` |
| Email | `app.student.email` |
| DOB | `formatDateOnly(app.dateOfBirth)` |
| Country of Citizenship | `app.citizenshipCountry ?? "—"` |
| Address | `formatSuburbCity(app.suburb, app.city)` |
| Chiropractic Experience | `formatChiroExperience(...)`, one line per entry, or "—" |

  Rows use `gap-4` and a right-aligned value, as in the disclosures card.

  *Note:* `submittedAt` is a full timestamp, so it is formatted in NZ time. UTC would show the previous day for morning submissions. `formatDateOnly` (UTC) is only for date-only values such as DOB.
- **Academic Background:**
  - remove the "Current/last school" and "NCEA level" rows
  - below the remaining rows, add an "Education history" sub-list:
    - each entry shows the institution name in bold, then level (Secondary/Tertiary), qualification if present, country, and `formatEducationYears(...)`, all in muted text
    - when there are no entries, show "No education history entered."
- **EditApplicantForm `initial`:** leave it unchanged in this task. Task 6 owns that edit.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Check it in the app**

Use the test applicant (Sharon Stevens or any seeded applicant) as a staff user who has **no saved layout**. Expected:
- Notes sit beside Application Details
- there is no Documents widget
- Disclosures and Personal Statement are half width
- Details shows exactly the 7 rows, with DOB and citizenship filled
- Academic Background lists the education entries

- [ ] **Step 9: Commit**

```bash
git add src/lib/applicantDisplay.ts src/lib/applicantDisplay.test.ts src/lib/applicantWidgets.ts "src/app/(admin)/admin/applicants/[id]/page.tsx"
git commit -m "Rework applicant Overview: details order, education history, widget layout"
```

---

### Task 6: Edit form covers everything in Application Details (#19)

**Files:**
- Modify: `src/app/(admin)/admin/applicants/[id]/EditApplicantForm.tsx`
- Modify: `src/app/(admin)/admin/applicants/[id]/page.tsx` (the `initial` prop only)

**Interfaces:**
- Consumes:
  - the profile PATCH keys from Task 3
  - `toDateInputValue` from Task 5
- Produces: `EditApplicantForm`'s `initial` prop gains these fields:
  - `dateOfBirth: string` (`YYYY-MM-DD` or `""`)
  - `citizenshipCountry: string`
  - `suburb: string`
  - `guardianRelation: string`
  - `chiropracticExperience: { chiropractorName: string; status: "OBSERVING" | "UNDER_CARE"; date: string }[]`

- [ ] **Step 1: Restructure the form sections**

| Section | Fields |
|---|---|
| Personal | First name, Last name, Email (read-only, as now), Mobile, Date of birth (`type="date"`), Country of citizenship |
| Academic | Overall Grade Average (`gpaScore`, `type="number" step="0.01"`), Prerequisites met (checkbox) |
| Address | Street address, Suburb, City, Postcode, Country |
| Chiropractic experience | Editable list (below) |
| Next of kin | Name, Relationship, Email, Phone |

- **Academic section:** these fields show for every year level. This was the user's decision in spec §5.
- **Chiropractic experience list:** each row has:
  - chiropractor name
  - status `Select` (Observing / Under care)
  - optional date
  - ✕ to remove
  
  Add a "+ Add entry" link.
- **Client-side check:** before submitting, if any row has a blank name, show "Please complete or remove all chiropractic experience entries." and don't submit.
- **On submit:** send every field, including `chiropracticExperience` as the full array.
- **Server errors:** show the server's `error` message when present, otherwise the existing generic message.

- [ ] **Step 2: Pass the new `initial` values from `page.tsx`**, using `toDateInputValue(app.dateOfBirth)` for the date.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Check it in the app**

Expected:
- Edit shows every Details value, plus next of kin and the academic fields
- changing the DOB to 09/03/2001 and saving shows 09/03/2001 in Details
- adding and removing chiropractic entries is reflected after saving
- a Year 1 applicant can set Overall Grade Average, which then appears on the Consideration Summary page
- saving with a blank chiropractor name is blocked

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/applicants/[id]/EditApplicantForm.tsx" "src/app/(admin)/admin/applicants/[id]/page.tsx"
git commit -m "Edit form covers all Application Details fields and chiropractic experience"
```

---

### Task 7: Prerequisite Courses panel (#28–30)

**Files:**
- Modify: `src/app/(admin)/admin/applicants/[id]/PrerequisitesPanel.tsx`
- Modify: `src/app/api/admin/applicants/[id]/prerequisites/route.ts`

**Interfaces:**
- Consumes: `STANDARD_PREREQUISITE_CODES`, `splitPrerequisiteRows`, `hasPrerequisiteDetails` and `PrerequisiteRow` from Task 1.
- Produces: the PATCH body becomes `{ prerequisitesMet: boolean; gpaScore: string | number | null; courses: CourseInput[] }`.

- [ ] **Step 1: Update the route**

- Change the guard from `ADVANCE_APPLICATION_STAGE` to `EDIT_APPLICANT_PROFILE`.
- Accept `gpaScore`, parsed as in the profile route: `null` or `""` → `null`, otherwise `parseFloat`. If the result is `NaN`, return 400 "Overall Grade Average must be a number."
- Write it in the existing `application.update`.

- [ ] **Step 2: Rework the panel**

**State**
- `const { standard, legacy } = splitPrerequisiteRows(saved)`, after mapping the saved courses to string rows.
- Local state for `standard`, `legacy`, `gpa` (string), `met` (boolean) and `expanded` (default `false`).

**Header**
- The header is a `<button aria-expanded>` with a chevron, showing "Prerequisite Courses".
- **Summary text:** `` `${standard.filter(hasPrerequisiteDetails).length} of 8 courses entered · Overall grade average: ${gpaScore ?? "—"} · Prerequisites met: ${met ? "Yes" : "No"}` ``. Use the saved values, not unsaved edits.

**Expanded body**
- An "Overall Grade Average" number input (`step="0.01"`) and a "Prerequisites met" checkbox, both disabled when `!canEdit`.
- The table:
  - **Standard rows:** the NZCC Course cell is plain text.
  - **Legacy rows:** shown after the standard rows, with an editable code cell and a ✕.
  - There is no "+ Add course" button.
- **Save:**
  - `courses` is the standard rows where `hasPrerequisiteDetails` is true, plus every legacy row with a non-blank code
  - year is sent as an int or `null`
  - also sends `gpaScore: gpa` and `prerequisitesMet: met`
  - then calls `router.refresh()`
- **Prop change:** the `courses` prop type now includes the saved strings. Remove the `prerequisitesMet` pass-through behaviour, because the panel now owns it.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Check it in the app** on a Year 2 applicant.

Expected:
- the panel is collapsed, with the summary showing "0 of 8 courses entered"
- expanding shows the 8 fixed codes
- entering a grade for HUMBIO1, a grade average of 6.5 and ticking "met", then saving, updates the summary to "1 of 8 … 6.5 … Yes"
- reloading keeps the values

Then insert a legacy row (`CHEM101`) through the old data, or `npx prisma studio`. Expected: it shows under the standard rows and survives a save.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/applicants/[id]/PrerequisitesPanel.tsx" "src/app/api/admin/applicants/[id]/prerequisites/route.ts"
git commit -m "Prerequisite Courses: fixed course list, collapsible, grade average and met"
```

---

### Task 8: Apply wizard (#2–7)

**Files:**
- Modify: `src/app/(auth)/apply/ApplyWizard.tsx`
- Modify: `src/app/api/apply/route.ts:76-118, 150`

**Interfaces:**
- Produces: the apply payload no longer contains `yearLevel`. The API always saves `"YEAR_1"`.

- [ ] **Step 1: Choose Path step (step 0)**

- Remove `yearLevel` from `FormState`, `INITIAL_STATE` and the payload.
- **Tiles:** render two tiles, `["DOMESTIC", "NZ Domestic"]` and `["INTERNATIONAL", "International"]`, using the existing tile style. The selected state is `form.category === cat`.
- **Intake dropdown:** replace the intake button grid with `<Select label="Intake year *">`:
  - a placeholder option `""` reading "Select an intake…"
  - one option per open intake: value `iy.id`, label `iy.label`
- Keep the "no intakes open" message.
- **Preselect:** add an initial-state rule so that when `openIntakeYears.length === 1`, `intakeYearId` starts as that id.
- **Validation:**
  - `!form.category` → "Please select your applicant type."
  - `!form.intakeYearId` → "Please select an intake year."

- [ ] **Step 2: Labels, requirements and notes**

- **Step 2 (support):**
  - label: "Please provide details"
  - validation message: "Please provide details of your support need."
- **Step 3 (address):**
  - the permanent-address Suburb label becomes "Suburb *"
  - add `!form.suburb.trim()` to the step 3 check, using the existing message
- **Step 4 (education):**
  - the NSN label loses its `" *"`
  - delete the domestic NSN validation line
  - add helper text "Please list all courses taken." under the "Education History *" heading, in `text-xs` muted style
- **Step 8 (personal statement):**
  - add helper text "250 words max."
  - the limit becomes `> 250`, with the message "Personal statement must be 250 words or fewer."
  - if a word counter is shown, it reads `` `${wordCount} / 250` ``

- [ ] **Step 3: Update the apply API**

- Drop `yearLevel` from the destructure and the required-fields check.
- Save `yearLevel: "YEAR_1"`.
- Add `if (!suburb?.trim()) return 400 "Suburb is required."` next to the postcode check.
- Delete the domestic NSN check.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Check it in the app**

Run through `/apply` as a new domestic applicant. Expected:
- two tiles and a dropdown
- blank suburb blocks step 3
- blank NSN is accepted
- the support-details label and both notes are present
- a 251-word statement is rejected and a 250-word one passes
- after submitting, the applicant shows "Year 1" in the admin header

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)/apply/ApplyWizard.tsx" src/app/api/apply/route.ts
git commit -m "Apply wizard: Domestic/International path with intake dropdown and form copy fixes"
```

---

### Task 9: Essay score label and range (#32)

**Files:**
- Modify: `src/app/(admin)/admin/applicants/[id]/EssayReviewPanel.tsx:45-47`
- Modify: `src/app/api/admin/applicants/[id]/essay-review/route.ts:15-17`
- Modify: `src/app/api/admin/applicants/export/route.ts:67`

- [ ] **Step 1: Make the changes**

- **Panel:**
  - the label becomes "Score (%)"
  - input `min={0}`
  - the save sends `score === "" ? null : parseInt(score, 10)`, so a score of 0 isn't dropped
- **Route:** the range check becomes `score < 0 || score > 100`, with the message "Score must be between 0 and 100."
- **Audit text:** `` `— score ${score}%` ``.
- **Export header:** "Essay Score (%)".

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Check it in the app**

Saving a score of 0 succeeds and shows 0 after reload.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/applicants/[id]/EssayReviewPanel.tsx" "src/app/api/admin/applicants/[id]/essay-review/route.ts" src/app/api/admin/applicants/export/route.ts
git commit -m "Essay review: score as a percentage, allow 0"
```

---

### Task 10: Communications unread badge clears (#33)

**Files:**
- Modify: `src/components/shared/MailThreadsPanel.tsx` (`openThread`)
- Create: `src/app/(admin)/admin/applicants/[id]/communications/RefreshOnMount.tsx`
- Modify: `src/app/(admin)/admin/applicants/[id]/communications/page.tsx`

**Interfaces:**
- Produces: `RefreshOnMount({ when }: { when: boolean })`, a client component that calls `router.refresh()` once on mount when `when` is true, and renders `null`.

- [ ] **Step 1: Read the Next.js refresh docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` and `.../refresh.md`. Confirm that `router.refresh()` from a client component re-renders the parent server layout (`[id]/layout.tsx`). If the docs say otherwise, use the mechanism they recommend for refreshing layout data, and note the deviation in the commit message.

- [ ] **Step 2: Threads mode**

In `MailThreadsPanel.openThread`, when `viewerRole === "STAFF"`, call `router.refresh()` after the GET succeeds. Do this every time a thread is opened: it's cheap, and it avoids depending on the shape of the thread list. Add `useRouter` from `next/navigation`.

- [ ] **Step 3: Chat mode**

In `communications/page.tsx`, compute `hadUnread` from the `updateMany` result (`count > 0`) and render `<RefreshOnMount when={hadUnread} />` next to the chat widget.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Check it in the app, in both modes**

Switch modes in Settings → Communication. For each mode:
1. The student sends a message, and the staff Communications tab shows the badge "1".
2. Staff open the thread or chat. The badge disappears without a manual reload.
3. The student's own unread indicator still behaves as before.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/MailThreadsPanel.tsx "src/app/(admin)/admin/applicants/[id]/communications/"
git commit -m "Clear the Communications unread badge once staff view messages"
```

---

### Task 11: Final verification

- [ ] **Step 1: Unit tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors, and the build succeeds.

- [ ] **Step 3: Confirm the schema is untouched**

Run: `git diff main --stat -- prisma/`
Expected: empty output.

- [ ] **Step 4: Run the spec's acceptance checklist**

Work through the spec's "Acceptance checklist" end to end in the running app, and note any item that fails.
