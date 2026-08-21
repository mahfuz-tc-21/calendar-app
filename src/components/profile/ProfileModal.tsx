'use client'

import React, { useState, useEffect } from 'react'
import { X, Camera as CameraIcon, Loader2, Save, LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { useRouter } from 'next/navigation'

interface ProfileModalProps {
  onClose: () => void
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [readReceipts, setReadReceipts] = useState(true)
  const [activeStatus, setActiveStatus] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleLogoutClick = async () => {
    if (confirm('Are you sure you want to logout?')) {
      onClose()
      await signOut()
    }
  }



  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setUsername(profile.username || '')
      setAvatarUrl(profile.avatar_url || '')
      setReadReceipts(profile.read_receipts_enabled !== false)
      setActiveStatus(profile.active_status_enabled !== false)
    }
  }, [profile])

  const handleSelectAvatar = async () => {
    if (!user) return
    setIsUploading(true)

    try {
      const image = await Camera.getPhoto({
        quality: 70,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      })

      if (!image || !image.dataUrl) {
        setIsUploading(false)
        return
      }

      const response = await fetch(image.dataUrl)
      const blob = await response.blob()
      
      const fileExt = image.format || 'jpeg'
      const path = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      setAvatarUrl(publicUrl)
      showToast('Avatar uploaded successfully. Click Save to apply.', 'success')
    } catch (err: any) {
      console.error('Error changing avatar:', err)
      showToast(err.message || 'Failed to update avatar photo', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || isSaving) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
          read_receipts_enabled: readReceipts,
          active_status_enabled: activeStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      showToast('Profile updated successfully', 'success')
      onClose()
    } catch (err: any) {
      console.error('Error updating profile:', err)
      showToast(err.message || 'Failed to update profile settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200" onClick={onClose}>
      
      <div
        className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-6 animate-in zoom-in-95 duration-200 border border-gray-150 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-gray-900 leading-tight">Edit Profile</h2>
          <p className="text-xs text-gray-500">Update your profile information and privacy settings.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center select-none uppercase font-bold text-gray-400 text-3xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  (displayName || username || 'U').substring(0, 2)
                )}
              </div>
              <button
                type="button"
                onClick={handleSelectAvatar}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full border-2 border-white hover:bg-blue-600 shadow-md cursor-pointer transition-transform duration-100 hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CameraIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Change Avatar
            </span>
          </div>

          <div className="space-y-3.5 max-h-[30vh] overflow-y-auto pr-1">
            <div className="flex flex-col gap-1 text-left">
              <label htmlFor="displayNameInput" className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                Display Name
              </label>
              <input
                id="displayNameInput"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.substring(0, 50))}
                placeholder="John Doe"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder:text-gray-400 leading-snug"
              />
            </div>

            <div className="flex flex-col gap-1 text-left">
              <label htmlFor="usernameInput" className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                Username
              </label>
              <input
                id="usernameInput"
                type="text"
                value={username}
                disabled
                placeholder="johndoe"
                className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-450 cursor-not-allowed leading-snug font-mono select-none"
              />
            </div>

            <div className="flex flex-col gap-3 text-left border-t border-gray-100 pt-4">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                Privacy Settings
              </span>
              
              <div className="flex items-start justify-between gap-3 p-1">
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="readReceiptsCheckbox" className="text-sm font-semibold text-gray-800">
                    Read Receipts
                  </label>
                  <p className="text-[10px] text-gray-500 leading-tight">
                    Let others know when you've read their messages.
                  </p>
                </div>
                <input
                  id="readReceiptsCheckbox"
                  type="checkbox"
                  checked={readReceipts}
                  onChange={(e) => setReadReceipts(e.target.checked)}
                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer mt-1 shrink-0"
                />
              </div>

              <div className="flex items-start justify-between gap-3 p-1">
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="activeStatusCheckbox" className="text-sm font-semibold text-gray-800">
                    Active Status
                  </label>
                  <p className="text-[10px] text-gray-500 leading-tight">
                    Let others see when you're active.
                  </p>
                </div>
                <input
                  id="activeStatusCheckbox"
                  type="checkbox"
                  checked={activeStatus}
                  onChange={(e) => setActiveStatus(e.target.checked)}
                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer mt-1 shrink-0"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleLogoutClick}
              className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors cursor-pointer border border-red-200 flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 active:bg-gray-100 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isUploading || !username.trim()}
                className="flex-1 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md cursor-pointer transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save</span>
              </button>
            </div>
          </div>

        </form>

      </div>

    </div>
  )
}
