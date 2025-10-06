'use client'

import { useEffect, useState } from 'react'
// eslint-disable-next-line import/order
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  onClose: (id: string) => void
}

export function Toast({ id, type, title, message, duration = 5000, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line no-undef
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    // eslint-disable-next-line no-undef
    return () => clearTimeout(timer)
  }, [duration])

  const handleClose = () => {
    setIsExiting(true)
    // eslint-disable-next-line no-undef
    setTimeout(() => {
      onClose(id)
    }, 300)
  }

  const icons = {
    success: <CheckCircle2 className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  }

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-orange-50 border-orange-200 text-orange-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900'
  }

  const iconStyles = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-orange-600',
    info: 'text-blue-600'
  }

  return (
    <div
      className={`
        ${styles[type]}
        border-2 rounded-lg shadow-lg p-4 min-w-[320px] max-w-md
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`${iconStyles[type]} flex-shrink-0 mt-0.5`}>
          {icons[type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-1">{title}</div>
          {(message != null && message.length > 0) && (
            <div className="text-sm opacity-90">{message}</div>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function ToastContainer({ toasts, onClose }: {
  toasts: ToastProps[]
  onClose: (id: string) => void
}) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none">
      <div className="space-y-3 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={onClose} />
        ))}
      </div>
    </div>
  )
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const showToast = (
    type: ToastType,
    title: string,
    message?: string,
    duration?: number
  ) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: ToastProps = {
      id,
      type,
      title,
      message,
      duration,
      onClose: removeToast
    }
    setToasts((prev) => [...prev, newToast])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  return {
    toasts,
    showToast,
    success: (title: string, message?: string) => showToast('success', title, message),
    error: (title: string, message?: string) => showToast('error', title, message),
    warning: (title: string, message?: string) => showToast('warning', title, message),
    info: (title: string, message?: string) => showToast('info', title, message)
  }
}
