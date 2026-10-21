"""
Lightweight text embedder using scikit-learn (already a project dependency,
no extra multi-hundred-MB downloads needed like sentence-transformers).

TF-IDF + TruncatedSVD gives fixed-size dense vectors that work fine for
semantic search over a domain-specific corpus like grade specs and
training-data descriptions. Swap this for a proper embedding model
(OpenAI, Sentence-Transformers, etc.) any time without touching
vector_store.py or the API layer.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
import numpy as np

EMBEDDING_DIM = 64


class Embedder:
    def __init__(self, dim: int = EMBEDDING_DIM):
        self.dim = dim
        self.vectorizer = TfidfVectorizer(max_features=2000, stop_words="english")
        self.svd = TruncatedSVD(n_components=dim, random_state=42)
        self.fitted = False

    def fit(self, texts: list):
        n_components = min(self.dim, max(1, len(texts) - 1))
        if n_components != self.dim:
            self.svd = TruncatedSVD(n_components=n_components, random_state=42)
            self.dim = n_components
        tfidf = self.vectorizer.fit_transform(texts)
        self.svd.fit(tfidf)
        self.fitted = True

    def embed(self, texts):
        single = isinstance(texts, str)
        if single:
            texts = [texts]
        tfidf = self.vectorizer.transform(texts)
        vecs = self.svd.transform(tfidf)
        # pad to fixed EMBEDDING_DIM so collection dimension stays constant
        if vecs.shape[1] < EMBEDDING_DIM:
            pad = np.zeros((vecs.shape[0], EMBEDDING_DIM - vecs.shape[1]))
            vecs = np.hstack([vecs, pad])
        return vecs[0].tolist() if single else vecs.tolist()
