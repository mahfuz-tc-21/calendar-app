# Remote Gallery Phase 1 Testing Manual

This document outlines the testing procedures and validation checklists for Remote Gallery Phase 1.

---

## 1. Prerequisites

Before testing, verify that the database migrations have been successfully applied to your Supabase project:
1. Open the Supabase Dashboard.
2. Go to the SQL Editor.
3. Paste and run the contents of [migration-remote-gallery-phase1.sql](file:///D:/Mahfuz/Project/calendar%20app/scripts/migration-remote-gallery-phase1.sql).

---

## 2. Test Cases

### Test Case 1: Device Identity Generation & Persistence
* **Action**: Build and run the Calendar application on an Android device or Emulator.
* **Verification**:
  * Open the app, authenticate (login), and check the Console/Network tab.
  * A `POST /api/device/register` request is successfully fired with device details.
  * Inspect the `devices` table in Supabase. A record must be created with a persistent `device_id` UUID, `is_paired = false`, and matching device specifications.
  * Close and restart the app. Verify that the subsequent registration request uses the *same* `device_id` (persistence check).

### Test Case 2: Explicit Pairing Code Generation
* **Action**: Log in as an administrator (set `is_admin = true` on your profile in Supabase profiles table) and access `/admin` in your web browser.
* **Verification**:
  * Click the "Generate Pairing Code" button.
  * An 8-character code formatted as `XXXX-XXXX` is displayed.
  * Inspect the `pairing_codes` table. A record should exist with the SHA-256 hash of the code. The raw code must *not* be in the database.
  * Check the `audit_logs` table. A `DEVICE_PAIR_GENERATE` entry must exist.

### Test Case 3: Code Expiration & Single-Use Checks
* **Action**: Attempt to redeem an expired code or reuse a code.
* **Verification**:
  * Enter an invalid pairing code on the device (under Profile Settings). Verify it is rejected with a `400` error.
  * Wait 15 minutes and enter a generated code. Verify it is rejected as expired.
  * Successfully pair a device. Try entering the same code on a second device. Verify it is rejected as already used.

### Test Case 4: Rate Limiting
* **Action**: Enter 5 consecutive incorrect pairing codes on a device.
* **Verification**:
  * After the 5th attempt, verify that the subsequent attempts return `429 Too Many Requests`.
  * The user is locked out from pairing for 15 minutes.

### Test Case 5: Explicit Device Pairing Transaction
* **Action**: Generate a code on the Admin Dashboard and enter it in the app's Profile modal.
* **Verification**:
  * The modal displays "Device paired successfully!".
  * The registration card updates to show "● This device is authorized for Remote Gallery".
  * On the Admin Dashboard, reload/refresh. The device must appear under the user's account card, showing status "Online" and a "Paired" badge.
  * Check the `audit_logs` table. A `DEVICE_PAIR` entry must exist, listing the admin, user, and device.

### Test Case 6: Revoking Pairing (Unpair)
* **Action**: On the Admin Dashboard, click "Unpair" on the paired device card.
* **Verification**:
  * Confirm the prompt. The card updates, removing the "Paired" badge.
  * In the mobile app's Profile Modal, reload. The device status must update to "This device is registered but not authorized."
  * Check the `audit_logs` table. A `DEVICE_UNPAIR` entry must exist.

### Test Case 7: RLS & Administrative Guards
* **Action**: Try accessing the admin APIs and dashboards from a non-admin account.
* **Verification**:
  * Log into a non-admin account. Browse to `/admin`. Verify you are shown an "Access Denied" screen and redirected back to `/calendar`.
  * Make a direct `GET` request to `/api/admin/devices` using Postman/curl with a non-admin session header. Verify it is rejected with `403 Forbidden`.
  * Check that you cannot modify `profiles.is_admin` via standard frontend forms or client-side queries.
