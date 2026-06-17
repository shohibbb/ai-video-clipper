# Checkpoint: Instagram Upload via Composio

**Tanggal:** 2026-06-16  
**Status:** Instagram upload single-account works (Python SDK child process)  
**Berikutnya:** Multi-account Instagram (lihat bagian "Rencana Multi-Akun" di bawah)

---

## Status Saat Ini

### Apa yang Sudah Berfungsi

1. **Instagram upload button** — muncul di halaman `/videos/[id]`
2. **API route** — `POST /api/clips/[id]/upload` dengan `platform: "instagram"`
3. **Python script** — `scripts/instagram-upload.py` menjalankan Composio Python SDK
4. **Composio SDK** — menggunakan `INSTAGRAM_POST_IG_USER_MEDIA` + `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH`
5. **UI component** — `InstagramUploadPanel` dengan gradient Instagram button
6. **Prisma schema** — sudah memiliki tabel `UploadTarget` untuk tracking upload

### File yang Dibuat/Diubah

| #   | File                                        | Status   | Deskripsi                                                           |
| --- | ------------------------------------------- | -------- | ------------------------------------------------------------------- |
| 1   | `src/lib/composio/types.ts`                 | NEW      | Type definitions untuk Composio API                                 |
| 2   | `src/lib/composio/client.ts`                | NEW      | REST v3 client                                                      |
| 3   | `src/lib/composio/instagram.ts`             | NEW      | Python process spawn untuk upload                                   |
| 4   | `src/lib/composio/index.ts`                 | NEW      | Re-export Instagram functions                                       |
| 5   | `scripts/instagram-upload.py`               | NEW      | Python script Composio SDK                                          |
| 6   | `src/app/api/clips/[id]/upload/route.ts`    | MODIFIED | Added Instagram upload section + `buildClipPublicUrl()`             |
| 7   | `src/components/instagram-upload-panel.tsx` | NEW      | UI panel Instagram upload                                           |
| 8   | `src/app/videos/[id]/page.tsx`              | MODIFIED | Added `InstagramUploadPanel` + grid 2 kolom                         |
| 9   | `src/lib/api/validation.ts`                 | MODIFIED | Schema accept "instagram" platform                                  |
| 10  | `.env`                                      | MODIFIED | Added `COMPOSIO_INSTAGRAM_ENTITY_ID` + `COMPOSIO_INSTAGRAM_USER_ID` |

### Connection Info

- **Composio Account ID:** `ca_5gImac_LWMu7`
- **Entity ID:** `shohib`
- **Instagram User ID:** `27387662517493391`
- **Instagram Username:** `@pmm94_rumahdakwahsangsurya_`
- **Status:** ACTIVE

### Catatan Teknis Penting

1. **Composio REST v3 vs Python SDK**
   - `INSTAGRAM_CREATE_MEDIA_CONTAINER` works via REST v3
   - `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` returns 404 in REST v3 — must use Python SDK
   - Solution: Spawn Python SDK as child process

2. **Instagram URL belum diimplementasi**
   - `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` hanya return `media_id` (numeric ID)
   - Untuk dapat permalink/URL: panggil `INSTAGRAM_GET_IG_MEDIA` dengan media_id
   - Belum diimplementasi, bisa dilakukan nanti

3. **UI Layout**
   - `ClipUploadPanel` (TikTok) dan `InstagramUploadPanel` (Instagram) dalam grid 2 kolom
   - `grid gap-5 sm:grid-cols-2` di dalam wrapper

---

## Rencana Multi-Akun Instagram

### Tujuan

- User bisa memilih akun Instagram mana yang akan digunakan untuk upload
- Tampilkan akun berdasarkan username (display)
- Upload berdasarkan `ig_user_id` (untuk Composio API)
- Support koneksi akun baru via OAuth Composio

### Database Model

```prisma
model SocialAccount {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  platform        String   // "instagram"
  connectedId     String   @map("connected_id") // Composio connected account ID
  igUserId        String   @map("ig_user_id") // Instagram Business Account ID
  igUsername      String   @map("ig_username") // @username Instagram
  alias           String?  // Label user (opsional)
  isActive        Boolean  @default(true)
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([userId, connectedId])
  @@map("social_accounts")
}
```

### API Routes

| Route                              | Method | Deskripsi                           |
| ---------------------------------- | ------ | ----------------------------------- |
| `/api/composio/instagram/accounts` | GET    | List akun Instagram yang terhubung  |
| `/api/composio/instagram/connect`  | POST   | Initiate OAuth flow untuk akun baru |
| `/api/composio/instagram/callback` | GET    | Handle callback dari Composio OAuth |

### UI Component

- **`InstagramAccountSelector`** — komponen baru
  - Dropdown pilihan akun (tampilkan @username)
  - Tombol "Connect New Account"
  - Loading state saat fetch accounts

### Flow Upload Multi-Akun

1. User pilih akun dari dropdown (tampilkan @username)
2. POST `/api/clips/[id]/upload` dengan `connectedAccountId: "xxx"`
3. Backend lookup `SocialAccount` → dapatkan `igUserId`
4. Kirim ke `instagram-upload.py`:
   - `entity_id = connectedId` (Composio entity)
   - `ig_user_id = igUserId` (untuk upload)
5. Python script panggil Composio SDK

### File yang Perlu Dibuat/Diubah

| #   | File                                               | Status                                |
| --- | -------------------------------------------------- | ------------------------------------- |
| 1   | `prisma/schema.prisma`                             | MODIFY — tambah model `SocialAccount` |
| 2   | `src/lib/composio/accounts.ts`                     | NEW — fungsi manage social accounts   |
| 3   | `src/app/api/composio/instagram/accounts/route.ts` | NEW                                   |
| 4   | `src/app/api/composio/instagram/connect/route.ts`  | NEW                                   |
| 5   | `src/app/api/composio/instagram/callback/route.ts` | NEW                                   |
| 6   | `src/components/instagram-account-selector.tsx`    | NEW                                   |
| 7   | `src/components/instagram-upload-panel.tsx`        | MODIFY — integrasi selector           |
| 8   | `src/app/api/clips/[id]/upload/route.ts`           | MODIFY — accept connectedAccountId    |
| 9   | `scripts/instagram-upload.py`                      | MODIFY — accept connected_account_id  |
