"""Write CareerOS_Opportunities.csv and CareerOS_Master_Profile.json from build/scored.json and data/profile.json."""
import json, csv, os, subprocess
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = json.load(open(os.path.join(R, "build/scored.json")))
T = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./src/taxonomy.js').TRACKS))"], cwd=R))
H = ["Job ID", "Job Title", "Employer", "Location", "Career Track", "Employment Type", "Salary", "Education", "Experience (min years)", "Skills", "Publication Date", "Deadline", "Verification Date", "Job Status", "Eligibility", "Match Score", "Career Value", "Keyword Coverage %", "Source", "Application URL", "Notes", "Source listing ID", "Eligibility reasons"]
with open(os.path.join(R, "CareerOS_Opportunities.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(H)
    for j in sorted(J, key=lambda x: -x["match"]):
        w.writerow([j["jobId"], j["title"], j["employer"], j["location"], "; ".join(T.get(t, t) for t in j["tracks"]), j.get("type", ""), j.get("salary", "Not disclosed"), j["education"], "" if j["minYears"] is None else j["minYears"], "; ".join(j["skills"]), j.get("published", ""), j.get("deadline", ""), j["verifiedDate"], "Closed" if j["expired"] else j["status"], j["eligibility"], j["match"], j["careerValue"], j["keywordCoverage"], j["source"], j.get("applyUrl", ""), j.get("notes", ""), j["id"], " | ".join(j["eligibilityReasons"])])
json.dump(json.load(open(os.path.join(R, "data/profile.json"))), open(os.path.join(R, "CareerOS_Master_Profile.json"), "w"), indent=2, ensure_ascii=False)
print("csv rows", len(J))
