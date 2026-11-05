import json,re,html,time,subprocess,sys,os
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
src=json.load(open(sys.argv[1])); out_f=sys.argv[2]
out=json.load(open(out_f)) if os.path.exists(out_f) else {}
def clean(s): return html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',s))).strip()
def text_with_breaks(s):
    s=re.sub(r'<br\s*/?>','\n',s); s=re.sub(r'</(p|li|ul|ol|h\d)>','\n',s); s=re.sub(r'<li>','\n- ',s)
    s=html.unescape(re.sub(r'<[^>]+>','',s)); s=re.sub(r'[ \t]+',' ',s); s=re.sub(r'\n\s*\n+','\n',s)
    return s.strip()
for i,(jid,card) in enumerate(src.items()):
    if jid in out: continue
    r=subprocess.run(["curl","-s","-L","--max-time","30","-A",UA,f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{jid}"],capture_output=True)
    s=r.stdout.decode("utf-8","replace")
    if len(s)<2000: out[jid]={"error":"empty",**card}; time.sleep(8); continue
    g=lambda p: (lambda m: clean(m.group(1)) if m else "")(re.search(p,s,re.S))
    d=dict(card)
    d["title"]=g(r'<h2[^>]*top-card-layout__title[^>]*>(.*?)</h2>') or card["title"]
    d["company"]=g(r'topcard__org-name-link[^>]*>(.*?)</a>') or card["company"]
    d["location"]=g(r'topcard__flavor topcard__flavor--bullet">(.*?)</span>') or card["location"]
    d["posted_ago"]=g(r'posted-time-ago__text[^>]*>(.*?)</span>')
    d["applicants"]=g(r'num-applicants__caption[^>]*>(.*?)</')or g(r'num-applicants__figure[^>]*>(.*?)</')
    d["closed"]=bool(re.search(r'No longer accepting applications|closed-job',s,re.I))
    m=re.search(r'show-more-less-html__markup[^>]*>(.*?)</div>',s,re.S)
    d["description"]=text_with_breaks(m.group(1)) if m else ""
    crit={}
    for h,t in re.findall(r'job-criteria-subheader">(.*?)</h3>\s*<span[^>]*>(.*?)</span>',s,re.S): crit[clean(h)]=clean(t)
    d["criteria"]=crit
    out[jid]=d
    if i%10==0:
        json.dump(out,open(out_f,"w"),ensure_ascii=False,indent=1); print(i,len(out),flush=True)
    time.sleep(1.5)
json.dump(out,open(out_f,"w"),ensure_ascii=False,indent=1); print("done",len(out))
