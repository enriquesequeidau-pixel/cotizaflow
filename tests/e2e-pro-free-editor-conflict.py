"""Chromium E2E: Free editor write wins over an in-flight Pro duplication.

Runs on loopback with fabricated quotes and session. Every external request is
intercepted; entitlement is mocked. No production writes or payments.
"""
import asyncio
import functools
import json
import runpy
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
fixture = runpy.run_path(str(ROOT / "tests/e2e-pro-duplicate.py"))
DATA, SESSION, QuietHandler = (
    fixture["DATA"], fixture["SESSION"], fixture["QuietHandler"]
)


async def run_case(base):
    third_seen = asyncio.Event()
    release_third = asyncio.Event()
    checks = []
    errors = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            await context.add_init_script("""(()=>{
              if(!localStorage.getItem('cotizaflow-v1'))
                localStorage.setItem('cotizaflow-v1',JSON.stringify(%s));
              if(!sessionStorage.getItem('cotizaflow-cloud-session-v1'))
                sessionStorage.setItem('cotizaflow-cloud-session-v1',JSON.stringify(%s));
            })();""" % (json.dumps(DATA), json.dumps(SESSION)))

            async def route_request(route):
                url = route.request.url
                if url.startswith(base):
                    await route.continue_()
                elif url.endswith("/functions/v1/cotizaflow-pro-access"):
                    checks.append(url)
                    if len(checks) == 3:
                        third_seen.set()
                        await asyncio.wait_for(release_third.wait(), timeout=15)
                    await route.fulfill(status=200, content_type="application/json",
                        body=json.dumps({"plan": "pro", "payment_verified": True}))
                else:
                    await route.abort()

            await context.route("**/*", route_request)
            pro = await context.new_page()
            free = await context.new_page()
            pro.on("pageerror", lambda exc: errors.append(str(exc)))
            free.on("pageerror", lambda exc: errors.append(str(exc)))
            pro.on("dialog", lambda dialog: asyncio.create_task(dialog.accept()))
            await pro.goto(base + "/", wait_until="load")
            await free.goto(base + "/", wait_until="load")

            await pro.locator("#cf-pro-open").click()
            await pro.locator("#cf-pro-duplicate").wait_for()
            await pro.locator("#cf-pro-quote").select_option("q1")
            await pro.locator("#cf-pro-duplicate").click()
            # The Pro operation already read the original snapshot; the final
            # entitlement check is deliberately held while Free saves.
            await asyncio.wait_for(third_seen.wait(), timeout=10)

            await free.locator('[data-nav="cotizaciones"]').click()
            await free.locator('[data-edit="q1"]').click()
            await free.locator("#notes").fill("Cambio Free durante verificación Pro")
            await free.locator('#quote-form button[type="submit"]').click()
            await free.get_by_role("button", name="COT-0001").wait_for()
            saved = await free.evaluate(
                "()=>JSON.parse(localStorage.getItem('cotizaflow-v1'))"
            )
            assert saved["quotes"][0]["notes"] == "Cambio Free durante verificación Pro"
            assert len(saved["quotes"]) == 1

            release_third.set()
            await expect(pro.locator("#cf-pro-status")).to_contain_text(
                "Los datos cambiaron en otra pestaña", timeout=10000
            )
            after = await pro.evaluate(
                "()=>JSON.parse(localStorage.getItem('cotizaflow-v1'))"
            )
            assert after == saved, "Pro must never overwrite the Free editor save"
            assert len(checks) == 3, checks
            assert not errors, errors
            print("PASS Chromium: Free save preserved during delayed Pro check; "
                  "no external network or real entitlement", flush=True)
        finally:
            release_third.set()
            await browser.close()


def main():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        asyncio.run(run_case("http://127.0.0.1:" + str(server.server_port)))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
