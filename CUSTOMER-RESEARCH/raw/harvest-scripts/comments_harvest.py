import json,time,os,subprocess,urllib.parse as up
BASE="https://arctic-shift.photon-reddit.com/api"
CF="id,body,score,created_utc,subreddit,author,link_id,parent_id"
def get(path,params,tries=6):
    q="&".join(f"{k}={v}" for k,v in params.items()); url=f"{BASE}{path}?{q}"
    d={}
    for i in range(tries):
        p=subprocess.run(["curl","-sS","-m","90",url],capture_output=True,text=True)
        try: d=json.loads(p.stdout)
        except Exception: d={"error":"parse"}
        if d.get("data") is not None: return d["data"]
        time.sleep(5+5*i)
    print("FAIL",url,str(d)[:120],flush=True); return []
seen=set()
if os.path.exists("comments.jsonl"):
    for l in open("comments.jsonl"):
        try: seen.add(json.loads(l)["id"])
        except Exception: pass
fc=open("comments.jsonl","a")
def w(o,src):
    if o["id"] in seen: return 0
    seen.add(o["id"]); o["_src"]=src
    lid=(o.get("link_id") or "t3_x")[3:]
    o["_url"]=f"https://www.reddit.com/r/{o.get('subreddit')}/comments/{lid}/_/{o['id']}/"
    fc.write(json.dumps(o)+"\n"); return 1
KW=["gave up","claustrophobic","still exhausted","my wife","my husband","changed my life",
"ripped it off","cannot tolerate","dry mouth","aerophagia","hate the mask","scared","stroke",
"oral appliance","inspire","surgery","lost weight","insurance","brain fog","zombie",
"tried everything","dread","divorce","separate rooms","life changing","waste of money"]
for kw in KW:
    q=up.quote(kw)
    for sub in ["SleepApnea","CPAP"]:
        d=get("/comments/search",{"subreddit":sub,"body":q,"limit":"100","fields":CF,"sort":"desc","sort_type":"created_utc"})
        n=sum(w(o,f"kw:{kw}:{sub}") for o in d); fc.flush()
        print("kw",kw,sub,len(d),"new",n,flush=True)
        time.sleep(4)
print("COMMENTS DONE",flush=True)
