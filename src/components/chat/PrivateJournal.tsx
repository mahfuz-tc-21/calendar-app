'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Calendar, Heart, Trash2, Edit, Save, X, Loader2 } from 'lucide-react'
import { useJournal, JournalEntry } from '@/hooks/useJournal'

const MOOD_EMOJIS: Record<string, string> = {
  great: '😊',
  good: '🙂',
  okay: '😐',
  bad: '😔',
  difficult: '😞',
}

export default function PrivateJournal() {
  const { entries, loading, fetchEntries, createEntry, updateEntry, deleteEntry } = useJournal()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  // Editor states
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editDate, setEditDate] = useState(() => new Date().toISOString().split('T')[0])
  const [editMood, setEditMood] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // Filter entries based on search query
  const filteredEntries = entries.filter((e) => {
    const query = searchQuery.toLowerCase()
    return (
      (e.title || '').toLowerCase().includes(query) ||
      e.content.toLowerCase().includes(query)
    );
  })

  const openCreateEditor = () => {
    setEditingEntry(null)
    setEditTitle('')
    setEditContent('')
    setEditDate(new Date().toISOString().split('T')[0])
    setEditMood(null)
    setIsEditorOpen(true)
  }

  const openEditEditor = (entry: JournalEntry) => {
    setEditingEntry(entry)
    setEditTitle(entry.title || '')
    setEditContent(entry.content)
    setEditDate(entry.entry_date)
    setEditMood(entry.mood)
    setIsEditorOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editContent.trim()) return

    setSaving(true)
    const payload = {
      title: editTitle.trim() || null,
      content: editContent.trim(),
      entry_date: editDate,
      mood: editMood,
    }

    let success = false
    if (editingEntry) {
      const res = await updateEntry(editingEntry.id, payload)
      success = !!res
    } else {
      const res = await createEntry(payload)
      success = !!res
    }

    setSaving(false)
    if (success) {
      setIsEditorOpen(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this journal entry?')) return
    const success = await deleteEntry(id)
    if (success && isEditorOpen) {
      setIsEditorOpen(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 relative select-none">
      {/* Search & Actions Bar */}
      <div className="p-4 border-b border-border flex items-center gap-3 bg-card shadow-xs shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search journal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        <button
          onClick={openCreateEditor}
          className="flex items-center gap-1 px-3.5 py-2 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      {/* Entry Listing */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar min-h-0 pb-20">
        {loading && entries.length === 0 ? (
          <div className="py-12 flex justify-center text-sm text-muted-foreground animate-pulse">
            Decrypting journal vault...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground italic">
            {searchQuery ? 'No matching entries found' : 'Your journal is empty. Write your first secure entry!'}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => openEditEditor(entry)}
              className="p-4 bg-card border border-border rounded-2xl hover:border-primary/40 hover:bg-secondary/15 transition-all cursor-pointer text-left space-y-2 relative group"
            >
              {/* Entry metadata */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-primary text-[10px] font-bold bg-blue-500/10 dark:bg-blue-500/25 px-2.5 py-0.5 rounded-full">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(entry.entry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                </div>
                {entry.mood && (
                  <span className="text-sm" title={`Feeling: ${entry.mood}`}>
                    {MOOD_EMOJIS[entry.mood] || ''}
                  </span>
                )}
              </div>

              {/* Title & snippet */}
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-foreground leading-tight">
                  {entry.title || 'Untitled Entry'}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-line">
                  {entry.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Slide-up / Overlay Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Editor Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                {editingEntry ? 'Edit Entry' : 'New Entry'}
              </h3>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editor Inputs */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-left">
              {/* Date & Mood row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="journal-date">
                    Entry Date
                  </label>
                  <input
                    id="journal-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                    Associate Mood
                  </label>
                  <div className="flex gap-1.5">
                    {Object.entries(MOOD_EMOJIS).map(([key, val]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditMood(editMood === key ? null : key)}
                        className={`text-base p-1.5 rounded-lg border transition-all cursor-pointer ${
                          editMood === key 
                            ? 'bg-primary/20 border-primary scale-105 font-bold' 
                            : 'bg-card border-border hover:bg-secondary'
                        }`}
                        title={key}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Title input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="journal-title">
                  Entry Title
                </label>
                <input
                  id="journal-title"
                  type="text"
                  placeholder="e.g. Reflecting on a busy week"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Content text area */}
              <div className="space-y-1 flex-1 flex flex-col">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="journal-content">
                  Write Entry
                </label>
                <textarea
                  id="journal-content"
                  placeholder="Type your secure thoughts here..."
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  required
                  rows={8}
                  className="w-full flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground resize-none min-h-[160px]"
                />
              </div>
            </form>

            {/* Actions Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/40">
              <div>
                {editingEntry && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEntry.id)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-secondary-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editContent.trim()}
                  className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Entry
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
