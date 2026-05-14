FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY embed-server/requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

ARG EMBEDDING_MODEL=all-MiniLM-L6-v2
ENV ADAPT_EMBEDDING_MODEL=${EMBEDDING_MODEL}

COPY server/src/services/rag/embed_server.py .

RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBEDDING_MODEL}')"

EXPOSE 9876

CMD ["python", "embed_server.py"]