import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import smoke_deployment


class FakeResponse:
    def __init__(self, status, body=None, content_type="application/json"):
        self.status = status
        self.headers = {"Content-Type": content_type}
        self._body = b"" if body is None else json.dumps(body).encode()

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class FakeOpener:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []

    def open(self, request, timeout):
        self.requests.append(request)
        return next(self.responses)


class ApiSmokeTests(unittest.TestCase):
    def test_login_checks_private_state_then_logs_out_and_checks_denial(self):
        opener = FakeOpener([
            FakeResponse(200, {"status": "ok"}),
            FakeResponse(401, {"detail": "Authentication required"}),
            FakeResponse(200, {"username": "jayy"}),
            FakeResponse(200, {"revision": "0003"}),
            FakeResponse(200, {"username": "jayy"}),
            FakeResponse(200, {"username": "jayy"}),
            FakeResponse(204),
            FakeResponse(401, {"detail": "Authentication required"}),
        ])

        smoke_deployment.check_api(
            "https://api.example.test",
            "password123",
            "0003",
            "jayy",
            "https://web.example.test",
            opener=opener,
        )

        paths = [request.full_url.removeprefix("https://api.example.test") for request in opener.requests]
        self.assertEqual(paths, [
            "/api/health", "/api/auth/session", "/api/auth/login", "/api/ready",
            "/api/me", "/api/auth/session", "/api/auth/logout", "/api/auth/session",
        ])
        login = opener.requests[2]
        self.assertEqual(login.get_method(), "POST")
        self.assertEqual(json.loads(login.data), {"username": "jayy", "password": "password123"})
        self.assertEqual(login.headers["Origin"], "https://web.example.test")
        self.assertNotIn("Authorization", login.headers)
        self.assertEqual(opener.requests[6].get_method(), "POST")

    def test_password_is_required(self):
        with self.assertRaisesRegex(ValueError, "PRODUCTION_AUTH_PASSWORD"):
            smoke_deployment.check_api(
                "https://api.example.test", "", "0003", "jayy", "https://web.example.test",
                opener=FakeOpener([])
            )

    def test_failed_login_never_includes_password_in_the_error(self):
        password = "do-not-print-this-password"
        opener = FakeOpener([
            FakeResponse(200, {"status": "ok"}),
            FakeResponse(401, {"detail": "Authentication required"}),
            FakeResponse(401, {"detail": {"message": password}}),
        ])

        with self.assertRaises(RuntimeError) as denied:
            smoke_deployment.check_api(
                "https://api.example.test", password, "0003", "jayy",
                "https://web.example.test", opener=opener
            )
        self.assertNotIn(password, str(denied.exception))


if __name__ == "__main__":
    unittest.main()
