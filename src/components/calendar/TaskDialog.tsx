'use client'

import React, { useState, useEffect } from 'react'
import { X, Trash2, Calendar, Clock, Loader2 } from 'lucide-react'
import { PlannerTask } from '@/hooks/usePlanner'
import { useReminders } from '@/hooks/useReminders'
import { calculateReminderDate } from '@/utils/reminderHelper'

interface TaskDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (taskData: any) => Promise<any>
  onDelete?: (id: string) => Promise<boolean>
  selectedDate: string // YYYY-MM-DD
  editingTask: PlannerTask | null
}

export default function TaskDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedDate,
  editingTask,
}: TaskDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [hasTime, setHasTime] = useState(false)
  const [taskTime, setTaskTime] = useState('09:00')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reminder settings
  const [reminderOffset, setReminderOffset] = useState('none')
  const [reminderCustomTime, setReminderCustomTime] = useState('09:00')
  const [reminderRepeat, setReminderRepeat] = useState('none')
  const { scheduleReminder, cancelReminder } = useReminders()

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title)
        setDescription(editingTask.description || '')
        setDate(editingTask.task_date)
        if (editingTask.task_time) {
          setHasTime(true)
          setTaskTime(editingTask.task_time.substring(0, 5))
        } else {
          setHasTime(false)
          setTaskTime('09:00')
        }
        setReminderOffset(editingTask.reminder_offset || 'none')
        setReminderCustomTime(editingTask.reminder_custom_time ? editingTask.reminder_custom_time.substring(0, 5) : '09:00')
        setReminderRepeat(editingTask.reminder_repeat || 'none')
      } else {
        setTitle('')
        setDescription('')
        setDate(selectedDate)
        setHasTime(false)
        setTaskTime('09:00')
        setReminderOffset('none')
        setReminderCustomTime('09:00')
        setReminderRepeat('none')
      }
    }
  }, [isOpen, editingTask, selectedDate])

  if (!isOpen) return null

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSaving(true)
    const taskData = {
      title: title.trim(),
      description: description.trim() || '',
      task_date: date,
      task_time: hasTime && taskTime ? taskTime : null,
      reminder_offset: reminderOffset,
      reminder_custom_time: reminderOffset === 'custom' ? reminderCustomTime : null,
      reminder_repeat: reminderRepeat,
    }

    const result = await onSave(taskData)
    setIsSaving(false)
    if (result) {
      if (reminderOffset !== 'none') {
        const triggerDate = calculateReminderDate(
          date,
          taskData.task_time,
          reminderOffset,
          reminderOffset === 'custom' ? reminderCustomTime : null
        )
        if (triggerDate) {
          await scheduleReminder({
            id: result.id,
            title: 'Planner Task: ' + result.title,
            body: result.description || 'Task due now',
            triggerAt: triggerDate,
            repeat: reminderRepeat !== 'none' ? (reminderRepeat as any) : undefined
          })
        } else {
          await cancelReminder(result.id)
        }
      } else {
        await cancelReminder(result.id)
      }
      onClose()
    }
  }

  const handleDeleteClick = async () => {
    if (!editingTask || !onDelete) return
    if (!confirm('Are you sure you want to delete this task?')) return

    setIsDeleting(true)
    const success = await onDelete(editingTask.id)
    setIsDeleting(false)
    if (success) {
      await cancelReminder(editingTask.id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editingTask ? 'Edit Task' : 'Create Task'}
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="task-title">
              Task Title
            </label>
            <input
              id="task-title"
              type="text"
              placeholder="e.g. Complete Project Proposal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="task-desc">
              Notes
            </label>
            <textarea
              id="task-desc"
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="task-date">
                Date
              </label>
              <div className="relative">
                <input
                  id="task-date"
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
                <span className="text-sm font-medium text-foreground">Specify Task Time</span>
              </label>
            </div>
          </div>

          {hasTime && (
            <div className="space-y-1 text-left animate-in fade-in duration-200">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="task-time">
                Due Time
              </label>
              <div className="relative">
                <input
                  id="task-time"
                  type="time"
                  value={taskTime}
                  onChange={(e) => setTaskTime(e.target.value)}
                  required={hasTime}
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                />
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Reminder Section */}
          <div className="border-t border-border pt-4 space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
              Offline Reminder Alerts
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="reminder-offset">
                  Reminder Offset
                </label>
                <select
                  id="reminder-offset"
                  value={reminderOffset}
                  onChange={(e) => setReminderOffset(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  <option value="none">No Reminder</option>
                  <option value="at">At time of task</option>
                  <option value="5m">5 minutes before</option>
                  <option value="15m">15 minutes before</option>
                  <option value="30m">30 minutes before</option>
                  <option value="1h">1 hour before</option>
                  <option value="1d">1 day before</option>
                  <option value="custom">Custom exact time</option>
                </select>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="reminder-repeat">
                  Repeat Interval
                </label>
                <select
                  id="reminder-repeat"
                  value={reminderRepeat}
                  onChange={(e) => setReminderRepeat(e.target.value)}
                  disabled={reminderOffset === 'none'}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary text-foreground disabled:opacity-50"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {reminderOffset === 'custom' && (
              <div className="space-y-1 text-left animate-in fade-in duration-200">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1" htmlFor="reminder-custom-time">
                  Custom Alert Time
                </label>
                <div className="relative">
                  <input
                    id="reminder-custom-time"
                    type="time"
                    value={reminderCustomTime}
                    onChange={(e) => setReminderCustomTime(e.target.value)}
                    required={reminderOffset === 'custom'}
                    className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer / Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/40">
          <div>
            {editingTask && onDelete && (
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
              Save Task
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
