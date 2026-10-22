"""E2E encrypted cloud backup roundtrip. Isolated mock API; no real users or payments."""
import json, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
UID='c1ad1a6d-926e-4f23-8b10-6247f630eaf1'
PASSWORD='this is a private cloud backup passphrase'
DATA={'settings':{'business':'E2E cliente privado','phone':'','email':'','currency':'CLP','tax':19},'clients':[], 'services':[], 'quotes':[]}
SESSION={'access_token':'sandbox-access-token','refresh_token':'sandbox-refresh-token','expires_at':4102444800,'user':{'id':UID,'email':'qa@example.test'}}
server=subprocess.Popen(['python3','-m','http.server','43781','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True)
  ctx=browser.new_context()
  page=ctx.new_page()
  stored={'data':None,'version':0}
  events={'write':0,'read':0}
  page.on('dialog',lambda dialog:dialog.accept())
  page.add_init_script(f"""{{
    sessionStorage.setItem('cotizaflow-cloud-session-v1',JSON.stringify({json.dumps(SESSION)}));
    localStorage.setItem('cotizaflow-v1',JSON.stringify({json.dumps(DATA)}));
  }}""")
  def backend(route):
   url=route.request.url
   if '/rest/v1/rpc/cotizaflow_safe_save' in url:
    body=route.request.post_data_json
    assert body['p_expected']==stored['version']
    assert 'E2E cliente privado' not in json.dumps(body['p_data'])
    assert body['p_data']['_cf_encrypted']['version']==1
    stored['data']=body['p_data'];stored['version']+=1;events['write']+=1
    payload=[{'saved':True,'server_version':stored['version']}]
   else:
    events['read']+=1
    payload=[{'data':stored['data'],'version':stored['version']}] if stored['data'] else []
   route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(payload))
  page.route('https://nrwbnjjaqilgreqhpcov.supabase.co/rest/v1/**',backend)
  page.goto('http://127.0.0.1:43781/',wait_until='domcontentloaded')
  page.locator('#cf-cloud-toggle').click()
  page.locator('#cf-backup-key').fill(PASSWORD)
  page.locator('#cf-push').click()
  page.get_by_text('Respaldo CIFRADO subido',exact=False).wait_for(timeout=25000)
  assert events['write']==1
  assert 'E2E cliente privado' not in json.dumps(stored['data'])
  assert stored['data']['_cf_encrypted']['ciphertext']
  # In a browser with empty local data, incorrect password must not overwrite it.
  page.evaluate("localStorage.removeItem('cotizaflow-v1')")
  page.locator('#cf-backup-key').fill('this key is definitely incorrect')
  page.locator('#cf-pull').click()
  page.get_by_text('No se pudo descifrar',exact=False).wait_for(timeout=25000)
  assert page.evaluate("localStorage.getItem('cotizaflow-v1')") is None
  page.locator('#cf-backup-key').fill(PASSWORD)
  page.locator('#cf-pull').click()
  # Respect the app's strict CSP: Playwright wait_for_function uses unsafe-eval.\n  # Poll via its trusted page.evaluate transport instead.\n  for attempt in range(100):\n   try:\n    if page.evaluate("() => localStorage.getItem('cotizaflow-v1') !== null"): break\n   except Exception:\n    pass  # Brief navigation during reload\n   time.sleep(.1)\n  else: raise AssertionError('Encrypted restoration never populated local storage')
  restored=json.loads(page.evaluate("localStorage.getItem('cotizaflow-v1')"))
  assert restored==DATA,(restored,DATA)
  assert events['write']==1 and events['read']>=3
  browser.close()
  print('PASS: encrypted upload, no plaintext in API, wrong-key fails closed, restore roundtrip')
finally:
 server.terminate();server.wait(timeout=5)
