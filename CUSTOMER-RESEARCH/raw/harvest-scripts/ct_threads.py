import json,re,html,time,subprocess,os
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
def fetch(u):
    for i in range(3):
        p=subprocess.run(["curl","-sSL","-m","45","-A",UA,u],capture_output=True)
        out=p.stdout.decode("utf-8","replace")
        if out and len(out)>2000: return out
        time.sleep(3*(i+1))
    return ""
topics=json.load(open("ct_topics.json"))
SEL=re.compile(r"\b(quit|give up|gave up|hate|struggl\w*|help|desperat\w*|can'?t|cant|frustrat\w*|newbie|new to|just diagnos\w*|first (night|week|month)|success|life|tired|exhaust\w*|fatigue|energy|wife|husband|partner|claustro|leak|sore|mask|comfort|anxiety|scared|afraid|worth it|worse|not working|no (better|improvement)|still tired|compliance|insurance|cost|surgery|inspire|dental|oral appliance|weight|alternative|stop(ped)? using|why (do|does|am|is)|advice)\b",re.I)
sel=[t for t in topics if SEL.search(t["title"])]
print("selected",len(sel),flush=True)
sel=sel[:150]
out=open("cpaptalk.jsonl","a")
done=set(open("ct_done.txt").read().split()) if os.path.exists("ct_done.txt") else set()
dn=open("ct_done.txt","a")
for i,t in enumerate(sel):
    if t["id"] in done: continue
    h=fetch(t["url"])
    if not h: print("skip",t["id"],flush=True); continue
    posts=re.findall(r'<div class="content">(.*?)</div>',h,re.S)
    auth=re.findall(r'class="username[^"]*"[^>]*>([^<]*)</a>',h)
    clean=[]
    for p in posts:
        p=re.sub(r'<blockquote.*?</blockquote>','',p,flags=re.S)
        p=re.sub(r'<br\s*/?>','\n',p); p=re.sub(r'<[^>]+>','',p)
        p=html.unescape(p).strip()
        if len(p)>60: clean.append(p)
    rec={"source":"cpaptalk.com","topic_id":t["id"],"title":t["title"],"url":t["url"],
         "authors":auth[:len(clean)],"posts":clean[:25]}
    out.write(json.dumps(rec)+"\n"); out.flush()
    done.add(t["id"]); dn.write(t["id"]+"\n"); dn.flush()
    print(i,t["id"],len(clean),t["title"][:60],flush=True)
    time.sleep(1.3)
print("CT DONE",flush=True)
