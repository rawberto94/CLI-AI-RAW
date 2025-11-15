'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  FileSignature,
  Plus,
  Send,
  Mail,
  User,
  CheckCircle2,
  Clock,
  X,
  AlertCircle,
  Trash2,
  ArrowRight,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Signer {
  id: string
  name: string
  email: string
  role: string
  order: number
  status: 'pending' | 'sent' | 'signed' | 'declined'
  signedAt?: string
}

interface SignatureRequestProps {
  contractId: string
  contractName: string
  onClose?: () => void
}

export function SignatureRequest({
  contractId,
  contractName,
  onClose,
}: SignatureRequestProps) {
  const [signers, setSigners] = useState<Signer[]>([
    {
      id: '1',
      name: '',
      email: '',
      role: 'Signer',
      order: 1,
      status: 'pending',
    },
  ])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [provider, setProvider] = useState<'docusign' | 'adobe'>('docusign')

  const addSigner = () => {
    setSigners([
      ...signers,
      {
        id: Date.now().toString(),
        name: '',
        email: '',
        role: 'Signer',
        order: signers.length + 1,
        status: 'pending',
      },
    ])
  }

  const removeSigner = (id: string) => {
    setSigners(signers.filter((s) => s.id !== id))
  }

  const updateSigner = (id: string, field: keyof Signer, value: any) => {
    setSigners(signers.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const sendForSignature = async () => {
    setSending(true)
    try {
      // Simulate API call to DocuSign/Adobe Sign
      await new Promise((resolve) => setTimeout(resolve, 2000))
      
      // Update signer statuses
      setSigners(signers.map((s) => ({ ...s, status: 'sent' })))
      setSent(true)
    } catch (error) {
      console.error('Failed to send for signature:', error)
    } finally {
      setSending(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'sent':
        return <Mail className="h-5 w-5 text-blue-600" />
      case 'declined':
        return <X className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'signed':
        return <Badge className="bg-green-500 text-white">Signed</Badge>
      case 'sent':
        return <Badge className="bg-blue-500 text-white">Sent</Badge>
      case 'declined':
        return <Badge className="bg-red-500 text-white">Declined</Badge>
      default:
        return <Badge className="bg-gray-400 text-white">Pending</Badge>
    }
  }

  const canSend = signers.every((s) => s.name && s.email)

  if (sent) {
    return (
      <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">Signature Request Sent!</CardTitle>
              <p className="text-gray-600 mt-1">
                All signers have been notified via email
              </p>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Signing Progress */}
          <div className="space-y-4">
            {signers.map((signer, index) => (
              <div
                key={signer.id}
                className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full border-2 border-blue-300 font-bold text-blue-600">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{signer.name}</p>
                      <p className="text-sm text-gray-600">{signer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(signer.status)}
                    {getStatusBadge(signer.status)}
                  </div>
                </div>
                {signer.signedAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Signed on {new Date(signer.signedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium text-gray-700">
              <span>Signing Progress</span>
              <span>
                {signers.filter((s) => s.status === 'signed').length} of {signers.length} signed
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500"
                style={{
                  width: `${
                    (signers.filter((s) => s.status === 'signed').length / signers.length) * 100
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" className="flex-1">
              <Mail className="h-4 w-4 mr-2" />
              Resend Reminders
            </Button>
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Status Report
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
              <FileSignature className="h-7 w-7 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Request E-Signature</CardTitle>
              <p className="text-gray-600 mt-1">{contractName}</p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">E-Signature Provider</label>
          <div className="flex gap-3">
            <button
              onClick={() => setProvider('docusign')}
              className={cn(
                'flex-1 p-4 rounded-xl border-2 transition-all',
                provider === 'docusign'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="font-semibold text-gray-900">DocuSign</div>
              <div className="text-sm text-gray-600">Industry-leading e-signature</div>
            </button>
            <button
              onClick={() => setProvider('adobe')}
              className={cn(
                'flex-1 p-4 rounded-xl border-2 transition-all',
                provider === 'adobe'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="font-semibold text-gray-900">Adobe Sign</div>
              <div className="text-sm text-gray-600">Trusted PDF workflows</div>
            </button>
          </div>
        </div>

        {/* Signers List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Signers ({signers.length})
            </label>
            <Button size="sm" variant="outline" onClick={addSigner}>
              <Plus className="h-4 w-4 mr-1" />
              Add Signer
            </Button>
          </div>

          {signers.map((signer, index) => (
            <div
              key={signer.id}
              className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200"
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full text-white font-bold shadow-md">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Name *
                      </label>
                      <Input
                        value={signer.name}
                        onChange={(e) => updateSigner(signer.id, 'name', e.target.value)}
                        placeholder="Full name"
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Email *
                      </label>
                      <Input
                        type="email"
                        value={signer.email}
                        onChange={(e) => updateSigner(signer.id, 'email', e.target.value)}
                        placeholder="email@example.com"
                        className="bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <select
                      value={signer.role}
                      onChange={(e) => updateSigner(signer.id, 'role', e.target.value)}
                      className="text-sm border-0 bg-transparent font-medium text-gray-700 focus:outline-none"
                    >
                      <option value="Signer">Signer</option>
                      <option value="Approver">Approver</option>
                      <option value="Witness">Witness</option>
                    </select>
                  </div>
                </div>
                {signers.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSigner(signer.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Signing Order Info */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Sequential Signing</p>
              <p className="text-blue-700 mt-1">
                Signers will receive the document in the order listed above. Each signer must
                complete their signature before the next signer is notified.
              </p>
            </div>
          </div>
        </div>

        {/* Validation Warning */}
        {!canSend && (
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <p className="font-medium">Required fields missing</p>
                <p className="text-yellow-700 mt-1">
                  Please provide name and email for all signers before sending.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          {onClose && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          )}
          <Button
            onClick={sendForSignature}
            disabled={!canSend || sending}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send for Signature
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
