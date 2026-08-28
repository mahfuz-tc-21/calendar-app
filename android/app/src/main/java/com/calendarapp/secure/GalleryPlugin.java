package com.calendarapp.secure;

import android.Manifest;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

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
public class GalleryPlugin extends Plugin {
    private static final String TAG = "GalleryPlugin";

    private String getRequiredPermissionAlias() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return "gallery_tiramisu";
        }
        return "gallery";
    }

    private boolean hasRequiredPermission() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return context.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
        }
        return context.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasRequiredPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasRequiredPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        String alias = getRequiredPermissionAlias();
        requestPermissionForAlias(alias, call, "permissionCallback");
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", hasRequiredPermission() ? "granted" : "prompt");
        call.resolve(ret);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasRequiredPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void listMedia(PluginCall call) {
        if (!hasRequiredPermission()) {
            call.reject("Photo access permission is required.");
            return;
        }

        int limit = call.getInt("limit", 100);
        int offset = call.getInt("offset", 0);

        JSArray mediaList = new JSArray();
        String[] projection = {
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT,
            MediaStore.Images.Media.SIZE,
            MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.DATE_MODIFIED
        };

        Uri uri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        String sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC LIMIT " + limit + " OFFSET " + offset;

        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(
                uri,
                projection,
                null,
                null,
                sortOrder
            );

            if (cursor != null && cursor.moveToFirst()) {
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE);
                int widthCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH);
                int heightCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT);
                int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE);
                int dateAddedCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED);
                int dateModCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_MODIFIED);

                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));

                do {
                    long id = cursor.getLong(idCol);
                    String name = cursor.getString(nameCol);
                    String mime = cursor.getString(mimeCol);
                    int width = cursor.getInt(widthCol);
                    int height = cursor.getInt(heightCol);
                    long size = cursor.getLong(sizeCol);
                    long dateAddedSec = cursor.getLong(dateAddedCol);
                    long dateModSec = cursor.getLong(dateModCol);

                    String createdAt = sdf.format(new Date(dateAddedSec * 1000));
                    String modifiedAt = sdf.format(new Date(dateModSec * 1000));

                    JSObject item = new JSObject();
                    item.put("mediaStoreId", String.valueOf(id));
                    item.put("fileName", name != null ? name : "unknown");
                    item.put("mimeType", mime != null ? mime : "image/jpeg");
                    item.put("width", width);
                    item.put("height", height);
                    item.put("size", size);
                    item.put("createdAt", createdAt);
                    item.put("modifiedAt", modifiedAt);
                    item.put("mediaType", "image");

                    mediaList.put(item);
                } while (cursor.moveToNext());
            }

            JSObject result = new JSObject();
            result.put("media", mediaList);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error querying MediaStore", e);
            call.reject("Failed to query MediaStore: " + e.getMessage());
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }

    @PluginMethod
    public void getThumbnail(PluginCall call) {
        if (!hasRequiredPermission()) {
            call.reject("Photo access permission is required.");
            return;
        }

        String mediaStoreIdStr = call.getString("mediaId");
        if (mediaStoreIdStr == null || mediaStoreIdStr.isEmpty()) {
            call.reject("mediaId is required");
            return;
        }

        try {
            long mediaStoreId = Long.parseLong(mediaStoreIdStr);
            Uri contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaStoreId);
            Bitmap bitmap = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    bitmap = getContext().getContentResolver().loadThumbnail(
                        contentUri,
                        new android.util.Size(200, 200),
                        null
                    );
                } catch (Exception e) {
                    Log.w(TAG, "loadThumbnail failed, falling back to legacy", e);
                }
            }

            if (bitmap == null) {
                // Fallback for API < 29
                bitmap = MediaStore.Images.Thumbnails.getThumbnail(
                    getContext().getContentResolver(),
                    mediaStoreId,
                    MediaStore.Images.Thumbnails.MINI_KIND,
                    null
                );
            }

            if (bitmap == null) {
                call.reject("Thumbnail not available for id: " + mediaStoreIdStr);
                return;
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 70, outputStream);
            byte[] bytes = outputStream.toByteArray();
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

            JSObject result = new JSObject();
            result.put("base64", base64);
            result.put("mimeType", "image/jpeg");
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error loading thumbnail", e);
            call.reject("Failed to load thumbnail: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getMedia(PluginCall call) {
        if (!hasRequiredPermission()) {
            call.reject("Photo access permission is required.");
            return;
        }

        String mediaStoreIdStr = call.getString("mediaId");
        if (mediaStoreIdStr == null || mediaStoreIdStr.isEmpty()) {
            call.reject("mediaId is required");
            return;
        }

        InputStream inputStream = null;
        try {
            long mediaStoreId = Long.parseLong(mediaStoreIdStr);
            Uri contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaStoreId);

            // Determine mime type
            String mimeType = getContext().getContentResolver().getType(contentUri);
            if (mimeType == null) {
                mimeType = "image/jpeg";
            }

            inputStream = getContext().getContentResolver().openInputStream(contentUri);
            if (inputStream == null) {
                call.reject("Failed to open input stream for media item");
                return;
            }

            // Decode dimensions first to see if we should scale it down
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeStream(inputStream, null, options);
            inputStream.close();

            // Re-open stream
            inputStream = getContext().getContentResolver().openInputStream(contentUri);

            int width = options.outWidth;
            int height = options.outHeight;

            // Maximum bounds for Remote Gallery image transfer to prevent OOM
            int maxDimension = 1600;
            int scale = 1;
            if (width > maxDimension || height > maxDimension) {
                int max = Math.max(width, height);
                scale = Math.round((float) max / (float) maxDimension);
            }

            BitmapFactory.Options decodeOptions = new BitmapFactory.Options();
            decodeOptions.inSampleSize = scale;
            Bitmap bitmap = BitmapFactory.decodeStream(inputStream, null, decodeOptions);
            inputStream.close();

            if (bitmap == null) {
                call.reject("Failed to decode media bitmap");
                return;
            }

            // Compress to JPEG with 80% quality
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream);
            byte[] bytes = outputStream.toByteArray();
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

            JSObject result = new JSObject();
            result.put("base64", base64);
            result.put("mimeType", mimeType);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error retrieving media", e);
            call.reject("Failed to load media item: " + e.getMessage());
        } finally {
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (Exception e) {
                    // Silently ignore
                }
            }
        }
    }
}
