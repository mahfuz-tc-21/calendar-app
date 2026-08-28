# Remote Gallery Database Schema (Revised)

This document provides details on the database tables, indexes, constraints, and Row Level Security (RLS) policies implemented for the Remote Gallery System.

---

## 1. Tables

### A. `public.profiles`
Contains user identity status:
* `id` (`uuid`, `PRIMARY KEY`, references `auth.users` on delete cascade): Profile UUID.
* `username` (`text`, `UNIQUE`, `NOT NULL`): Handle.
* `display_name` (`text`): Public display name.
* `avatar_url` (`text`): URL to avatar image.
* `is_admin` (`boolean`, `NOT NULL`, default `false`): Controls administrative status.
* `last_seen` (`timestamp with time zone`): Last sync timestamp.

### B. `public.devices`
Contains registered client installations linked to logged-in accounts:
* `id` (`uuid`, `PRIMARY KEY`, default `gen_random_uuid()`): Unique device database ID.
* `user_id` (`uuid`, references `profiles(id)` on delete cascade): Owner user profile.
* `device_id` (`text`, `UNIQUE`, `NOT NULL`): Client-persisted unique hardware ID.
* `device_name` (`text`, `NOT NULL`): Human-readable device label.
* `device_model` (`text`, `NOT NULL`): Native device model.
* `platform` (`text`, `NOT NULL`): OS platform (e.g. `'android'`, `'web'`).
* `os_version` (`text`, `NOT NULL`): Operating system version.
* `app_version` (`text`, `NOT NULL`): App compilation version.
* `is_online` (`boolean`, `NOT NULL`, default `false`): Current online state.
* `last_seen` (`timestamp with time zone`, default `now()`): Last heartbeat sync date.
* `created_at` (`timestamp with time zone`, default `now()`): Creation date.
* `updated_at` (`timestamp with time zone`, default `now()`): Last modification date.

### C. `public.media_metadata`
Caches device media metadata catalog elements:
* `id` (`uuid`, `PRIMARY KEY`, default `gen_random_uuid()`): Metadata ID.
* `device_id` (`uuid`, references `devices(id)` on delete cascade): Device UUID.
* `media_store_id` (`text`, `NOT NULL`): Native Android MediaStore ID.
* `file_name` (`text`, `NOT NULL`): Filename.
* `mime_type` (`text`, `NOT NULL`): MIME type.
* `width` (`integer`): Image width.
* `height` (`integer`): Image height.
* `size` (`bigint`): File size in bytes.
* `created_at` (`timestamp with time zone`): Date taken.
* `modified_at` (`timestamp with time zone`): Last modification time.
* `media_type` (`text`, default `'image'`): Content type (`'image'`, `'video'`).
* `indexed_at` (`timestamp with time zone`, default `now()`): Indexing timestamp.
* *Constraint*: `UNIQUE(device_id, media_store_id)`

### D. `public.audit_logs`
Records administrative events:
* `id` (`uuid`, `PRIMARY KEY`, default `gen_random_uuid()`): Log ID.
* `admin_user_id` (`uuid`, references `profiles(id)` on delete set null): Admin who executed the action.
* `action` (`text`, `NOT NULL`): Action tag (e.g. `DEVICE_REMOVE`, `DEVICE_VIEW`, `GALLERY_OPEN`).
* `target_user_id` (`uuid`, references `profiles(id)` on delete set null): Targeted user account.
* `target_device_id` (`uuid`, references `devices(id)` on delete set null): Targeted device record.
* `metadata` (`jsonb`): Dynamic metadata.
* `created_at` (`timestamp with time zone`, default `now()`): Creation date.

---

## 2. Performance Indexes

* `idx_devices_user_id` on `devices(user_id)`
* `idx_devices_is_online` on `devices(is_online)`
* `idx_devices_last_seen` on `devices(last_seen)`
* `idx_media_metadata_device_id` on `media_metadata(device_id)`
* `idx_media_metadata_media_store_id` on `media_metadata(media_store_id)`
* `idx_audit_logs_created_at` on `audit_logs(created_at)`

---

## 3. Row Level Security (RLS)

* **Devices**:
  * Users can read/write their own devices: `user_id = auth.uid()`
  * Admins can select/update all devices: `is_admin()` helper returns true.
* **Media Metadata**:
  * Only admins can select/insert/update/delete media metadata rows.
* **Audit Logs**:
  * Only admins can select logs.
