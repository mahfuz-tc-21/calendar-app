# Remote Gallery Phase 2 Testing Manual

This document outlines the testing procedures and validation checklists for Remote Gallery Phase 2.

---

## 1. Prerequisites

Before testing:
1. Apply the Phase 2 database schema: paste and run the contents of [migration-remote-gallery-phase2.sql](file:///D:/Mahfuz/Project/calendar%20app/scripts/migration-remote-gallery-phase2.sql) in the Supabase SQL Editor.
2. Compile and compile the debug APK:
   * Run `npm run mobile:build`
   * Sync native resources: `npx cap sync android`
   * Open the project in Android Studio or compile using Gradle from command line:
     `cd android && ./gradlew assembleDebug`

---

## 2. Test Cases

### Test Case 1: Intercepted Permission Request (Chat -> Photo)
* **Action**:
  1. Log into a fresh installation of the Calendar app on a device.
  2. Enter the Private Space and open a Chat conversation.
  3. Tap the **Photo** button in the chat area, and select **Gallery** in the bottom sheet.
* **Verification**:
  * The app intercepts the action and shows the native Android permission dialog requesting access to photos/media.
  * Click **Deny**. Verify that a toast appears saying `"Photo access permission is required."` and the app gracefully stops.
  * Tap **Photo -> Gallery** again. When the dialog appears, click **Allow**. Verify that the standard Capacitor image picker opens successfully, enabling you to select and upload photos.

### Test Case 2: No Double-Prompts
* **Action**: Close the app, re-open it, enter the chat, and click **Photo -> Gallery**.
* **Verification**:
  * The standard photo picker must open immediately without prompting for permissions again.

### Test Case 3: Initial and Foreground Sync (Use Case: Paired Device)
* **Action**:
  1. Complete pairing on the device using the Admin Dashboard (from Phase 1).
  2. Once paired, ensure permissions are granted.
  3. Close and re-open the app, or put the app in the background and resume it.
* **Verification**:
  * Check the network logs or server logs. A `POST /api/device/media/sync` request must be fired.
  * Inspect the `media_metadata` table in Supabase. It must be populated with rows representing the images on the device, including dimensions, MIME types, date taken, and size.

### Test Case 4: Delete Reconciliation
* **Action**:
  1. Take a screenshot or save an image on the Android device.
  2. Open the Calendar app (triggers sync). Verify that a new row is added to the `media_metadata` table.
  3. Go to the Android Photos app and delete the screenshot.
  4. Resume or restart the Calendar app (triggers sync).
* **Verification**:
  * Inspect the `media_metadata` table. The row representing the deleted screenshot must be automatically deleted from the database table.

### Test Case 5: Native Plugin Methods (listMedia, getThumbnail, getMedia)
* **Action**: Invoke the plugin methods from the developer console (web view inspector).
* **Verification**:
  * Call `listMedia({ limit: 10, offset: 0 })`. Verify it returns an array of 10 media items with full metadata columns.
  * Call `getThumbnail({ mediaId: "..." })` using an ID from the list. Verify it returns a small compressed Base64 string.
  * Call `getMedia({ mediaId: "..." })`. Verify it returns the Base64 image payload compressed natively.
