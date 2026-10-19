"""Playwright E2E; runs in CI, screenshots/traces retained in artifacts."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess, time, os

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'; OUT.mkdir(exist_ok=True)
server=subprocess.Popen(['python3','-m','http.server','8765','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True, **({'executable_path':os.environ['CHROMIUM_PATH']} if os.getenv('CHROMIUM_PATH') else {}),args=['--no-sandbox'])
  for label,width,height in [('mobile-360',360,780),('mobile-390',390,844),('mobile-430',430,932),('desktop-1440',1440,900)]:
   context=browser.new_context(viewport={'width':width,'height':height},accept_downloads=True)
   context.tracing.start(screenshots=True,snapshots=True,sources=True)
   page=context.new_page(); page_errors=[]; page.on('pageerror',lambda e:page_errors.append(str(e)))
   try:
    page.goto('http://127.0.0.1:8765/',wait_until='load')
    page.get_by_role('heading',name='Tus cotizaciones').wait_for()
    page.locator('[data-nav=clientes]').click()
    page.locator('#name').fill('Ana Pérez');page.locator('#phone').fill('56911112222');page.locator('#entity-form button[type=submit]').click()
    assert page.get_by_text('Ana Pérez').count()>=1
    page.locator('[data-entity-edit]').click();page.locator('#name').fill('Ana Pérez Editada');page.locator('#entity-form button[type=submit]').click()
    page.locator('[data-nav=servicios]').click();page.locator('#name').fill('Revisión de tablero');page.locator('#price').fill('25000');page.locator('#entity-form button[type=submit]').click()
    page.locator('[data-nav=cotizaciones]').click();page.locator('[data-new=editar]').click();page.locator('#clientId').select_option(label='Ana Pérez Editada')
    page.locator('[data-key=name]').fill('Revisión de tablero');assert page.locator('[data-key=price]').input_value()=='25000'
    page.locator('#status').select_option('enviada');page.locator('#quote-form button[type=submit]').click()
    assert page.get_by_role('button',name='COT-0001').count()==1
    page.reload(); assert page.get_by_role('button',name='COT-0001').count()==1
    with page.expect_download() as d: page.locator('[data-pdf]').click()
    pdf=OUT/f'{label}-cotizacion.pdf';d.value.save_as(pdf)
    assert pdf.read_bytes().startswith(b'%PDF-1.4')
    with page.expect_popup() as popup:page.locator('[data-follow]').click()
    assert 'whatsapp.com' in popup.value.url or 'wa.me' in popup.value.url
    page.get_by_role('button',name='COT-0001').click();page.locator('#status').select_option('aceptada');page.locator('#quote-form button[type=submit]').click()
    assert page.get_by_text('Aceptada').count()>=1
    page.locator('[data-nav=inicio]').click()
    assert page.locator('body').evaluate('(el)=>el.scrollWidth<=window.innerWidth+2'), 'Horizontal overflow'
    page.screenshot(path=str(OUT/f'{label}-dashboard.png'),full_page=True)
    page.locator('[data-nav=ajustes]').click();page.locator('#business').fill('Técnica Demo');page.locator('#settings-form button[type=submit]').click()
    with page.expect_download() as d: page.locator('#export').click()
    backup=OUT/f'{label}-backup.json';d.value.save_as(backup);assert b'T' in backup.read_bytes()
    assert not page_errors, page_errors
    print('PASS',label,'clients,services,quote,states,persistence,pdf,WhatsApp,settings,backup,responsive',flush=True)
   except Exception as exc:
    page.screenshot(path=str(OUT/f'{label}-FAILED.png'),full_page=True)
    print('FAIL',label,repr(exc),flush=True)
    raise
   finally:
    context.tracing.stop(path=str(OUT/f'{label}-trace.zip'));context.close()
  browser.close()
finally:
 server.terminate(); server.wait()
