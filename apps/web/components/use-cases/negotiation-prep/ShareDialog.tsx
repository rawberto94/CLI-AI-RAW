'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Share2, Copy, Check, Link2, Clock, Eye, Edit, X } from 'lucide-react'
import { ShareService, type SharedScenario } from '@/lib/negotiation-prep/share-service'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  scenarioId: string
  currentUserId: string
  scenarioData: {
    role: string
    level: string
    location: string
    supplier: string
    currentRate: number
    targetRate: number
    strategy: string
    notes?: string
  }
}

export function ShareDialog({
  isOpen,
  onClose,
  scenarioId,
  currentUserId,
  scenarioData
}: ShareDialogProps) {
  const [permission, setPermission] = useState<'read' | 'edit'>('read')
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7)
  const [sharedLink, setSharedLink] = useState<SharedScenario | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreateLink = () => {
    const shared = ShareService.createShareLink(
      scenarioId,
      currentUserId,
      permission,
      expiresInDays || undefined,
      scenarioData
    )
    setSharedLink(shared)
  }

  const handleCopyLink = async () => {
    if (!sharedLink) return

    const success = await ShareService.copyShareUrl(sharedLink.id)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRevoke = () => {
    if (!sharedLink) return
    
    if (confirm('Are you sure you want to revoke this link? It will no longer be accessible.')) {
      ShareService.revokeShareLink(sharedLink.id)
      setSharedLink(null)
    }
  }

  const handleClose = () => {
    setSharedLink(null)
    setCopied(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            Share Negotiation Scenario
          </DialogTitle>
          <DialogDescription>
            Create a shareable link to collaborate with your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!sharedLink ? (
            <>
              {/* Scenario Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Scenario Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Role:</span>
                    <span className="ml-2 font-medium">{scenarioData.role} - {scenarioData.level}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Supplier:</span>
                    <span className="ml-2 font-medium">{scenarioData.supplier}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Rate:</span>
                    <span className="ml-2 font-medium">CHF {scenarioData.currentRate.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Target Rate:</span>
                    <span className="ml-2 font-medium">CHF {scenarioData.targetRate.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Permission Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Permission
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPermission('read')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      permission === 'read'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">View Only</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Recipients can view but not edit the scenario
                    </p>
                  </button>

                  <button
                    onClick={() => setPermission('edit')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      permission === 'edit'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Edit className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">Can Edit</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Recipients can view and modify the scenario
                    </p>
                  </button>
                </div>
              </div>

              {/* Expiration Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link Expiration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 7, 30, null].map((days) => (
                    <button
                      key={days || 'never'}
                      onClick={() => setExpiresInDays(days)}
                      className={`px-4 py-2 border-2 rounded-lg text-sm transition-all ${
                        expiresInDays === days
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {days ? `${days} day${days > 1 ? 's' : ''}` : 'Never'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Create Button */}
              <Button onClick={handleCreateLink} className="w-full">
                <Link2 className="w-4 h-4 mr-2" />
                Create Shareable Link
              </Button>
            </>
          ) : (
            <>
              {/* Success State */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">Link Created Successfully!</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Share this link with your team members to collaborate
                  </p>
                </div>

                {/* Link Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shareable Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ShareService.getShareUrl(sharedLink.id)}
                      readOnly
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                    <Button onClick={handleCopyLink} variant="outline">
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2 text-green-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Link Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                      {sharedLink.permission === 'read' ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <Edit className="w-4 h-4" />
                      )}
                      <span>Permission</span>
                    </div>
                    <div className="font-medium capitalize">{sharedLink.permission}</div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                      <Clock className="w-4 h-4" />
                      <span>Expires</span>
                    </div>
                    <div className="font-medium">
                      {sharedLink.expiresAt
                        ? sharedLink.expiresAt.toLocaleDateString()
                        : 'Never'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button onClick={handleRevoke} variant="outline" className="flex-1">
                    <X className="w-4 h-4 mr-2" />
                    Revoke Link
                  </Button>
                  <Button onClick={handleClose} className="flex-1">
                    Done
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Component to display existing shared links
export function SharedLinksList({ userId }: { userId: string }) {
  const [links, setLinks] = useState<SharedScenario[]>([])

  const loadLinks = () => {
    const userLinks = ShareService.getUserSharedScenarios(userId)
    setLinks(userLinks)
  }

  useState(() => {
    loadLinks()
  })

  const handleRevoke = (shareId: string) => {
    if (confirm('Revoke this shared link?')) {
      ShareService.revokeShareLink(shareId)
      loadLinks()
    }
  }

  const handleCopy = async (shareId: string) => {
    await ShareService.copyShareUrl(shareId)
  }

  if (links.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Share2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No shared links yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {links.map((link) => {
        const stats = ShareService.getShareStats(link.id)
        return (
          <div key={link.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-sm">
                  {link.scenarioData.role} - {link.scenarioData.level}
                </div>
                <div className="text-xs text-gray-500">
                  Created {link.createdAt.toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleCopy(link.id)} size="sm" variant="outline">
                  <Copy className="w-3 h-3" />
                </Button>
                <Button onClick={() => handleRevoke(link.id)} size="sm" variant="outline">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span className="capitalize">{link.permission} access</span>
              <span>{stats?.accessCount || 0} views</span>
              {stats?.daysUntilExpiry && (
                <span>Expires in {stats.daysUntilExpiry} days</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
