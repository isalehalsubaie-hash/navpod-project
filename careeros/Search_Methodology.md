# CareerOS: Search Methodology

**Search date:** 5 November 2026 (all verification dates in the database are this date unless noted).
**Geography:** Riyadh first, then the rest of Saudi Arabia. GCC and remote roles were searched but none relevant and accessible were found.

## 1. Platforms searched

| Platform | How it was used | Result |
|---|---|---|
| LinkedIn Jobs (public, logged-out pages) | Guest search pages for 97 keyword sets, filtered to Saudi Arabia / Riyadh, past 30 days, internship, entry and associate levels; then each listing's public detail page | 1,437 listing cards collected; 282 detail pages read (full description, seniority, type, "no longer accepting applications" flag). Main source. Requests were rate-limited (about one every 1.5 to 2.5 s). |
| Bayt.com | Search engine results only | Direct access blocked (HTTP 403). Not bypassed. |
| GulfTalent | Search engine results only | Blocked (HTTP 403). Not bypassed. |
| Indeed Saudi Arabia | Search engine results only | Blocked (HTTP 401). Not bypassed. |
| Naukrigulf, Foundit Gulf, Jooble, JobLeads, Glassdoor | Search engine results only | Used to discover leads; never used as the sole verification of an "open" status. |
| Sabbar (Saudi platform) | Attempted | JavaScript-rendered pages timed out in the research browser. Not used. |
| Jadarat (government) | Reachability check | HTTP 403 and requires login. Not accessed. |
| HRDF, Misk Hub | Program pages | Reachable; no open engineering graduate program on the search date. |
| Employer career portals | 54 career URLs checked (HTTP status recorded in the Company Watchlist) | Lockheed Martin, Boeing and BAE Saudi listings read; others recorded as reachable or not. |
| Official / news sources | Aramco program pages, SPA (Saudi Press Agency), Breaking Defense, law-firm Saudization alerts, SCE pages via search | Used for market facts, each with source and date. |

Arabic and English terms were both used (for example: مهندس ميكانيكي، متدرب، تدريب تعاوني، حديثي التخرج مهندس، برنامج تطوير الخريجين).

## 2. Companies investigated

Defence and aerospace: SAMI (and SAMI Autonomous, SAMI Land, SAMI Aerospace Mechanics, SAMI-AEC), GAMI, GADD, INTRA Defense Technologies, Taqnia, Terra Drone Arabia, Airbus Defence and Space Saudi, Airbus Helicopters, Lockheed Martin, Boeing, BAE Systems, Thales, Raytheon/RTX, L3Harris, Leonardo, Saab, Northrop Grumman, General Dynamics, Saudia Aerospace Engineering Industries, Alsalam Aerospace, KACST, Saudi Space Agency, Alfaisal/AlfaisalX, KAUST, Elbit, Hanwha, Rheinmetall, EDGE, Scopa.
Search terms for BLACKBAT, ATAM and Smart Drones returned no accessible listings or careers pages.

Energy and industrial: Saudi Aramco, Luberef, SABIC, Ma'aden, ACWA Power, Saudi Electricity Company, SWPC, Marafiq, Sipchem, Tasnee, Sadara, alfanar, Zamil, Riyadh Cables, Hitachi Energy, Siemens Energy, GE Vernova, ENGIE, Saipem, TechnipFMC.

EPC and consulting: Parsons, AtkinsRéalis, Jacobs, Worley, Wood, KBR, Bechtel, Technip Energies, WSP, Egis, Dar Al-Handasah, AESG, AECOM, Omrania, Jensen Hughes, Hill International.

## 3. Keywords used (English, LinkedIn guest search)

Riyadh, entry and internship levels: mechanical engineer, graduate engineer, engineering intern, internship engineering, site engineer, MEP engineer, HVAC engineer, fire protection engineer, project engineer, maintenance engineer, reliability engineer, quality engineer, QA/QC engineer, planning engineer, graduate development program, graduate trainee, management trainee engineering, commissioning engineer, field engineer, production engineer, design engineer, application engineer, sales engineer, business development engineer, project coordinator, PMO, business analyst engineering, HSE engineer, safety engineer, inspection engineer.

Saudi Arabia: UAV, drone, unmanned, robotics engineer, autonomous systems, aerospace engineer, defense engineer, systems engineer, systems integration engineer, test engineer, flight test, avionics, thermography, asset integrity, condition monitoring, NDT, drone pilot, photogrammetry, GIS surveying, remote sensing, internship, fresh graduate engineer, technical sales engineer, solutions engineer, strategy analyst, commercial analyst, project finance intern, energy engineer, renewable energy engineer, power plant engineer, oil and gas graduate, EPC graduate engineer, plus every company name in section 2.

## 4. Verification method

For every listing kept in the database:
1. The listing's own page was opened (LinkedIn public detail page, or the employer/program page).
2. "Open" means the page loaded on 5 Nov 2026 and showed no "No longer accepting applications" notice. Closed listings were moved to *Excluded and Expired*.
3. Publication date: LinkedIn's listing date, otherwise derived from "N days ago". Marked "not stated" when unavailable.
4. Deadlines are recorded only when the advert states one (only 1 active listing did: JPMorgan, 6 Nov 2026).
5. Education, experience, nationality, gender, GPA, co-op letter, Tamheer and certification requirements were extracted from the advert text by the CareerOS engine, then the top ~60 listings were reviewed by hand. Manual corrections are stored as `manualFlags`/`notes` with the reason (`research/overrides.json`).
6. Application links: the LinkedIn listing URL is recorded because LinkedIn hides the employer's external apply link from logged-out visitors. Use the advert's Apply button, which may redirect to the employer portal.
7. Duplicates (same title and employer) were merged; the duplicate URL is kept on the record.
8. Not relevant to the ten career tracks (for example hotel, legal, graphic design, IT infrastructure) were excluded with the reason recorded.
9. Salaries: none of the kept adverts publish a salary, so all show "Not disclosed". No salary was estimated.

## 5. Eligibility and scoring

- **Eligibility** (GREEN / YELLOW / ORANGE / RED) is rule-based and every reason is shown. Missing personal data (nationality, GPA, co-op requirement) produces YELLOW, never GREEN. Roles needing a completed degree are YELLOW because you graduate January 2027. 3+ years required is RED; 1 to 2 years is ORANGE.
- **Match score** (0 to 100) uses the weights you specified: education 15, experience and projects 25, skills 20, entry-level suitability 15, track alignment 10, location 5, development potential 10. Each factor has a written explanation.
- **Keyword coverage** = (exact + verified equivalent matches) / keywords from a 170-term library found in the advert. Equivalents are listed in the Keyword Library (for example HVAC = heating, ventilation and air conditioning).

## 6. Candidate evidence

Inspected: `portfolio/Saleh_Alsubaie_CV.pdf` (17 Oct 2026, identical copies under three names), `portfolio/index.html`, the NavPod `README.md`, and on Google Drive `Saleh_Alsubaie_CV_COOP.pdf` (Aug 2026) and the Defensathon recommendation letter. No DOCX of the CV exists in the workspace or Drive, so the master DOCX was reconstructed from the PDF (see README).

## 7. Source limitations and caveats

- LinkedIn's public view hides some listings and the external apply link; listings can close at any time after the check.
- Several `.sa` sites (SAMI, GADD, Aramco careers root, KACST, SCE, Marafiq, Tasnee, Riyadh Cables, SAEI, Alsalam) did not load from the research environment. This is a network limitation, not evidence that the sites are down. Open them yourself.
- Aggregator copies were never used to mark a job "open" on their own. The Alfaisal Research Engineer record is kept with status **Unknown** because the employer page timed out.
- Market observations are counts over this database's adverts (a sample), not labour-market statistics. Regulatory facts come from law-firm alerts and official pages with dates; the primary MHRSD text for the 2026 engineering Saudization change was not retrieved.
- Em dashes in advert text were normalised to hyphens; all other advert text is stored verbatim.

## 8. Research pass 2 (same day, 5 November 2026)

To find roles that do not say "Mechanical Engineer", a second sweep used: project controls, cost engineer, asset management engineer, digital transformation engineer, industrial digitalization, IoT engineer, automation engineer graduate, instrumentation engineer, process engineer, mechatronics engineer, product engineer, R&D engineer, research assistant engineering, engineering consultant graduate, technical consultant, technical operations, operations engineer, facility / facilities management engineer, HVAC commissioning, energy efficiency engineer, sustainability engineer, geospatial, surveying engineer, GIS engineer, drone inspection, aerial survey, integrity engineer, corrosion engineer, metrology, calibration engineer, supply chain engineer, procurement engineer, tender engineer, estimation engineer, graduate trainee program, management trainee, and Arabic: برنامج تطوير الخريجين، مهندس حديث التخرج، مهندس مشاريع، مهندس صيانة، مهندس سلامة، مهندس جودة.

Result: 406 new listing cards, 141 detail pages read, and about 100 new relevant opportunities after curation (database now 278 active records plus 161 excluded or expired). Existing job IDs were kept stable.

## 9. ATS documentation
- Official: Greenhouse, "Unsuccessful resume parse" (https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse). Its nine causes are implemented as checks in CV Studio, plus its 2.5 MB parse limit.
- Workday, Lever and iCIMS: no official public parsing page could be retrieved. Third-party guides were read but are not used as sources of rules.

## 10. Gmail
Your Gmail receives LinkedIn and Indeed job alerts (about 200 in 30 days) and LinkedIn application confirmations (61 in 120 days). CareerOS 2.0 can import LinkedIn alerts and confirmations into your private storage. Your application history was **not** added to the research data or the repository.
