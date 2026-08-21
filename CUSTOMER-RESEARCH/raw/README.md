# Raw research data

**Do not edit these files.** They are the unmodified evidence base. Any re-analysis should read them and write elsewhere. New collection rounds should go in new files (`reddit-posts-2026-09.jsonl` etc.), never overwrite these.

## Files

| File | Records | Contents |
|---|---:|---|
| `reddit-posts.jsonl` | 3,313 | Posts from r/SleepApnea and r/CPAP, deduplicated by post id |
| `reddit-comments.jsonl` | 11,828 | Comments from the same subreddits: 11,528 retrieved thread-by-thread from 163 high-discussion posts, plus 300 from keyword searches |
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

**Note on how comments were sampled.** The archive's keyword comment-search endpoint rate-limited aggressively, so most comments were collected a different way: for the 260 highest-comment posts in the corpus, every available comment was pulled by thread (163 threads returned data). That means the comment set is **complete within the threads it covers**, but those threads were chosen for high engagement — so it represents *the market's most-discussed conversations*, not a random slice of all comments. Percentages computed on it (see `07-RAW-EVIDENCE-comments-peer-dynamics.md`) describe what is said inside busy threads, and are reported that way. No post-level frequency claim in this research uses comment data.

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
