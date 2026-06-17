#!/usr/bin/env python3
"""
Simulasi Multi-Akun Instagram Upload

Fitur:
- Daftar user baru
- Connect akun Instagram (simulasi OAuth)
- Pilih akun untuk upload
- Upload ke Instagram via Composio SDK

Cara pakai: python scripts/simulasi-multi-account.py
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone

# ============================================================
# "Database" — file JSON
# ============================================================

DB_DIR = os.path.join(os.path.dirname(__file__), "..", "tmp_db")
DB_FILE = os.path.join(DB_DIR, "database.json")
os.makedirs(DB_DIR, exist_ok=True)


def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            return json.load(f)
    return {"users": {}, "social_accounts": []}


def save_db(db):
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=2)


# ============================================================
# User & Social Account Management
# ============================================================


def create_user(email, name=None):
    db = load_db()
    if email in db["users"]:
        print(f"⚠️  User {email} already exists.")
        return db["users"][email]["id"]

    user_id = str(uuid.uuid4())
    db["users"][email] = {
        "id": user_id,
        "email": email,
        "name": name or email.split("@")[0],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    save_db(db)
    print(f"✅ User created: {email} (ID: {user_id[:8]}...)")
    return user_id


def connect_instagram(user_id, ig_username, ig_user_id=None):
    """Simulasi OAuth — seolah user berhasil login Instagram"""
    db = load_db()

    if not ig_user_id:
        ig_user_id = f"ig_{uuid.uuid4().hex[:12]}"

    account = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "platform": "instagram",
        "connected_id": f"composio_{uuid.uuid4().hex[:8]}",
        "ig_user_id": ig_user_id,
        "ig_username": ig_username,
        "alias": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    db["social_accounts"].append(account)
    save_db(db)

    user_email = next(
        (e for e, u in db["users"].items() if u["id"] == user_id), "unknown"
    )
    print(f"🔗 Instagram @{ig_username} connected to {user_email}")
    return account["id"]


def get_user_accounts(user_id):
    db = load_db()
    return [
        a
        for a in db["social_accounts"]
        if a["user_id"] == user_id and a["is_active"]
    ]


def get_account_by_id(account_id):
    db = load_db()
    for a in db["social_accounts"]:
        if a["id"] == account_id:
            return a
    return None


# ============================================================
# Instagram Upload (simulasi)
# ============================================================


def upload_to_instagram(account_id, video_url, caption=""):
    """Upload video ke Instagram (mock — sebenarnya bukan call SDK)"""
    account = get_account_by_id(account_id)
    if not account:
        return {"success": False, "error": "Account not found"}

    print(f"\n📤 Uploading to Instagram:")
    print(f"   Account: @{account['ig_username']} (ID: {account['ig_user_id']})")
    print(f"   Video:   {video_url}")
    print(f"   Caption: {caption[:50]}...")
    print(f"   Entity:  {account['connected_id']}")
    print(f"   Platform: instagram")

    # Simulasi call Composio SDK
    print(f"\n   ⏳ Creating media container...")
    container_id = f"container_{uuid.uuid4().hex[:10]}"
    print(f"   ✅ Container ID: {container_id}")

    print(f"   ⏳ Waiting for video processing...")
    print(f"   ⏳ Publishing container...")

    media_id = f"media_{uuid.uuid4().hex[:10]}"
    print(f"   ✅ Published! Media ID: {media_id}")
    print(f"   🔗 https://www.instagram.com/reel/{uuid.uuid4().hex[:8]}/\n")

    return {
        "success": True,
        "container_id": container_id,
        "media_id": media_id,
        "account_used": account["ig_username"],
    }


# ============================================================
# CLI Simulation
# ============================================================


def print_divider(title=""):
    width = 60
    if title:
        print(f"\n{'=' * width}")
        print(f"  {title}")
        print(f"{'=' * width}")
    else:
        print("-" * width)


def run_simulation():
    print_divider("SIMULASI MULTI-AKUN INSTAGRAM UPLOAD")
    print("  (tanpa Supabase — pakai file JSON)")
    print_divider()

    # --- Step 1: Buat beberapa user ---
    print_divider("STEP 1: Buat User")
    user_1 = create_user("alice@example.com", "Alice")
    user_2 = create_user("bob@example.com", "Bob")
    user_3 = create_user("charlie@example.com", "Charlie")

    # --- Step 2: Masing-masing connect Instagram ---
    print_divider("STEP 2: Connect Akun Instagram")

    # Alice: 2 akun Instagram
    alice_personal = connect_instagram(user_1, "alice_personal", "1111111111")
    alice_bisnis = connect_instagram(user_1, "alice_business", "2222222222")

    # Bob: 1 akun Instagram
    bob_akun = connect_instagram(user_2, "bob_media", "3333333333")

    # Charlie: 3 akun Instagram
    charlie_a = connect_instagram(user_3, "charlie_vlog", "4444444444")
    charlie_b = connect_instagram(user_3, "charlie_bisnis", "5555555555")
    charlie_c = connect_instagram(user_3, "charlie_gaming", "6666666666")

    # --- Step 3: Upload dengan pilihan akun ---
    print_divider("STEP 3: Upload Video")

    # Alice upload ke akun bisnis
    print(f"\n📌 Alice → upload ke @alice_business:")
    upload_to_instagram(
        alice_bisnis,
        "https://storage.supabase.co/clips/alice_video_1.mp4",
        "Check out our new product! #launch #excited",
    )

    # Bob upload
    print(f"\n📌 Bob → upload ke @bob_media:")
    upload_to_instagram(
        bob_akun,
        "https://storage.supabase.co/clips/bob_video_1.mp4",
        "Behind the scenes #bts #creator",
    )

    # Charlie upload ke akun gaming
    print(f"\n📌 Charlie → upload ke @charlie_gaming:")
    upload_to_instagram(
        charlie_c,
        "https://storage.supabase.co/clips/charlie_clip_1.mp4",
        "New gameplay! #gaming #epic",
    )

    # --- Step 4: Tampilkan database ---
    print_divider("STEP 4: Database State")
    db = load_db()
    print(f"\n📊 Users: {len(db['users'])}")
    for email, user in db["users"].items():
        accounts = [
            a
            for a in db["social_accounts"]
            if a["user_id"] == user["id"] and a["is_active"]
        ]
        print(f"   👤 {email} ({user['name']}) → {len(accounts)} Instagram account(s):")
        for a in accounts:
            print(f"      📸 @{a['ig_username']} (ID: {a['ig_user_id']})")

    print_divider("✅ SIMULASI SELESAI")
    print(f"\n📁 Database file: {DB_FILE}")
    print("\n💡 Untuk production: tinggal ganti file JSON → PostgreSQL (Prisma)")


if __name__ == "__main__":
    # Reset database untuk simulasi bersih
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
    run_simulation()