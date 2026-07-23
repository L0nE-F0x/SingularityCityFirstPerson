"""Threaded static server for local playtesting.

`python -m http.server` is single-threaded: one browser keep-alive connection
blocks every other request, so a second tab (or a second browser) hangs with
ERR_EMPTY_RESPONSE. This serves the same folder with a thread per connection.

    python serve.py [port]        # default 8931
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8931
ROOT = os.path.dirname(os.path.abspath(__file__))   # serve this folder, whatever the cwd


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # quiet; errors still surface via log_error


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), partial(Handler, directory=ROOT))
    srv.daemon_threads = True
    print(f'Singularity City FP - http://localhost:{PORT}')
    srv.serve_forever()
