# PRD & FSD — AI Automation Clipping Video

## 0. Konteks Singkat

Produk ini adalah sistem automasi untuk membantu user memproses daftar video menjadi clip pendek menggunakan Reap API, menyimpan hasilnya ke storage, lalu mengunggah clip tersebut secara otomatis ke TikTok melalui integrasi Reap Publish.

Untuk MVP, sistem menggunakan **Reap REST API** untuk pembuatan clip dan **Reap Publish API** untuk upload ke TikTok. Tidak lagi menggunakan Playwright browser automation atau Composio.

---

# Part 1 — PRD: Product Requirements Document

## 1. Product Overview

### 1.1 Nama Produk

**AI Automation Video Clipper**

### 1.2 Deskripsi Produk

AI Automation Video Clipper adalah aplikasi web yang memungkinkan user memasukkan daftar video, memproses video tersebut menjadi short clips melalui Reap API, menyimpan hasil clip ke storage, lalu mengunggah hasil clip secara otomatis ke TikTok.

Produk ini bertujuan mengurangi pekerjaan manual dalam proses:

1. Mengumpulkan video.
2. Mengunggah video ke Reap untuk diproses.
3. Menunggu hasil clipping.
4. Mengunduh hasil clip.
5. Menyimpan hasil clip.
6. Membuat caption/title/hashtag.
7. Mengunggah clip ke TikTok.

### 1.3 Masalah yang Diselesaikan

Content creator atau operator social media sering perlu mengubah video panjang menjadi beberapa short clips. Proses ini biasanya manual, repetitif, memakan waktu, dan sulit dikelola jika jumlah video banyak.

Masalah utama:

* Upload video ke platform clipping masih manual.
* Hasil clip perlu dicek dan diunduh satu per satu.
* File hasil clip perlu disimpan ulang ke storage.
* Upload ke TikTok dilakukan manual.
* Tidak ada dashboard status untuk melihat progress setiap video.
* Sulit melakukan retry jika salah satu proses gagal.

### 1.4 Tujuan Produk

Produk ini bertujuan membuat workflow clipping video menjadi semi-otomatis hingga otomatis.

Tujuan utama MVP:

* User dapat memasukkan daftar video dari Web UI.
* Sistem dapat membuat task clipping untuk setiap video.
* Sistem dapat mengirim video ke Reap API untuk diproses.
* Sistem dapat menerima webhook atau polling untuk mengambil hasil clip.
* Sistem dapat menyimpan hasil clip ke storage.
* Sistem dapat mengunggah hasil clip ke TikTok melalui Reap Publish.
* User dapat melihat status setiap video dan clip.
* Sistem memiliki retry dan logging ketika proses gagal.

### 1.5 Non-Goals untuk MVP

Hal yang tidak menjadi fokus MVP:

* Tidak membuat model AI clipping sendiri.
* Tidak membuat pengganti Reap.
* Tidak mendukung semua platform sosial sekaligus.
* Tidak mendukung multi-tenant enterprise dari awal.
* Tidak melakukan bypass CAPTCHA, rate limit, atau sistem keamanan pihak ketiga.
* Tidak menjalankan automation dalam skala besar tanpa izin dari pihak layanan terkait.

### 1.6 Target User

#### Primary User

Content creator, social media manager, atau operator konten yang sering membuat clip pendek dari video panjang.

#### Secondary User

Founder, developer, atau agency kecil yang ingin menguji workflow automasi short-form content sebelum membangun sistem production yang lebih besar.

---

## 2. User Stories

### 2.1 Video Submission

Sebagai user, saya ingin memasukkan daftar video agar sistem dapat memprosesnya secara otomatis.

Acceptance criteria:

* User dapat menambahkan video melalui URL.
* User dapat mengunggah file video dari lokal.
* User dapat menambahkan beberapa video sekaligus.
* Sistem membuat task untuk setiap video.
* Sistem menampilkan status awal sebagai `pending`.

### 2.2 Task Monitoring

Sebagai user, saya ingin melihat status setiap video agar saya tahu progress proses clipping.

Acceptance criteria:

* User dapat melihat list task video.
* Setiap task memiliki status.
* User dapat melihat error jika task gagal.
* User dapat melakukan retry task gagal.

### 2.3 Reap Processing

Sebagai user, saya ingin sistem mengirim video ke Reap agar saya tidak perlu upload manual ke platform clipping.

Acceptance criteria:

* Worker dapat mengambil task dari queue.
* Worker dapat mengunggah source video ke Reap (via URL atau file upload).
* Worker dapat membuat project clipping di Reap.
* Sistem dapat menerima webhook callback saat project selesai.
* Atau sistem dapat melakukan polling jika webhook tidak tersedia.

### 2.4 Clip Storage

Sebagai user, saya ingin hasil clip disimpan di storage agar file dapat diakses ulang.

Acceptance criteria:

* Sistem dapat menyimpan clip ke object storage.
* Setiap clip memiliki URL/path storage.
* Metadata clip disimpan di database.
* User dapat melihat atau mengunduh clip dari dashboard.

### 2.5 Auto Upload ke TikTok

Sebagai user, saya ingin clip otomatis diunggah ke TikTok agar proses publikasi lebih cepat.

Acceptance criteria:

* User dapat memilih platform tujuan (MVP: TikTok).
* Sistem menggunakan Reap Publish API untuk upload ke TikTok.
* Sistem menyimpan status upload.
* Sistem menyimpan URL hasil upload jika tersedia.
* Sistem dapat melakukan retry upload jika gagal.

### 2.6 Caption Generation

Sebagai user, saya ingin sistem membantu membuat title, caption, dan hashtag agar hasil upload lebih siap dipublikasikan.

Acceptance criteria:

* Sistem dapat membuat caption otomatis menggunakan LLM.
* User dapat mengedit caption sebelum upload.
* Caption tersimpan di database.
* Caption digunakan saat upload ke platform tujuan.

---

## 3. Product Scope

### 3.1 MVP Scope

Fitur MVP:

1. Authentication sederhana.
2. Dashboard video task.
3. Input video URL.
4. Upload file video ke storage.
5. Queue task processing.
6. Reap API Worker untuk pembuatan clip.
7. Webhook atau polling untuk download hasil clip.
8. Simpan hasil clip ke storage.
9. Generate title/caption sederhana.
10. Upload clip ke TikTok menggunakan Reap Publish.
11. Retry failed task.
12. Basic logging.

### 3.2 Future Scope

Fitur lanjutan:

1. Multi-user workspace.
2. Scheduling upload.
3. Approval flow sebelum upload.
4. AI clip ranking.
5. Template caption per platform.
6. Bulk upload dengan concurrency control.
7. Analytics upload.
8. Payment dan subscription.
9. Support platform tambahan (YouTube Shorts, Instagram Reels).

---

## 4. Success Metrics

### 4.1 Product Metrics

* Jumlah video yang berhasil diproses.
* Jumlah clip yang berhasil dibuat.
* Jumlah clip yang berhasil diupload.
* Rata-rata waktu dari video submission sampai clip siap.
* Persentase task gagal.
* Persentase task berhasil setelah retry.

### 4.2 MVP Success Criteria

MVP dianggap berhasil jika:

* Minimal 80% video berhasil diproses oleh Reap API.
* Minimal 80% hasil clip berhasil disimpan ke storage.
* Minimal 70% clip berhasil diupload ke TikTok melalui Reap Publish.
* User dapat melihat status task dengan jelas.
* Sistem dapat melakukan retry untuk task gagal.

---

## 5. Risiko Produk

### 5.1 Risiko ToS dan Compliance

Sistem menggunakan Reap API dan Reap Publish. Harus mematuhi Terms of Service Reap dan TikTok.

Mitigasi:

* Gunakan API resmi, bukan scraping.
* Batasi concurrency (Reap rate limit: 10 req/min).
* Gunakan akun resmi milik sendiri.
* Jangan melakukan automation massal tanpa izin.

### 5.2 Risiko API Berubah

Reap API mungkin berubah di masa depan.

Mitigasi:

* Simpan OpenAPI spec lokal untuk referensi.
* Buat service boundary yang modular (Reap API client di `src/lib/reap/`).
* Gunakan type-safe API client dengan TypeScript.

### 5.3 Risiko Platform Upload

TikTok memiliki policy, rate limit, review, dan restriction masing-masing.

Mitigasi:

* Gunakan Reap Publish API (sudah menangani OAuth dan platform API).
* Simpan status upload di database.
* Validasi ukuran, durasi, dan format video.
* Tambahkan error handling untuk upload failure.

---

# Part 2 — FSD: Functional Specification Document

## 6. System Architecture

### 6.1 High-Level Architecture

```text
Client
  ↓
Web UI (Next.js App Router)
  ↓
Backend API (Next.js Route Handlers)
  ↓
Database (PostgreSQL) + Queue (Redis/BullMQ)
  ↓
Reap Processing Worker → Reap API
  ↓
Webhook Handler / Polling Worker → Download clips
  ↓
Clip Result Storage (Supabase/Cloudflare R2)
  ↓
Reap Publish Worker → Reap API → TikTok
```

### 6.2 Recommended Tech Stack

#### Frontend

* Next.js / React
* Tailwind CSS

#### Backend

* Next.js Route Handlers

#### Database

* PostgreSQL
* Prisma ORM

#### Queue

* BullMQ + Redis

#### Clip Generation

* Reap API (REST)

#### Storage

* Supabase Storage atau Cloudflare R2

#### Upload Integration

* Reap Publish API (TikTok)

#### AI Captioning

* OpenAI API / local LLM

---

## 7. Main Functional Modules

### 7.1 Authentication Module

#### Purpose

Mengatur user login dan akses dashboard.

#### Functional Requirements

* User dapat login.
* User dapat logout.
* Sistem menyimpan session user.
* Setiap task dikaitkan dengan user.

#### MVP Option

Gunakan NextAuth placeholder untuk MVP.

---

### 7.2 Video Submission Module

#### Purpose

Menerima input video dari user.

#### Input Type

1. Video URL.
2. File upload.

#### Functional Flow

```text
User submit video
  ↓
Backend validasi input
  ↓
Jika file: upload ke source storage
  ↓
Simpan metadata video ke database
  ↓
Buat job di queue
  ↓
Status video = pending
```

#### Validation

* URL harus valid.
* File harus video.
* Format video yang didukung: MP4, MOV, WEBM.
* Ukuran file mengikuti batas storage dan Reap (max 500MB).

---

### 7.3 Task Management Module

#### Purpose

Mengelola lifecycle video processing.

#### Status Lifecycle

```text
pending
queued
uploading_to_reap
processing_in_reap
downloading_from_reap
storing_clips
generating_caption
ready_to_upload
uploading_to_tiktok
completed
failed
cancelled
```

#### Functional Requirements

* Sistem membuat task untuk setiap video.
* Sistem memperbarui status task secara berkala.
* User dapat melihat status task.
* User dapat retry task gagal.
* User dapat cancel task yang belum diproses.

---

### 7.4 Queue Module

#### Purpose

Mengatur antrean job agar proses automation tidak berjalan bersamaan secara berlebihan.

#### Functional Requirements

* Setiap video menghasilkan satu processing job.
* Queue mendukung retry otomatis.
* Queue mendukung delay.
* Queue mendukung concurrency limit.

#### Recommended MVP Configuration

```text
Reap Worker concurrency: 1
Reap Publish Worker concurrency: 1
Reap Polling Worker concurrency: 1
Retry max: 3
Retry delay: 5 minutes
Timeout per job: configurable
```

---

### 7.5 Reap Processing Worker Module

#### Purpose

Mengunggah video ke Reap dan membuat project clipping.

#### Worker Flow

```text
1. Ambil job dari queue.
2. Validasi Reap API key.
3. Jika source URL: create clips project langsung.
4. Jika source file: upload file ke Reap → create clips project.
5. Simpan reapProjectId ke database.
6. Update video status = processing_in_reap.
7. Worker menjadwalkan polling fallback dengan delay 15 menit.
8. Webhook menjadi jalur utama; polling menangani webhook yang terlewat.
```

#### Webhook Flow (Recommended)

```text
Reap kirim webhook project completed
  ↓
Webhook handler menerima payload
  ↓
Enqueue job download clip idempoten
  ↓
Download worker fetch daftar clip dari Reap API
  ↓
Download setiap clip
  ↓
Upload clip ke storage
  ↓
Buat Clip records di database
  ↓
Update video status = ready_to_upload
```

#### Polling Flow (Fallback)

```text
Reap Polling Worker ambil job dari queue
  ↓
Tunggu 15 menit agar webhook menjadi jalur utama
  ↓
Poll Reap project status setiap 5 menit
  ↓
Jika completed: enqueue job download clip yang sama
  ↓
Jika failed: update status = failed
```

#### Error Handling

Jika gagal:

* Simpan error message.
* Ubah status task menjadi `failed`.
* Trigger retry jika retry count belum habis.

---

### 7.6 Clip Storage Module

#### Purpose

Menyimpan hasil clip dari Reap.

#### Storage Structure

```text
/users/{user_id}/videos/{video_id}/source.mp4
/users/{user_id}/videos/{video_id}/clips/{clip_id}.mp4
```

#### Functional Requirements

* Sistem dapat upload file ke storage.
* Sistem menyimpan storage path di database.
* Sistem dapat membuat signed URL jika storage private.
* Sistem dapat menghapus file jika task dihapus.

---

### 7.7 Caption & Metadata Module

#### Purpose

Membuat metadata upload seperti title, caption, description, dan hashtag.

#### Functional Requirements

* Generate title otomatis.
* Generate caption otomatis.
* Generate hashtag otomatis.
* User dapat mengedit metadata.
* Metadata tersimpan per clip.

---

### 7.8 Reap Publish Module (TikTok Upload)

#### Purpose

Mengunggah clip ke TikTok menggunakan Reap Publish API.

#### Supported Platform for MVP

1. TikTok (via Reap Publish)

YouTube Shorts dan Instagram Reels menjadi future scope.

#### Upload Flow

```text
Clip ready_to_upload
  ↓
User memilih platform tujuan (TikTok)
  ↓
Backend membuat upload job
  ↓
Reap Publish Worker menjalankan publishClip API
  ↓
Sistem menerima response dari Reap
  ↓
Simpan upload URL/status
  ↓
Status menjadi completed atau failed
```

#### Functional Requirements

* Sistem dapat upload clip ke TikTok melalui Reap.
* Sistem dapat mengirim title/caption/tags.
* Sistem menyimpan upload status.
* Sistem menyimpan platform video URL jika tersedia.

---

## 8. Page / Screen Specification

### 8.1 Dashboard Page

#### Purpose

Menampilkan ringkasan task video.

#### Components

* Total videos.
* Total clips generated.
* Total uploads completed.
* Failed tasks.
* Recent tasks.

#### Actions

* Add video.
* View task detail.
* Retry failed task.

---

### 8.2 Add Video Page

#### Purpose

User menambahkan video baru.

#### Components

* Input video URL.
* File upload input.
* Submit button.

#### Validation Message

* Invalid URL.
* Unsupported file type.
* File too large.

---

### 8.3 Video Task List Page

#### Purpose

Menampilkan semua video task.

#### Columns

* Video title/source.
* Status.
* Created date.
* Number of clips.
* Upload target.
* Error indicator.
* Action.

#### Actions

* View detail.
* Retry.
* Cancel.
* Delete.

---

### 8.4 Video Detail Page

#### Purpose

Menampilkan detail processing video dan hasil clip.

#### Sections

* Source video info.
* Processing status.
* Timeline log.
* Clip result list.
* Upload status.

#### Actions

* Preview clip.
* Edit caption.
* Upload now.
* Retry upload.
* Download clip.

---

### 8.5 Integration Settings Page

#### Purpose

Menampilkan status integrasi Reap dan TikTok.

#### Components

* Reap API connection status.
* TikTok integration status (via Reap).
* Storage connection status.
* Redis / BullMQ status.

---

## 9. Data Model

### 9.1 users

```sql
users (
  id uuid primary key,
  email text not null unique,
  name text,
  created_at timestamp,
  updated_at timestamp
)
```

### 9.2 videos

```sql
videos (
  id uuid primary key,
  user_id uuid references users(id),
  source_type text, -- url | file
  source_url text,
  source_storage_path text,
  title text,
  duration_seconds integer,
  status text,
  error_message text,
  retry_count integer default 0,
  reap_project_id text,
  created_at timestamp,
  updated_at timestamp
)
```

### 9.3 clips

```sql
clips (
  id uuid primary key,
  video_id uuid references videos(id),
  user_id uuid references users(id),
  reap_clip_id text,
  storage_path text,
  preview_url text,
  duration_seconds integer,
  title text,
  caption text,
  hashtags text[],
  virality_score float,
  source_start_time float,
  source_end_time float,
  status text,
  created_at timestamp,
  updated_at timestamp
)
```

### 9.4 upload_targets

```sql
upload_targets (
  id uuid primary key,
  clip_id uuid references clips(id),
  user_id uuid references users(id),
  platform text, -- tiktok
  upload_status text,
  uploaded_url text,
  reap_integration_id text,
  reap_post_id text,
  scheduled_at timestamp,
  error_message text,
  retry_count integer default 0,
  created_at timestamp,
  updated_at timestamp
)
```

### 9.5 jobs

```sql
jobs (
  id uuid primary key,
  user_id uuid references users(id),
  video_id uuid references videos(id),
  clip_id uuid references clips(id),
  job_type text, -- reap_process | reap_publish | generate_caption
  status text,
  attempts integer default 0,
  max_attempts integer default 3,
  error_message text,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp,
  updated_at timestamp
)
```

### 9.6 logs

```sql
logs (
  id uuid primary key,
  job_id uuid references jobs(id),
  user_id uuid references users(id),
  level text, -- info | warning | error
  message text,
  metadata jsonb,
  created_at timestamp
)
```

---

## 10. API Specification

### 10.1 Create Video Task

```http
POST /api/videos
```

#### Request

```json
{
  "sourceType": "url",
  "sourceUrl": "https://example.com/video.mp4"
}
```

#### Response

```json
{
  "videoId": "uuid",
  "status": "pending"
}
```

---

### 10.2 List Video Tasks

```http
GET /api/videos
```

#### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Video title",
      "status": "processing_in_reap",
      "createdAt": "timestamp"
    }
  ]
}
```

---

### 10.3 Get Video Detail

```http
GET /api/videos/{videoId}
```

#### Response

```json
{
  "id": "uuid",
  "status": "completed",
  "reapProjectId": "reap_project_id",
  "clips": [
    {
      "id": "uuid",
      "reapClipId": "reap_clip_id",
      "storagePath": "path/to/clip.mp4",
      "caption": "caption text",
      "uploadStatus": "completed"
    }
  ]
}
```

---

### 10.4 Retry Video Task

```http
POST /api/videos/{videoId}/retry
```

#### Response

```json
{
  "videoId": "uuid",
  "status": "queued"
}
```

---

### 10.5 Poll Reap Project (Manual)

```http
POST /api/videos/{videoId}/poll
```

#### Response

```json
{
  "videoId": "uuid",
  "reapProjectId": "reap_project_id",
  "jobId": "uuid",
  "status": "polling_started"
}
```

---

### 10.6 Update Clip Metadata

```http
PATCH /api/clips/{clipId}
```

#### Request

```json
{
  "title": "New title",
  "caption": "New caption",
  "hashtags": ["#shorts", "#ai"]
}
```

---

### 10.7 Upload Clip to TikTok

```http
POST /api/clips/{clipId}/upload
```

#### Request

```json
{
  "platform": "tiktok"
}
```

#### Response

```json
{
  "uploadTargetId": "uuid",
  "status": "queued"
}
```

---

### 10.8 Get Reap Integrations

```http
GET /api/reap/integrations
```

#### Response

```json
{
  "data": [
    {
      "id": "integration_id",
      "platform": "tiktok",
      "isActive": true,
      "username": "username",
      "name": "Account Name"
    }
  ]
}
```

---

## 11. Worker Specification

### 11.1 Reap Processing Worker

#### Input

* `videoId`
* `sourceUrl` or `sourceStoragePath`
* `userId`

#### Output

* Reap project created
* `reapProjectId` stored in database
* Video status updated to `processing_in_reap`

#### Failure Cases

* Reap API key invalid.
* Upload failed.
* API rate limit exceeded (10 req/min).
* Storage download/upload failed.

#### Retry Policy

* Max retry: 3
* Retry delay: 5 minutes

---

### 11.2 Reap Polling Worker

#### Input

* `videoId`
* `reapProjectId`
* `userId`

#### Output

* Clips downloaded from Reap
* Clip files uploaded to storage
* `Clip` records created in database
* Video status updated to `ready_to_upload`

#### Failure Cases

* Reap project failed.
* Reap project returned 0 clips.
* Clip download failed.
* Storage upload failed.

#### Polling Configuration

* Initial delay: 15 minutes
* Poll interval: 5 minutes
* Max attempts: 24 (~2 hours)
* Clip download retry: 3

---

### 11.3 Reap Publish Worker (TikTok)

#### Input

* `clipId`
* `uploadTargetId`
* `userId`

#### Output

* Reap post created
* Upload status updated
* TikTok URL stored if available

#### Failure Cases

* No active TikTok integration.
* Reap API error.
* TikTok rejected the upload.

#### Retry Policy

* Max retry: 3
* Retry delay: 5 minutes

---

## 12. Security Requirements

* User hanya dapat melihat task miliknya sendiri.
* Storage private by default.
* Signed URL digunakan untuk preview/download.
* Reap API key tidak disimpan di frontend.
* Semua API endpoint membutuhkan authentication.
* Jangan expose API key di frontend.

---

## 13. Logging & Observability

### Required Logs

* Task created.
* Worker started.
* Reap project created.
* Webhook received.
* Clip download started.
* Storage upload completed.
* Reap publish started.
* Publish completed.
* Error details.

---

## 14. Edge Cases

* Video URL tidak bisa diakses.
* Video terlalu panjang.
* Video terlalu besar (>500MB).
* Video tidak memiliki audio.
* Reap tidak menghasilkan clip.
* Reap project expired atau invalid.
* Storage penuh.
* Upload platform ditolak karena copyright/policy.
* Caption kosong.
* User disconnect akun TikTok saat upload berjalan.
* Worker crash saat proses berjalan.

---

## 15. MVP Development Phases

### Phase 1 — Core Dashboard & Task

Deliverables:

* Auth.
* Add video URL.
* Video task list.
* Database schema.
* Queue setup.

### Phase 2 — Storage & Worker Foundation

Deliverables:

* Upload file to storage.
* Worker service.
* Job status update.
* Logging.

### Phase 3 — Reap API Integration

Deliverables:

* Reap API client.
* Upload source to Reap.
* Create clips project.
* Store reapProjectId.

### Phase 4 — Clip Download & Review

Deliverables:

* Webhook handler.
* Polling worker fallback.
* Download clips from Reap.
* Save clips to storage.
* Clip list dan preview.
* Edit title/caption/hashtag.
* Generate caption dengan LLM.

### Phase 5 — Reap Publish (TikTok)

Deliverables:

* Connect TikTok account di Reap dashboard.
* Upload clip ke TikTok via Reap Publish.
* Send caption/description metadata.
* Save uploaded TikTok URL atau platform response.
* Retry TikTok upload.

### Phase 6 — Hardening

Deliverables:

* Retry policy.
* Worker health check.
* Rate limiting.
* Manual fallback.
* README dan setup docs.

---

## 16. Acceptance Criteria for MVP

MVP diterima jika:

1. User dapat login dan membuka dashboard.
2. User dapat menambahkan video URL atau upload file.
3. Sistem membuat task video.
4. Worker mengambil task dari queue.
5. Worker dapat mengirim video ke Reap API.
6. Webhook atau polling dapat mengambil hasil clip.
7. Clip tersimpan di storage.
8. User dapat melihat hasil clip di dashboard.
9. User dapat mengedit caption/title.
10. User dapat mengunggah clip ke TikTok melalui Reap Publish.
11. User dapat melihat status upload.
12. Task gagal dapat diretry.
13. Error utama tersimpan di log.

---

## 17. Recommended Initial Build Order

Urutan paling aman untuk development:

1. Buat database schema.
2. Buat Web UI sederhana untuk submit video.
3. Buat backend API untuk membuat video task.
4. Buat queue dan worker dummy.
5. Buat storage upload/download.
6. Integrasikan Reap API client.
7. Simpan hasil clip ke storage.
8. Buat page clip review.
9. Integrasikan Reap Publish untuk upload TikTok.
10. Tambahkan retry dan logging.
11. Tambahkan caption generation.

---

## 18. Open Questions

Beberapa keputusan yang masih perlu ditentukan:

1. Platform upload MVP sudah ditentukan: TikTok terlebih dahulu.
2. Storage yang digunakan: Supabase Storage, S3, atau Cloudflare R2?
3. Apakah user perlu approval sebelum upload otomatis?
4. Apakah caption dibuat otomatis sebelum user review atau langsung dipakai?
5. Apakah video input hanya URL atau juga file upload sejak MVP?
6. Apakah produk ini untuk penggunaan pribadi/internal atau akan menjadi SaaS publik?
7. Apakah perlu sistem scheduling upload?

---

## 19. Final Recommendation

Untuk MVP saat ini, gunakan pendekatan berikut:

```text
Web UI + Backend API + Database + Queue
         ↓
Reap API untuk pembuatan clip
         ↓
Webhook / Polling untuk download hasil
         ↓
Storage untuk hasil clip
         ↓
Reap Publish API untuk upload ke TikTok
```

Pendekatan ini lebih stabil daripada Playwright automation karena menggunakan API resmi. Sistem dibuat modular agar integrasi Reap dapat diganti dengan platform clipping lain di masa depan tanpa mengubah keseluruhan produk.

# PROJECT_BRIEF.md — AI Automation Video Clipper

## Product Summary

AI Automation Video Clipper adalah aplikasi web untuk membantu user memproses daftar video menjadi short clips menggunakan Reap API, menyimpan hasil clip ke storage, lalu mengunggah clip ke TikTok menggunakan Reap Publish API.

Untuk MVP, sistem menggunakan Reap REST API untuk pembuatan clip dan Reap Publish untuk upload ke TikTok. Tidak lagi menggunakan Playwright browser automation atau Composio.

## MVP Focus

MVP hanya fokus pada:
- Input video URL atau upload file video.
- Membuat video task.
- Queue processing.
- Reap API Worker untuk pembuatan clip.
- Webhook atau polling untuk download hasil clip.
- Menyimpan hasil clip ke storage.
- Preview hasil clip.
- Edit title/caption/hashtag.
- Upload hasil clip ke TikTok menggunakan Reap Publish.
- Retry task gagal.
- Basic logging.

## Non-Goals

MVP tidak mencakup:
- Membuat model AI clipping sendiri.
- Upload ke YouTube Shorts.
- Upload ke Instagram Reels.
- Multi-tenant enterprise.
- Payment/subscription.
- Playwright browser automation.
- Composio integration.

## Recommended Tech Stack

Frontend:
- Next.js
- TypeScript
- Tailwind CSS

Backend:
- Next.js Route Handlers

Database:
- PostgreSQL
- Prisma ORM

Queue:
- Redis
- BullMQ

Clip Generation:
- Reap API (REST)

Storage:
- Storage service abstraction
- Initial target: Supabase Storage atau Cloudflare R2

Uploader:
- Reap Publish API (TikTok integration)

Auth:
- NextAuth placeholder for MVP

## System Architecture

```text
Client
→ Web UI
→ Backend API
→ Database + Queue
→ Reap Processing Worker
→ Webhook Handler / Polling Worker
→ Storage
→ Reap Publish Worker
→ TikTok
```

## Core Status Lifecycle

Video status:
- pending
- queued
- uploading_to_reap
- processing_in_reap
- downloading_from_reap
- storing_clips
- generating_caption
- ready_to_upload
- uploading_to_tiktok
- completed
- failed
- cancelled

Clip status:
- created
- stored
- ready_to_upload
- uploading
- uploaded
- failed

Upload status:
- queued
- uploading
- publishing
- completed
- failed
- cancelled

## Required Pages

1. Dashboard
2. Add Video
3. Video Task List
4. Video Detail
5. Clip Review
6. Integration Settings

## Required API Routes

POST /api/videos
GET /api/videos
GET /api/videos/:id
POST /api/videos/:id/retry
POST /api/videos/:id/poll
PATCH /api/clips/:id
POST /api/clips/:id/upload
POST /api/reap/webhook
GET /api/reap/integrations

## Required Database Models

- User
- Video
- Clip
- UploadTarget
- Job
- Log

## MVP Development Phases

Phase 1:
- Project scaffold
- Prisma schema
- Basic dashboard
- Video submission page
- API skeleton

Phase 2:
- Redis + BullMQ
- Worker skeleton
- Job status update

Phase 3:
- Storage service
- File upload support
- Clip storage abstraction

Phase 4:
- Reap API client
- Reap processing worker
- Webhook handler
- Polling worker fallback
- Download/store clips

Phase 5:
- Clip preview
- Edit caption/title/hashtag
- Caption generation placeholder

Phase 6:
- Reap Publish (TikTok)
- Upload status tracking
- Retry upload

Phase 7:
- Logging
- Worker health check
- README and setup docs

Phase 8:
- UI updates
- Integration settings page
- Status badge updates
- Final cleanup

## Important Constraints

- Do not hardcode secrets.
- Do not expose API keys to frontend.
- Keep Reap API module replaceable by future clip generation service.
- Keep Reap Publish module replaceable by future upload service.
- Implement each phase incrementally.
- Respect Reap rate limit (10 requests per minute per API key).
