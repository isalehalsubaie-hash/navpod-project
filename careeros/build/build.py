"""Assemble the single-file CareerOS.html from src/, data/, vendor/ and master_cv/."""
import json, base64, os, glob, datetime, subprocess, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
read = lambda p: open(P(p), encoding="utf-8").read()
def js_safe(s): return s.replace("</script", "<\\/script").replace("<!--", "<\\!--")
seed = {
    "seedVersion": 3,
    "researchDate": "2026-11-05",
    "profile": json.load(open(P("data/profile.json"))),
    "jobs": json.load(open(P("data/jobs.json"))),
    "excluded": json.load(open(P("data/excluded.json"))),
    "companies": json.load(open(P("data/companies.json"))),
    "market": json.load(open(P("data/market.json"))),
    "master": {
        "docxName": "Saleh_Alsubaie_CV_MASTER.docx",
        "docxSource": "Reconstructed by CareerOS from Saleh_Alsubaie_CV.pdf (2026-10-17), text verbatim, layout measured from the PDF",
        "docxB64": base64.b64encode(open(P("master_cv/Saleh_Alsubaie_CV_MASTER.docx"), "rb").read()).decode(),
        "pdfName": "Saleh_Alsubaie_CV.pdf",
        "pdfB64": base64.b64encode(open(P("../portfolio/Saleh_Alsubaie_CV.pdf"), "rb").read()).decode(),
    },
}
seed_json = json.dumps(seed, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
app = "\n".join(open(f, encoding="utf-8").read() for f in sorted(glob.glob(P("src/app/*.js"))))
html = read("src/index.template.html")
parts = {
    "/*STYLES*/": read("src/styles.css"),
    "/*BUILD*/": datetime.date.today().isoformat(),
    "/*JSZIP*/": js_safe(read("vendor/jszip.min.js")),
    "/*PDFJS*/": js_safe(read("vendor/pdf.min.js")),
    "/*PDFWORKER*/": js_safe(read("vendor/pdf.worker.min.js")),
    "/*SEED*/": seed_json,
    "/*ENGINEHASH*/": __import__("hashlib").sha256((read("src/engine.js") + read("src/taxonomy.js")).encode()).hexdigest()[:16],
    "/*FONTW*/": read("data/font_widths.json"),
    "/*TAXONOMY*/": js_safe(read("src/taxonomy.js")),
    "/*ENGINE*/": js_safe(read("src/engine.js")),
    "/*ENGINE2*/": js_safe(read("src/engine2.js")),
    "/*JSPDF*/": js_safe(read("vendor/jspdf.umd.min.js")),
    "/*PDFFONTS*/": json.dumps({k: base64.b64encode(open(P("vendor/fonts/SSP-" + n + ".ttf"), "rb").read()).decode() for k, n in [("r", "Regular"), ("b", "Bold"), ("i", "It"), ("bi", "BoldIt")]}),
    "/*PDFRENDER*/": js_safe(read("src/pdfrender.js")),
    "/*APP*/": js_safe(app),
}
for k, v in parts.items():
    assert k in html, k
    html = html.replace(k, v, 1)
out = P("CareerOS.html")
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, round(os.path.getsize(out) / 1e6, 2), "MB")
# hosted (private claude.ai page) variant: adapter loads right after the seed, before the app
web = html.replace("<script>window.CAREEROS_FONT_WIDTHS", "<script>" + js_safe(read("src/artifact_adapter.js")) + "</script>\n<script>window.CAREEROS_FONT_WIDTHS", 1)
assert web != html
outw = P("CareerOS_web.html"); open(outw, "w", encoding="utf-8").write(web)
print("wrote", outw, round(os.path.getsize(outw) / 1e6, 2), "MB")
