"""
Builds the semantic search index: one entry per metal grade, with a text
description covering the grade name, description, and composition ranges,
embedded and stored in the "grade_specs" collection.

Also exposes a "memory" collection used for AI Agent copilot memory: past
chat turns get embedded and stored so future turns can retrieve
semantically-relevant history (not just the last N messages).
"""
from . import vector_store
from .embedder import Embedder, EMBEDDING_DIM
from data.grade_specs import GradeSpecificationGenerator

GRADE_COLLECTION = "grade_specs"
MEMORY_COLLECTION = "agent_memory"

_embedder = Embedder()
_indexed = False


def _grade_to_text(grade_data: dict) -> str:
    grade = grade_data.get("grade", "")
    desc = grade_data.get("description", "")
    ranges = grade_data.get("composition_ranges", {})
    range_text = ", ".join(
        f"{el} between {r[0]} and {r[1]} percent" for el, r in ranges.items()
    )
    return f"Grade {grade}: {desc}. Composition: {range_text}."


def build_index(force: bool = False):
    """Fit the embedder on all grade descriptions and index them."""
    global _indexed
    if _indexed and not force:
        return {"status": "already_indexed", "grades": vector_store.count(GRADE_COLLECTION)}

    generator = GradeSpecificationGenerator()
    grades = generator.grades  # dict: grade_name -> spec dict

    texts = [_grade_to_text(spec) for spec in grades.values()]
    ids = list(range(1, len(texts) + 1))
    payloads = [
        {"grade": spec.get("grade"), "description": spec.get("description"), "composition_ranges": spec.get("composition_ranges")}
        for spec in grades.values()
    ]

    if not texts:
        return {"status": "no_data", "grades": 0}

    _embedder.fit(texts)
    vectors = _embedder.embed(texts)

    vector_store.ensure_collection(GRADE_COLLECTION, EMBEDDING_DIM)
    vector_store.upsert(GRADE_COLLECTION, ids, vectors, payloads)

    # Memory collection uses the same embedder/dimension, created empty.
    vector_store.ensure_collection(MEMORY_COLLECTION, EMBEDDING_DIM)

    _indexed = True
    return {
        "status": "indexed",
        "grades": len(texts),
        "backend": vector_store.backend_name(),
    }


def semantic_search(query: str, top_k: int = 5):
    if not _indexed:
        build_index()
    query_vector = _embedder.embed(query)
    results = vector_store.search(GRADE_COLLECTION, query_vector, limit=top_k)
    return results


def remember(text: str, metadata: dict = None):
    """Store a piece of text (e.g. a chat turn) in agent memory."""
    if not _indexed:
        build_index()
    vec = _embedder.embed(text)
    existing_count = vector_store.count(MEMORY_COLLECTION)
    vector_store.upsert(
        MEMORY_COLLECTION,
        [existing_count + 1],
        [vec],
        [{"text": text, **(metadata or {})}],
    )


def recall(query: str, top_k: int = 3):
    """Retrieve the most semantically relevant past memories for a query."""
    if not _indexed:
        build_index()
    query_vector = _embedder.embed(query)
    return vector_store.search(MEMORY_COLLECTION, query_vector, limit=top_k)
