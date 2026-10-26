"""Isolated Chromium E2E for CotizaFlow Pro calendar export and revocation.

Localhost-only static app, fabricated quote/session, mocked entitlement. No
payments, network access to services, email, calendar API or production writes.
"""
import copy
import functools
import json
import runpy
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
fixture = runpy.run_path(str(ROOT / "tests/e2e-pro-duplicate.py"))
DATA = copy.deepcopy(fixture["DATA"])
DATA["quotes"][0]["status"] = "enviada"
SESSION, QuietHandler = fixture["SESSION"], fixture["QuietHandler"]


def run_case(browser, base, mode):
    context = browser.new_context(accept_downloads=True)
    context.add_init_script("""(()=>{
      if(!localStorage.getItem('cotizaflow-v1'))
        localStorage.setItem('cotizaflow-v1',JSON.stringify(%s));
      if(!sessionStorage.getItem('cotizaflow-cloud-session-v1'))
        sessionStorage.setItem('cotizaflow-cloud-session-v1',JSON.stringify(%s));
    })();""" % (json.dumps(DATA), json.dumps(SESSION)))
    checks, downloads, errors = [], [], []

    def intercept(route):
        url = route.request.url
        if url.startswith(base):
            route.continue_()
        elif url.endswith("/functions/v1/cotizaflow-pro-access"):
            checks.append(url)
            allowed = mode == "pro" or len(checks) < (4 if mode == "revoke_final" else 2)
            route.fulfill(status=200, content_type="application/json",
                body=json.dumps({"plan": "pro" if allowed else "free",
                                 "payment_verified": allowed}))
        else:
            route.abort()

    context.route("**/*", intercept)
    page = context.new_page()
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("download", lambda download: downloads.append(download))
    try:
        page.goto(base + "/", wait_until="load")
        page.locator("#cf-pro-open").click()
        page.locator("#cf-pro-calendar").wait_for()
        if mode == "pro":
            with page.expect_download(timeout=10000) as pending:
                page.locator("#cf-pro-calendar").click()
            download = pending.value
            assert download.suggested_filename == "cotizaflow-seguimientos.ics"
            ics = Path(download.path()).read_bytes().decode("utf-8")
            assert "BEGIN:VCALENDAR" in ics and "END:VCALENDAR" in ics
            assert "BEGIN:VEVENT" in ics and "DTSTART;VALUE=DATE:20261021" in ics
            assert "COT-0001" in ics
            assert "Cliente ficticio" not in ics, "Private client names must be excluded"
            assert len(downloads) == 1, downloads
            assert len(checks) == 4, checks
        else:
            page.locator("#cf-pro-calendar").click()
            page.locator("#cf-pro-status").get_by_text(
                "requiere Pro", exact=False
            ).wait_for(timeout=10000)
            assert not downloads, "Revoked account must not download an ICS"
            assert len(checks) == (4 if mode == "revoke_final" else 2), checks
        assert page.evaluate(
            "JSON.parse(localStorage.getItem('cotizaflow-v1'))"
        ) == DATA, "Calendar export must not modify Free quote data"
        assert not errors, errors
        print("PASS Chromium calendar", mode,
              "localhost, fake entitlement, no external network", flush=True)
    finally:
        context.close()


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0),
        functools.partial(QuietHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = "http://127.0.0.1:" + str(server.server_port)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            try:
                for mode in ("pro", "revoke_initial", "revoke_final"):
                    run_case(browser, base, mode)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
