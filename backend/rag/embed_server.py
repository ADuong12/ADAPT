from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rag.embedder import embed

class EmbedHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/embed":
            length = int(self.headers["Content-Length"])
            body = json.loads(self.rfile.read(length))
            vectors = embed(body["texts"])
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"embeddings": vectors}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress per-request logs

if __name__ == "__main__":
    port = int(os.environ.get("EMBED_SERVER_PORT", 9876))
    print(f"Embed server starting on port {port}")
    HTTPServer(("127.0.0.1", port), EmbedHandler).serve_forever()
