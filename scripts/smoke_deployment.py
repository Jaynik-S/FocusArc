"""Production smoke checks; credentials are never written to output."""
import argparse
import http.cookiejar
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
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
    ):
        raise ValueError("Smoke checks require an HTTPS origin without path or credentials")
    return value.rstrip("/")


def fetch(url):
    request = urllib.request.Request(url)
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=90) as response:
            return response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Smoke request failed: HTTP {exc.code}") from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Smoke request failed: connection unavailable") from None


class ApiSmokeClient:
    def __init__(self, base, opener=None):
        self.base = base
        self.opener = opener or urllib.request.build_opener(
            NoRedirect(), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

    def request(self, path, *, method="GET", payload=None, expected=200):
        body = json.dumps(payload).encode() if payload is not None else None
        headers = {"Content-Type": "application/json"} if body is not None else {}
        request = urllib.request.Request(
            self.base + "/api/" + path.lstrip("/"),
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with self.opener.open(request, timeout=90) as response:
                status = response.status
                content_type = response.headers.get("Content-Type", "")
                response_body = response.read()
        except urllib.error.HTTPError as exc:
            status = exc.code
            content_type = exc.headers.get("Content-Type", "")
            response_body = exc.read()
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError("Smoke request failed: connection unavailable") from None

        if status != expected:
            raise RuntimeError(f"{path} returned HTTP {status}; expected {expected}")
        if expected == 204:
            return None
        if "application/json" not in content_type:
            raise RuntimeError(f"{path} did not return JSON")
        try:
            return json.loads(response_body)
        except (TypeError, json.JSONDecodeError):
            raise RuntimeError(f"{path} returned invalid JSON") from None


def check_api(url, password, revision, username, *, opener=None):
    base = origin(url)
    if not username:
        raise ValueError("PRODUCTION_AUTH_USERNAME is required")
    if not password:
        raise ValueError("PRODUCTION_AUTH_PASSWORD is required")
    client = ApiSmokeClient(base, opener=opener)

    if client.request("health") != {"status": "ok"}:
        raise RuntimeError("health returned unexpected state")
    client.request("auth/session", expected=401)

    login = client.request(
        "auth/login",
        method="POST",
        payload={"username": username, "password": password},
    )
    if login.get("username") != username:
        raise RuntimeError("login returned unexpected identity")
    ready = client.request("ready")
    if ready.get("revision") != revision:
        raise RuntimeError("ready returned an unexpected migration revision")
    for path in ("me", "auth/session"):
        if client.request(path).get("username") != username:
            raise RuntimeError(f"{path} returned unexpected identity")

    client.request("auth/logout", method="POST", expected=204)
    client.request("auth/session", expected=401)
    print("API health, login, revision, identity, logout, and unauthenticated denial verified")


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
    parser.add_argument("--username", default=os.environ.get("PRODUCTION_AUTH_USERNAME", ""))
    args = parser.parse_args()
    try:
        if args.kind == "api":
            check_api(
                args.url,
                os.environ.get("PRODUCTION_AUTH_PASSWORD", ""),
                args.revision,
                args.username,
            )
        else:
            check_web(args.url)
    except (ValueError, RuntimeError, TimeoutError) as exc:
        parser.exit(1, f"{exc}\n")
