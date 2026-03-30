"""POST contacts_ranked.json to the local sync API endpoint."""

import json
import ssl
import urllib.request
from pathlib import Path

# macOS Python often lacks root certs — use certifi if available, else unverified
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

API_URL = "https://birthdayping.vercel.app/api/sync"
API_KEY = "snickers7"
USER_EMAIL = "jstarrtaylor@gmail.com"

data = Path(__file__).resolve().parent.parent / "contacts_ranked.json"
payload = data.read_bytes()

req = urllib.request.Request(
    API_URL,
    data=payload,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
        "X-User-Email": USER_EMAIL,
    },
    method="POST",
)

with urllib.request.urlopen(req, context=SSL_CTX) as resp:
    body = json.loads(resp.read())
    print(f"✓ Synced {body['synced']} contacts")
