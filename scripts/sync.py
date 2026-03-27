"""POST contacts_ranked.json to the local sync API endpoint."""

import json
import urllib.request
from pathlib import Path

API_URL = "http://localhost:3000/api/sync"
API_KEY = "dev-sync-key-change-me"
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

with urllib.request.urlopen(req) as resp:
    body = json.loads(resp.read())
    print(f"✓ Synced {body['synced']} contacts")
