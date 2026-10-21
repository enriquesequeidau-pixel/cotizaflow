"""Build-time supply chain guard: CotizaFlow ships without third-party JS packages."""
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCES=(
 "app.mjs","backup.mjs","check.mjs","cloud.mjs","core.mjs",
 "plan-checkout.mjs","pro-safety.mjs","pro.mjs","workflow.mjs","smoke.mjs",
)
for filename in ("package.json","package-lock.json","pnpm-lock.yaml","yarn.lock","npm-shrinkwrap.json"):
 assert not (ROOT/filename).exists(), "Unexpected package dependency: "+filename

checked=0
for name in SOURCES:
 path=ROOT/name
 assert path.is_file(), "Expected first-party asset missing: "+name
 src=path.read_text(encoding="utf-8")
 # Only relative ES module imports; no CDN/npm imports and no dynamic loading.
 assert not re.search(r"\\bimport\\s*\\(",src), "Dynamic import requires separate review: "+name
 assert not re.search(r"\\b(?:eval|Function)\\s*\\(",src), "Dynamic JavaScript evaluation: "+name
 assert not re.search(r"\\b(?:importScripts)\\s*\\(",src), "Worker code loading: "+name
 for m in re.finditer(r"""\\b(?:import|export)\\s+(?:(?:[^;\\n]*?\\bfrom\\s*)?)['"]([^'"]+)['"]""",src):
  spec=m.group(1)
  assert spec.startswith("./"), "External module must be audited before launch: "+name+" -> "+spec
  dependency=(path.parent/spec).resolve()
  assert dependency.is_relative_to(ROOT.resolve()) and dependency.is_file(), "Unresolved local dependency: "+spec
  checked+=1

html=(ROOT/"index.html").read_text(encoding="utf-8")
for src in re.findall(r'<script[^>]*\\bsrc=["\\']([^"\\']+)["\\']',html,re.I):
 assert src.endswith(".mjs") and (ROOT/src).is_file(), "New external script requires a security audit: "+src
assert "github-actions" in (ROOT/".github/dependabot.yml").read_text(encoding="utf-8")
print(f"PASS: no third-party JS packages, {checked} resolved first-party module imports, and GitHub Actions updates monitored")
