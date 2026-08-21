# Raw research data

**Do not edit these files.** They are the unmodified evidence base. Any re-analysis should read them and write elsewhere. New collection rounds should go in new files (`reddit-posts-2026-09.jsonl` etc.), never overwrite these.

## Files

| File | Records | Contents |
|---|---:|---|
| `reddit-posts.jsonl` | 3,313 | Posts from r/SleepApnea and r/CPAP, deduplicated by post id |
| `reddit-comments.jsonl` | 300 | Comments from the same subreddits (partial — see note below) |
| `cpaptalk-threads.jsonl` | 150 | Full threads from CPAPtalk.com, with all posts in each thread |
| `theme-tagger.py` | — | The regex theme classifier used for every frequency figure |
| `harvest-scripts/` | — | The collection scripts, so any number here can be reproduced |

Collected 2026-08-21. Read-only retrieval of public content; nothing was posted, joined, liked or modified anywhere.

## Schema — `reddit-posts.jsonl`

One JSON object per line:

- `id`, `title`, `selftext`, `author`, `subreddit`
- `score`, `num_comments`, `created_utc` (unix seconds)
- `link_flair_text`
- `_url` — reconstructed permalink, open it to verify any quote
- `_src` — **provenance, and it matters for interpretation:**
  - `daysample:<subreddit>:<date>` = **Track A**, the unbiased sample. Every post from that calendar day, no keyword filter. **Only these records may be used for frequency claims.**
  - `kw:<keyword>:<subreddit>` = **Track B**, targeted keyword search. Use for quotes and depth. **Never for frequencies** — the keyword guarantees the hit.

## Schema — `reddit-comments.jsonl`

`id`, `body`, `author`, `subreddit`, `score`, `created_utc`, `link_id` (parent post, `t3_<id>`), `parent_id`, `_url`, `_src`.

**Note on completeness:** the comment collection is partial. The archive API rate-limits the comment-search endpoint aggressively, and several keyword queries were refused during collection. The comments present are genuine and usable for language and quotes; the set is **not** a representative sample and no frequency claim in this research is based on it. Re-running `harvest-scripts/comments_harvest.py` later (it resumes and de-duplicates) will extend it.

## Reproducing the frequency numbers

```python
import json
exec(open("theme-tagger.py").read())          # provides tag(text)
posts = [json.loads(l) for l in open("reddit-posts.jsonl")]
base  = [p for p in posts
         if p["_src"].startswith("daysample") and len(p.get("selftext") or "") > 150]
# len(base) == 1976 -> the denominator used in 04-FREQUENCY-BASELINE.md
```

## Sources

- Reddit content via the Arctic Shift public Reddit archive (`arctic-shift.photon-reddit.com`). Reddit itself blocks direct automated access from this environment; the archive mirrors the same public content, and every `_url` points back to the original.
- CPAPtalk.com, scraped read-only from public forum pages.
- **No Facebook data.** No group was named or made accessible, and group content is login-walled. See `../00-METHODOLOGY-AND-SOURCES.md` §5.
