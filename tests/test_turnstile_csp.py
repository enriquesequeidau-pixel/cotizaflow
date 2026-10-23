"""Ensure Cloudflare Turnstile can render without relaxing the app CSP."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text('utf-8')
auth=(ROOT/'auth-captcha.mjs').read_text('utf-8')
m=re.search(r'<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"',html)
assert m, 'HTML must declare a strict Content Security Policy'
csp=m.group(1)
directives=dict((name,values) for name,*values in (item.strip().split() for item in csp.split(';') if item.strip()))
assert directives.get('script-src')==["'self'",'https://challenges.cloudflare.com']
assert directives.get('frame-src')==['https://challenges.cloudflare.com']
assert directives.get('object-src')==["'none'"]
assert directives.get('base-uri')==["'none'"]
assert directives.get('form-action')==["'self'"]
assert "'unsafe-inline'" not in directives['script-src']
assert "script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'" in auth
assert 'export const AUTH_CAPTCHA_ENABLED=true;' in auth, 'Staging mode checks frontend required challenge'
print('PASS: official Turnstile script/iframe allowed without unsafe-inline; frontend test mode active')
