"""CotizaFlow static release guards. Read-only, no external service or payment calls."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

class ReleaseSmoke(unittest.TestCase):
    def test_core_files_present(self):
        for name in ("index.html", "app.mjs", "cloud.mjs", "pro.mjs"):
            with self.subTest(file=name):
                self.assertTrue((ROOT / name).is_file(), f"Missing {name}")

    def test_module_paths_resolve(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        paths = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html)
        self.assertTrue(paths, "No linked script files in index.html")
        for path in paths:
            if path.startswith(("http:", "https:", "//")):
                continue
            with self.subTest(path=path):
                self.assertTrue((ROOT / path.split("?")[0].lstrip("/")).is_file(), f"Missing linked script: {path}")

    def test_pro_verification_is_server_side(self):
        pro = (ROOT / "pro.mjs").read_text(encoding="utf-8")
        self.assertIn("cotizaflow-pro-access", pro)
        self.assertIn("payment_verified===true", pro)
        self.assertIn("await ensurePro()", pro)
        self.assertNotRegex(pro, r"localStorage\.setItem\(['\"](?:isPro|proEnabled|plan_pro)")

    def test_no_obvious_server_secrets_in_static_files(self):
        for name in ("index.html", "app.mjs", "cloud.mjs", "pro.mjs"):
            content = (ROOT / name).read_text(encoding="utf-8")
            with self.subTest(file=name):
                self.assertNotRegex(content, r"(?i)(?:service_role|webhook_secret|mp_access_token)\s*[:=]\s*['\"][^'\"]{12,}")
                self.assertNotRegex(content, r"sb_secret_[A-Za-z0-9_-]{12,}")

if __name__ == "__main__":
    unittest.main()
