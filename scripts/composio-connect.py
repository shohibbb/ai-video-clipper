#!/usr/bin/env python3
"""
Composio OAuth Connection Initiator & Metadata Fetcher (Production Ready v2)

Usage:
  python scripts/composio-connect.py '{"user_id": "...","redirect_url": "..."}'

Output: JSON with redirectUrl and account metadata
"""

import json
import os
import sys

try:
    from composio import Composio
except ImportError:
    print(json.dumps({"success": False, "error": "composio SDK not installed. Run: pip install composio-core"}))
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)

    try:
        args = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    user_id = args.get("user_id")
    # redirect_url bisa digunakan oleh SDK atau disimpan jika flow kustom memerlukan callback spesifik
    redirect_url = args.get("redirect_url", "")

    if not user_id:
        print(json.dumps({"success": False, "error": "user_id is required"}))
        sys.exit(1)

    api_key = os.environ.get("COMPOSIO_API_KEY", "")
    if not api_key:
        print(json.dumps({"success": False, "error": "COMPOSIO_API_KEY not set"}))
        sys.exit(1)

    auth_config_id = os.environ.get("COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID", "")
    if not auth_config_id:
        print(json.dumps({"success": False, "error": "COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID not set"}))
        sys.exit(1)

    try:
        # Inisialisasi Composio client
        composio = Composio(api_key=api_key)

        # 1. Gunakan method .link() terbaru (API v3) untuk menghindari error 400 Legacy Endpoint
        connection = composio.connected_accounts.link(
            user_id=user_id,
            auth_config_id=auth_config_id,
            allow_multiple=True
        )

        # Mengambil data esensial dari object hasil connection
        redirect_url_target = getattr(connection, 'redirect_url', '') or getattr(connection, 'redirectUrl', '')
        connected_account_id = getattr(connection, 'connected_account_id', None) or getattr(connection, 'id', None)

        # 2. LOGIKA BARU: Ambil metadata Instagram (ig_user_id & username) jika koneksi sudah aktif/ready
        ig_user_id = ""
        ig_username = ""
        
        # Mengecek apakah status koneksi langsung 'ACTIVE' (jika user sebelumnya sudah pernah authorize)
        connection_status = getattr(connection, 'status', '').upper()
        
        if connection_status == "ACTIVE" and connected_account_id:
            try:
                # Eksekusi tool INSTAGRAM_GET_USER_INFO secara programmatic
                result = composio.tools.execute(
                    "INSTAGRAM_GET_USER_INFO",
                    user_id=user_id,
                    arguments={}
                )

                if result.get("successful"):
                    data = result.get("data", {})
                    ig_user_id = data.get("id", "")
                    ig_username = data.get("username", "")
            except Exception:
                # Silently pass jika gagal ambil info saat inisiasi awal (karena user belum klik tautan)
                pass

        # 3. Kembalikan response JSON bersih ke Web Backend
        print(json.dumps({
            "success": True,
            "redirectUrl": redirect_url_target,
            "connectedAccountId": str(connected_account_id) if connected_account_id else "",
            "status": connection_status,
            "instagram_metadata": {
                "ig_user_id": ig_user_id,
                "username": ig_username
            }
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "type": type(e).__name__
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()