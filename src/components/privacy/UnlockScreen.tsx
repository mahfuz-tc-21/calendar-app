'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

export default function UnlockScreen() {
  const router = useRouter()

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 bg-gray-50 text-center space-y-4">
      <h1 className="text-5xl font-black text-gray-300 select-none">404</h1>
      <h2 className="text-lg font-bold text-gray-800">Page Not Found</h2>
      <p className="text-xs text-gray-500 max-w-[240px] mx-auto leading-relaxed">
        The requested page is invalid or you do not have permission to view it.
      </p>
      <button
        onClick={() => router.push('/calendar')}
        className="px-4 py-2 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
      >
        Go Back
      </button>
    </div>
  )
}
