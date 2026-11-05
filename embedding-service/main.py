"""NoteVault embedding service.

Turns text into 384-dimensional vectors with sentence-transformers/all-MiniLM-L6-v2.
Vectors are L2-normalised, so cosine similarity in pgvector (<=>) is well behaved.

Run:  uvicorn main:app --port 8000
"""
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
API_KEY = os.getenv("EMBEDDING_API_KEY")  # optional shared secret with the Next.js app
MAX_TEXTS = 256
MAX_CHARS = 4000

model = SentenceTransformer(MODEL_NAME)
DIM = model.get_sentence_embedding_dimension()

app = FastAPI(title="NoteVault Embedding Service", version="1.0.0")


class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=MAX_TEXTS)


class EmbedResponse(BaseModel):
    model: str
    dim: int
    embeddings: list[list[float]]


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "dim": DIM}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest, x_api_key: str | None = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    texts = [t.strip()[:MAX_CHARS] for t in req.texts]
    if any(not t for t in texts):
        raise HTTPException(status_code=422, detail="Texts must not be empty")
    vectors = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return EmbedResponse(model=MODEL_NAME, dim=DIM, embeddings=vectors.tolist())
