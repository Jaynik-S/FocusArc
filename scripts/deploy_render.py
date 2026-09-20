"""Deploy one tested Git SHA and wait for that exact Render deployment."""
import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request


API = "https://api.render.com/v1"
FAILED = {"build_failed", "update_failed", "pre_deploy_failed", "canceled", "deactivated"}


def request_json(path, key, deadline, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    while time.monotonic() < deadline:
        request = urllib.request.Request(
            API + path, data=body,
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=min(30, max(1, deadline - time.monotonic()))) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                try:
                    delay = max(1, float(exc.headers.get("Retry-After", "10")))
                except ValueError:
                    delay = 10
                time.sleep(min(delay, max(0, deadline - time.monotonic())))
                continue
            # Do not log response bodies: upstream errors can echo credentials.
            raise RuntimeError(f"Render API returned HTTP {exc.code}") from None
        except (urllib.error.URLError, TimeoutError):
            # An ambiguous POST may already have started a deployment. Never replay it.
            if payload is not None:
                raise RuntimeError("Deploy request lost its response; inspect Render before retrying") from None
            time.sleep(min(10, max(0, deadline - time.monotonic())))
    raise TimeoutError("Render API deadline exceeded")


def deploy(service_id, sha, key, timeout=1200):
    if not re.fullmatch(r"srv-[a-zA-Z0-9]+", service_id):
        raise ValueError("Expected a Render service ID (srv-...)")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a complete Git commit SHA")
    if not key:
        raise ValueError("RENDER_API_KEY is required")
    deadline = time.monotonic() + timeout
    result = request_json(f"/services/{service_id}/deploys", key, deadline, {"commitId": sha})
    deploy_id = result.get("id", "")
    if not re.fullmatch(r"dep-[a-zA-Z0-9]+", deploy_id):
        raise RuntimeError("Render did not return a deployment ID")
    print(f"Waiting for {service_id} deployment {deploy_id}, commit {sha}", flush=True)
    while time.monotonic() < deadline:
        result = request_json(f"/services/{service_id}/deploys/{deploy_id}", key, deadline)
        if result.get("id") != deploy_id:
            raise RuntimeError("Render returned a different deployment")
        status = result.get("status")
        if status == "live":
            if result.get("commit", {}).get("id") != sha:
                raise RuntimeError("Live deployment does not match the tested commit")
            print(f"Live: {service_id} {deploy_id} {sha}", flush=True)
            return deploy_id
        if status in FAILED:
            raise RuntimeError(f"Render deployment ended with {status}")
        time.sleep(min(10, max(0, deadline - time.monotonic())))
    raise TimeoutError("Render deployment did not become live within 20 minutes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("service_id")
    parser.add_argument("sha")
    args = parser.parse_args()
    try:
        deploy(args.service_id, args.sha, os.environ.get("RENDER_API_KEY", ""))
    except (ValueError, RuntimeError, TimeoutError) as exc:
        parser.exit(1, f"{exc}\n")
