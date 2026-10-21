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
