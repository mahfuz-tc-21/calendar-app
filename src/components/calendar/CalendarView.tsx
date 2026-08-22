'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, Edit2 } from 'lucide-react'
import { useCalendar, CalendarEvent } from '@/hooks/useCalendar'
import { usePrivateSpace } from '@/context/PrivateSpaceContext'
import { useToast } from '@/context/ToastContext'
import EventDialog from './EventDialog'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarView() {
  const router = useRouter()
  const { events, loading, isOffline, fetchEvents, createEvent, updateEvent, deleteEvent } = useCalendar()
  const { hasPasscode, unlock, setupPasscode, loading: privateSpaceLoading } = usePrivateSpace()
  const { showToast } = useToast()

  // Calendar Date State
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1) // 1-12
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  // Two-cell secret unlock state
  const [clickSequence, setClickSequence] = useState<string[]>([])
  const unlockTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Setup private access sequence state
  const [isSetupMode, setIsSetupMode] = useState(false)
  const [setupStep, setSetupStep] = useState<'idle' | 'pick_1' | 'pick_2' | 'confirm_1' | 'confirm_2'>('idle')
  const [tempSecret, setTempSecret] = useState<string[]>([])
  const [confirmSecret, setConfirmSecret] = useState<string[]>([])

  useEffect(() => {
    if (!privateSpaceLoading) {
      const mode = !isOffline && !hasPasscode
      setIsSetupMode(mode)
      if (mode) {
        setSetupStep('pick_1')
      } else {
        setSetupStep('idle')
      }
    }
  }, [privateSpaceLoading, hasPasscode, isOffline])

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
    }
  }, [])

  // Prefetch private page for instant transition on successful cell sequence unlock
  useEffect(() => {
    router.prefetch('/private')
  }, [router])

  // Fetch events when current month or year changes
  useEffect(() => {
    fetchEvents(currentYear, currentMonth)
  }, [currentYear, currentMonth, fetchEvents])

  // Year choices (Current year +/- 10 years)
  const years = useMemo(() => {
    const curYear = new Date().getFullYear()
    const result = []
    for (let y = curYear - 10; y <= curYear + 10; y++) {
      result.push(y)
    }
    return result
  }, [])

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth() + 1)
    setSelectedDate(today.toISOString().split('T')[0])
  }

  // Calculate days for the 6-row 7-col grid (42 cells)
  const gridDays = useMemo(() => {
    const grid = []
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay() // 0 = Sun
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate()

    // 1. Previous Month days (hidden, render as empty)
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      grid.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
      })
    }

    // 2. Current Month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      grid.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
      })
    }

    // 3. Next Month days to fill 42 cells (6 rows * 7 days) (hidden, render as empty)
    const remainingCells = 42 - grid.length
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      grid.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
      })
    }

    return grid
  }, [currentYear, currentMonth])

  // Map events to their dates for quick lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events.forEach((event) => {
      const dStr = event.event_date
      if (!map[dStr]) {
        map[dStr] = []
      }
      map[dStr].push(event)
    })
    return map
  }, [events])

  const selectedDayEvents = useMemo(() => {
    return eventsByDate[selectedDate] || []
  }, [eventsByDate, selectedDate])

  // Save event handler
  const handleSaveEvent = async (eventData: any) => {
    if (editingEvent) {
      return await updateEvent(editingEvent.id, eventData)
    } else {
      return await createEvent(eventData)
    }
  }

  // Delete event handler
  const handleDeleteEvent = async (id: string) => {
    return await deleteEvent(id)
  }

  const openCreateDialog = () => {
    setEditingEvent(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event)
    setIsDialogOpen(true)
  }

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-16">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card border-b border-border shadow-xs">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg tracking-tight text-foreground">Calendar</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
        </div>
      </header>

      {/* Main Calendar Panel */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-4">
        
        {/* Setup Banner */}
        {isSetupMode && (
          <div className="bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30 p-4 rounded-2xl text-center space-y-2 animate-in fade-in duration-200">
            <h2 className="text-sm font-bold text-primary dark:text-blue-400">Set your private access</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {setupStep === 'pick_1' && 'Choose two Calendar cells. These two cells will be used to open your private space. Select the first cell.'}
              {setupStep === 'pick_2' && 'Select the second cell.'}
              {setupStep === 'confirm_1' && 'Select the same first cell to confirm your sequence.'}
              {setupStep === 'confirm_2' && 'Select the same second cell to confirm.'}
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSetupMode(false)
                  setSetupStep('idle')
                  setTempSecret([])
                  setConfirmSecret([])
                  router.replace('/calendar')
                }}
                className="px-3 py-1 bg-card hover:bg-secondary border border-border rounded-lg text-xs font-semibold text-foreground cursor-pointer transition-colors"
              >
                Cancel Setup
              </button>
            </div>
          </div>
        )}

        {/* Navigation & Selectors */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-xs space-y-3">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center justify-between w-full sm:w-auto gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleToday}
                className="px-3.5 py-1.5 border border-border rounded-lg text-sm font-medium text-foreground bg-card cursor-pointer hover:bg-secondary transition-colors min-h-[40px]"
              >
                Today
              </button>
            </div>

            {/* Dropdowns */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                className="flex-1 sm:flex-none px-2.5 py-1.5 border border-border rounded-lg text-sm bg-card font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-h-[40px]"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="flex-1 sm:flex-none px-2.5 py-1.5 border border-border rounded-lg text-sm bg-card font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-h-[40px]"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Layout */}
          <div>
            {/* Weekdays */}
            <div className="grid grid-cols-7 text-center mb-1">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="text-xs font-semibold text-muted-foreground py-1 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Days cells */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 border-t border-border pt-1">
              {gridDays.map(({ dateStr, dayNumber, isCurrentMonth }) => {
                const dayEvents = eventsByDate[dateStr] || []
                const isSelected = dateStr === selectedDate
                const isToday = dateStr === todayStr

                if (!isCurrentMonth) {
                  return (
                    <div
                      key={dateStr}
                      className="aspect-square relative flex flex-col items-center justify-center p-0.5 sm:p-1 rounded-xl min-h-[40px] select-none bg-transparent"
                    />
                  )
                }

                const handleDayClick = async () => {
                  setSelectedDate(dateStr)

                  const getDayNumber = (d: string) => d.split('-')[2]

                  if (isSetupMode) {
                    if (setupStep === 'pick_1') {
                      setTempSecret([dateStr])
                      setSetupStep('pick_2')
                    } else if (setupStep === 'pick_2') {
                      if (tempSecret[0] === dateStr) {
                        showToast('Choose a different second cell', 'error')
                        return
                      }
                      setTempSecret([tempSecret[0], dateStr])
                      setSetupStep('confirm_1')
                    } else if (setupStep === 'confirm_1') {
                      setConfirmSecret([dateStr])
                      setSetupStep('confirm_2')
                    } else if (setupStep === 'confirm_2') {
                      if (tempSecret[0] === confirmSecret[0] && tempSecret[1] === dateStr) {
                        const success = await setupPasscode(`${getDayNumber(tempSecret[0])},${getDayNumber(tempSecret[1])}`)
                        if (success) {
                          setIsSetupMode(false)
                          setSetupStep('idle')
                          setTempSecret([])
                          setConfirmSecret([])
                          router.replace('/calendar')
                        } else {
                          setTempSecret([])
                          setConfirmSecret([])
                          setSetupStep('pick_1')
                        }
                      } else {
                        showToast('Confirmation sequence did not match. Please start again.', 'error')
                        setTempSecret([])
                        setConfirmSecret([])
                        setSetupStep('pick_1')
                      }
                    }
                    return
                  }

                  // Normal unlock sequence check
                  if (clickSequence.length === 0) {
                    setClickSequence([dateStr])
                    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
                    unlockTimerRef.current = setTimeout(() => {
                      setClickSequence([])
                    }, 3000)
                  } else if (clickSequence.length === 1) {
                    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
                    const seq = [clickSequence[0], dateStr]
                    setClickSequence([]) // reset immediately
                    
                    const success = await unlock(`${getDayNumber(seq[0])},${getDayNumber(seq[1])}`, true) // silent=true
                    if (success) {
                      router.push('/private')
                    }
                  }
                }

                const isSelectedInSetup = isSetupMode && (
                  (setupStep === 'pick_2' && tempSecret[0] === dateStr) ||
                  (setupStep === 'confirm_2' && confirmSecret[0] === dateStr)
                )

                return (
                  <button
                    key={dateStr}
                    onClick={handleDayClick}
                    className={`aspect-square relative flex flex-col items-center justify-center p-0.5 sm:p-1 rounded-xl transition-all cursor-pointer min-h-[40px] select-none ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : isToday
                          ? 'bg-blue-500/15 dark:bg-blue-500/30 text-primary dark:text-blue-400 font-bold border border-primary/30 dark:border-primary/50'
                          : isSelectedInSetup
                            ? 'ring-2 ring-primary text-primary dark:text-blue-400 font-medium bg-blue-500/10 dark:bg-blue-500/20'
                            : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <span className="text-sm">{dayNumber}</span>
                    
                    {/* Event indicators */}
                    {dayEvents.length > 0 && (
                      <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-primary-foreground' : 'bg-primary'
                      }`} />
                    )}
                  </button>
                )
              })}
            </div>

          </div>

        </div>

        {/* Selected Day Agenda */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-semibold text-foreground">Agenda</h3>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC' // Prevents local timezone shift on YYYY-MM-DD parsing
                })}
              </p>
            </div>
            
            <button
              onClick={openCreateDialog}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-blue-700 dark:hover:bg-blue-500 text-primary-foreground rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>

          {/* Agenda list */}
          {loading ? (
            <div className="py-8 flex justify-center text-sm text-muted-foreground animate-pulse">
              Loading agenda...
            </div>
          ) : selectedDayEvents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground italic">
              No events scheduled for this day
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => (
                <div
                  key={event.id}
                  className="group flex items-start justify-between p-3.5 border border-border rounded-xl hover:bg-secondary/35 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-foreground leading-tight">
                        {event.title}
                      </h4>
                      {event.start_time && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-primary dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/25 px-2 py-0.5 rounded-full shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>
                            {event.start_time.substring(0, 5)}
                            {event.end_time ? ` - ${event.end_time.substring(0, 5)}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => openEditDialog(event)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg cursor-pointer transition-colors shrink-0"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

      </main>

      {/* Floating Plus button for convenient mobile access */}
      <button
        onClick={openCreateDialog}
        aria-label="Add Event"
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover:bg-blue-700 dark:hover:bg-blue-500 text-primary-foreground rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer z-20 md:hidden"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Dialog container */}
      <EventDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        selectedDate={selectedDate}
        editingEvent={editingEvent}
      />

    </div>
  )
}
