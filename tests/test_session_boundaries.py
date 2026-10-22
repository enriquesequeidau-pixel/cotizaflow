"""CotizaFlow browser-session isolation and recovery security regression.

CotizaFlow authenticates with bearer tokens held in per-tab sessionStorage.
No login cookies are issued or managed by this client.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
cloud=(ROOT/'cloud.mjs').read_text('utf-8')
checkout=(ROOT/'plan-checkout.mjs').read_text('utf-8')
pro=(ROOT/'pro.mjs').read_text('utf-8')
assert "const SESSION_KEY='cotizaflow-cloud-session-v1';" in cloud
assert "sessionStorage.setItem(SESSION_KEY,JSON.stringify(s))" in cloud
assert "sessionStorage.removeItem(SESSION_KEY)" in cloud
assert "sessionStorage.getItem(SESSION_KEY)" in cloud
assert "sessionStorage.getItem(SESSION_KEY)" in checkout
assert "localStorage.setItem(SESSION_KEY" not in cloud
assert "localStorage.getItem(SESSION_KEY" not in cloud
assert not re.search(r"document\.cookie|cookieStore|setCookie",cloud)
assert "fetch(API+'/auth/v1/logout?scope=local'" in cloud
assert "saveSession(null)" in cloud
assert "refreshPending=auth('token?grant_type=refresh_token'" in cloud
assert "session?.refresh_token===previousRefreshToken" in cloud
assert "error.status===400||error.status===401" in cloud
assert "history.replaceState(history.state,'',location.pathname+location.search)" in cloud
assert "const redirectTo=new URL(location.pathname,location.origin).href" in cloud
assert "window.CotizaFlowSession.token()" in checkout
assert "window.CotizaFlowSession.token()" in pro
assert "verifiedToken!==token" in pro
assert "localStorage.setItem('isPro'" not in pro
print("PASS: per-tab token storage, local logout, invalid-refresh cleanup, own-app recovery redirect, Pro-token isolation")
