import subprocess,re,json,time,html,sys
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
def fetch(u):
    for i in range(3):
        p=subprocess.run(["curl","-sSL","-m","40","-A",UA,u],capture_output=True,text=True)
        if p.stdout and len(p.stdout)>2000: return p.stdout
        time.sleep(3*(i+1))
    return ""
# 1) collect topic listing
topics={}
for start in range(0,50*45,50):
    h=fetch(f"https://www.cpaptalk.com/viewforum.php?f=1&start={start}")
    found=re.findall(r'href="\./(viewtopic/t(\d+)/[^"]*?\.html)[^"]*"\s+class="topictitle">(.*?)</a>',h,re.S)
    for path,tid,title in found:
        topics[tid]={"id":tid,"title":html.unescape(re.sub("<[^>]+>","",title)),"url":"https://www.cpaptalk.com/"+path}
    print("listing",start,len(found),len(topics),flush=True)
    if not found: break
    time.sleep(1.2)
json.dump(list(topics.values()),open("ct_topics.json","w"),indent=1)
print("TOPICS",len(topics),flush=True)
