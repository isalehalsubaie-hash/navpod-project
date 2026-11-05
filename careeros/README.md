# CareerOS

**Your Personal Career Intelligence Platform.** One local application for discovering jobs, checking eligibility, analysing adverts, tailoring your CV without breaking its format, building application packages and tracking every application.

Built for Saleh Abdullah Alsubaie, research snapshot of **5 November 2026**.

## What is in this folder

| File | What it is |
|---|---|
| `CareerOS.html` | **The application.** One self-contained file (about 3 MB). Works offline. |
| `CareerOS_Data.xlsx` | Workbook: Summary, All Opportunities, Apply Now, Application Tracker, Master Career Profile, Career Evidence, Company Watchlist, Keyword Library, Search Sources, Excluded and Expired |
| `CareerOS_Opportunities.csv` | Backup of the 176 researched opportunities with eligibility, match and coverage |
| `CareerOS_Master_Profile.json` | Your verified career profile (single source of truth) |
| `Job_Search_Executive_Summary.md` | Priorities, best opportunities per category, gaps, findings |
| `Search_Methodology.md` | Platforms, companies, keywords, verification method, limitations |
| `QA_Report.md` | Test results and the defects found and fixed during testing |
| `master_cv/Saleh_Alsubaie_CV_MASTER.docx` | Editable master CV reconstructed from your PDF (see below) |
| `tools/careeros_server.py` | Optional local companion: live search via your own API key, advert re-checks, exact DOCX to PDF |
| `src/`, `data/`, `vendor/`, `build/`, `research/`, `tests/` | Source, data, bundled libraries, build scripts, research scripts and automated tests |

## 1. Start the application

Double-click `CareerOS.html` (Chrome, Edge, Safari or Firefox). That is all. There is no server and no install.

- Data is stored in your browser's IndexedDB on this device. Use the same browser each time.
- On a phone, open the file from Files/Drive in a browser; the layout is responsive.
- Private/incognito windows may not keep data between sessions.

## 2. Your master CV (important)

Only PDF versions of your CV existed (workspace and Google Drive). Exact format-preserving editing needs a DOCX, so CareerOS **rebuilt your 17 Oct 2026 PDF as `Saleh_Alsubaie_CV_MASTER.docx`**: same A4 page, 34 pt side margins, Source Sans Pro, the same font sizes, section rules, bullets and right-aligned dates, with the text copied verbatim. Rendered in LibreOffice it is a one-page near-identical match (two lines wrap slightly differently).

**Do one of these first:**
- Open *My Master CV*, compare it with your PDF, and click **Approve reconstructed DOCX as master**; or
- Upload your original DOCX (*My Master CV → Upload CV*). It replaces the reconstruction as the master.

Install the free *Source Sans Pro* font on your computer so Word shows the CV exactly as designed.

**Format lock** (*My Master CV* or *Settings*): `LOCK ORIGINAL CV FORMAT: ON` by default. Tailoring then only rewrites words inside existing paragraphs and text runs. Page size, margins, fonts, sizes, colours, headings, section order, bullets, spacing, tabs and hyperlinks are untouched. Every job gets a new copy; the master is never overwritten, and each copy is re-opened and checked against it.

Uploading a **PDF** gives you text extraction and an ATS readability check, but a PDF cannot be edited in place with a guaranteed layout. Use the DOCX for tailoring. *My Master CV* can also export an optional simplified ATS DOCX, which never replaces the original.

## 3. Add career experience

*My Career Profile → + Add experience, project or certificate.* Enter facts only, choose a verification status (Verified from documentation / Confirmed by me / Requires confirmation / Suggested), and save. Skills are detected automatically. Only Verified or Confirmed evidence is ever used in a CV, cover letter or form answer.

Fill the personal fields at the top (nationality, GPA, IMSIU co-op requirement, availability, salary expectation). Eligibility for every job recalculates immediately. **Set your nationality first:** 27 adverts are Saudi-nationals-only and stay YELLOW until it is confirmed.

Resolve the integrity flags shown on the profile page (flight hours wording, "HVAC Design", PCB design, items in progress).

## 4. Discover opportunities

*Discover Opportunities* opens on **Apply Now** (GREEN and YELLOW only). Tabs: Stretch (ORANGE), Not eligible (RED), All active, Expired & excluded. Filter by city, company, track, eligibility, match, internship/full-time, student/graduate, experience, deadline, publish date and paid/unpaid. Sort by match, newest, closest deadline, Riyadh first or career development. Switch between cards and table.

## 5. Analyse a job

Click any job. The analysis screen has: Overview (eligibility with every reason, match, coverage), Requirements (extracted mandatory/preferred items, tools, certifications, Saudi-specific items, and a requirement-by-requirement table), Keywords & CV (exact / equivalent / supported / unconfirmed / missing), Match score (each weighted factor explained), Strategy, and the Original advert.

To analyse a job that is not in the database: *Job Analysis*, paste the advert or upload its PDF/DOCX, add title, company, location and URL, then **Analyse this job**.

## 6. Optimise your CV for a job

From a job, click **ANALYZE AND TAILOR MY CV**, then **OPTIMIZE MY CV FOR THIS JOB**. You get a table of *Original CV | Suggested CV | Reason* with word-level highlights. For each row: **Accept**, **Reject**, **Edit** (warns if you add a skill your profile does not support), or **Undo**; **Restore original** resets everything. Keyword coverage recalculates after every decision.

The page-fit tile measures line wrapping with the real Source Sans Pro glyph widths on your layout. In testing it predicted LibreOffice's page count correctly for 12 of 12 jobs. If it says the CV will run to two pages, reject a longer change or accept the offered removal of a low-relevance block.

**Create tailored CV (DOCX)** writes a new copy, re-opens it, and confirms that unchanged paragraphs, page setup, fonts and the master file are all intact.

**PDF:** open the DOCX in Word or LibreOffice and *Save as PDF*, or run the companion (section 9) and click **PDF** for an exact LibreOffice conversion with a page count.

## 7. Prepare an application package

*Application Builder*, choose the job, **GENERATE COMPLETE APPLICATION PACKAGE**. Tabs: cover letter (editable, DOCX or print), recruiter messages (introduction, follow-up, internship inquiry, graduate inquiry, referral), application form answers (fields that need you are marked YOUR INPUT REQUIRED; salary is never filled in), strategy, interview preparation (DOCX), and a checklist. **Download application package (.zip)** bundles the tailored CV, cover letter, interview prep, messages, answers, strategy and checklist.

CareerOS never invents contact names, company reasons or achievements. Add your own reason to join a company in *Company Watchlist*; it then appears in cover letters for that company.

## 8. Track applications

*Application Tracker*: change status (13 statuses), dates, contact and notes inline. Status is only set to *Applied* after you confirm you submitted the application yourself. The **Deadlines calendar** shows deadlines, follow-ups and applied dates. Overdue follow-ups are highlighted on the Tracker and Dashboard. Export the tracker as CSV.

## 9. Refresh opportunities (optional live search)

CareerOS does not fake live search. The **Refresh opportunities** button works when the optional companion is running with a search API you configure:

```bash
cd careeros
# choose one provider:
export GOOGLE_CSE_KEY=...  GOOGLE_CSE_CX=...     # Google Programmable Search JSON API
# or
export JSEARCH_API_KEY=...                       # JSearch on RapidAPI (aggregates LinkedIn, Indeed and others)
python3 tools/careeros_server.py                 # serves http://127.0.0.1:8765
```

Keys stay in your terminal environment and never enter the HTML file. Only your search keywords are sent to the provider. New results are labelled *Live search result (unverified)* until you check the advert. The companion also powers **Re-check if open** on each job (fetches the advert page and looks for a closed notice) and exact **DOCX to PDF** export (needs LibreOffice).

Without the companion you can always add any advert manually in *Job Analysis*.

## 10. Back up, restore, delete

*Settings*: **Export full backup (JSON)** (includes CV files, versions and tracker; keep it private), **Restore from backup**, export profile JSON, export opportunities CSV, reload the research snapshot (keeps your profile, CVs and tracker), and **Delete all my data**.

## Privacy

Local-first. No analytics, no external requests with your data, no API keys in the code. The only network use is the optional companion you start yourself.

## Rebuilding and testing (developers)

```bash
cd careeros/build && npm install                      # jszip, @xmldom/xmldom, pdfjs-dist (tests and build)
cd .. && python3 build/build.py                       # rebuild CareerOS.html
node build/export_data.js && python3 build/make_xlsx.py   # rebuild exports
node tests/e2e.js                                     # 48 end-to-end checks in headless Chromium
node tests/test_tailoring_pages.js                    # renders tailored CVs with LibreOffice and checks page count and integrity
node tests/test_docx.js                               # DOCX read/edit unit check
```

Research scripts in `research/` reproduce the job collection (`li_collect.py`, `li_detail.py`), curation (`curate.js`, `overrides.json`, `manual_records.json`) and database build (`build_jobs.js`).

Third-party code bundled in the HTML: JSZip (MIT or GPLv3) and PDF.js (Apache 2.0).
