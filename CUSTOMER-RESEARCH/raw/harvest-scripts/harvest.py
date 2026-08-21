import json, time, sys, datetime as dt
from fetch import get
import urllib.parse as up

PF="id,title,selftext,score,num_comments,created_utc,subreddit,author,link_flair_text"
CF="id,body,score,created_utc,subreddit,author,link_id,parent_id"
seen_p=set(); seen_c=set()
import os
for f_,st in (("posts.jsonl",seen_p),("comments.jsonl",seen_c)):
    if os.path.exists(f_):
        for l in open(f_):
            try: st.add(json.loads(l)["id"])
            except Exception: pass
DONE=set(open("done.txt").read().split()) if os.path.exists("done.txt") else set()
dn=open("done.txt","a")
def mark(u): DONE.add(u); dn.write(u+"\n"); dn.flush()
fp=open("posts.jsonl","a"); fc=open("comments.jsonl","a")

def wp(o,src):
    if o["id"] in seen_p: return
    seen_p.add(o["id"]); o["_src"]=src
    o["_url"]=f"https://www.reddit.com/r/{o.get('subreddit')}/comments/{o['id']}/"
    fp.write(json.dumps(o)+"\n"); fp.flush()
def wc(o,src):
    if o["id"] in seen_c: return
    seen_c.add(o["id"]); o["_src"]=src
    lid=(o.get("link_id") or "t3_x")[3:]
    o["_url"]=f"https://www.reddit.com/r/{o.get('subreddit')}/comments/{lid}/_/{o['id']}/"
    fc.write(json.dumps(o)+"\n"); fc.flush()

def day_posts(sub, start):
    end=start+86400; after=start; n=0
    while True:
        d=get("/posts/search",{"subreddit":sub,"limit":"100","after":str(after),"before":str(end),
              "sort":"asc","sort_type":"created_utc","fields":PF})
        if not d: break
        for o in d: wp(o,f"daysample:{sub}:{dt.datetime.utcfromtimestamp(start).date()}")
        n+=len(d)
        if len(d)<100: break
        after=d[-1]["created_utc"]+1
        time.sleep(1.5)
    return n

SUBS=["SleepApnea","CPAP"]
# ~34 sampled days spread over 18 months = unbiased base rate corpus
base=dt.datetime(2025,3,5)
days=[int((base+dt.timedelta(days=16*i)).timestamp()) for i in range(34)]
now=int(time.time())
days=[d for d in days if d < now-86400]
print("sample days:",len(days),flush=True)
for sub in SUBS:
    for s in days:
        u=f"day:{sub}:{dt.datetime.utcfromtimestamp(s).date()}"
        if u in DONE: continue
        try: n=day_posts(sub,s); mark(u)
        except Exception as e: n=-1; print("err",e,flush=True)
        print("day",sub,dt.datetime.utcfromtimestamp(s).date(),n,flush=True)
        time.sleep(1.5)

KW=["exhausted all the time","brain fog","claustrophobic","ripped the mask off","gave up on cpap",
 "stopped using my cpap","can't tolerate cpap","mask leaks","dry mouth","aerophagia","sore nose",
 "straps too tight","hate my cpap","scared","afraid of dying","die in my sleep","heart attack",
 "stroke","my wife","my husband","separate bedrooms","snoring so loud","embarrassed","divorce",
 "mouth tape","chin strap","mandibular advancement","oral appliance","dentist appliance","inspire implant",
 "UPPP surgery","septoplasty","lost weight","ozempic","side sleeping","positional therapy","insurance denied",
 "how much did it cost","compliance data","my AHI","no energy","falling asleep at work","falling asleep driving",
 "morning headaches","depressed","libido","desperate","life changing","ruining my life","travel with cpap","cleaning my cpap"]
for kw in KW:
    q=up.quote(kw)
    for sub in SUBS:
      for path,field,flds,w in (("/posts/search","selftext",PF,wp),("/comments/search","body",CF,wc)):
            u=f"kw:{kw}:{sub}:{field}"
            if u in DONE: continue
            try:
                d=get(path,{"subreddit":sub,field:q,"limit":"100","fields":flds,"sort":"desc","sort_type":"created_utc"})
                for o in d: w(o,f"kw:{kw}:{sub}")
                print("kw",kw,sub,path,len(d),flush=True); mark(u)
            except Exception as e: print("errkw",kw,e,flush=True)
            time.sleep(1.6)
print("PHASE1 DONE",flush=True)
