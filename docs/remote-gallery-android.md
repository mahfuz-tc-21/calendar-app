# Remote Gallery Android Plugin Integration (Phase 2)

This document provides details on the native Android implementation, Target SDK compatibility, and permissions configuration for the Remote Gallery plugin.

---

## 1. Native Capacitor Plugin (`GalleryPlugin`)

The custom native plugin `GalleryPlugin.java` is registered with Capacitor using the `@CapacitorPlugin(name = "Gallery")` annotation. It is located at [GalleryPlugin.java](file:///D:/Mahfuz/Project/calendar%20app/android/app/src/main/java/com/calendarapp/secure/GalleryPlugin.java).

### Permission Declarations
The plugin maps permissions based on the active API level:
```java
@CapacitorPlugin(
    name = "Gallery",
    permissions = {
        @Permission(
            alias = "gallery",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        ),
        @Permission(
            alias = "gallery_tiramisu",
            strings = {
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            }
        )
    }
)
```

---

## 2. API Level Compatibility

The plugin supports Android APIs from Min SDK `24` up to Target SDK `36`:
* **Android 13+ (API >= 33 / Tiramisu)**:
  * Utilizes `Manifest.permission.READ_MEDIA_IMAGES` and `Manifest.permission.READ_MEDIA_VIDEO`.
  * Loads thumbnails using `contentResolver.loadThumbnail(contentUri, size, signal)`.
* **Android 12- (API < 33)**:
  * Utilizes the legacy `Manifest.permission.READ_EXTERNAL_STORAGE`.
  * Loads thumbnails via `MediaStore.Images.Thumbnails.getThumbnail(...)`.

---

## 3. Querying MediaStore (Pagination)

The `listMedia` method queries `MediaStore.Images.Media.EXTERNAL_CONTENT_URI` to list device files:
* Sorts by `DATE_ADDED DESC`.
* Implements pagination using a limit/offset query structure appended directly to the `sortOrder` parameter (e.g. `date_added DESC LIMIT 100 OFFSET 0`). This ensures backward compatibility with all Android versions.
* Fetches key metadata without reading high-resolution image binaries into device memory.

---

## 4. Media Retrieve & Compression Safeguards

To prevent bridge choke and `OutOfMemoryError` failures when retrieving media:
* **Image Compression**: `getMedia` and `getThumbnail` decode images and compress them to JPEG format using a quality setting of `70`-`80`%.
* **Scale Constraints**: If an image exceeds `1600px` in either dimension, it is dynamically down-scaled in native memory before serialization to Base64.
* **MIME Verification**: MIME types are retrieved dynamically from the Android `ContentResolver` to preserve correct file extensions.
