import os
import sys
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)

MODEL_NAME = os.environ.get("ADAPT_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
_model = None


def get_model():
    global _model
    if _model is None:
        print(f"Loading embedding model: {MODEL_NAME}", flush=True)
        _model = SentenceTransformer(MODEL_NAME)
        dim = _model.get_sentence_embedding_dimension()
        print(f"Model loaded (dimension={dim})", flush=True)
    return _model


@app.route("/embed", methods=["POST"])
def embed():
    data = request.get_json(silent=True)
    if not data or "texts" not in data:
        return jsonify({"error": "Missing 'texts' field"}), 400

    texts = data["texts"]
    if not isinstance(texts, list) or len(texts) == 0:
        return jsonify({"error": "'texts' must be a non-empty array"}), 400

    try:
        m = get_model()
        embeddings = m.encode(texts, convert_to_numpy=True).tolist()
        return jsonify({"embeddings": embeddings})
    except Exception as e:
        print(f"Embedding error: {e}", file=sys.stderr, flush=True)
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    loaded = _model is not None
    return jsonify({"status": "ok", "model": MODEL_NAME, "loaded": loaded})


if __name__ == "__main__":
    port = int(os.environ.get("EMBED_PORT", "9876"))
    print(f"Starting embedding server on port {port}", flush=True)
    app.run(host="0.0.0.0", port=port)