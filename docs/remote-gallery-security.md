# Remote Gallery Security Policy (Revised)

This document outlines the security boundaries, authorization checks, RLS policies, rate limiting, and cryptographic controls implemented in the Remote Gallery system.

---

## 1. Explicit Consent & Authorization Boundary

The Remote Gallery system is strictly for explicitly authorized personal devices:
* **Explicit Android Permission**: Media metadata indexing is only activated when the user explicitly grants photo/media access to the Calendar app (intercepted on the Chat → Photo action).
* **Account/Device Association**: A device is linked to the authenticated user account that is logged in. Admins cannot arbitrarily query devices across accounts unless they view the account's details in the Admin Panel.
* **No Service Role Keys on Client**: Service role credentials are never shipped to the Android client. Database changes bypass RLS only through secure, server-side API routes.

---

## 2. Multi-Layer Authorization Checks

Verification is implemented at multiple layers to prevent privilege escalation:
* **Client UI (React Router)**: Enforces `is_admin === true` on mount for `/admin`, displaying a redirect layout for unauthorized users.
* **Database (RLS Policies)**: `is_admin()` helper checks the user profile configuration to grant/deny database requests.
* **Server-Side API Routes**: Re-verifies access token and checks database `is_admin` flag on all `/api/admin/*` paths:
```typescript
const supabase = await createClient()
const isAdmin = await isAdminServer(supabase)
if (!isAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## 3. Auditing

Every sensitive operation creates a detailed audit entry:
* **Logs Generated**:
  * `DEVICE_REGISTER`: Logged when a device calls `/api/device/register`.
  * `DEVICE_REMOVE`: Logged when an admin removes/deletes a registered device.
  * `DEVICE_VIEW` / `GALLERY_OPEN`: Logged when an admin accesses device details or media list.
* **Sensitive Data Redaction**: Passwords, tokens, pairing secrets, and image data are strictly banned from inclusion in the audit logs.
