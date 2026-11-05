"""Collect public (logged-out) LinkedIn job listings for Saudi Arabia.
Uses only the public guest endpoints that LinkedIn serves to visitors without an account.
Rate limited. Stores raw card data in li_cards.json."""
import json, time, re, sys, html, urllib.parse, subprocess
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
def get(url):
    r=subprocess.run(["curl","-s","-L","--max-time","30","-A",UA,url],capture_output=True)
    return r.stdout.decode("utf-8","replace")
QUERIES=sys.argv[1].split("|") if len(sys.argv)>1 else []
LOC=sys.argv[2] if len(sys.argv)>2 else "Saudi Arabia"
EXP=sys.argv[3] if len(sys.argv)>3 else "1,2,3"
try: cards=json.load(open("li_cards.json"))
except Exception: cards={}
for q in QUERIES:
    for start in (0,10,20):
        url=("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?"+
             urllib.parse.urlencode({"keywords":q,"location":LOC,"f_E":EXP,"f_TPR":"r2592000","start":start}))
        s=get(url)
        items=s.split("<li>")[1:]
        n=0
        for it in items:
            m=re.search(r'jobPosting:(\d+)',it)
            if not m: continue
            jid=m.group(1)
            def f(p):
                mm=re.search(p,it,re.S); return html.unescape(re.sub(r'\s+',' ',mm.group(1))).strip() if mm else ""
            c=dict(id=jid,title=f(r'base-search-card__title">(.*?)</h3>'),
                   company=f(r'base-search-card__subtitle">.*?>(.*?)</a>') or f(r'base-search-card__subtitle">(.*?)</h4>'),
                   location=f(r'job-search-card__location">(.*?)</span>'),
                   date=(re.search(r'datetime="([\d-]+)"',it) or [None,""])[1] if re.search(r'datetime="([\d-]+)"',it) else "",
                   url=f"https://www.linkedin.com/jobs/view/{jid}/")
            c.setdefault("queries",[])
            if jid in cards: cards[jid]["queries"]=sorted(set(cards[jid].get("queries",[])+[q]))
            else: c["queries"]=[q]; cards[jid]=c
            n+=1
        print(f"{q!r} start={start}: {n}",flush=True)
        time.sleep(2.5)
        if n<10: break
json.dump(cards,open("li_cards.json","w"),indent=1,ensure_ascii=False)
print("total",len(cards))
