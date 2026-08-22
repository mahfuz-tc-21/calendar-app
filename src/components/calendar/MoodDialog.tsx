'use client'

import React, { useState, useEffect } from 'react'
import { X, Trash2, Loader2, Heart } from 'lucide-react'
import { DailyMood } from '@/hooks/useMood'

interface MoodDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (mood: DailyMood['mood'], note: string | null) => Promise<any>
  onDelete?: () => Promise<boolean>
  selectedDate: string // YYYY-MM-DD
  existingMood: DailyMood | null
}

const MOODS_OPTIONS: { value: DailyMood['mood']; emoji: string; label: string; color: string }[] = [
  { value: 'great', emoji: '😊', label: 'Great', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  { value: 'good', emoji: '🙂', label: 'Good', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'okay', emoji: '😐', label: 'Okay', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  { value: 'bad', emoji: '😔', label: 'Bad', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  { value: 'difficult', emoji: '😞', label: 'Difficult', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
]

export default function MoodDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedDate,
  existingMood,
}: MoodDialogProps) {
  const [selectedMood, setSelectedMood] = useState<DailyMood['mood'] | null>(null)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (existingMood) {
        setSelectedMood(existingMood.mood)
        setNote(existingMood.note || '')
      } else {
        setSelectedMood(null)
        setNote('')
      }
    }
  }, [isOpen, existingMood])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!selectedMood) return
    setIsSaving(true)
    const result = await onSave(selectedMood, note.trim() || null)
    setIsSaving(false)
    if (result) {
      onClose()
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirm('Are you sure you want to delete this check-in?')) return

    setIsDeleting(true)
    const success = await onDelete()
    setIsDeleting(false)
    if (success) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              How was your day?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-left">
          {/* Date Indicator */}
          <div className="text-xs text-muted-foreground font-semibold">
            Checking in for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}
          </div>

          {/* Mood Selectors */}
          <div className="grid grid-cols-5 gap-2">
            {MOODS_OPTIONS.map((opt) => {
              const isSelected = selectedMood === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedMood(opt.value)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer select-none active:scale-95 ${
                    isSelected
                      ? 'bg-primary border-primary text-primary-foreground scale-105 shadow-md font-bold'
                      : 'bg-card border-border text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className={`text-[9px] mt-1 tracking-tight truncate ${isSelected ? 'text-white' : 'text-muted-foreground font-medium'}`}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Short Note Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="mood-note">
              Short Notes
            </label>
            <input
              id="mood-note"
              type="text"
              placeholder="e.g. Productive day, felt tired but happy"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/40">
          <div>
            {existingMood && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting || !selectedMood}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Check-in
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
