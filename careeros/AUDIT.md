# CareerOS 1.0 audit (before the 2.0 upgrade)

Audited 5 November 2026 against the live code (`src/`), the hosted page and iPhone-size renders (`tests/audit_mobile.js`).

## Architecture
- Vanilla JS single-page app, 5 modules (`src/app/01..05`), shared engine (`src/engine.js`, also used by Node build/tests), taxonomy (170 terms), seed data embedded at build. Two builds: `CareerOS.html` (local file, IndexedDB) and `CareerOS_web.html` (private claude.ai page, per-person db storage, platform downloads, in-page routing).
- State: one object `S` (profile, jobs, excluded, companies, market, applications, cvVersions, packages, optim, settings, master, activity). Computed values cached per job (`C(job)`), invalidated on profile change.
- Strengths kept: evidence-status model, eligibility rules with reasons, explainable 7-factor match, keyword coverage, run-preserving DOCX editing with integrity check, glyph-width page-fit estimate, package generator, tracker with calendar, 12 screens, 48 E2E tests.

## Working features (all tested in 1.0)
Discover (tabs, 12 filters, 5 sorts, cards/table), job analysis (6 tabs), manual job import (paste/PDF/DOCX), career profile editing, master CV (DOCX/PDF import, ATS checks, format lock, simplified ATS DOCX), CV optimizer (accept/reject/edit/undo, coverage recalculation, overflow warning), tailored DOCX, application builder (cover letter, 5 messages, form answers, strategy, interview prep, checklist, ZIP), tracker (13 statuses, dates, calendar, CSV), market intelligence, watchlist, keyword intelligence, settings (backup/restore/export/wipe).

## Defects and gaps found
| # | Area | Finding | Severity |
|---|---|---|---|
| 1 | Mobile | Top bar shows title, subtitle and every action button; uses ~30% of the iPhone screen | High |
| 2 | Mobile | Job page, profile and builder overflow horizontally (390 px viewport: 468 / 414 / 402 px) | High |
| 3 | Mobile | Wide tables (tracker, keywords, requirements, watchlist, comparisons) scroll sideways instead of becoming cards | High |
| 4 | Mobile | Navigation hidden behind a hamburger only; no thumb-reachable navigation | High |
| 5 | Design | Light theme only; no dark mode; stat tiles stack one per row on phones | Medium |
| 6 | Hosted page | PDF export needs the local companion, which cannot run on an iPhone; print is blocked | High |
| 7 | Hosted page | Live search and "re-check if open" need the local companion (blocked by the page's network policy) | High (limitation) |
| 8 | Intelligence | No AI assistant; no way to ask questions across jobs and profile | High |
| 9 | Scoring | Only eligibility and match; no separate career-value assessment; no opportunity comparison | Medium |
| 10 | CV | No career-track CV versions (Mechanical, UAV/Aerospace, Safety/Inspection, Project, Business) | Medium |
| 11 | CV | ATS checks cite no external documentation | Low |
| 12 | Application | No application email, no readiness checklist score | Medium |
| 13 | Company | Watchlist is a table; no company profile page joining vacancies, programs and facts | Medium |
| 14 | Interview | Interview prep only exists inside a package; no module to start from an invitation | Medium |
| 15 | Development | Gaps are a keyword list; no ranked roadmap with cost, time and benefit | Medium |
| 16 | Analytics | No analytics page (response rate, interview rate, by track/version/channel) | Medium |
| 17 | Dashboard | No "next best moves"; top five is a plain ranking | Medium |
| 18 | Discovery | Research covered the obvious titles; adjacent roles (project controls, asset management, digitalization, applications engineering) were not swept | Medium |
| 19 | Data | Tracker has no application channel field, so channel analytics are impossible | Low |

No buttons were decorative in 1.0: every button had a handler and was covered by tests. Features that depended on the companion were labelled as such.

## Environment limits (verified with the platform documentation)
- Hosted page: no direct network to other hosts; `alert/confirm/print/window.open` blocked; downloads only through the `downloads` capability; persistent private storage through `db` under `data/users/<id>/`; AI through `sample` (Claude, with page-defined tools, no web access); connectors through `mcp`.
- Local file: full browser features, IndexedDB, companion server optional.
- No job board offers an API reachable from either build without a key. Bayt, GulfTalent and Indeed block automated access.

## Upgrade decisions
Keep the architecture and every working feature. Add modules rather than rewrite. Fix mobile first. Add an in-browser DOCX to PDF renderer (embedded Source Sans Pro) so PDFs work on the iPhone. Build CareerOS AI on `sample` with read-only tools over the user's own data. Keep live search honest: research refresh in this session, manual import everywhere, companion search on desktop.
