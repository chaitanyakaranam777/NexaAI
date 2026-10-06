# Architecture Notes

NEXA uses a provider gateway so the frontend only speaks to one application API. The backend decides which model provider receives a request.

## Production upgrade path

1. PostgreSQL for users, conversations, evaluations and prompt versions.
2. Redis for rate limiting and short-lived sessions.
3. S3-compatible object storage for documents.
4. Background queue for large document ingestion.
5. Retrieval layer with embeddings/vector search.
6. OpenTelemetry traces and structured logs.
7. Authentication and per-user API quotas.
8. Provider fallback and circuit breakers.
