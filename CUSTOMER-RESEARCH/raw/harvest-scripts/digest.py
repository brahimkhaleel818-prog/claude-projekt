import json,sys,random
exec(open("themes.py").read())
_raw=[json.loads(l) for l in open("posts.jsonl")]
_seen=set(); posts=[]
for _p in _raw:
    if _p["id"] in _seen: continue
    _seen.add(_p["id"]); posts.append(_p)
def load_comments():
    try: return [json.loads(l) for l in open("comments.jsonl")]
    except Exception: return []
def show(theme,n=12,chars=800,minlen=300,src=None,seed=7,skip=0):
    P=[p for p in posts if len(p.get("selftext") or "")>minlen]
    if src: P=[p for p in P if p["_src"].startswith(src)]
    hits=[p for p in P if theme in tag(p["title"]+" "+p["selftext"])]
    hits.sort(key=lambda p:-(p["num_comments"]*2+p["score"]))
    print(f"### THEME {theme}: {len(hits)} matching posts\n")
    for p in hits[skip:skip+n]:
        t=p["selftext"].replace("\n\n","\n").strip()[:chars]
        print(f"--- [{p['subreddit']} | score {p['score']} | {p['num_comments']} comments | {p['id']}]")
        print("TITLE:",p["title"])
        print(t.replace("\n"," ⏎ "))
        print()
if __name__=="__main__":
    for th in sys.argv[1:]:
        a=th.split(":"); show(a[0], n=int(a[1]) if len(a)>1 else 12)

SEEN=set()
def show2(theme,n=8,chars=600,minlen=250,maxc=None,mode="mid"):
    import random
    P=[p for p in posts if len(p.get("selftext") or "")>minlen and p["id"] not in SEEN]
    hits=[p for p in P if theme in tag(p["title"]+" "+p["selftext"])]
    hits.sort(key=lambda p:-(p["num_comments"]*2+p["score"]))
    if mode=="mid": pool=hits[8:80] if len(hits)>20 else hits
    else: pool=hits
    random.seed(11); random.shuffle(pool)
    print(f"### {theme}: {len(hits)} posts (showing {min(n,len(pool))})\n")
    for p in pool[:n]:
        SEEN.add(p["id"])
        t=p["selftext"].replace("\n\n","\n").strip()[:chars]
        print(f"--- [{p['subreddit']}|{p['score']}pts|{p['num_comments']}c|{p['id']}] {p['title']}")
        print(t.replace("\n"," ⏎ ")); print()
