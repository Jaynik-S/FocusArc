import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import deploy_render


class DeployTests(unittest.TestCase):
    sha = "a" * 40

    def test_waits_for_exact_live_commit(self):
        replies = [{"id": "dep-test"}, {"id": "dep-test", "status": "build_in_progress"},
                   {"id": "dep-test", "status": "live", "commit": {"id": self.sha}}]
        with patch.object(deploy_render, "request_json", side_effect=replies) as request, patch.object(deploy_render.time, "sleep"):
            self.assertEqual(deploy_render.deploy("srv-test", self.sha, "test-key"), "dep-test")
            self.assertEqual(request.call_args_list[0].args[3], {"commitId": self.sha})
            self.assertEqual(request.call_count, 3)

    def test_wrong_commit_is_not_success(self):
        with patch.object(deploy_render, "request_json", side_effect=[{"id": "dep-test"}, {"id": "dep-test", "status": "live", "commit": {"id": "b" * 40}}]):
            with self.assertRaisesRegex(RuntimeError, "tested commit"):
                deploy_render.deploy("srv-test", self.sha, "test-key")

    def test_failed_build_blocks_next_deployment(self):
        with patch.object(deploy_render, "request_json", side_effect=[{"id": "dep-test"}, {"id": "dep-test", "status": "build_failed"}]):
            with self.assertRaisesRegex(RuntimeError, "build_failed"):
                deploy_render.deploy("srv-test", self.sha, "test-key")

    def test_invalid_sha_never_calls_render(self):
        with patch.object(deploy_render, "request_json") as request:
            with self.assertRaises(ValueError):
                deploy_render.deploy("srv-test", "main", "test-key")
            request.assert_not_called()


if __name__ == "__main__":
    unittest.main()
