'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Copy,
  Check,
  X,
  Users,
  Link2,
  Mail,
  Eye,
  Edit3,
  MessageSquare,
  Shield,
  Trash2,
  Clock,
  ChevronDown,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentType: 'contract' | 'rate_card' | 'template' | 'workflow';
  documentTitle: string;
}

interface ShareEntry {
  id: string;
  sharedWith: string;
  permission: string;
  createdAt: string;
  accessedAt?: string;
  isActive: boolean;
}

const permissionOptions = [
  { value: 'VIEW', label: 'Can view', icon: Eye, description: 'View only access' },
  { value: 'COMMENT', label: 'Can comment', icon: MessageSquare, description: 'View and add comments' },
  { value: 'EDIT', label: 'Can edit', icon: Edit3, description: 'Full editing access' },
  { value: 'ADMIN', label: 'Admin', icon: Shield, description: 'Full access including sharing' },
];

export function ShareDialog({
  isOpen,
  onClose,
  documentId,
  documentType,
  documentTitle,
}: ShareDialogProps) {
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [permission, setPermission] = useState('VIEW');
  const [message, setMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showPermissionDropdown, setShowPermissionDropdown] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { copied: linkCopied, copy: copyLink } = useCopyToClipboard({
    showToast: false, // We use custom toast here
    resetDelay: 2000,
  });

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/sharing?documentId=${documentId}&documentType=${documentType}`
      );
      const data = await response.json();
      if (data.success) {
        setShares(data.shares || []);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [documentId, documentType]);

  useEffect(() => {
    if (isOpen) {
      fetchShares();
    }
  }, [isOpen, fetchShares]);

  const handleAddEmail = () => {
    if (email && !emails.includes(email) && email.includes('@')) {
      setEmails([...emails, email]);
      setEmail('');
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter(e => e !== emailToRemove));
  };

  const handleShare = async () => {
    if (emails.length === 0) {
      toast({
        title: 'No recipients',
        description: 'Please add at least one email address',
        variant: 'destructive',
      });
      return;
    }

    setSharing(true);
    try {
      let expiresAt: string | undefined;
      if (expiresIn !== 'never') {
        const days = parseInt(expiresIn);
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      }

      const response = await fetch('/api/sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          documentType,
          recipients: emails,
          permission,
          expiresAt,
          message,
          notifyByEmail,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Shared successfully',
          description: `${documentTitle} shared with ${emails.length} people`,
        });
        setEmails([]);
        setMessage('');
        fetchShares();
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: 'Share failed',
        description: 'Failed to share document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharing(false);
    }
  };

  const handleUpdatePermission = async (shareId: string, newPermission: string) => {
    try {
      const response = await fetch('/api/sharing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, permission: newPermission }),
      });

      if (response.ok) {
        setShares(prev =>
          prev.map(s => (s.id === shareId ? { ...s, permission: newPermission } : s))
        );
        toast({
          title: 'Permission updated',
          description: 'Share permission has been updated',
        });
      }
    } catch {
      // Error handled silently
    }
    setShowPermissionDropdown(null);
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      const response = await fetch(`/api/sharing?id=${shareId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShares(prev => prev.filter(s => s.id !== shareId));
        toast({
          title: 'Access revoked',
          description: 'Share access has been removed',
        });
      }
    } catch {
      // Error handled silently
    }
  };

  const handleCopyLink = async () => {
    const shareLink = `${window.location.origin}/${documentType}s/${documentId}`;
    const success = await copyLink(shareLink);
    if (success) {
      toast({
        title: 'Link copied',
        description: 'Share link copied to clipboard',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Share2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Share Document</h2>
                  <p className="text-sm text-slate-500 truncate max-w-[280px]">{documentTitle}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Email Input */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Share with people
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                    placeholder="Add email addresses"
                    aria-label="Email address to share with"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleAddEmail}
                  disabled={!email.includes('@')}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  aria-label="Add email to share list"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              {/* Email Tags */}
              {emails.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {emails.map((e) => (
                    <span
                      key={e}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {e}
                      <button onClick={() => handleRemoveEmail(e)} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Permission Selector */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Permission</label>
              <div className="grid grid-cols-4 gap-2">
                {permissionOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setPermission(opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                        permission === opt.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', permission === opt.value ? 'text-blue-600' : 'text-slate-500')} />
                      <span className={cn('text-xs font-medium', permission === opt.value ? 'text-blue-700' : 'text-slate-600')}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ChevronDown className={cn('w-4 h-4 transition-transform', showAdvanced && 'rotate-180')} />
              Advanced options
            </button>

            {/* Advanced Options */}
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Message (optional)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a message to include in the invitation..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Expires in</span>
                  </div>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="never">Never</option>
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyByEmail}
                    onChange={(e) => setNotifyByEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-600">Send email notification</span>
                </label>
              </motion.div>
            )}

            {/* Share Button */}
            <button
              onClick={handleShare}
              disabled={emails.length === 0 || sharing}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {sharing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Share with {emails.length} {emails.length === 1 ? 'person' : 'people'}
                </>
              )}
            </button>

            {/* Copy Link */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <Link2 className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${documentType}s/${documentId}`}
                className="flex-1 bg-transparent text-sm text-slate-600 outline-none"
                aria-label="Share link"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1 bg-slate-200 text-slate-700 rounded-md text-sm hover:bg-slate-300 transition-colors flex items-center gap-1"
                aria-label={linkCopied ? 'Link copied' : 'Copy share link'}
              >
                {linkCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {linkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Current Shares */}
          {shares.length > 0 && (
            <div className="border-t border-slate-200">
              <div className="px-6 py-3 bg-slate-50">
                <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  People with access ({shares.length})
                </h3>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  </div>
                ) : (
                  shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {share.sharedWith.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{share.sharedWith}</p>
                          <p className="text-xs text-slate-500">
                            {share.accessedAt ? 'Accessed recently' : 'Not yet accessed'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            onClick={() => setShowPermissionDropdown(showPermissionDropdown === share.id ? null : share.id)}
                            className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 flex items-center gap-1"
                          >
                            {share.permission}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          
                          {showPermissionDropdown === share.id && (
                            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                              {permissionOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleUpdatePermission(share.id, opt.value)}
                                  className={cn(
                                    'w-full px-3 py-2 text-left text-xs hover:bg-slate-50',
                                    share.permission === opt.value && 'bg-blue-50 text-blue-600'
                                  )}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleRevokeShare(share.id)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ShareDialog;
