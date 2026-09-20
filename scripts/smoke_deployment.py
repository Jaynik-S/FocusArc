"""Read-only production checks; credentials are never written to output."""
import argparse
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def origin(value):
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("Smoke checks require an HTTPS origin without path or credentials")
    return value.rstrip("/")


def fetch(url, key=None):
    headers = {"Authorization": "Bearer " + key} if key else {}
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=90) as response:
            return response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Smoke request failed: HTTP {exc.code}") from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Smoke request failed: connection unavailable") from None


def check_api(url, key, revision, owner):
    base = origin(url)
    if not key:
        raise ValueError("PERSONAL_ACCESS_KEY is required")
    for path, expected in [("health", {"status": "ok"}), ("ready", {"revision": revision}), ("me", {"username": owner})]:
        content_type, body = fetch(base + "/api/" + path, key if path != "health" else None)
        if "application/json" not in content_type:
            raise RuntimeError(f"{path} did not return JSON")
        data = json.loads(body)
        if any(data.get(k) != v for k, v in expected.items()):
            raise RuntimeError(f"{path} returned unexpected state")
    request = urllib.request.Request(base + "/api/me")
    try:
        urllib.request.build_opener(NoRedirect()).open(request, timeout=90).close()
    except urllib.error.HTTPError as exc:
        if exc.code != 401:
            raise RuntimeError("Unauthenticated access did not return 401") from None
    else:
        raise RuntimeError("Unauthenticated personal data access was allowed")
    print("API health, authenticated readiness/revision/owner, and unauthenticated denial verified")


def check_web(url):
    base = origin(url)
    _, index = fetch(base + "/")
    for path in ("/timers", "/history", "/schedule", "/stats"):
        content_type, body = fetch(base + path)
        if "text/html" not in content_type or body != index:
            raise RuntimeError(f"SPA fallback failed for {path}")
    assets = re.findall(rb'(?:src|href)="(/assets/[^"\s]+)"', index)
    if not assets:
        raise RuntimeError("Built application assets missing from index")
    for asset in assets:
        content_type, body = fetch(base + asset.decode())
        if "text/html" in content_type or not body:
            raise RuntimeError("Static asset returned HTML or empty content")
    print("Static SPA routes and referenced assets verified")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=["api", "web"])
    parser.add_argument("url")
    parser.add_argument("--revision")
    parser.add_argument("--owner", default="jayy")
    args = parser.parse_args()
    try:
        if args.kind == "api":
            check_api(args.url, os.environ.get("PERSONAL_ACCESS_KEY", ""), args.revision, args.owner)
        else:
            check_web(args.url)
    except (ValueError, RuntimeError, TimeoutError) as exc:
        parser.exit(1, f"{exc}\n")
