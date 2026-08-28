import { createAdminClient } from '@/utils/supabase/server'
import { type SupabaseClient } from '@supabase/supabase-js'

/**
 * Checks if the currently authenticated user in the provided Supabase client is an admin.
 * Evaluates the profile's is_admin column server-side.
 */
export async function isAdminServer(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return false

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (error || !profile) return false
    return profile.is_admin === true
  } catch (err) {
    console.error('isAdminServer error:', err)
    return false
  }
}

/**
 * Writes an audit log record using the bypass-RLS admin client.
 */
export async function createAuditLog(
  adminUserId: string | null,
  action: string,
  targetUserId: string | null = null,
  targetDeviceId: string | null = null,
  metadata: Record<string, any> = {}
) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('audit_logs')
      .insert({
        admin_user_id: adminUserId,
        action,
        target_user_id: targetUserId,
        target_device_id: targetDeviceId,
        metadata
      })
    
    if (error) {
      console.error('Failed to create audit log in DB:', error.message)
    }
  } catch (err) {
    console.error('Failed to invoke createAuditLog:', err)
  }
}
