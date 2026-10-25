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

    def test_document_csp_and_external_plan_module(self):
        html=(ROOT / "index.html").read_text(encoding="utf-8")
        plan=(ROOT / "plan-checkout.mjs").read_text(encoding="utf-8")
        self.assertIn('http-equiv="Content-Security-Policy"',html)
        self.assertIn("script-src 'self'",html)
        self.assertIn('src="plan-checkout.mjs"',html)
        self.assertNotIn('<script type="module">',html)
        self.assertIn("cotizaflow-mp-checkout",plan)
        self.assertIn("checkout_enabled === true",plan)
        self.assertIn("status",plan)

    def test_pro_verification_is_server_side(self):
        pro = (ROOT / "pro.mjs").read_text(encoding="utf-8")
        self.assertIn("cotizaflow-pro-access", pro)
        self.assertIn("payment_verified===true", pro)
        self.assertIn("await ensurePro()", pro)
        self.assertNotRegex(pro, r"localStorage\.setItem\(['\"](?:isPro|proEnabled|plan_pro)")

    def test_pro_actions_revalidate_entitlement_after_cancellation(self):
        # A verified subscription can be cancelled or refunded at any moment.
        # Client-side authorization must never be cached for three minutes.
        pro = (ROOT / "pro.mjs").read_text(encoding="utf-8")
        ensure = re.search(r"async function ensurePro\(\)\{(.*?)\}\nfunction safeName", pro, re.S)
        self.assertIsNotNone(ensure, "Missing Pro action guard")
        guard = ensure.group(1)
        self.assertIn("verified=false", guard)
        self.assertIn("await entitlement()", guard)
        self.assertIn("('cf-pro-content').hidden=true", guard)
        self.assertNotIn("expires", pro)
        self.assertNotIn("verifiedToken", pro)
        # Three actions still call the guard directly. Calendar export delegates to
        # an adapter that MUST verify the same guard before reading or downloading.
        self.assertGreaterEqual(pro.count("await ensurePro()"), 3)
        self.assertIn("verifyPro:ensurePro", pro)
        adapter = (ROOT / "pro-calendar-action.mjs").read_text(encoding="utf-8")
        self.assertIn("if(await verifyPro()!==true)", adapter)
        self.assertLess(adapter.index("await verifyPro()"), adapter.index("const data=readData()"))
        self.assertLess(adapter.index("const data=readData()"), adapter.index("await downloadIcs("))

    def test_no_obvious_server_secrets_in_static_files(self):
        for name in ("index.html", "app.mjs", "cloud.mjs", "pro.mjs"):
            content = (ROOT / name).read_text(encoding="utf-8")
            with self.subTest(file=name):
                self.assertNotRegex(content, r"(?i)(?:service_role|webhook_secret|mp_access_token)\s*[:=]\s*['\"][^'\"]{12,}")
                self.assertNotRegex(content, r"sb_secret_[A-Za-z0-9_-]{12,}")


    def test_legal_pages_and_support(self):
        html = (ROOT / "app.mjs").read_text(encoding="utf-8")
        self.assertIn('href="privacidad.html"', html)
        self.assertIn('href="terminos.html"', html)
        self.assertIn('mailto:soporte@sequeidaulabs.com', html)
        for filename in ("privacidad.html", "terminos.html"):
            page = (ROOT / filename).read_text(encoding="utf-8")
            with self.subTest(page=filename):
                self.assertIn("Sequeidau Labs SpA", page)
                self.assertIn("soporte@sequeidaulabs.com", page)
                self.assertIn("cobros reales", page.lower())

if __name__ == "__main__":
    unittest.main()
