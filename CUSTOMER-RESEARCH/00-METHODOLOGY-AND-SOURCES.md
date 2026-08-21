# Sleep Apnea — Customer Research: Methodology, Sources & Limitations

**Research date:** 2026-08-21
**Scope:** People who have (or suspect they have) sleep apnea, and the partners who live with them.
**Nature:** READ-ONLY. Nothing was posted, commented, liked, joined, left, or modified anywhere. No account of the client was used or altered.

---

## 1. What was actually accessible (read this first)

Honesty about sourcing matters more than a long source list. Here is exactly what happened.

| Source requested | Status | What I did instead |
|---|---|---|
| **Reddit** | Reddit blocks automated fetching of `reddit.com` from this environment (HTTP 403 for the site, and the search index refuses the domain) | Used the **Arctic Shift public Reddit archive** (`arctic-shift.photon-reddit.com`), a full public mirror of Reddit posts/comments. Content is verbatim Reddit content; every item carries its original Reddit permalink so you can verify it in your own browser. |
| **Facebook groups/pages** | **NOT accessed. No data from Facebook is in this research.** | The brief said "groups/pages that I explicitly provide access to" — no group names, links or exports were provided. Facebook groups are also login-walled and this research runs in an isolated cloud container with no access to the client's browser session or accounts. See §5 for how to supply this. |
| **Public forums** | Partially accessible | **CPAPtalk.com** (119k+ topics, the largest independent CPAP user forum) scraped read-only. **ApneaBoard**, **Quora**, **HealthBoards**, **Trustpilot** blocked automated access (403). **MyApnea.org** community is offline ("under construction"). |
| **Reviews** | Not usable | Amazon/Trustpilot review pages blocked. On-brand review widgets (mouthpiece vendors) are vendor-curated and were deliberately excluded as unreliable evidence. |

**Consequence for interpretation:** this research reflects *English-language, online, community-participating* sleep apnea patients. That population over-represents people who are engaged enough to seek help and under-represents people who quietly stopped treatment and never posted again. Where that matters, it is flagged in the confidence notes.

---

## 2. Data collected

| Dataset | Size | What it is |
|---|---|---|
| `raw/reddit-posts.jsonl` | 3,313 | Posts from **r/SleepApnea** and **r/CPAP** |
| `raw/reddit-comments.jsonl` | 11,828 | Comments: 11,528 pulled thread-by-thread from the 163 most-discussed posts, plus 300 from keyword search |
| `raw/cpaptalk-threads.jsonl` | 150 | Full threads from CPAPtalk.com |

Every record keeps: original text, author handle, score, comment count, timestamp, and a reconstructed source URL.

### Two-track sampling (this is the important methodological point)

**Track A — unbiased base-rate sample.**
All posts published on **34 calendar days spread evenly across ~18 months** (one day every 16 days, Mar 2025 → Aug 2026) in both subreddits, with no keyword filter at all. This is what lets me say *"X% of people talk about Y"* without the number being an artifact of my own search terms. Frequencies in `04-FREQUENCY-BASELINE.md` come **only** from this track.

**Track B — targeted depth sample.**
~50 keyword searches (emotional and treatment-specific language: "gave up on cpap", "claustrophobic", "afraid of dying", "my wife", "aerophagia", "ozempic", "inspire implant", …) against post bodies and comment bodies. This surfaces the strongest first-person accounts. **Track B is used for quotes and nuance only — never for frequency claims**, because searching for a phrase guarantees you find it.

**Comments — a third collection method.** The archive's keyword comment-search rate-limited too hard to use at scale, so comments were instead pulled exhaustively from the 260 highest-comment threads (163 returned data, 11,528 comments). Complete within those threads, but skewed toward busy conversations by construction — treated accordingly, and never used for post-level frequencies.

**Track C — triangulation.**
CPAPtalk.com threads, to check whether Reddit-specific dynamics were being mistaken for market-wide patterns. (They partly were — see the note on the "data tinkerer" segment.)

---

## 3. How themes were counted

Each post in Track A with >150 characters of body text was tagged automatically against ~30 theme patterns (regex over title + body), then the classifications were spot-checked by reading. A post can carry several themes. The tagger is in `raw/theme-tagger.py` so the counts are reproducible and auditable.

Automatic tagging is blunt: it detects *topics mentioned*, not *intensity*. So every quantitative claim in this research is paired with a qualitative read, and both are shown separately.

---

## 4. Separation of evidence and interpretation

- `CUSTOMER-RESEARCH/` — **raw evidence only.** Verbatim quotes, source links, and per-quote extraction. Nothing here is my conclusion.
- `CUSTOMER-MODEL/` — **my interpretation.** Avatars, sub-avatars, beliefs, awareness levels. Clearly labelled as interpretation, with the evidence it rests on.
- `ANGLES/` — **advertising hypotheses only.** Not validated. No angle is called a winner; only paid data can decide that.

Confidence labels used throughout:
- **High** — appears repeatedly across many independent people, in both the unbiased and targeted samples, and in the second source (CPAPtalk).
- **Medium** — a clear recurring pattern, but from fewer independent people, or concentrated in one source/subreddit.
- **Low** — visible and plausible, but thin evidence. Treat as a question to research further, not as a finding.

Where two groups say opposite things, both are preserved (see the CPAP-loves-it vs CPAP-intolerant split, and the weight-loss-cured vs weight-isn't-my-cause split). They are not averaged into a fake middle.

---

## 5. To add the Facebook layer

Facebook data has to come from the client, because group content is login-walled and this environment has no access to any browser session or account.

Workable options, in order of usefulness:
1. **Export the posts/comments** from the specific groups (screenshots, copy-paste into a text file, or a group export) and drop them in `CUSTOMER-RESEARCH/raw/facebook/`. I will analyse them with the same tagger and keep them clearly separated by source.
2. **Name the groups/pages.** If any are *public*, some content may be readable without login and I can attempt a read-only fetch.
3. If neither is possible, the research stands as Reddit + CPAPtalk, and the Facebook layer stays explicitly marked as a gap. Facebook sleep apnea groups skew older, more device-focused and more partner-involved than Reddit, so the missing layer most likely under-represents **older long-term CPAP users** and **spouses**.

---

## 6. Account safety confirmation

No posting, commenting, voting, reacting, messaging, joining, leaving, editing or settings changes occurred on any platform. No login was used anywhere. All access was anonymous, read-only retrieval of publicly available content.
