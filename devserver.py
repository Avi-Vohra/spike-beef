#!/usr/bin/env python3
# Tiny static file server with caching fully disabled. Plain `python3 -m
# http.server` lets browsers (and the two-device WiFi testing this game
# needs) silently serve stale JS after an edit - confirmed directly this
# session: a normal reload kept showing old game text even after the
# source file on disk had changed, and only a hard reload picked it up.
# For active development this is worse than useless, so every response
# here is forced to never be cached.
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


with ReusableTCPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
    print(f"Serving (no-cache) on 0.0.0.0:{PORT}")
    httpd.serve_forever()
