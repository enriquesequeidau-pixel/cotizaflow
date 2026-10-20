from urllib.parse import urlparse, parse_qs
import json
import subprocess
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
# CotizaFlow deliberately uses an app-specific, session-scoped Auth token store.
CLOUD=(root/'cloud.mjs').read_text(encoding='utf-8')
assert "const SESSION_KEY='cotizaflow-cloud-session-v1'" in CLOUD
assert "supabase.auth.signOut(" not in CLOUD

server=subprocess.Popen(['python3','-m','http.server','4389','--bind','127.0.0.1'],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for width, base_url in ((375,'http://127.0.0.1:4389'),(1280,'http://127.0.0.1:4389'),(375,'https://cotizaflow.sequeidaulabs.com'),(1280,'https://cotizaflow.sequeidaulabs.com')):
            variant='public' if base_url.startswith('https') else 'local'
            ctx=browser.new_context(viewport={'width':width,'height':800},device_scale_factor=1)
            page=ctx.new_page()
            errors=[]
            sent=[]
            recovery_urls=[]
            page.on('pageerror', lambda err: errors.append(str(err)))
            def intercept(route):
                req=route.request
                if req.method=='POST':
                    recovery_urls.append(req.url)
                    sent.append(json.loads(req.post_data or '{}'))
                    route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body='{}')
                else:
                    route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,apikey'})
            page.route('**/auth/v1/recover*',intercept)
            page.goto(f'{base_url}/',wait_until='domcontentloaded')
            page.locator('#cf-cloud-toggle').click()
            link=page.locator('#cf-forgot')
            expect(link).to_be_visible()
            assert float(link.evaluate('(e)=>getComputedStyle(e).fontSize')[:-2])<=13
            link.click()
            expect(page.locator('#cf-cloud-status')).to_contain_text('Escribe primero tu correo')
            page.locator('#cf-email').fill('qa-cotizaflow@example.com')
            link.click()
            expect(page.locator('#cf-cloud-status')).to_contain_text('Solicitud recibida',timeout=10000)
            assert len(sent)==1 and sent[0]['email']=='qa-cotizaflow@example.com',sent
            redirect=parse_qs(urlparse(recovery_urls[0]).query).get('redirect_to',[None])[0]
            assert redirect==f'{base_url}/',f'Recovery escaped CotizaFlow: {redirect}'
            expect(link).to_be_enabled()
            assert not errors,errors
            print(json.dumps({'width':width,'variant':variant,'status':'PASS','sent_mocked_recovery_requests':len(sent)}))
            ctx.close()
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)
