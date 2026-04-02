'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, CheckCircle2, Loader2, AlertCircle, PenTool,
  Shield, Clock, ChevronDown, Type, Edit3, X,
} from 'lucide-react'

interface SignerInfo {
  name: string
  email: string
  role: string
  contractTitle: string
  contractId: string
  requestId: string
  subject: string
  message: string
  expiresAt: string | null
}

type SignatureMethod = 'typed' | 'drawn'

export default function SigningPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const requestId = params.id as string
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signerInfo, setSignerInfo] = useState<SignerInfo | null>(null)
  const [signatureMethod, setSignatureMethod] = useState<SignatureMethod>('typed')
  const [typedName, setTypedName] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [showDecline, setShowDecline] = useState(false)

  // Canvas for drawn signature
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Validate token and load signer info
  useEffect(() => {
    async function validate() {
      if (!token) {
        setError('No signing token provided. Please use the link from your email.')
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/signatures/${requestId}/sign?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error || data.message || 'Invalid or expired signing link')
        } else {
          setSignerInfo(data.data)
          setTypedName(data.data.name || '')
        }
      } catch {
        setError('Failed to validate signing link. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    validate()
  }, [requestId, token])

  // Canvas drawing handlers
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }, [getCanvasCoords])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setHasDrawn(true)
  }, [isDrawing, getCanvasCoords])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }, [])

  const handleSubmit = async () => {
    if (!agreedToTerms) return
    const isValid = signatureMethod === 'typed' ? typedName.trim().length >= 2 : hasDrawn

    if (!isValid) return

    setSubmitting(true)
    try {
      let signatureData: string
      if (signatureMethod === 'drawn') {
        signatureData = canvasRef.current?.toDataURL('image/png') || ''
      } else {
        signatureData = typedName.trim()
      }

      const res = await fetch(`/api/signatures/${requestId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureMethod,
          signatureData,
          agreedToTerms: true,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to submit signature')
      }
      setCompleted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit signature')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/signatures/${requestId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'decline',
          declineReason: declineReason.trim() || 'No reason provided',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to decline')
      }
      setDeclined(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline')
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <Shield className="w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Verifying Signing Link</h2>
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Validating your secure link...</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !signerInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Sign</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <p className="text-sm text-slate-400">
            Please contact the sender for a new signing link.
          </p>
        </div>
      </div>
    )
  }

  // Completed state
  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/30 to-teal-50/20 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-green-200 p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6"
          >
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Document Signed</h2>
          <p className="text-slate-500 mb-4">
            Your signature has been recorded successfully. A confirmation email will be sent to{' '}
            <strong>{signerInfo?.email}</strong>.
          </p>
          <div className="bg-green-50 rounded-lg p-4 text-left text-sm text-green-800 space-y-1">
            <p><strong>Document:</strong> {signerInfo?.contractTitle}</p>
            <p><strong>Signed by:</strong> {signerInfo?.name}</p>
            <p><strong>Date:</strong> {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
          </div>
        </motion.div>
      </div>
    )
  }

  // Declined state
  if (declined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-orange-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4">
            <X className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Signing Declined</h2>
          <p className="text-slate-500">The sender has been notified of your decision.</p>
        </div>
      </div>
    )
  }

  const isSignatureValid = signatureMethod === 'typed' ? typedName.trim().length >= 2 : hasDrawn
  const canSubmit = isSignatureValid && agreedToTerms && !submitting

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <PenTool className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-800">ConTigo e-Sign</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Shield className="w-4 h-4" />
            <span>Secure Signing</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Document Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 mb-1">{signerInfo?.subject || 'Signature Request'}</h1>
              <p className="text-slate-600 mb-3">{signerInfo?.contractTitle}</p>
              {signerInfo?.message && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 italic">
                  &ldquo;{signerInfo.message}&rdquo;
                </div>
              )}
            </div>
          </div>
          {signerInfo?.expiresAt && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4" />
              <span>This signing request expires on {new Date(signerInfo.expiresAt).toLocaleDateString('en-US', { dateStyle: 'long' })}</span>
            </div>
          )}
        </div>

        {/* Signer Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Signing as</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
              {signerInfo?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-medium text-slate-800">{signerInfo?.name}</p>
              <p className="text-sm text-slate-500">{signerInfo?.email}</p>
            </div>
          </div>
        </div>

        {/* Signature Input */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Your Signature</h2>

          {/* Method Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSignatureMethod('typed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                signatureMethod === 'typed'
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Type className="w-4 h-4" />
              Type
            </button>
            <button
              onClick={() => setSignatureMethod('drawn')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                signatureMethod === 'drawn'
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              Draw
            </button>
          </div>

          <AnimatePresence mode="wait">
            {signatureMethod === 'typed' ? (
              <motion.div
                key="typed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Type your full name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                />
                {typedName.trim().length >= 2 && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <p className="text-xs text-slate-400 mb-2">Signature Preview</p>
                    <p className="text-2xl font-signature text-slate-800 italic" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}>
                      {typedName}
                    </p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="drawn"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={180}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-slate-300 text-lg">Draw your signature here</p>
                    </div>
                  )}
                </div>
                {hasDrawn && (
                  <button onClick={clearCanvas} className="mt-2 text-sm text-slate-500 hover:text-slate-700 underline">
                    Clear and redraw
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Terms */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600 leading-relaxed">
              I agree that my electronic signature is the legal equivalent of my manual/handwritten signature.
              By signing this document, I consent to be legally bound by its terms and conditions.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setShowDecline(true)}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
          >
            Decline to Sign
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <PenTool className="w-4 h-4" />
                Sign Document
              </>
            )}
          </button>
        </div>

        {/* Error banner */}
        {error && signerInfo && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}
      </main>

      {/* Decline dialog */}
      <AnimatePresence>
        {showDecline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDecline(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Decline to Sign</h3>
              <p className="text-sm text-slate-500 mb-4">
                The sender will be notified. You can optionally provide a reason.
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason for declining (optional)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none h-24 focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowDecline(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecline}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 rounded-lg"
                >
                  {submitting ? 'Declining...' : 'Confirm Decline'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-12 py-6 text-center text-xs text-slate-400">
        <p>Secured by ConTigo CLM Platform &middot; This document is legally binding</p>
      </footer>
    </div>
  )
}
