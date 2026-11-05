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
