#!/usr/bin/env python3
"""Western Tally prototype viewer — zero-dependency dev server.

Usage:
    py serve.py [port] [--no-open]

Serves the repository root on 127.0.0.1 (default port 4173), prints the URL,
and opens the browser unless --no-open is given. Standard library only.
"""

import os
import sys
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 4173


class ViewerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.startswith("/screenshots/"):
            # Captures are immutable once renamed - cache them forever.
            self.send_header(
                "Cache-Control", "public, max-age=31536000, immutable"
            )
        else:
            # Code and docs should always revalidate while iterating.
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main(argv):
    args = [a for a in argv[1:] if a != "--no-open"]
    no_open = "--no-open" in argv[1:]
    port = int(args[0]) if args else DEFAULT_PORT

    handler = partial(ViewerHandler, directory=ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)

    url = "http://127.0.0.1:%d/" % port
    print("Western Tally - Prototype Library")
    print("Serving %s" % ROOT)
    print("Open %s" % url)
    if not no_open:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
