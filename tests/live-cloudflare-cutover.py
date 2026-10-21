"""Production Cloudflare cutover test: anonymous UI only, no registrations or payments."""
from playwright.sync_api import sync_playwright, expect

BASE="https://cotizaflow.sequeidaulabs.com/"
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 ctx=browser.new_context(viewport={"width":390,"height":844})
 page=ctx.new_page()
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.add_init_script("""window.__cspIssues=[];document.addEventListener('securitypolicyviolation',e=>{window.__cspIssues.push({directive:e.violatedDirective,blocked:e.blockedURI})})""")
 resp=page.goto(BASE,wait_until="load",timeout=30000)
 assert resp and resp.status==200, f"Unexpected app status: {resp.status if resp else None}"
 expect(page.get_by_role("heading",name="Tus cotizaciones")).to_be_visible()
 assert page.url.startswith(BASE),page.url
 page.locator("#cf-cloud-toggle").click()
 expect(page.locator("#cf-cloud-dialog")).to_be_visible()
 expect(page.locator("#cf-login")).to_be_visible()
 expect(page.locator("#cf-email")).to_be_visible()
 expect(page.locator("#cf-password")).to_be_visible()
 assert page.evaluate("typeof window.CotizaFlowSession?.token==='function'")
 assert page.locator("#cf-session").is_hidden()
 page.locator("#cf-close").click()
 expect(page.locator("#cf-cloud-dialog")).to_be_hidden()
 # The core app remains usable after navigating; no account data or billing changes.
 page.locator("[data-nav=clientes]").click()
 assert page.url.startswith(BASE),page.url
 expect(page.locator("#name")).to_be_visible()
 page.wait_for_timeout(600)
 assert not errors,errors
 issues=page.evaluate("window.__cspIssues")
 assert not issues,issues
 print("PASS CotizaFlow public HTTPS + cloud account entry + core editor; no CSP violation")
 ctx.close()
 browser.close()
