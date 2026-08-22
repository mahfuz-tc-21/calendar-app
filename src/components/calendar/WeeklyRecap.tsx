'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Calendar, CheckSquare, Smile, Gamepad2, MessageSquare, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

interface WeeklyRecapProps {
  isOpen: boolean
  onClose: () => void
}

export default function WeeklyRecap({ isOpen, onClose }: WeeklyRecapProps) {
  const { user } = useAuth()
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0) // 0 = current week, -1 = last week, etc.
  const [loading, setLoading] = useState(false)
  
  // Metrics
  const [eventsCount, setEventsCount] = useState(0)
  const [tasksCompleted, setTasksCompleted] = useState(0)
  const [tasksTotal, setTasksTotal] = useState(0)
  const [moodCounts, setMoodCounts] = useState<Record<string, number>>({
    great: 0,
    good: 0,
    okay: 0,
    bad: 0,
    difficult: 0
  })
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [messagesSent, setMessagesSent] = useState(0)

  // Start & End of week
  const getWeekRange = useCallback(() => {
    const today = new Date()
    // Adjust for currentWeekOffset
    today.setDate(today.getDate() + (currentWeekOffset * 7))

    const day = today.getDay()
    const diffToSunday = today.getDate() - day

    const sunday = new Date(today.setDate(diffToSunday))
    sunday.setHours(0, 0, 0, 0)

    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)
    saturday.setHours(23, 59, 59, 999)

    return {
      start: sunday,
      end: saturday,
      startStr: sunday.toISOString().split('T')[0],
      endStr: saturday.toISOString().split('T')[0]
    }
  }, [currentWeekOffset])

  const fetchRecapData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const supabase = createClient()
    const { startStr, endStr, start, end } = getWeekRange()

    try {
      // 1. Fetch Calendar Events count
      const { count: events } = await supabase
        .from('calendar_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('event_date', startStr)
        .lte('event_date', endStr)

      setEventsCount(events || 0)

      // 2. Fetch Tasks Completed / Total
      const { data: tasks } = await supabase
        .from('planner_tasks')
        .select('completed')
        .eq('user_id', user.id)
        .gte('task_date', startStr)
        .lte('task_date', endStr)

      const totalT = tasks?.length || 0
      const compT = tasks?.filter((t: any) => t.completed).length || 0
      setTasksTotal(totalT)
      setTasksCompleted(compT)

      // 3. Fetch Mood Counts
      const { data: moods } = await supabase
        .from('daily_moods')
        .select('mood')
        .eq('user_id', user.id)
        .gte('mood_date', startStr)
        .lte('mood_date', endStr)

      const counts = { great: 0, good: 0, okay: 0, bad: 0, difficult: 0 }
      moods?.forEach((m: any) => {
        if (m.mood in counts) {
          counts[m.mood as keyof typeof counts]++
        }
      })
      setMoodCounts(counts)

      // 4. Fetch Games Played
      const { count: games } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .or(`created_by.eq.${user.id},opponent_id.eq.${user.id}`)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      setGamesPlayed(games || 0)

      // 5. Fetch Messages Sent (privacy-preserving)
      const { count: msgs } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      setMessagesSent(msgs || 0)

    } catch (e) {
      console.error('Error fetching recap metrics:', e)
    } finally {
      setLoading(false)
    }
  }, [user, getWeekRange])

  useEffect(() => {
    if (isOpen) {
      fetchRecapData()
    }
  }, [isOpen, currentWeekOffset, fetchRecapData])

  if (!isOpen) return null

  const { start, end } = getWeekRange()
  const formatDateRange = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Weekly Personal Recap
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Selector */}
        <div className="flex items-center justify-between px-6 py-3 bg-secondary/30 border-b border-border">
          <button
            onClick={() => setCurrentWeekOffset(prev => prev - 1)}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-xs font-bold text-foreground">
            {currentWeekOffset === 0 ? 'This Week' : currentWeekOffset === -1 ? 'Last Week' : `${formatDateRange()}`}
          </span>

          <button
            onClick={() => setCurrentWeekOffset(prev => prev + 1)}
            disabled={currentWeekOffset === 0}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar text-left">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span>Gathering your weekly highlights...</span>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Event & Tasks counts */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl border border-border bg-card flex flex-col items-center justify-center text-center">
                  <Calendar className="w-6 h-6 text-blue-500 mb-1" />
                  <span className="text-lg font-black text-foreground">{eventsCount}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Events Scheduled</span>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card flex flex-col items-center justify-center text-center">
                  <CheckSquare className="w-6 h-6 text-green-500 mb-1" />
                  <span className="text-lg font-black text-foreground">{tasksCompleted} / {tasksTotal}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Tasks Completed</span>
                </div>
              </div>

              {/* Chat & Game Metrics */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl border border-border bg-card flex flex-col items-center justify-center text-center">
                  <Gamepad2 className="w-6 h-6 text-purple-500 mb-1" />
                  <span className="text-lg font-black text-foreground">{gamesPlayed}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Games Played</span>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card flex flex-col items-center justify-center text-center">
                  <MessageSquare className="w-6 h-6 text-teal-500 mb-1" />
                  <span className="text-lg font-black text-foreground">{messagesSent}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Messages Sent</span>
                </div>
              </div>

              {/* Mood breakdown chart */}
              <div className="p-4.5 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-1.5 border-b border-border pb-2">
                  <Smile className="w-4.5 h-4.5 text-yellow-500" />
                  <h3 className="text-xs font-bold text-foreground">Mood Breakdown</h3>
                </div>
                
                <div className="space-y-2.5">
                  {[
                    { key: 'great', label: '😊 Great', color: 'bg-green-500' },
                    { key: 'good', label: '🙂 Good', color: 'bg-blue-500' },
                    { key: 'okay', label: '😐 Okay', color: 'bg-yellow-500' },
                    { key: 'bad', label: '😔 Bad', color: 'bg-orange-500' },
                    { key: 'difficult', label: '😞 Difficult', color: 'bg-red-500' },
                  ].map(opt => {
                    const count = moodCounts[opt.key] || 0
                    const totalMoods = Object.values(moodCounts).reduce((a, b) => a + b, 0)
                    const pct = totalMoods > 0 ? (count / totalMoods) * 100 : 0
                    return (
                      <div key={opt.key} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium text-foreground">
                          <span>{opt.label}</span>
                          <span>{count} day{count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${opt.color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-secondary/40 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition-all active:scale-98 cursor-pointer shadow-xs min-h-[38px]"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  )
}
