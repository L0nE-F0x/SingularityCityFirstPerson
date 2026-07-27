"""Threaded static server for local playtesting.

`python -m http.server` is single-threaded: one browser keep-alive connection
blocks every other request, so a second tab (or a second browser) hangs with
ERR_EMPTY_RESPONSE. This serves the same folder with a thread per connection.

    python serve.py [port]        # default 8931
"""
import base64
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8931
ROOT = os.path.dirname(os.path.abspath(__file__))   # serve this folder, whatever the cwd
SHOTS = os.path.join(ROOT, '.shots')                # dev-only screenshot drop (gitignored)


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        """Dev-only: POST a canvas data URL to /__shot?name=foo and it lands in
        .shots/foo.jpg. Playtesting a WebGL scene means looking at frames, and
        pulling them back through the page as base64 is far slower than letting
        the page hand the bytes straight to disk."""
        if not self.path.startswith('/__shot'):
            self.send_error(404)
            return
        from urllib.parse import urlparse, parse_qs
        name = (parse_qs(urlparse(self.path).query).get('name') or ['shot'])[0]
        name = ''.join(ch for ch in name if ch.isalnum() or ch in '-_')[:64] or 'shot'
        body = self.rfile.read(int(self.headers.get('Content-Length') or 0)).decode('utf-8')
        if ',' in body:
            body = body.split(',', 1)[1]
        os.makedirs(SHOTS, exist_ok=True)
        path = os.path.join(SHOTS, name + '.jpg')
        with open(path, 'wb') as f:
            f.write(base64.b64decode(body))
        self.send_response(200)
        self.send_header('Content-Length', '2')
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, fmt, *args):
        pass  # quiet; errors still surface via log_error


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), partial(Handler, directory=ROOT))
    srv.daemon_threads = True
    print(f'Singularity City FP - http://localhost:{PORT}')
    srv.serve_forever()
