# Remote Gallery Testing Manual (Revised)

This document outlines the testing procedures and validation checklists for the Remote Gallery System.

---

## 1. Prerequisites

Before testing:
1. Apply the database schemas: paste and run the contents of [migration-remote-gallery-phase1.sql](file:///D:/Mahfuz/Project/calendar%20app/scripts/migration-remote-gallery-phase1.sql) and [migration-remote-gallery-phase2.sql](file:///D:/Mahfuz/Project/calendar%20app/scripts/migration-remote-gallery-phase2.sql) in the Supabase SQL Editor.
2. Set administrative status for your profile in the database:
   ```sql
   UPDATE public.profiles SET is_admin = true WHERE username = 'your_username';
   ```
3. Compile and compile the debug APK:
   * Run `npm run mobile:build`
   * Sync native resources: `npx cap sync android`
   * Open the project in Android Studio or compile using Gradle from command line:
     `cd android && ./gradlew assembleDebug`

---

## 2. Test Cases

### Test Case 1: Automatic Device Registration (Startup)
* **Action**: Build and run the Calendar application on an Android device or Emulator.
* **Verification**:
  * Open the app and log in.
  * Check the network tab or console. A `POST /api/device/register` request is successfully fired with device details.
  * Inspect the `devices` table in Supabase. A record must exist linking your authenticated `user_id` and the persistent `device_id` UUID.
  * Close and restart the app. Verify that the subsequent registration request uses the *same* `device_id` (persistence check).

### Test Case 2: Intercepted Permission Request (Chat -> Photo)
* **Action**:
  1. Open a Chat conversation in the Private Space.
  2. Tap the **Photo** button, and select **Gallery** in the bottom sheet.
* **Verification**:
  * The app intercepts the action and shows the native Android permission dialog requesting access to photos/media.
  * Click **Deny**. Verify that a toast appears saying `"Photo access permission is required."` and the app gracefully stops.
  * Tap **Photo -> Gallery** again. When the dialog appears, click **Allow**. Verify that the standard Capacitor image picker opens successfully.

### Test Case 3: Initial and Foreground Sync
* **Action**:
  1. Once permissions are granted, close and re-open the app, or put the app in the background and resume it.
* **Verification**:
  * A `POST /api/device/media/sync` request must be fired.
  * Inspect the `media_metadata` table in Supabase. It must be populated with rows representing the images on the device, including dimensions, MIME types, date taken, and size.

### Test Case 4: Delete Reconciliation
* **Action**:
  1. Take a screenshot on the Android device.
  2. Open the Calendar app (triggers sync). Verify that a new row is added to the `media_metadata` table.
  3. Go to the Android Photos app and delete the screenshot.
  4. Resume or restart the Calendar app (triggers sync).
* **Verification**:
  * Inspect the `media_metadata` table. The row representing the deleted screenshot must be automatically deleted from the database table.

### Test Case 5: Admin Panel drill down Hierarchy
* **Action**: Log in as an administrator and access `/admin` in your web browser.
* **Verification**:
  * **View 1: All Users** lists all registered user profiles and their device counts. Clicking a user card opens their registered devices list.
  * **View 2: User Devices** lists all registered devices for the selected user (showing online/offline presence dynamically based on last seen).
  * **View 3: Gallery** lists the cached media metadata rows (names, mime types, sizes, dimensions) for the selected device as placeholders.
  * Click the "Remove Device" button. Verify the device is deleted from the `devices` table and the view refreshes.
  * Inspect the `audit_logs` table. A `DEVICE_REMOVE` entry must exist, listing the admin, user, and device.
