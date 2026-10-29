# SAS Test (Oct 2026) feedback: minor, cosmetic and small-logic fixes

**Date:** 2026-10-30
**Source:** client feedback document `reports/user_feedback/SAS Test Oct 2026.docx`. Item numbers (#n) match the numbered breakdown of that document.

## Intent

The client (the NZCC admissions team) tested a full application end to end ("Sharon Stevens", Domestic Year 2) and reviewed it from the admissions side. This work clears every piece of their feedback that can be done **without a database schema change and without major backend work**. The goal is that their next test round shows the forms, labels, applicant overview and prerequisite entry working the way they asked, and that these bugs are fixed:

- an essay that can't be opened
- an unread badge that won't clear
- details missing from the applicant file

## Scope

### Goals: in this work

| # | Area | Summary |
|---|------|---------|
| 2 | Apply wizard | Path step: two choices (NZ Domestic / International) plus an intake-year dropdown. Year level is no longer chosen by the student. |
| 3 | Apply wizard | Rename the support label to "Please provide details". |
| 4 | Apply wizard | Suburb becomes required. |
| 5 | Apply wizard | NSN becomes optional. |
| 6 | Apply wizard | Education History note: "Please list all courses taken." |
| 7 | Apply wizard | Personal Statement note: "250 words max." |
| 10 | Applicant header | Staff can change the year level under the applicant's name. |
| 11 | Applicant header | Remove the application number. |
| 12 | Overview | Show education history in Academic Background. |
| 13, 14 | Overview | Disclosures and Personal Statement become half width. |
| 15 | Overview | Remove the Documents widget. |
| 17 | Overview | Internal Notes sit next to Application Details at the top. |
| 18, 20–23 | Application Details | New fields, labels and order. |
| 19 | Edit form | The edit form covers everything shown in Application Details. |
| 28–30 | Prerequisites | Fixed course list, collapsible, Overall Grade Average. |
| 31 | Files | Uploaded documents open or download with their real filename. |
| 32 | Essay | Change the label to "Score". |
| 33 | Communications | The unread badge clears once messages have been viewed. |

### Non-goals: deliberately excluded

Anything needing a schema change or major backend work. That covers:

- #1 residency status
- #8 applicant transcript upload during the application
- #16 staff uploading to the applicant's portal
- #24–27 email delivery and email copies on file
- #35–37 the official offer letter, signature and offer templates

Also excluded:

- **#9 greeting:** already done in commit `c43f048`. The student dashboard now shows only "Kia ora, {firstName}".
- **#34 offer showing as a task:** the code generates no offer task. It comes from a staff-configured task template on an Offer stage, so it is a data change in Settings → Task templates, not code. Tell the client rather than build anything.
- **Changing the intake year from the applicant file:** only the year level is editable from the header.

### Anti-goals: this fails even if it technically works when it…

- …adds or changes Prisma schema or migrations. Every change here must work on the current schema.
- …loses existing data. That includes:
  - prerequisite rows already entered under non-standard course codes
  - applications already submitted with Year 2
  - staff members' saved Overview layouts, which must still load
- …puts a Year 2 applicant in a state staff can't fix from the applicant file.

## Constraints

- **Next.js version:** this repo uses a Next.js release with breaking changes from older versions (see `AGENTS.md`). Read `node_modules/next/dist/docs/` before touching routing, layouts, caching or `router.refresh` behaviour.
- **Match existing style:**
  - inline `style={{…}}` colour values (`#114E3B` green, `#C79A3B` gold)
  - card header pattern: `px-5 py-3.5`, uppercase 11px label
  - `Input` / `Button` / `Textarea` components from `src/components/ui`
  - every staff write goes through `permissionGuard` and `logAudit`
- **Schema facts the design relies on:**
  - `Application.yearLevel` is a required enum `YEAR_1 | YEAR_2`.
  - `dateOfBirth`, `citizenshipCountry` and `suburb` exist and are saved by `/api/apply`.
  - `EducationHistoryEntry` rows are saved on apply but never shown to staff.
  - `PrerequisiteCourse` has `nzccCourseCode`, `equivalentCourseCode`, `grade`, `institution`, `year`.
  - `gpaScore` is a `Float`.

---

## Design

### 1. Apply wizard (`src/app/(auth)/apply/ApplyWizard.tsx`, `src/app/api/apply/route.ts`)

**#2 Choose Path (step 0)**

- Replace the four category+year tiles with **two tiles**: "NZ Domestic" (`DOMESTIC`) and "International" (`INTERNATIONAL`). Keep the same tile styling.
- Replace the intake-year button grid with a **`Select` dropdown** labelled "Intake year *". Its options are the open intakes already passed in as `openIntakeYears`, which `page.tsx` loads with `isOpenForApplications && !isArchived`, ordered by year, and labelled `iy.label`. Keep the existing "no intakes currently open" message when the list is empty.
- *Our call:* if exactly one intake is open, preselect it.
- Remove `yearLevel` from the wizard's form state, validation and payload. Step 0 validation becomes:
  - category required: "Please select your applicant type."
  - intake required: "Please select an intake year."
- **API:** `/api/apply` stops requiring `yearLevel` and always saves `yearLevel: "YEAR_1"`. Any `yearLevel` sent by the client is ignored. Decided by the user: new applications default to Year 1 and staff correct it on the applicant file.

**#3** In step 2, the input label "Please describe your support category" becomes "Please provide details". The validation message becomes "Please provide details of your support need."

**#4** Suburb becomes required on the **permanent address only**:

- label "Suburb *"
- add it to the step 3 validation
- `/api/apply` returns 400 "Suburb is required." when it is blank

*Our call:* the alternative postal address suburb stays optional.

**#5** NSN becomes optional for everyone:

- label without "*"
- remove the step 4 check
- remove the domestic NSN check in `/api/apply`

**#6** Add the helper text "Please list all courses taken." under the "Education History *" heading. Use small muted text, matching other helper text in the wizard.

**#7** Add the helper text "250 words max." under the personal statement label.

*Our call:* enforce it. The step 8 validation limit changes from 300 to 250 words, with the message "Personal statement must be 250 words or fewer." If a live word count is shown, display it as `n / 250`.

### 2. Applicant header (`src/app/(admin)/admin/applicants/[id]/layout.tsx`)

**#11** Remove the `applicantNumber` span and the separator after it. The number stays in the applicants list, exports and anywhere else it appears. This change applies to the header only.

**#10 Year level control**

- In the meta line under the name (`Domestic · Year 1 · 2026 INTAKE`), the "Year N" item becomes a small inline control when the viewer has `EDIT_APPLICANT_PROFILE`.
- **Control:**
  - a compact `<select>` with the options "Year 1" and "Year 2"
  - styled to sit inline with the text: no heavy border, and an affordance on hover or focus
- **On change:**
  - PATCH `/api/admin/applicants/[id]/profile` with `{ yearLevel }`
  - then `router.refresh()`
- **Without the permission:** plain text, as now.
- **Profile API:**
  - accept `yearLevel`
  - validate it against `YEAR_1 | YEAR_2`, returning 400 otherwise
  - audit it through the existing `logAudit` call
- **Effect:** switching to Year 2 makes the Prerequisite Courses widget appear, because it is gated on `yearLevel === "YEAR_2"`. Switching back hides it. Prerequisite data is kept either way.
- Implement it as a small client component (for example `YearLevelEditor.tsx`) next to `FlagEditor.tsx`, following its pattern.

### 3. Overview widgets (`src/lib/applicantWidgets.ts`, `src/app/(admin)/admin/applicants/[id]/page.tsx`)

**New default layout** (order and width):

| Widget | Width |
|---|---|
| progress | full |
| stage-documents | full |
| **details** | half |
| **notes** | **half** |
| academic | half |
| **disclosures** | **half** |
| prerequisites | full |
| **statement** | **half** |
| tasks | half |
| offer | half |
| interview | half |
| essay | half |
| account | full |

- **#17:** notes moves up beside details.
- **#13–14:** disclosures and statement become half width.
- **#15:** remove the `documents` widget from `APPLICANT_WIDGETS` and from `page.tsx`, together with its now-unused data (`documents` in the include, `canVerifyDocs`, and the `DocumentVerifyButtons` import if unused). `normaliseLayout` already drops unknown ids, so saved layouts that contain "documents" keep working.

**Saved layouts:** staff who have already saved a layout keep their order and widths, because `normaliseLayout` respects the stored width.

*Our call:* don't overwrite saved layouts. Release notes should say "use Move Widgets → Reset/resize if your layout predates this". If there is no reset option, the builder may add a "Reset to default" action to the Move Widgets mode, which is a small client and API change.

**#12 Academic Background**

- Remove the "Current/last school" and "NCEA level" rows. The wizard never collects those fields, so they always show "—".
- Keep "Completed tertiary study" and "National Student Number" (NSN shows "—" when blank).
- Add an **Education history** list below them from `app.educationHistory`, ordered by `yearStarted` descending, then `createdAt`. Each entry shows:
  - institution name (bold)
  - level (Secondary or Tertiary)
  - qualification, if any
  - country
  - `yearStarted–yearCompleted`, or `yearStarted–present` / `yearStarted–` when there is no completion year
- When there are no entries, show "No education history entered."
- Add `educationHistory` to the `findUnique` include.

### 4. Application Details box (`page.tsx` `details` widget)

**#18, #20–23:** the rows, in this exact order:

| Label | Value |
|---|---|
| Date Submitted | `submittedAt` as `en-NZ` date, or "—" |
| Mobile | `phone`, or "—" |
| Email | `student.email` |
| DOB | `dateOfBirth` as `en-NZ` date, or "—" |
| Country of Citizenship | `citizenshipCountry`, or "—" |
| Address | `suburb, city`, skipping blanks, or "—" (see note) |
| Chiropractic Experience | every `chiropracticExperience` entry as "Name (Observing)" / "Name (Under care)", joined with line breaks, or "—" |

- **Removed rows:** Next of Kin (#21), GPA and Prerequisites met (#22). These remain stored and editable in the Edit form (§5). GPA and Prerequisites met are also editable in the Prerequisites panel for Year 2 (§6).
- **Address:** the client asked for "town, region". The schema has no region field, so this shows suburb and city. *Our call;* flagged in the follow-ups.
- **Chiropractic Experience:** long values wrap and stay right-aligned. Follow the `gap-4` / `text-right` pattern from the disclosures card.

### 5. Edit form (`EditApplicantForm.tsx`, `/api/admin/applicants/[id]/profile`)

**#19:** the edit modal must show and allow editing of everything in the Details box, plus next of kin (the client wants next of kin visible when editing).

**Sections:**

- **Personal**
  - First name, last name
  - Email: read-only, as now, because it is the login
  - Mobile
  - Date of birth (`type="date"`)
  - Country of citizenship
- **Address**
  - Street address
  - Suburb
  - City
  - Postcode
  - Country
- **Chiropractic experience**
  - Editable list of entries: chiropractor name (required), status (`Observing` / `Under care`), optional date
  - "+ Add entry" and remove (✕)
  - Same field rules as the wizard
- **Next of kin**
  - Name, email, phone, as now
  - *Our call:* also add Relationship (`guardianRelation`), which is stored but currently not editable

- **Academic**
  - Overall Grade Average (`gpaScore`, numeric, `step="0.01"`)
  - Prerequisites met (checkbox)
  - These stay in the form **for every applicant**. Decided by the user: both fields matter for Year 1 and Year 2, and the Prerequisites panel only appears for Year 2. For Year 2 applicants the same two fields can also be edited in the Prerequisites panel (§6). Both places write the same `gpaScore` / `prerequisitesMet` columns.

**Profile API changes:**

- **New fields accepted:** `dateOfBirth` (ISO date or empty → `null`), `citizenshipCountry`, `suburb`, `guardianRelation`, `yearLevel` (§2) and `chiropracticExperience`.
- **`chiropracticExperience`:** an array of `{ chiropractorName, status, date }`. When present, it **replaces** the application's entries (`deleteMany` + `createMany`) in the same transaction, the same approach the prerequisites route uses. Validate:
  - `chiropractorName` is non-empty
  - `status` is `OBSERVING` or `UNDER_CARE`
  - return 400 otherwise
- **Existing fields:** keep accepting the current ones (including `gpaScore` and `prerequisitesMet`) so nothing else breaks.
- **Audit:** keep the single `logAudit` call listing the changed fields.

**Passing data:** pass the new initial values from `page.tsx`, with dates formatted `YYYY-MM-DD` for the date inputs. Keep the modal scrollable (`max-h-[90vh] overflow-y-auto`, already in place).

### 6. Prerequisite Courses (`PrerequisitesPanel.tsx`, `/api/admin/applicants/[id]/prerequisites`)

**#28 Fixed course list**

- Define the standard list once, for example `src/lib/prerequisites.ts`: `HUMBIO1, HUMBIO2, LIFESCI1, LIFESCI2, BIOMECP, ELECTIVE 1, ELECTIVE 2, ELECTIVE 3`, in that order.
- The table always shows these 8 rows:
  - The NZCC Course column is a fixed label, not an input.
  - Equivalent Course, Grade, Institution and Year remain inputs.
  - Saved rows are matched by `nzccCourseCode`, ignoring case and spaces, so "humbio 1" matches HUMBIO1 (*our call*). A matched row is saved back under the standard code.
  - If an application has two saved rows that match the same standard code, the first fills the standard row and the extra one appears as a legacy row, so nothing is lost.
- **No add or remove:** the "+ Add course" button and the per-row ✕ go for the standard rows.
- **Legacy rows:** saved rows whose code isn't in the list appear after the 8 standard rows. They are editable, have a ✕, and are labelled with their code. This prevents data loss (anti-goal).
- **Saving:**
  - Send the standard rows that have at least one detail filled in, plus the remaining legacy rows.
  - The route keeps its replace-all behaviour.
  - Blank standard rows are not stored.

**#29 Collapsible:**

- The card header becomes a toggle with a chevron.
- **Collapsed by default** (*our call*). The header shows a one-line summary: `n of 8 courses entered · Overall grade average: x · Prerequisites met: Yes/No`.
- The expanded state is local only and not saved.

**#30 Overall Grade Average and Prerequisites met**

- Inside the expanded panel, above the table:
  - a numeric input "Overall Grade Average", bound to `gpaScore`, with `step="0.01"`
  - a "Prerequisites met" checkbox, bound to `prerequisitesMet`
- Both are saved by the panel's Save button through the prerequisites route.
- **Route changes:** the route accepts `gpaScore`, parsed as float with empty → `null`, the same rule the profile route uses.

**Permissions:** today the panel enables editing with `EDIT_APPLICANT_PROFILE`, but the route requires `ADVANCE_APPLICATION_STAGE`. *Our call:* change the route guard to `EDIT_APPLICANT_PROFILE`. GPA and prerequisites-met were previously edited under that permission, so editing rights stay the same.

**Visibility:** the widget is still shown only for Year 2 (unchanged).

### 7. File opening (`src/app/api/files/[...key]/route.ts`) — #31

**Problem:** the route sends `Content-Disposition: inline; filename="<storage key>"`. Browsers can't display a .docx inline, so they download it under the GUID-like storage key with no extension, which is what the client saw.

**Change:**

- Look up the `Document` by `storageKey` for **all roles**. Students keep the existing ownership restriction.
- When a Document row is found:
  - use `document.filename` as the download name
  - use `document.mimeType` as the content type, falling back to the extension map
- **PDFs and images** (`application/pdf`, `image/*`): `inline`, so they open in a new browser tab.
- **Everything else**, including Word: `attachment`, so it downloads with its real name (for example "Acceptance receipt YR 13 (UE note).docx").
- **Filename header:** send both `filename="<ASCII-safe fallback>"` and `filename*=UTF-8''<percent-encoded name>`.
- When no Document row exists (staff only), keep the current behaviour, using the key's basename.
- **Unchanged:** path-traversal protection and auth checks.

An in-browser preview of Word documents is out of scope.

### 8. Essay label — #32

In `EssayReviewPanel.tsx`, the label "Score (out of 100)" becomes **"Score (%)"**. The input's `min` changes from 1 to 0, and `max` stays 100. The essay-review API (`api/admin/applicants/[id]/essay-review/route.ts`) currently rejects anything outside 1–100, so change its check to 0–100 to match.

*Our call:* add "(%)" so staff know the scale. The CSV export header "Essay Score (/100)" becomes "Essay Score (%)".

### 9. Communications unread badge — #33

**Problem:** the badge count is computed in the applicant `layout.tsx`, a server layout. In Threads mode, opening a thread marks messages read through the API (`mail-threads/[threadId]` GET), but the layout is never re-rendered, so the badge keeps its stale count. In Chat mode, the page marks messages read while it renders, which may happen after the layout has already counted them.

**Required behaviour:** after staff view unread student messages, the badge drops to the correct remaining count without a manual reload. This applies in both messaging modes.

**Approach:** left to the builder, after checking the Next.js docs in this repo for how layouts re-render. Suggested approach:

- in `MailThreadsPanel`, when `viewerRole === "STAFF"` and an opened thread had unread messages, call `router.refresh()` after the GET succeeds
- in Chat mode, add a tiny client component on the communications page that calls `router.refresh()` once on mount when there were unread messages

The student-side unread indicators need to keep working.

---

## Left to the builder

- Component boundaries and file names, other than those named above.
- Exact visual treatment of the inline year-level select, the collapse chevron and the helper text, within the existing style.
- Whether to add "Reset to default" to Move Widgets (§3).
- The mechanism for the badge refresh (§9).
- Tests: follow whatever test setup the repo has. If there is none, verify manually in the running app against the checklist below.

## Acceptance checklist

1. Apply as a new domestic applicant:
   - [ ] Two path tiles and an intake dropdown.
   - [ ] Suburb is required.
   - [ ] NSN is optional.
   - [ ] The new label and notes are present.
   - [ ] A 251-word statement is rejected.
   - [ ] The submitted application is Year 1.
2. On that applicant:
   - [ ] The header has no number.
   - [ ] Change Year 1 → Year 2: the prerequisites widget appears, and the audit log records the change.
3. On the Overview:
   - [ ] Notes sit beside Details.
   - [ ] No Documents widget.
   - [ ] Disclosures and Statement are half width.
   - [ ] Academic Background lists the education entries.
4. Application Details:
   - [ ] Shows exactly the 7 rows, in order, with DOB and citizenship filled.
   - [ ] Edit shows every one of them plus next of kin, and saving updates the box.
   - [ ] Edit also shows Overall Grade Average and Prerequisites met for a Year 1 applicant, and the saved values appear on the Consideration Summary.
   - [ ] Chiropractic entries can be added, edited and removed.
5. Prerequisites:
   - [ ] Collapsed with a summary.
   - [ ] Expands to the 8 fixed courses.
   - [ ] Grade average and "met" save.
   - [ ] An application with an old non-standard course row still shows and keeps it.
6. Files:
   - [ ] A .docx task upload downloads with its original filename.
   - [ ] A PDF opens in the browser.
7. Essay panel:
   - [ ] Label reads "Score (%)".
8. Communications:
   - [ ] Student sends a message; the staff badge shows 1.
   - [ ] Staff open the thread or chat; the badge clears without reload.
   - [ ] Works in both messaging modes.

## Follow-up questions for the client (not blocking)

1. **Spotting unset year levels.** New applications default to Year 1, so how should staff spot applicants who are really Year 2 and still need correcting? Possible answers include a filter, a flag, or a review step at Intake Review.
2. **Student dashboard.** The student dashboard shows "Domestic · Year 1" under Applicant type, which is wrong until staff correct it. Should students see the year level at all?
3. **Address.** "Address (town, region)": the portal stores suburb and city but no region. Is suburb and city acceptable, or is a region field wanted (a schema change)?
4. **GPA and Prerequisites met for Year 1.** The client said these belong in the Prerequisite Courses section, which only exists for Year 2. We've kept them editable for every applicant through the Edit form, on the assumption that they matter for Year 1 too. Is that right, or should they be Year 2 only (and hidden for Year 1 on the Consideration Summary and in the export)?
5. **Grade average format.** Is "Overall Grade Average" always a number (for example a GPA such as 6.5)? Letter grades would need a schema change.
