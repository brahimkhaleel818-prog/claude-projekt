import subprocess, json, time, sys
BASE="https://arctic-shift.photon-reddit.com/api"
def get(path, params, tries=5):
    q="&".join(f"{k}={v}" for k,v in params.items())
    url=f"{BASE}{path}?{q}"
    for i in range(tries):
        p=subprocess.run(["curl","-sS","-m","60",url],capture_output=True,text=True)
        try: d=json.loads(p.stdout)
        except Exception: d={"error":"parse:"+p.stdout[:120]}
        if d.get("data") is not None: return d["data"]
        time.sleep(3*(i+1))
    print("FAIL",url,str(d)[:200],file=sys.stderr); return []
if __name__=="__main__":
    d=get("/posts/search",{"subreddit":"SleepApnea","limit":"2","fields":"id,title,selftext,score,num_comments,created_utc,subreddit,author,link_flair_text"})
    print(json.dumps(d,indent=1)[:900])
