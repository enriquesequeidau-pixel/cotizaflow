"""Non-payment OPTIONS-only CORS smoke checks for this app's isolated Edge Functions."""
import unittest,urllib.request
BASE="https://nrwbnjjaqilgreqhpcov.supabase.co/functions/v1/"
ORIGIN="https://cotizaflow.sequeidaulabs.com"
FOREIGN="https://promoflash.sequeidaulabs.com"
FUNCTIONS=["cotizaflow-mp-checkout","cotizaflow-pro-report","cotizaflow-pro-access","cotizaflow-billing"]
def preflight(slug):
 req=urllib.request.Request(BASE+slug,method='OPTIONS',headers={
  "Origin":ORIGIN,
  "Access-Control-Request-Method":"POST",
  "Access-Control-Request-Headers":"apikey,authorization,content-type"
 })
 with urllib.request.urlopen(req,timeout=25) as response:
  return response.status,response.headers.get('Access-Control-Allow-Origin')
class EdgeOrigins(unittest.TestCase):
 def test_each_function_allows_own_domain_only(self):
  for slug in FUNCTIONS:
   with self.subTest(slug=slug):
    code,allow=preflight(slug)
    self.assertIn(code,(200,204),slug)
    self.assertEqual(allow,ORIGIN,slug)
    self.assertNotEqual(allow,FOREIGN,slug)
if __name__=="__main__":
 unittest.main()
