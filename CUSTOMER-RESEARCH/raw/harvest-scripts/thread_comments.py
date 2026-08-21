import json,time,os
from fetch import get
CF="id,body,score,created_utc,subreddit,author,link_id,parent_id"
posts=[json.loads(l) for l in open("posts.jsonl")]
seen=set()
if os.path.exists("comments.jsonl"):
    for l in open("comments.jsonl"):
        try: seen.add(json.loads(l)["id"])
        except Exception: pass
done=set(open("done2.txt").read().split()) if os.path.exists("done2.txt") else set()
d2=open("done2.txt","a"); fc=open("comments.jsonl","a")
# pick discussion-heavy threads: they carry the replies of other sufferers
cand=[p for p in posts if p.get("num_comments",0)>=12]
cand.sort(key=lambda p:-p["num_comments"])
cand=cand[:260]
print("threads:",len(cand),flush=True)
for i,p in enumerate(cand):
    if p["id"] in done: continue
    d=get("/comments/search",{"link_id":"t3_"+p["id"],"limit":"100","fields":CF})
    n=0
    for c in d:
        if c["id"] in seen: continue
        seen.add(c["id"]); c["_src"]="thread:"+p["id"]; c["_post_title"]=p["title"]
        lid=(c.get("link_id") or "t3_x")[3:]
        c["_url"]=f"https://www.reddit.com/r/{c.get('subreddit')}/comments/{lid}/_/{c['id']}/"
        fc.write(json.dumps(c)+"\n"); n+=1
    fc.flush(); done.add(p["id"]); d2.write(p["id"]+"\n"); d2.flush()
    print(i,p["id"],p["num_comments"],"->",n,flush=True)
    time.sleep(1.5)
print("PHASE2 DONE",flush=True)
