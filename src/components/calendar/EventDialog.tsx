'use client'

import React, { useState, useEffect } from 'react'
import { X, Trash2, Calendar, Clock, Loader2 } from 'lucide-react'
import { CalendarEvent } from '@/hooks/useCalendar'

interface EventDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (eventData: any) => Promise<any>
  onDelete?: (id: string) => Promise<boolean>
  selectedDate: string // YYYY-MM-DD
  editingEvent: CalendarEvent | null
}

export default function EventDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedDate,
  editingEvent,
}: EventDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [hasTime, setHasTime] = useState(false)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingEvent) {
        setTitle(editingEvent.title)
        setDescription(editingEvent.description || '')
        setDate(editingEvent.event_date)
        if (editingEvent.start_time) {
          setHasTime(true)
          setStartTime(editingEvent.start_time.substring(0, 5))
          setEndTime(editingEvent.end_time ? editingEvent.end_time.substring(0, 5) : '')
        } else {
          setHasTime(false)
          setStartTime('09:00')
          setEndTime('10:00')
        }
      } else {
        setTitle('')
        setDescription('')
        setDate(selectedDate)
        setHasTime(false)
        setStartTime('09:00')
        setEndTime('10:00')
      }
    }
  }, [isOpen, editingEvent, selectedDate])

  if (!isOpen) return null

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSaving(true)
    const eventData = {
      title: title.trim(),
      description: description.trim() || '',
      event_date: date,
      start_time: hasTime && startTime ? startTime : null,
      end_time: hasTime && endTime ? endTime : null,
    }

    const result = await onSave(eventData)
    setIsSaving(false)
    if (result) {
      onClose()
    }
  }

  const handleDeleteClick = async () => {
    if (!editingEvent || !onDelete) return
    if (!confirm('Are you sure you want to delete this event?')) return

    setIsDeleting(true)
    const success = await onDelete(editingEvent.id)
    setIsDeleting(false)
    if (success) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editingEvent ? 'Edit Event' : 'Create Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="event-title">
              Event Title
            </label>
            <input
              id="event-title"
              type="text"
              placeholder="e.g. Design Sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="event-desc">
              Description
            </label>
            <textarea
              id="event-desc"
              placeholder="Add details, notes, or links..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="event-date">
                Date
              </label>
              <div className="relative">
                <input
                  id="event-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="flex items-end pb-3 text-left">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasTime}
                  onChange={(e) => setHasTime(e.target.checked)}
                  className="w-4.5 h-4.5 text-primary border-border bg-card rounded focus:ring-primary focus:ring-2 cursor-pointer"
                />
                <span className="text-sm font-medium text-foreground">Specify Event Time</span>
              </label>
            </div>
          </div>

          {hasTime && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="event-start">
                  Start Time
                </label>
                <div className="relative">
                  <input
                    id="event-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required={hasTime}
                    className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="event-end">
                  End Time
                </label>
                <div className="relative">
                  <input
                    id="event-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required={hasTime}
                    className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer / Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/40">
          <div>
            {editingEvent && onDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
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
              onClick={handleFormSubmit}
              disabled={isSaving || isDeleting || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Event
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
