# CareerOS: Quality Assurance Report

Run on the final build, 5 November 2026. All commands are in `README.md` (Rebuilding and testing).

| Suite | Command | Result |
|---|---|---|
| Research data and profile integrity | `node tests/test_data.js` | **24 / 24 passed** |
| End-to-end workflow in headless Chromium | `node tests/e2e.js` | **48 / 48 passed** |
| Tailored CV rendering (LibreOffice) | `node tests/test_tailoring_pages.js` | **12 / 12 passed**, master unchanged |
| Every screen loads without errors | `node tests/smoke.js` | **12 / 12 screens, 0 console errors** |
| Companion (live search config, re-check, DOCX to PDF) | `node tests/companion_e2e.js` (companion running) | Passed: PDF exported (1 page), re-check recorded, honest "search not configured" message |
| Excel formulas | `recalc.py CareerOS_Data.xlsx` | 9 formulas, **0 errors** |

## What the tests cover
- **Job research:** every opportunity has a source and application URL; unique IDs; no duplicates (title, employer, location); no closed or past-deadline job in the active set; valid publication and verification dates; Saudi locations; eligibility present; Saudi-only roles never GREEN while nationality is unset; 3+ year roles RED; unknown-status roles never GREEN; no invented salaries; excluded records all have reasons.
- **Candidate profile:** not represented as a graduate; CAPM, OSHA, TOEFL not verified; SCE not claimed; flight-hours conflict flagged; thermography stays an interest; every item has a status and evidence list.
- **CV:** DOCX and PDF upload, text extraction, ATS checks for both, tailored copy created, original vs tailored comparison, DOCX and PDF export, exported files reopened, paragraph-by-paragraph integrity check, page setup and fonts identical, master byte-identical after tailoring, page count measured.
- **Scoring:** requirement matrix built from the advert; mandatory gaps shown; editing a suggestion to add unsupported skills triggers a warning; keyword coverage recalculates after each decision and accepting all suggestions never lowers it (checked on all 176 jobs); eligibility is separate from ATS and match.
- **Application:** package generated and tied to the right job; ZIP and cover letter DOCX download; edits persist; status changes only after confirmation; follow-up date; calendar; data persists after closing and reopening; backup and CSV export.
- **UI:** all 12 navigation items, tabs, filters, search, sorting, card/table views, dialogs close on navigation, mobile layout (390 px) without horizontal overflow, mobile menu.

## Defects found and fixed during testing
1. Terminology alignment rewrote an employer name ("Athlath Construction" became "Athlath infrastructure (Construction)") because "infrastructure" was wrongly a synonym of "construction". Synonym removed; alignment now only touches bullets, the profile summary and skills lines.
2. Title cleaning turned "Pre-Sales Engineer" into "Pre" in the objective sentence. Fixed.
3. A character-count page estimate missed real overflow. Replaced with line wrapping from Source Sans Pro glyph widths, which now predicts LibreOffice's page count correctly on all 12 test jobs.
4. Some suggestions lowered keyword coverage (a new headline dropped words the advert used). Each wording change is now measured on its own and dropped if it lowers coverage.
5. "Graduate development program" objective was used for a "Fresh Graduate" job title. Fixed.
6. Cover letter pasted bullets as subject-less sentences. Rewritten into first-person sentences.
7. Supporting-experience ranking favoured generic matches (MEP internship for a systems role). Reweighted by keyword frequency and career-track overlap.
8. Dialogs stayed open after navigation; mobile job cards overflowed by 21 px. Both fixed.
9. "Document control" was treated as a synonym of technical documentation. Removed.

## Known limitations
- Word may wrap a line slightly differently from LibreOffice; always check the page count of the final PDF.
- Live search requires your own API key (Google Programmable Search or JSearch) and the local companion.
- LinkedIn's public view hides the employer's external apply link; use the advert's Apply button.

# CareerOS 2.0 test results (5 November 2026)

| Suite | Result |
|---|---|
| `tests/e2e2.js`: 2.0 features on the hosted build with simulated AI, Gmail, private storage and downloads | **30 / 30** |
| `tests/e2e.js`: original 1.0 workflow (regression) | **48 / 48** |
| `tests/web_e2e.js`: hosted-page behaviour (blocked dialogs, private storage, reload) | **14 / 14** |
| `tests/test_data.js`: research data and profile integrity (278 jobs) | **24 / 24** |
| `tests/test_engine2.js`: career value, compare, next moves, track CVs, development map, analytics, email parsers | **13 / 13** |
| `tests/smoke.js`: 23 screens, console errors | **0 errors** |
| iPhone 13 layout audit, 20 screens | **No horizontal overflow** |
| In-app PDF (`tests/test_pdf.js`) | Master CV renders to 1 page with embedded fonts and live links; visually matches LibreOffice |

Covered in 2.0: next best moves, compare and recommendation, career value factors, readiness, track CV build and verification (not added to tracker), CV Studio listing, Greenhouse ATS checks, in-app PDF download, change review, application email, approvals, interview briefing plus AI notes through tools, AI chat answer with real job IDs from a tool call, development map tiers and progress, Gmail scan and import (application as Applied with the email date, alert job as unverified), analytics, company "checked today", dark theme, persistence of imported applications, briefings and comparisons after reload.

## Defects found and fixed during 2.0 work
1. Three screens overflowed sideways on iPhone (header-less key/value tables, long URLs, long AI prompt chips).
2. The NEW badge marked every job; it now marks adverts published in the last 2 days or jobs imported in the last 2 days.
3. Near-duplicate re-posts (Honeywell "Saudi National Only" vs "Saudi Nationals Only") were both kept; deduplication now compares the first 42 characters of the title, the employer and the location.
4. Broken employer names from LinkedIn markup in 10 new listings were re-fetched.
5. A ServiceNow IT role and other off-track roles from the wider sweep were excluded with reasons.
6. The AI response sanitiser contained a literal em dash; replaced with an escape code.

## What was not tested against the real host
The AI (`sample`), Gmail connector (`mcp`), private storage (`db`) and downloads were exercised against simulations of the documented interfaces. On the real claude.ai page the first AI or Gmail use asks for your consent. If anything behaves differently there, it is reported in the page as an error message and falls back to the built-in features.

# Performance and bug-fix pass (5 November 2026)

Measured on an iPhone 13 viewport with the CPU slowed 4x (`tests/perf.js`):

| Action | Before | After |
|---|---|---|
| App start (first launch) | 10.4 s | 3.4 s |
| App start (later launches, cached analyses) | 10.4 s | 1.1 to 1.7 s |
| Open Command Center | 14.1 s | 0.03 to 0.1 s |
| Change a profile field | 17.9 s | 1.0 s |
| Open Discover | 0.25 s | 0.10 to 0.20 s |

What changed: keyword matching pre-check (identical results, verified on all 279 jobs), per-line matching limited to keywords present in the advert (7x faster analysis), advert analyses cached separately from profile-dependent scores and kept on the device between sessions (keyed by a content hash and the engine version), PDF libraries loaded only when used, embedded data parsed as JSON, Discover shows 30 cards at a time with Show more, search updates only the result list (no keyboard flicker on iPhone), translucent blur effects removed (iOS scroll smoothness), one-time cache save deferred to idle time.

Bugs fixed:
1. Search box on iPhone was hidden inside the collapsed Filters panel; it is now always visible.
2. Opening the app after a research update did not add new jobs to locally saved data (seed version not bumped); research jobs now refresh while keeping your edits, removed untracked listings are dropped and tracked ones kept.
3. Tracker entries could disappear if their job left the research data; applications now keep a snapshot.
4. On the private page every save also wrote a 3 MB copy to on-device storage; removed.
5. GPA: now private by default. No GPA prompts, to-dos or eligibility warnings; GPA minimums show as neutral notes. Existing saved data migrated.

Verification: `tests/clickall.js` clicked 481 actions across 22 screens (desktop file and iPhone private page) with no errors; `tests/cache_e2e.js` (3/3) proves cached and fresh results are identical; `tests/merge_e2e.js` (7/7) proves research refreshes keep your data; all earlier suites still pass (48/48, 30/30, 14/14, 24/24, 13/13, 8/8, 12/12 tailoring pages).

## Update, 6 November 2026: applied jobs, safer saving, CV merge fix

Changes:
1. Jobs already applied to are no longer suggested. Discover, the Dashboard (best matches, newest, closing soon), next best moves and the AI shortlist skip any job whose tracker status is Applied or later. The job stays in the tracker, and Discover shows how many are hidden with a "Show them" switch.
2. Gmail import now also reads employer career-site confirmations (Workday, Workable, SmartRecruiters, SuccessFactors, Greenhouse and similar), not only LinkedIn. A confirmation is matched to a saved job only when the email reads like a confirmation, contains the job's full title as a standalone title (so "Senior Project Engineer" does not match "Project Engineer"), and names the employer.
3. The research seed now leaves out listings the user has already applied to (private, git-ignored list). 272 jobs remain. Seed version bumped so saved data refreshes.

Bugs fixed:
1. Data loss on the private page: saves were split into parts written in place, so closing or reloading the page during a save could leave a mix of old and new parts. The next start could not read them, started empty and saved over the stored data. Saves are now atomic (changed parts go to a spare slot and the index is written last), and if stored data ever cannot be read, CareerOS shows a message and does not save that session instead of overwriting it. `tests/save_atomic_e2e.js` reproduces the failure on the previous build (3 of 3 checks fail) and passes on this one, 6 runs out of 6.
2. CV Optimizer: two accepted suggestions on the same line (for example a skills addition and an integrity correction) produced a tailored CV with one change missing and an integrity warning. Same-line changes are now merged; changes that edit the same words are reported instead of silently dropped.

Results: `e2e.js` 48/48, `e2e2.js` 32/32, `web_e2e.js` all pass, `save_atomic_e2e.js` 3/3, `applied_e2e.js` 6/6, `cache_e2e.js` 3/3, `merge_e2e.js` 7/7, `test_data.js` 24/24, `test_engine2.js` 20/20, `test_tailoring_pages.js` 0 failures, `smoke.js` 0 errors, `clickall.js` no problems on desktop and iPhone, local file and private page.

## Update, 6 November 2026 (2): coursework, quick wins

1. Profile: Maintenance Engineering (A+) and ME 1446 Gas Dynamics (A+), confirmed by the user, added as coursework evidence (maintenance and fluid mechanics). Existing saved profiles receive them once on next start.
2. CV Optimizer: new "Coursework" suggestion inserts one bullet under the degree line when the advert asks for what a course covers (46 of 135 reachable jobs ask for maintenance, the most common gap). The new paragraph is a copy of an existing bullet with its text replaced, so formatting is identical. The TalMal fintech role stays on the master CV and is still offered for removal (with permission) for engineering roles, which also keeps the page count at one when coursework is added.
3. Profile "Quick wins" card and a matching next best move: the most requested skills without confirmed evidence (currently Planning and Scheduling, QA/QC, Testing and Commissioning, MS Office, Reliability Engineering, Excel, AutoCAD and others), confirm or dismiss in one tap.
4. Average keyword coverage across reachable jobs if every suggestion is accepted: 50% before tailoring, 61% after.

Results: `test_tailoring_pages.js` 0 failures (now checks every paragraph of each tailored copy, including inserted lines), `applied_e2e.js` 11/11, `merge_e2e.js` 8/8, `e2e.js` 48/48, `e2e2.js` 32/32, `web_e2e.js`, `save_atomic_e2e.js`, `cache_e2e.js` all pass, `test_data.js` 24/24, `test_engine2.js` 20/20.

