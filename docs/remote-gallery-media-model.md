# Remote Gallery Media Metadata Model & Sync Strategy

This document details the database representation of media items, metadata structures, and the incremental background synchronization flow.

---

## 1. Media Metadata Table Schema

The `media_metadata` table caches device media catalogs on the server without storing raw image binary data. It is defined in [migration-remote-gallery-phase2.sql](file:///D:/Mahfuz/Project/calendar%20app/scripts/migration-remote-gallery-phase2.sql):

```sql
CREATE TABLE IF NOT EXISTS public.media_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  media_store_id TEXT NOT NULL, -- Native MediaStore primary ID
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(device_id, media_store_id)
);
```

---

## 2. Foreground Incremental Sync Flow

Rather than executing continuous background scanner threads that drain batteries and trigger background process kills, the sync routine runs primarily during active user sessions:

```
[ App Launch / App Resume (Foreground) ]
                 │
                 ▼
[ Verify Device Authorization in DB ]
                 │
                 ▼
[ Verify Gallery Permission is Granted ]
                 │
                 ▼
[ Query MediaStore listMedia(limit: 200) ]
                 │
                 ▼
[ POST /api/device/media/sync Payload ]
                 │
                 ▼
[ Upsert DB Rows & Reconcile Deletions ]
```

---

## 3. Delete Reconciliation Algorithm

When a batch of media items is received, the server reconciles deleted files:
1. Calculates the minimum and maximum modification times (`modified_at`) across the payload items.
2. Selects all cached database metadata entries for this device that fall within this date range.
3. Compares the database keys against the payload MediaStore IDs.
4. Any cached record in the database that falls within this date range but is missing from the payload is determined to have been deleted from the device and is deleted from the `media_metadata` table.
5. This ensures the dashboard list remains accurate, removing items that are deleted on-device.
