"""Build CareerOS_Data.xlsx from data/ and build/scored.json."""
import json, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = lambda p: json.load(open(os.path.join(R, p), encoding="utf-8"))
jobs = L("build/scored.json"); prof = L("data/profile.json"); comps = L("data/companies.json"); excl = L("data/excluded.json"); market = L("data/market.json")
import importlib.util, subprocess
tax = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./src/taxonomy.js')))"], cwd=R))
TR = tax["TRACKS"]
F = "Arial"; HF = Font(name=F, bold=True, color="FFFFFF", size=10); BF = Font(name=F, size=10); LF = Font(name=F, size=10, color="1C5CAB", underline="single")
HFILL = PatternFill("solid", fgColor="0E1B2C"); thin = Side(style="thin", color="E3E6EB")
FILL = {"GREEN": "E6F6E6", "YELLOW": "FFF5DC", "ORANGE": "FDEEE7", "RED": "FBE9E9"}
wb = Workbook(); wb.remove(wb.active)
def sheet(name, heads, rows, widths=None, links=(), wrap=(), elig_col=None, note=None):
    ws = wb.create_sheet(name)
    start = 1
    if note:
        ws.cell(1, 1, note).font = Font(name=F, italic=True, size=9, color="4A5260"); start = 2
    for c, h in enumerate(heads, 1):
        x = ws.cell(start, c, h); x.font = HF; x.fill = HFILL; x.alignment = Alignment(vertical="center", wrap_text=True)
    for r, row in enumerate(rows, start + 1):
        for c, v in enumerate(row, 1):
            if isinstance(v, list): v = "; ".join(str(i) for i in v)
            x = ws.cell(r, c, v); x.font = BF; x.border = Border(bottom=thin)
            x.alignment = Alignment(vertical="top", wrap_text=(c in wrap))
            if c in links and isinstance(v, str) and v.startswith("http"):
                x.hyperlink = v; x.font = LF
    ws.freeze_panes = ws.cell(start + 1, 2)
    if rows: ws.auto_filter.ref = f"A{start}:{get_column_letter(len(heads))}{start + len(rows)}"
    for c, w in enumerate(widths or [], 1): ws.column_dimensions[get_column_letter(c)].width = w
    ws.row_dimensions[start].height = 30
    if elig_col and rows:
        col = get_column_letter(elig_col); rng = f"{col}{start+1}:{col}{start+len(rows)}"
        for k, v in FILL.items(): ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{k}"'], fill=PatternFill("solid", fgColor=v), font=Font(name=F, bold=True)))
    return ws
JH = ["Job ID", "Job Title", "Employer", "Location", "Career Track", "Employment Type", "Salary", "Education", "Experience (min years)", "Skills", "Publication Date", "Deadline", "Verification Date", "Job Status", "Eligibility", "Eligibility reasons", "Match Score", "Keyword Coverage %", "Job Description (excerpt)", "Source", "Application URL", "Verification", "Notes"]
def jrow(j): return [j["jobId"], j["title"], j["employer"], j["location"], [TR.get(t, t) for t in j.get("tracks", [])], j.get("type", ""), j.get("salary", "Not disclosed"), j["education"], j["minYears"] if j["minYears"] is not None else "Not stated", j["skills"], j.get("published", ""), j.get("deadline", ""), j.get("verifiedDate", ""), "Closed" if j["expired"] else j.get("status", ""), j["eligibility"], j["eligibilityReasons"], j["match"], j["keywordCoverage"], (j.get("description") or "")[:1500], j.get("source", ""), j.get("applyUrl", ""), j.get("verification", ""), j.get("notes", "")]
W = [11, 38, 24, 22, 26, 13, 14, 20, 11, 34, 12, 11, 12, 10, 11, 50, 8, 10, 60, 30, 30, 40, 40]
active = sorted([j for j in jobs if not j["expired"]], key=lambda j: -j["match"])
# Summary with live formulas
ws = wb.create_sheet("Summary")
ws["A1"] = "CareerOS data workbook"; ws["A1"].font = Font(name=F, bold=True, size=14)
ws["A2"] = "Research date 2026-11-05. Counts below are formulas over the 'All Opportunities' sheet. Eligibility and match are separate; neither is a hiring probability."; ws["A2"].font = Font(name=F, italic=True, size=9)
labels = [("Opportunities in database", '=COUNTA(\'All Opportunities\'!A:A)-1'), ("GREEN (can apply)", '=COUNTIF(\'All Opportunities\'!O:O,"GREEN")'), ("YELLOW (likely, confirm)", '=COUNTIF(\'All Opportunities\'!O:O,"YELLOW")'), ("ORANGE (stretch)", '=COUNTIF(\'All Opportunities\'!O:O,"ORANGE")'), ("RED (not currently eligible)", '=COUNTIF(\'All Opportunities\'!O:O,"RED")'), ("Match 70+ and GREEN/YELLOW", '=COUNTIFS(\'All Opportunities\'!Q:Q,">=70",\'All Opportunities\'!O:O,"GREEN")+COUNTIFS(\'All Opportunities\'!Q:Q,">=70",\'All Opportunities\'!O:O,"YELLOW")'), ("Average match score", '=ROUND(AVERAGE(\'All Opportunities\'!Q:Q),1)'), ("Excluded / expired / upcoming records", '=COUNTA(\'Excluded and Expired\'!A:A)-1'), ("Applications tracked (excluding example row)", '=MAX(0,COUNTA(\'Application Tracker\'!A:A)-3)')]
for i, (l, f) in enumerate(labels, 4):
    ws.cell(i, 1, l).font = BF; c = ws.cell(i, 2, f); c.font = Font(name=F, bold=True, size=10)
ws.column_dimensions["A"].width = 46; ws.column_dimensions["B"].width = 14
sheet("All Opportunities", JH, [jrow(j) for j in active], W, links=(20, 21), wrap=(2, 16, 19, 22, 23), elig_col=15)
sheet("Apply Now", JH, [jrow(j) for j in active if j["eligibility"] in ("GREEN", "YELLOW")], W, links=(20, 21), wrap=(2, 16, 19, 22, 23), elig_col=15, note="Only GREEN and YELLOW opportunities. Re-check each advert before applying.")
# Tracker template
TH = ["Job ID", "Company", "Position", "Location", "Advert URL", "Eligibility", "Match Score", "Keyword Coverage %", "CV Version", "Application Package", "Application Date", "Deadline", "Status", "Contact Person", "Follow-up Date", "Notes"]
ex = ["EXAMPLE (delete)", "Airbus Defence and Space Saudi", "Engineering Apprentice for System Engineering", "Riyadh", "https://www.linkedin.com/jobs/view/4465939394/", "YELLOW", 88, 70, "Saleh_Alsubaie_CV_Airbus_..._v1.docx", "Yes", "", "", "To apply", "", "", "Example row showing the format"]
ws = sheet("Application Tracker", TH, [ex], [14, 26, 34, 14, 30, 11, 9, 10, 30, 10, 13, 12, 16, 20, 13, 30], links=(5,), elig_col=6,
           note="Fill one row per application. Edit any column; 'Status' has a dropdown. The CareerOS app keeps its own tracker and can export it as CSV.")
dv = DataValidation(type="list", formula1='"Discovered,Not reviewed,Interested,To apply,CV prepared,Applied,Assessment,Interview,Rejected,Offer received,Accepted,Follow-up required,Withdrawn"', allow_blank=True)
ws.add_data_validation(dv); dv.add("M3:M500")
for r in range(3, 501):
    for c in range(1, 17): ws.cell(r, c).font = BF
for c in range(1, 17): ws.cell(3, c).font = Font(name=F, size=10, italic=True, color="7A8392")
# Profile
P = prof; pe = P["personal"]; ed = P["education"]
rows = [["Name", pe["name"], "verified_doc", ""], ["Email", pe["email"], "verified_doc", ""], ["Phone", pe["phone"], "verified_doc", ""], ["City", pe["city"], "verified_doc", ""], ["LinkedIn", pe["linkedin"], "verified_doc", ""], ["Portfolio", pe["portfolio"], "verified_doc", ""],
        ["Degree", ed["degree"] + ", " + ed["university"], ed["status"], ""], ["Academic status", ed["academicStatus"], ed["status"], "Not yet graduated"], ["Expected graduation", ed["expectedGraduation"], ed["status"], ""],
        ["GPA", ed["gpa"]["value"] or "(not set)", ed["gpa"]["status"], ed["gpa"]["note"]], ["University co-op required", ed["coopRequired"]["value"] or "(not set)", ed["coopRequired"]["status"], ed["coopRequired"]["note"]]]
for k in ["nationality", "gender", "workAuthorization", "availability", "salaryExpectation"]:
    rows.append([k, pe[k]["value"] or "(not set)", pe[k]["status"], pe[k]["note"]])
rows += [["Skill: " + s["name"], s.get("strength", ""), s["status"], (s.get("note") or "") + (" | evidence: " + ", ".join(s.get("evidence", [])) if s.get("evidence") else "")] for s in P["skills"]]
rows += [["INTEGRITY FLAG: " + f["title"], f["severity"], "", f["detail"]] for f in P["integrityFlags"]]
st = sheet("Master Career Profile", ["Field", "Value", "Verification status", "Note"], rows, [36, 50, 20, 90], links=(2,), wrap=(2, 4))
sheet("Career Evidence", ["ID", "Type", "Title", "Organisation", "Start", "End", "Verification status", "Career tracks", "Skills (keyword ids)", "Details", "Evidence sources", "Notes"],
      [[i["id"], i["type"], i["title"], i.get("org", ""), i.get("start", ""), i.get("end", ""), i["status"], [TR.get(t, t) for t in i.get("tracks", [])], i.get("skills", []), "\n".join(i.get("bullets", [])), i.get("evidence", []), i.get("notes", "")] for i in P["items"]],
      [7, 13, 46, 30, 9, 9, 18, 30, 30, 70, 20, 50], wrap=(3, 10, 12))
T = {"A": "Actual advertised vacancy", "B": "Open talent pool", "C": "General CV submission", "D": "Speculative networking"}
openby = {}
for j in active: openby.setdefault(j["employer"].lower(), 0); openby[j["employer"].lower()] += 1
sheet("Company Watchlist", ["Company", "Opportunity type", "Industry", "Location", "Career site", "Career site check", "Career tracks", "Departments", "Typical roles", "Keywords", "Internship programs", "Graduate programs", "Talent pool", "Last checked", "Notes"],
      [[c["name"], c["opportunityType"] + ": " + T[c["opportunityType"]], c["industry"], c["location"], c["careersUrl"], c["careersCheck"], [TR.get(t, t) for t in c["tracks"]], c["departments"], c["typicalRoles"], c["keywords"], c["internshipPrograms"], c["graduatePrograms"], c["talentPool"], c["lastChecked"], c["notes"]] for c in comps],
      [32, 28, 24, 18, 32, 30, 28, 24, 24, 24, 34, 34, 22, 12, 60], links=(5,), wrap=(11, 12, 15))
freq = {}
for j in active:
    for s in j["skills"]: freq[s] = freq.get(s, 0) + 1
sheet("Keyword Library", ["Keyword ID", "Canonical term", "Equivalent wording (synonyms)", "Category", "Career tracks", "Active adverts mentioning it"],
      sorted([[k["id"], k["term"], k["syn"], k["cat"], [TR.get(t, t) for t in k["tracks"]], freq.get(k["term"], 0)] for k in tax["TAXONOMY"]], key=lambda r: -r[5]), [14, 30, 70, 12, 40, 12], wrap=(3,))
src = [["LinkedIn public job pages (logged-out guest view)", "https://www.linkedin.com/jobs/", "Primary listing source", "Accessible; 1,437 listing cards collected, 282 detail pages read", "2026-11-05"],
       ["Bayt.com", "https://www.bayt.com/en/saudi-arabia/", "Aggregator", "Blocked automated access (HTTP 403). Not bypassed. Used only via search snippets.", "2026-11-05"],
       ["GulfTalent", "https://www.gulftalent.com/saudi-arabia", "Aggregator", "Blocked (HTTP 403). Not bypassed.", "2026-11-05"],
       ["Indeed Saudi Arabia", "https://sa.indeed.com", "Aggregator", "Blocked (HTTP 401). Not bypassed.", "2026-11-05"],
       ["Naukrigulf", "https://www.naukrigulf.com", "Aggregator", "Connection failed from research environment.", "2026-11-05"],
       ["Glassdoor", "https://www.glassdoor.com", "Aggregator", "Seen in search results only (counts not used as statistics).", "2026-11-05"],
       ["Jadarat", "https://jadarat.sa", "Government job portal", "HTTP 403 to automated check; requires login. Not accessed.", "2026-11-05"],
       ["HRDF", "https://www.hrdf.org.sa", "Government (Tamheer)", "Reachable; program rules not retrieved.", "2026-11-05"],
       ["Misk Hub", "https://hub.misk.org.sa", "Programs", "Reachable; no open engineering GDP on 2026-11-05.", "2026-11-05"],
       ["Sabbar", "https://sabbar.com", "Saudi job platform", "JavaScript-rendered pages timed out; not used.", "2026-11-05"],
       ["Employer career portals", "see Company Watchlist", "Employer", "Checked 54 career URLs; results recorded per company.", "2026-11-05"]]
src += [[f["topic"], s, "Market fact source", f["type"], f["verified"]] for f in market["facts"] for s in f["sources"]]
sheet("Search Sources", ["Source", "URL", "Role", "Access result / use", "Checked"], src, [44, 60, 22, 70, 12], links=(2,), wrap=(4,))
exrows = [[e.get("id", ""), e.get("category", "Excluded"), e.get("title", ""), e.get("employer", ""), e.get("reason", ""), e.get("source", ""), e.get("verifiedDate", "2026-11-05")] for e in excl]
exrows += [[j["jobId"], "Expired", j["title"], j["employer"], "Closed or past deadline", j["source"], j["verifiedDate"]] for j in jobs if j["expired"]]
sheet("Excluded and Expired", ["ID", "Category", "Title", "Employer", "Reason", "Source", "Checked"], exrows, [16, 22, 46, 28, 70, 40, 12], links=(6,), wrap=(3, 5))
wb.move_sheet("Summary", offset=0)
out = os.path.join(R, "CareerOS_Data.xlsx"); wb.save(out); print("saved", out)
