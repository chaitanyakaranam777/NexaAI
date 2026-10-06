import os
import time
from typing import Any
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

app = FastAPI(title="NEXA AI Workbench API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

METRICS = {"requests": 0, "chat": 0, "compare": 0, "code_review": 0, "document": 0, "total_ms": 0}

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    provider: str = "demo"
    model: str = "nexa-demo"
    history: list[Message] = []

class CompareRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)
    left_provider: str = "demo"
    left_model: str = "nexa-demo"
    right_provider: str = "demo"
    right_model: str = "nexa-demo"

class ReviewRequest(BaseModel):
    language: str = "python"
    code: str = Field(min_length=1, max_length=30000)

def demo_answer(prompt: str, feature: str = "chat") -> str:
    if feature == "review":
        return """## Engineering Review

**Quality:** 8.1/10

### Findings
- **Performance:** Check for repeated work inside loops and unnecessary allocations.
- **Reliability:** Add explicit input validation and predictable error handling.
- **Maintainability:** Extract complex logic into small, testable functions.
- **Security:** Never hard-code secrets; validate external input at API boundaries.

### Suggested next step
Add unit tests around the main path, then profile the hot path before optimizing."""
    if feature == "document":
        return f"""## Document Intelligence

I indexed the supplied context and can answer questions against it.

**Context-aware summary:** The request is asking about the provided document rather than general model knowledge.

**Recommended architecture:** chunk → retrieve relevant passages → generate grounded answer → expose citations/metadata."""
    return f"""## NEXA Response

I received your request:

> {prompt[:500]}

This is **Demo Mode**. Configure `GEMINI_API_KEY` or `OPENAI_API_KEY` to route requests to a real model.

### What the production path adds
- provider abstraction
- model selection
- server-side API keys
- request validation
- latency metrics
- structured feature endpoints"""

async def call_gemini(prompt: str, model: str) -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return demo_answer(prompt)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, params={"key": key}, json=payload)
        r.raise_for_status()
        data = r.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            return "The provider returned no text."

async def call_openai(prompt: str, model: str) -> str:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return demo_answer(prompt)
    base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{base}/chat/completions", headers=headers, json=payload)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

async def generate(prompt: str, provider: str, model: str, feature: str = "chat") -> str:
    if provider == "gemini":
        return await call_gemini(prompt, model)
    if provider == "openai":
        return await call_openai(prompt, model)
    return demo_answer(prompt, feature)

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "nexa-api", "mode": "production" if (os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")) else "demo"}

@app.get("/api/models")
async def models():
    return {
        "providers": [
            {"id": "demo", "name": "NEXA Demo", "model": "nexa-demo", "ready": True},
            {"id": "gemini", "name": "Google Gemini", "model": os.getenv("GEMINI_MODEL", "gemini-3.8-flash"), "ready": bool(os.getenv("GEMINI_API_KEY"))},
            {"id": "openai", "name": "OpenAI-compatible", "model": os.getenv("OPENAI_MODEL", "gpt-5"), "ready": bool(os.getenv("OPENAI_API_KEY"))},
        ]
    }

@app.get("/api/metrics")
async def metrics():
    avg = round(METRICS["total_ms"] / max(METRICS["requests"], 1))
    return {**METRICS, "avg_latency_ms": avg}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    start = time.perf_counter()
    answer = await generate(req.message, req.provider, req.model)
    ms = int((time.perf_counter() - start) * 1000)
    METRICS["requests"] += 1; METRICS["chat"] += 1; METRICS["total_ms"] += ms
    return {"answer": answer, "latency_ms": ms, "provider": req.provider, "model": req.model}

@app.post("/api/compare")
async def compare(req: CompareRequest):
    start = time.perf_counter()
    left = await generate(req.prompt, req.left_provider, req.left_model)
    left_ms = int((time.perf_counter() - start) * 1000)
    start = time.perf_counter()
    right = await generate(req.prompt, req.right_provider, req.right_model)
    right_ms = int((time.perf_counter() - start) * 1000)
    METRICS["requests"] += 2; METRICS["compare"] += 1; METRICS["total_ms"] += left_ms + right_ms
    return {"left": {"answer": left, "latency_ms": left_ms}, "right": {"answer": right, "latency_ms": right_ms}}

@app.post("/api/code-review")
async def code_review(req: ReviewRequest):
    prompt = f"""You are a senior software engineer. Review this {req.language} code. Give concise findings on correctness, complexity, performance, security, maintainability, and tests. Then give improved code if useful.\n\n{req.code}"""
    start = time.perf_counter()
    answer = await generate(prompt, "gemini" if os.getenv("GEMINI_API_KEY") else "demo", os.getenv("GEMINI_MODEL", "gemini-3.8-flash"), "review")
    ms = int((time.perf_counter() - start) * 1000)
    METRICS["requests"] += 1; METRICS["code_review"] += 1; METRICS["total_ms"] += ms
    return {"answer": answer, "latency_ms": ms}

@app.post("/api/document/ask")
async def document_ask(question: str, file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > 2_000_000:
        raise HTTPException(413, "File too large")
    context = raw.decode("utf-8", errors="ignore")[:50000]
    prompt = f"""Answer the question using only the document context below. If the answer is not present, say so.\n\nQUESTION: {question}\n\nDOCUMENT:\n{context}"""
    start = time.perf_counter()
    answer = await generate(prompt, "gemini" if os.getenv("GEMINI_API_KEY") else "demo", os.getenv("GEMINI_MODEL", "gemini-3.8-flash"), "document")
    ms = int((time.perf_counter() - start) * 1000)
    METRICS["requests"] += 1; METRICS["document"] += 1; METRICS["total_ms"] += ms
    return {"answer": answer, "filename": file.filename, "chars_indexed": len(context), "latency_ms": ms}
