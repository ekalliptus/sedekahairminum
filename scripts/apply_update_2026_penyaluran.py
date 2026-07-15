#!/usr/bin/env python3
"""One-off data update from official CATATAN UPDATE doc (Jul 2026).
Reconciles `penerima` + `stats(grp=penerima)` to the new distribution table.
Idempotent: re-running yields the same end state. Reads creds from .dev.vars.
Source: gdoc 16BHgxfZ... + spreadsheet 1aVFguxnK7Bn... (DATA DISTRIBUSI AIR 2026).
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
with open(os.path.join(ROOT, ".dev.vars")) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"')

URL = env["SUPABASE_URL"].rstrip("/")
KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
HDR = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def req(method, path, body=None, prefer="return=representation"):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=data, method=method,
                               headers={**HDR, "Prefer": prefer})
    with urllib.request.urlopen(r) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else None


def patch(pid, body):
    return req("PATCH", f"/rest/v1/penerima?id=eq.{pid}", body)


# --- 1. Reorder + galon fixes on existing rows (by id) ---
# Coords are PRESERVED (only reorder/galon/status/publish change). KI Ageng is
# the sole row that leaves the map, so it's the only one that sets lat/lng null.
# id: (sort_order, galon, status)
existing = {
    "38e9848b-e0b6-4364-adfc-53b64d5703c7": (1,  6,  "tersalurkan"),   # An-Nur
    "d73b1d08-8792-4c90-97b0-bced42964f2e": (2,  8,  "tersalurkan"),   # Fajrussa'adah
    "07fb4813-2423-4186-8520-a04d73d8e54e": (3,  5,  "tersalurkan"),   # Al-Kholifah
    "4c15d233-e0db-44cb-8bc3-b4aee7a3c31a": (4,  10, "tersalurkan"),   # Al-Murtadlo
    "6243726a-57b3-478c-b213-2d32f6e8f785": (5,  10, "tersalurkan"),   # Ar-Ruhamaa' 8->10
    "d64f4360-3d5f-4ef6-9c95-d148837640fd": (6,  6,  "tersalurkan"),   # Nurul Jamil Al-Jumar
    "4eefe96b-8aa2-4dda-935d-37d5e2c5337a": (7,  3,  "tersalurkan"),   # Nurulhadi 2  2->3
    "dfa03476-984d-4be4-808d-ffa5be32d752": (9,  5,  "tersalurkan"),   # Hidayatul Mubtadiin Kunci
    "dd51f0f5-91e2-4450-979c-e2dae11d29fd": (10, 5,  "tersalurkan"),   # Yasma Mulia 4->5
    "be95d3c2-3a22-42b5-977b-300903aecc70": (11, 3,  "tersalurkan"),   # Roudlotuth Tholabah 2->3
    "2485d236-6bc6-487c-bcb7-40d945614dab": (13, 6,  "tersalurkan"),   # Kun Solihan
    "4c64592a-b43d-4dcd-b722-2549445361bd": (14, 14, "tersalurkan"),   # Panti Asuhan Islam
    "37da8649-c061-48fb-ae67-7036b22b52f3": (15, 20, "tersalurkan"),   # Thoriqul Mukminin
    "1a437f0e-a79f-46c9-a671-823827f5471f": (16, 10, "tersalurkan"),   # Muhammadiyah Al-Mujahidin
    "6310a570-ec56-444b-ae29-d9f326d38555": (17, 8,  "tersalurkan"),   # Ash-Shiddiq 2
}
for pid, (so, gal, st) in existing.items():
    patch(pid, {"sort_order": so, "galon": gal, "status": st, "is_published": True})
    print(f"updated {pid} sort={so} galon={gal} status={st}")

# KI Ageng Wonokusumo: keep in table (sort 18) but SELESAI + off the map.
patch("a9e85ad6-052b-4e9e-8390-d1489799ca01",
      {"sort_order": 18, "galon": 6, "status": "selesai",
       "lat": None, "lng": None, "is_published": True})
print("updated KI Ageng Wonokusumo -> selesai, off map")

# --- 2. Remove from table + map (not in new distribution list) ---
remove = {
    "88ab824b-f6fa-430b-a106-b66579758526": "Al-Hikmah Gubuk Rubuh",
    "fdbaa187-3991-403d-b83b-cf5ccfdfdf6c": "Baitul Jannah Darussalam",
    "587a5d65-5463-4274-a305-6d927c1c001f": "Assalafiyah Darussalam",
}
for pid, name in remove.items():
    patch(pid, {"is_published": False})
    print(f"unpublished {name}")

# --- 3. Insert 2 new pondok (coords resolved from official maps links) ---
new_rows = [
    {"name": "PP Ainul Yakin Special Children", "type": "Pesantren",
     "city": "Tepus", "province": "Gunung Kidul", "galon": 40,
     "status": "tersalurkan", "lat": -8.0608911, "lng": 110.6389694,
     "sort_order": 8, "is_published": True},
    {"name": "Nurul Qur'an Islamic Boarding School", "type": "Pesantren",
     "city": "Patuk", "province": "Gunung Kidul", "galon": 8,
     "status": "tersalurkan", "lat": -7.8706703, "lng": 110.4946289,
     "sort_order": 12, "is_published": True},
]
# idempotent: only insert if a row with that name doesn't already exist
for row in new_rows:
    q = urllib.parse.quote(row["name"])
    found = req("GET", f"/rest/v1/penerima?name=eq.{q}&select=id")
    if found:
        patch(found[0]["id"], row)
        print(f"upserted (existing) {row['name']}")
    else:
        req("POST", "/rest/v1/penerima", [row])
        print(f"inserted {row['name']}")

# --- 4. Stats (grp=penerima) ---
stats = {
    "efcc7aa4-4125-46cb-b5e3-5392e9a85370": 18,    # Lembaga Penerima 19->18
    "9bd635ca-e6ff-4967-a49b-5b42c6826d33": 1446,  # Galon/Distribusi 298->1446
    "4e5d11ca-0698-40cc-a85c-d5dc2e1e3469": 9,     # Kecamatan 7->9
    "40d1f509-02a0-4d23-9cf7-2e284e9d9c03": 1,     # Kabupaten (unchanged)
}
for sid, num in stats.items():
    req("PATCH", f"/rest/v1/stats?id=eq.{sid}", {"num": num})
    print(f"stat {sid} -> {num}")

print("DONE")
