#!/usr/bin/env python3
"""CareerOS local companion (optional). Python 3 standard library only.

Runs on http://127.0.0.1:8765 and adds three things the browser cannot do on its own:
  GET  /health          what is available
  GET  /search?q=...    live job search through an API YOU configure (no scraping):
                         - Google Programmable Search: set GOOGLE_CSE_KEY and GOOGLE_CSE_CX
                         - JSearch on RapidAPI:        set JSEARCH_API_KEY
  GET  /recheck?url=... fetch one advert page and report whether it shows a closed notice
  POST /docx2pdf        convert a DOCX to PDF with LibreOffice and report the page count

API keys stay in your environment variables on your computer. Only the search keywords are sent
to the provider. Nothing about your CV or profile leaves your machine.
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("CAREEROS_PORT", "8765"))
SOFFICE = shutil.which("soffice") or shutil.which("libreoffice")
UA = "CareerOS-companion/1.0 (personal job search tool)"

def provider():
    if os.environ.get("GOOGLE_CSE_KEY") and os.environ.get("GOOGLE_CSE_CX"): return "Google Programmable Search"
    if os.environ.get("JSEARCH_API_KEY"): return "JSearch (RapidAPI)"
    return None

def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode("utf-8"))

def search(q):
    p = provider()
    if p == "Google Programmable Search":
        d = get_json("https://www.googleapis.com/customsearch/v1?" + urllib.parse.urlencode({"key": os.environ["GOOGLE_CSE_KEY"], "cx": os.environ["GOOGLE_CSE_CX"], "q": q + " Saudi Arabia job", "num": 10}))
        return p, [{"title": i.get("title", ""), "url": i.get("link", ""), "snippet": i.get("snippet", ""), "company": i.get("displayLink", "")} for i in d.get("items", [])]
    if p == "JSearch (RapidAPI)":
        d = get_json("https://jsearch.p.rapidapi.com/search?" + urllib.parse.urlencode({"query": q + " in Saudi Arabia", "num_pages": 1}),
                     {"X-RapidAPI-Key": os.environ["JSEARCH_API_KEY"], "X-RapidAPI-Host": "jsearch.p.rapidapi.com"})
        out = []
        for i in d.get("data", []):
            out.append({"title": i.get("job_title", ""), "company": i.get("employer_name", ""), "location": ", ".join(x for x in [i.get("job_city"), i.get("job_country")] if x),
                        "url": i.get("job_apply_link") or i.get("job_google_link", ""), "applyUrl": i.get("job_apply_link", ""), "description": i.get("job_description", ""),
                        "published": (i.get("job_posted_at_datetime_utc") or "")[:10], "type": i.get("job_employment_type", "")})
        return p, out
    raise RuntimeError("No search API configured. Set GOOGLE_CSE_KEY + GOOGLE_CSE_CX or JSEARCH_API_KEY and restart.")

CLOSED = re.compile(r"no longer accepting applications|this job (has )?expired|position (has been )?filled|job is closed|applications? (are )?closed", re.I)

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json", extra=None):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*"); self.send_header("Access-Control-Expose-Headers", "X-Page-Count")
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(data)
    def do_OPTIONS(self):
        self.send_response(204); self.send_header("Access-Control-Allow-Origin", "*"); self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); self.send_header("Access-Control-Allow-Headers", "Content-Type"); self.end_headers()
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        try:
            if u.path == "/health":
                p = provider()
                return self._send(200, {"ok": True, "search": p, "pdf": bool(SOFFICE), "message": "Search ready via " + p if p else "No search API configured. Set GOOGLE_CSE_KEY + GOOGLE_CSE_CX, or JSEARCH_API_KEY, then restart."})
            if u.path == "/search":
                p, res = search(q.get("q", [""])[0]); return self._send(200, {"provider": p, "results": res})
            if u.path == "/recheck":
                url = q.get("url", [""])[0]
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                try:
                    with urllib.request.urlopen(req, timeout=30) as r: html = r.read(800000).decode("utf-8", "replace"); code = r.status
                except urllib.error.HTTPError as e: return self._send(200, {"url": url, "http": e.code, "closed": e.code in (404, 410), "note": "HTTP error; the site may block automated checks. Open it in your browser."})
                return self._send(200, {"url": url, "http": code, "closed": bool(CLOSED.search(html))})
            self._send(404, {"error": "unknown endpoint"})
        except Exception as e: self._send(500, {"error": str(e)})
    def do_POST(self):
        if self.path != "/docx2pdf": return self._send(404, {"error": "unknown endpoint"})
        if not SOFFICE: return self._send(500, {"error": "LibreOffice (soffice) not found. Install it, or export the PDF from Word."})
        data = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "cv.docx"); open(src, "wb").write(data)
            subprocess.run([SOFFICE, "--headless", "--convert-to", "pdf", "--outdir", d, src], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
            pdf = os.path.join(d, "cv.pdf")
            if not os.path.exists(pdf): return self._send(500, {"error": "Conversion failed"})
            body = open(pdf, "rb").read()
            pages = len(re.findall(rb"/Type\s*/Page[^s]", body))
            self._send(200, body, "application/pdf", {"X-Page-Count": str(pages)})
    def log_message(self, fmt, *a): sys.stderr.write("[careeros] " + fmt % a + "\n")

if __name__ == "__main__":
    print(f"CareerOS companion on http://127.0.0.1:{PORT}  search: {provider() or 'not configured'}  pdf: {'LibreOffice' if SOFFICE else 'unavailable'}")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
