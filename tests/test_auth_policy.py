"""Static auth regression guards with fake data only; no live signups."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
class AuthPolicy(unittest.TestCase):
    def test_registration_vs_existing_login_and_reset(self):
        src=(ROOT/'cloud.mjs').read_text('utf-8')
        self.assertIn("if(!email||password.length<10)",src)
        self.assertIn("Ingresa correo válido y contraseña de al menos 10 caracteres para crear la cuenta.",src)
        self.assertIn("if(pass.length<10)",src)
        self.assertIn("auth('token?grant_type=password'",src)
    def test_one_refresh_owner_for_backup_and_billing(self):
        cloud=(ROOT/'cloud.mjs').read_text('utf-8')
        billing=(ROOT/'plan-checkout.mjs').read_text('utf-8')
        self.assertIn("window.CotizaFlowSession=Object.freeze({token})",cloud)
        self.assertIn('if(!refreshPending)',cloud)
        self.assertIn('return refreshPending',cloud)
        self.assertIn('window.CotizaFlowSession.token()',billing)
        self.assertNotIn("grant_type=refresh_token",billing)
        pro=(ROOT/'pro.mjs').read_text('utf-8')
        self.assertIn('window.CotizaFlowSession.token()',pro)
        self.assertNotIn("grant_type=refresh_token",pro)
        self.assertNotIn("sessionStorage.setItem(SESSION,JSON.stringify",pro)

    def test_pro_entitlement_cache_follows_current_auth_token(self):
        pro=(ROOT/'pro.mjs').read_text('utf-8')
        self.assertIn('verifiedToken=verified?token:null',pro)
        self.assertIn('verifiedToken!==token',pro)
        self.assertIn('const token=await sessionToken();if(!verified',pro)
        self.assertIn('verified=false;verifiedToken=null;await entitlement()',pro)
        self.assertNotIn("grant_type=refresh_token",pro)
    def test_app_specific_auth_redirect_and_session(self):
        src=(ROOT/'cloud.mjs').read_text('utf-8')
        self.assertIn("const SESSION_KEY='cotizaflow-cloud-session-v1'",src)
        self.assertIn("const redirectTo=new URL(location.pathname,location.origin).href",src)
        self.assertIn("auth('signup?redirect_to='+encodeURIComponent(new URL(location.pathname,location.origin).href)",src)
        self.assertNotIn('promoflash.sequeidaulabs.com',src)
        self.assertNotIn('misterioya.sequeidaulabs.com',src)
        self.assertIn("fetch(API+'/auth/v1/logout?scope=local'",src)
        self.assertNotIn("fetch(API+'/auth/v1/logout',{",src)
        self.assertIn('saveSession(null)',src)
if __name__=='__main__':
    unittest.main()
