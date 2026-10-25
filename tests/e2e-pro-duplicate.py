"""Isolated real-browser E2E for the existing Pro Studio duplicate UI.

Uses only localhost, fabricated storage/session, mocked entitlement responses.
No external network, checkout, email, Supabase writes or production services.
"""
import functools
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
DATA={
 "settings":{"business":"Taller de prueba","phone":"","email":"","currency":"CLP","tax":19},
 "clients":[{"id":"c1","name":"Cliente ficticio","phone":"","email":""}],
 "services":[],
 "quotes":[{
   "id":"q1","number":"COT-0001","clientId":"c1","date":"2026-10-18",
   "validUntil":"2026-10-25","followUp":"2026-10-21","status":"aceptada",
   "discount":10,"tax":19,"notes":"Servicio ficticio","currency":"CLP",
   "items":[{"id":"i1","name":"Instalación","qty":2,"price":10000}]
 }]
}
SESSION={
 "access_token":"fake-local-e2e-token","expires_at":9999999999,
 "user":{"id":"11111111-1111-4111-8111-111111111111","email":"demo@example.invalid"}
}

class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

def run_case(browser,base,mode,width=390,height=844):
 context=browser.new_context(viewport={"width":width,"height":height})
 context.add_init_script("""(()=>{
   if(!localStorage.getItem('cotizaflow-v1'))
     localStorage.setItem('cotizaflow-v1',JSON.stringify(%s));
   if(!sessionStorage.getItem('cotizaflow-cloud-session-v1'))
     sessionStorage.setItem('cotizaflow-cloud-session-v1',JSON.stringify(%s));
 })();""" % (json.dumps(DATA),json.dumps(SESSION)))
 requests=[]
 def route_request(route):
  url=route.request.url
  if url.startswith(base):
   route.continue_()
  elif url.endswith("/functions/v1/cotizaflow-pro-access"):
   requests.append(url)
   allowed=mode=="pro" or (mode=="revoked" and len(requests)==1)
   route.fulfill(status=200,content_type="application/json",
     body=json.dumps({"plan":"pro" if allowed else "free","payment_verified":allowed}))
  else:
   # Absolutely no requests to Supabase, Cloudflare or other external services.
   route.abort()
 context.route("**/*",route_request)
 page=context.new_page()
 errors=[]
 page.on("pageerror",lambda exc: errors.append(str(exc)))
 page.on("dialog",lambda dialog: dialog.accept())
 try:
  page.goto(base+"/",wait_until="load")
  page.locator("#cf-pro-open").click()
  if mode=="free":
   page.locator("#cf-pro-status").get_by_text("requiere Pro",exact=False).wait_for()
   assert page.locator("#cf-pro-duplicate").count()==0
  else:
   page.locator("#cf-pro-duplicate").wait_for()
   page.locator("#cf-pro-quote").select_option("q1")
   page.locator("#cf-pro-duplicate").click()
   if mode=="pro":
    page.wait_for_function(
      "()=>JSON.parse(localStorage.getItem('cotizaflow-v1')).quotes.length===2")
    page.locator("[data-nav=cotizaciones]").click()
    page.get_by_role("button",name="COT-0002").wait_for()
    result=page.evaluate("JSON.parse(localStorage.getItem('cotizaflow-v1'))")
    assert [q["number"] for q in result["quotes"]]==["COT-0002","COT-0001"]
    assert result["quotes"][0]["status"]=="borrador"
    assert result["quotes"][1]["status"]=="aceptada"
    assert result["quotes"][1]["items"][0]["id"]=="i1"
    assert result["quotes"][0]["items"][0]["id"]!="i1"
    assert result["quotes"][0]["date"]!=result["quotes"][1]["date"]
   else:
    page.locator("#cf-pro-status").get_by_text("requiere Pro",exact=False).wait_for()
  if mode!="pro":
   result=page.evaluate("JSON.parse(localStorage.getItem('cotizaflow-v1'))")
   assert result==DATA, "Free/revoked access must not mutate local data"
  assert len(requests)=={"free":1,"pro":3,"revoked":2}[mode],requests
  assert not errors,errors
  print("PASS browser",mode,f"{width}x{height}; mocked entitlement; no external network",flush=True)
 finally:
  context.close()

def main():
 handler=functools.partial(QuietHandler,directory=str(ROOT))
 server=ThreadingHTTPServer(("127.0.0.1",0),handler)
 thread=threading.Thread(target=server.serve_forever,daemon=True)
 thread.start()
 try:
  base=f"http://127.0.0.1:{server.server_port}"
  with sync_playwright() as playwright:
   browser=playwright.chromium.launch(headless=True,args=["--no-sandbox"])
   try:
    for mode in ("free","pro","revoked"):
     run_case(browser,base,mode)
    run_case(browser,base,"pro",width=1440,height=900)
   finally:
    browser.close()
 finally:
  server.shutdown()
  server.server_close()

if __name__=="__main__":main()
