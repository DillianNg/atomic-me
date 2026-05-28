# Upload feature (Phase 5)

Flow upload tu FE -> presigned URL -> R2 -> confirm. Khong qua BE proxy.

## Kien truc

```
UploadPage (pages/upload.tsx)
  +-- UploadDropzone        (click hoac drag-drop)
  +-- FilePreview           (ten, size, type)
  +-- ParseProgress         (% upload + label stage)
  `-- useUploadAsset (hook)
        +-- POST /assets/upload-url   -> assetId + presigned PUT URL
        +-- XHR PUT len R2            -> theo doi upload progress
        `-- POST /assets/confirm      -> doi status sang UPLOADED, audit log
```

## E2E manual test voi R2 that

### 1. Tao bucket R2 va token API

1. Cloudflare Dashboard -> R2 -> Create bucket: `atomic-me-assets` (hoac ten khac).
2. R2 -> Manage R2 API Tokens -> Create API Token voi `Object Read & Write`.
   Luu lai Account ID, Access Key ID, Secret Access Key.

### 2. Cau hinh CORS cho bucket

Vao bucket -> Settings -> CORS Policy, dan:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-vercel-domain.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3000
  }
]
```

Khong them `*` cho `AllowedOrigins` o production (chi cho dev preview).

### 3. Dien env

Trong `.env` o repo root (BE doc qua `--env-file=../../.env`):

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=atomic-me-assets
```

Trong `apps/web/.env.local`:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE_URL=http://localhost:3001
```

### 4. Chay app

```
pnpm dev
```

Dang nhap Clerk, vao trang /upload. Drag mot file PDF/DOCX/image <= 25 MB. Quan sat:

- DB: bang Asset xuat hien record voi `status` = `PENDING` ngay sau khi xin URL,
  doi thanh `UPLOADED` sau khi confirm.
- R2: object xuat hien tai key `users/{userId}/assets/{assetId}/{filename_sanitized}`.
- AuditLog: 1 row voi `action = 'ASSET_UPLOADED'`, `entityType = 'Asset'`.

### Cac case loi can verify thu cong

| Case | Ket qua mong doi |
|------|------------------|
| File > 25 MB | FE chan ngay, BE tra 400 neu bypass (sizeBytes lon hon limit) |
| MIME khong support (vd `video/mp4`) | FE chan, BE tra 400 (ZodError VALIDATION_ERROR) |
| Khong co token | BE tra 401 UNAUTHORIZED |
| Goi 21 lan /upload-url trong 1 phut | Lan 21 tra 429 RATE_LIMITED |
| Goi /confirm voi assetId nguoi khac | BE tra 404 NOT_FOUND (khong leak) |
| Goi /confirm 2 lan voi cung asset | Lan 2 idempotent, ket qua nhat quan |

### Limit hien tai

- `MAX_FILE_SIZE_MB = 25` (xem `packages/shared/src/constants/limits.ts`).
- `MAX_ASSETS_PER_USER = 50`.
- Rate limit: 20 req/phut/user (in-memory; production multi-instance can store rieng).
- Presigned URL TTL: 5 phut.

### Phase 6 hook

`ParseProgress` da co cho de noi tiep parse status (PARSING / PARSED / FAILED).
Webhook hoac polling cua Phase 6 se update `Asset.status` va FE invalidate query.
