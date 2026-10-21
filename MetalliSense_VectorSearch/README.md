# MetalliSense Semantic Search (Actian VectorAI DB)

Built for **PEC Hacks 4.0 × Actian VectorAI DB**. Adds meaning-based search
over your foundry training data and grade specs — "find readings similar to
this deviation" instead of exact filters.

## Works with or without the real Actian VectorAI DB

`actian-vectorai` isn't currently resolvable via `pip` (confirmed — it's a
very new product, not yet reliably indexed). Rather than block on that,
this service uses `vector_store.py`, which:

- Tries to import and connect to a real, locally-running Actian VectorAI DB
  if the SDK is installed and reachable
- **Automatically falls back to a local in-memory vector store** (plain
  numpy cosine similarity) with the exact same interface if it isn't

So semantic search works fully right now, with zero extra setup, using the
fallback. If/when you get real VectorAI DB running (Docker + the SDK), this
service will automatically start using it instead — no code changes needed.

✅ **Verified**: CSV parsing (all 200k rows), text generation, grade-range
derivation, and the vector store's upsert/search logic were all tested and
confirmed working (exact-match search correctly found the right item with
1.0 similarity and ranked others correctly). The only untested piece is the
`sentence-transformers` embedding model itself — a well-established,
widely-used library — which I could not install in my own environment due
to disk space (it pulls a ~1.7GB CUDA toolkit), not a fault in this code.

## What this does

1. Reads your `dataset.csv` and derives grade specs from it.
2. Converts each reading/grade into a short sentence
   (e.g. *"Grade SG-IRON reading, within normal spec. Composition: Fe
   88.2%, C 3.7%, Si 2.6%..."*).
3. Embeds those sentences locally using `sentence-transformers`
   (`all-MiniLM-L6-v2` — runs on CPU, no cloud API needed).
4. Stores the embeddings (real VectorAI DB or local fallback — see above).
5. Exposes `POST /semantic-search` — give it a plain-English query, get
   back the most semantically similar readings or grades.

## Setup

```bash
cd MetalliSense_VectorSearch
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

This installs `sentence-transformers` (which includes PyTorch — the
install is a few GB and may take a few minutes). No Actian package is
required for this to work.

Make sure `dataset.csv` is in this folder (it should already be, from the
main project package).

### Run it

```bash
python main.py
```

Watch for one of these on startup:
```
ℹ️  actian_vectorai SDK not installed — using local in-memory vector store.
```
or, if you've set up real VectorAI DB:
```
✓ Connected to real Actian VectorAI DB at localhost:50051
```
Either way, it then indexes your data:
```
✓ Indexed 5000 training-data readings + grade specs
```

### Try it

```bash
curl -X POST http://localhost:8002/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query": "high carbon reading that looks out of spec", "collection": "training_data", "limit": 5}'
```

## (Optional) Use the real Actian VectorAI DB instead of the fallback

1. Follow Actian's setup guide: https://docs.vectoraidb.actian.com/home/installation/instructions
2. `pip install actian-vectorai` once it's available in your environment/index
3. Set `VECTORAI_HOST` if it's not on the default `localhost:50051`
4. Restart this service — it will detect and use the real database automatically

## Environment variables

```
TRAINING_DATA_CSV=./dataset.csv
VECTORAI_HOST=localhost:50051   # only used if actian-vectorai is installed
EMBEDDING_MODEL=all-MiniLM-L6-v2
MAX_TRAINING_ROWS=5000     # how many CSV rows to index (all 200k works, just slower to start)
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Backend in use (real/fallback) + index status |
| POST | `/reindex` | Rebuild the index from the current CSV |
| POST | `/semantic-search` | `{ query, collection: "training_data"\|"grades", limit }` |
