"""Non-payment OPTIONS-only CORS smoke checks for this app's isolated Edge Functions."""
import unittest,urllib.request,urllib.error
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

class ProAccessBoundary(unittest.TestCase):
 def test_missing_session_is_denied_without_touching_payments(self):
  req=urllib.request.Request(BASE+"cotizaflow-pro-access",method="POST",
   headers={"Origin":ORIGIN,"Content-Type":"application/json"},data=b'{}')
  with self.assertRaises(urllib.error.HTTPError) as fail:
   urllib.request.urlopen(req,timeout=25)
  self.assertEqual(fail.exception.code,401)

class ProEndpointBoundaries(unittest.TestCase):
 def test_no_session_on_report(self):
  req=urllib.request.Request(BASE+"cotizaflow-pro-report",method="POST",headers={"Origin":ORIGIN,"Content-Type":"application/json"},data=b'{}')
  with self.assertRaises(urllib.error.HTTPError) as err:
   urllib.request.urlopen(req,timeout=25)
  self.assertEqual(err.exception.code,401)

 def test_no_session_on_checkout_status(self):
  req=urllib.request.Request(BASE+"cotizaflow-mp-checkout",method="POST",headers={"Origin":ORIGIN,"Content-Type":"application/json"},data=b'{"action":"status"}')
  with self.assertRaises(urllib.error.HTTPError) as err:
   urllib.request.urlopen(req,timeout=25)
  self.assertEqual(err.exception.code,401)

class RetiredStripeSafety(unittest.TestCase):
 def test_stripe_billing_and_webhook_stay_disabled(self):
  import json
  for slug in ("cotizaflow-billing","cotizaflow-stripe-webhook"):
   with self.subTest(slug=slug):
    req=urllib.request.Request(BASE+slug,method="POST",
     headers={"Origin":ORIGIN,"Content-Type":"application/json"},data=b'{}')
    with self.assertRaises(urllib.error.HTTPError) as failed:
     urllib.request.urlopen(req,timeout=25)
    self.assertEqual(failed.exception.code,503)
    self.assertEqual(json.loads(failed.exception.read().decode())["error"],"stripe_legacy_disabled")

if __name__=="__main__":
 unittest.main()

