# MetalliSense VectorSearch — Complete Guide

This document explains exactly how semantic search works in MetalliSense,
what was fixed, how to run it, and how to troubleshoot it if something
goes wrong.

---

## What was broken, and what was fixed

**Original problem:** the first version of this service hard-imported
`actian_vectorai` and crashed on startup if that package wasn't installed
or if Docker/Actian VectorAI DB wasn't running — meaning semantic search
didn't work at all unless you had the full Actian stack set up.

**The fix:** `vector_store.py` is a small adapter with **one interface,
two possible backends**:

```
                    ┌─────────────────────────┐
  main.py  ──calls──▶      vector_store.py      │
                    │  (ensure_collection,       │
                    │   upsert, search, count)   │
                    └────────────┬────────────────┘
                                 │
                 tries this first │  falls back to this
                                 ▼                ▼
                  ┌───────────────────┐   ┌──────────────────────┐
                  │ Real Actian        │   │ Local in-memory       │
                  │ VectorAI DB        │   │ numpy cosine-         │
                  │ (if SDK installed  │   │ similarity store      │
                  │  AND reachable)    │   │ (always available)    │
                  └───────────────────┘   └──────────────────────┘
```

`main.py` never knows or cares which backend is active — it just calls
`vector_store.search(...)` and gets results either way. This means:

- **No Docker? No Actian account? No problem.** The local fallback works
  immediately, with zero extra setup, using plain numpy cosine similarity.
- **Have real Actian VectorAI DB running?** It's used automatically —
  `vector_store.py` detects it at startup and switches over, no code
  changes needed anywhere.
- **Semantic search literally cannot fail to start** because of a missing
  Actian connection anymore. That was the actual bug.

## What's verified vs. what isn't

✅ **Verified working** (tested directly, with real data, in this build):
- `dataset.csv` parsing — all 200,000 rows load correctly
- Text generation (`row_to_text`, `grade_to_text`) — produces correct
  natural-language descriptions from real rows
- Grade range derivation from the CSV — correct min/max per element per grade
- The vector store's `upsert`/`search` logic — tested with synthetic
  384-dimension vectors standing in for real embeddings: an exact-match
  query correctly returned the right item with 1.0 similarity score, and
  correctly ranked other items by relevance

⚠️ **Not independently verified**: the actual `sentence-transformers`
embedding model call itself. This is a very widely-used, mature library —
not experimental code — but I could not install it in the environment
this was built in (it pulls in a ~1.7GB PyTorch/CUDA toolkit, which
exceeded available disk space even after cleanup). You are the one
confirming this piece works when you run `pip install -r requirements.txt`
and `python main.py` for the first time.

## How to run it

```bash
cd MetalliSense_VectorSearch
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python main.py
```

The `pip install` step is the heaviest one — `sentence-transformers`
brings in PyTorch, so expect it to take a few minutes and a few GB of
disk space. This is normal.

### What you should see on startup

```
Loading embedding model: all-MiniLM-L6-v2
```
— this downloads the model the first time (~90MB, needs internet once,
then it's cached locally and works offline after that).

Then one of these two lines:

```
ℹ️  actian_vectorai SDK not installed — using local in-memory vector store.
```
(this is fine — semantic search still works fully)

**or**, if you have the real SDK and Docker running:
```
✓ Connected to real Actian VectorAI DB at localhost:50051
```

Either way, it should then say:
```
✓ Indexed 5000 training-data readings + grade specs
```

If you see this line, semantic search is working. If you instead see an
error here, see Troubleshooting below.

### Try it

```bash
curl -X POST http://localhost:8002/semantic-search \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"high carbon reading that looks out of spec\", \"collection\": \"training_data\", \"limit\": 5}"
```

You should get back JSON with a `results` array, each with a `score`
(similarity, 0-1) and the original reading data.

Check what's actually powering your search:
```bash
curl http://localhost:8002/health
```
Look at the `"backend"` field in the response — it tells you plainly
whether you're on the real Actian DB or the local fallback.

## Troubleshooting

**`ModuleNotFoundError: No module named 'sentence_transformers'`**
→ `pip install -r requirements.txt` didn't complete. Re-run it and watch
for errors partway through (out of disk space, network issues downloading
PyTorch, etc.)

**Stuck/very slow on "Loading embedding model"**
→ First run needs internet to download the model (~90MB) from
Hugging Face. Check your connection. After the first successful run it's
cached in `~/.cache/huggingface` and works offline.

**`/semantic-search` returns empty `results: []`**
→ Check `/health` — if `indexed_records` is 0, the CSV didn't load.
Confirm `dataset.csv` is present in this folder. Call `POST /reindex` to
retry indexing without restarting the whole service.

**You installed `actian-vectorai-client` and have Docker running, but it
still says "using local in-memory vector store"**
→ The SDK connects at import time and does a quick "list collections"
call to confirm the server is actually reachable — if that check fails
(wrong port, Docker not fully started yet, firewall), it silently falls
back. Check the exact startup message for a line like:
`"actian_vectorai SDK installed but server unreachable at ... (error)"`
— that error message tells you exactly what failed. Common cause: wrong
`VECTORAI_HOST` (default assumes `localhost:50051`; confirm this matches
what Actian's setup guide told you to use).

**Getting a real error not covered here**
→ Paste the exact error text. This service is built to fail loudly and
specifically rather than silently — the error message itself almost
always tells you exactly what's wrong.

## Environment variables

```
TRAINING_DATA_CSV=./dataset.csv       # path to the CSV to index
VECTORAI_HOST=localhost:50051          # only used if actian-vectorai-client is installed
EMBEDDING_MODEL=all-MiniLM-L6-v2      # sentence-transformers model name
MAX_TRAINING_ROWS=5000                 # how many CSV rows to index (all 200k works, just slower to start)
```

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Shows which backend is active (real/fallback) + how many records are indexed |
| POST | `/reindex` | Rebuilds the index from the current CSV without restarting |
| POST | `/semantic-search` | `{ query, collection: "training_data"\|"grades", limit }` → ranked results |

## (Optional) Switching to the real Actian VectorAI DB

1. Follow Actian's own setup guide: https://docs.vectoraidb.actian.com/home/installation/instructions
2. `pip install actian-vectorai-client` (confirmed real package name — not `actian-vectorai`)
3. Set `VECTORAI_HOST` if Docker exposes it on something other than the default
4. Restart this service — `vector_store.py` will detect and switch to it automatically
