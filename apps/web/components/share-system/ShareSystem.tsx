'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Link, Mail, QrCode, Share2, Twitter, Facebook, Linkedin, MessageCircle, X } from 'lucide-react';

// ============================================================================
// Share Context
// ============================================================================

interface ShareData {
  title: string;
  text?: string;
  url: string;
}

interface ShareContextValue {
  share: (data: ShareData) => void;
  canShare: boolean;
}

const ShareContext = createContext<ShareContextValue | null>(null);

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const share = useCallback(async (data: ShareData) => {
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch (err) {
        // User cancelled or error
      }
    }
  }, []);

  return (
    <ShareContext.Provider value={{ share, canShare }}>
      {children}
    </ShareContext.Provider>
  );
}

export function useShare() {
  const context = useContext(ShareContext);
  if (!context) {
    throw new Error('useShare must be used within a ShareProvider');
  }
  return context;
}

// ============================================================================
// Share Button
// ============================================================================

interface ShareButtonProps {
  data: ShareData;
  fallback?: 'modal' | 'copy';
  className?: string;
  children?: React.ReactNode;
}

export function ShareButton({ data, fallback = 'modal', className = '', children }: ShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const { share, canShare } = useShare();

  const handleClick = async () => {
    if (canShare) {
      share(data);
    } else if (fallback === 'modal') {
      setShowModal(true);
    } else {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-2 ${className}`}
      >
        {children || (
          <>
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Share'}
          </>
        )}
      </button>

      <ShareModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        data={data}
      />
    </>
  );
}

// ============================================================================
// Share Modal
// ============================================================================

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareData;
}

export function ShareModal({ isOpen, onClose, data }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const encodedUrl = encodeURIComponent(data.url);
  const encodedTitle = encodeURIComponent(data.title);
  const encodedText = encodeURIComponent(data.text || '');

  const shareLinks = [
    {
      name: 'Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: 'hover:bg-blue-100 dark:hover:bg-blue-900',
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:bg-blue-100 dark:hover:bg-blue-900',
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
      color: 'hover:bg-blue-100 dark:hover:bg-blue-900',
    },
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: 'hover:bg-green-100 dark:hover:bg-green-900',
    },
    {
      name: 'Email',
      icon: Mail,
      url: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
      color: 'hover:bg-gray-100 dark:hover:bg-gray-800',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-white dark:bg-gray-900 rounded-2xl p-6 z-50 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Share
              </h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-6">
              {shareLinks.map(link => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${link.color}`}
                >
                  <link.icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {link.name}
                  </span>
                </a>
              ))}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Or copy link
              </label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Link className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {data.url}
                  </span>
                </div>
                <button
                  onClick={copyLink}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Copy Link Button
// ============================================================================

interface CopyLinkButtonProps {
  url: string;
  className?: string;
}

export function CopyLinkButton({ url, className = '' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        copied
          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
      } ${className}`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
      {copied ? 'Copied!' : 'Copy Link'}
    </button>
  );
}

// ============================================================================
// Social Share Buttons
// ============================================================================

interface SocialShareButtonsProps {
  url: string;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export function SocialShareButtons({
  url,
  title,
  size = 'md',
  showLabels = false,
  className = '',
}: SocialShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const platforms = [
    {
      name: 'Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      bg: 'bg-[#1DA1F2] hover:bg-[#1a8cd8]',
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      bg: 'bg-[#1877F2] hover:bg-[#166fe5]',
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
      bg: 'bg-[#0A66C2] hover:bg-[#095bb5]',
    },
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {platforms.map(platform => (
        <a
          key={platform.name}
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${sizeClasses[size]} ${platform.bg} rounded-lg text-white transition-colors flex items-center gap-2`}
        >
          <platform.icon className={iconSizes[size]} />
          {showLabels && (
            <span className="text-sm font-medium">{platform.name}</span>
          )}
        </a>
      ))}
    </div>
  );
}

// ============================================================================
// QR Code Share
// ============================================================================

interface QRShareButtonProps {
  url: string;
  className?: string;
}

export function QRShareButton({ url, className = '' }: QRShareButtonProps) {
  const [showQR, setShowQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <button
        onClick={() => setShowQR(true)}
        className={`inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors ${className}`}
      >
        <QrCode className="w-4 h-4" />
        QR Code
      </button>

      <AnimatePresence>
        {showQR && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowQR(false)}
            />
            <motion.div
              ref={qrRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-xs mx-auto bg-white dark:bg-gray-900 rounded-2xl p-6 z-50 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  QR Code
                </h3>
                <button
                  onClick={() => setShowQR(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                {/* Placeholder for QR code - in real app, use a QR library */}
                <div className="w-48 h-48 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-gray-400" />
                </div>
              </div>
              
              <p className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
                Scan with your phone to open
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Share Sheet (Mobile-style)
// ============================================================================

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareData;
  additionalActions?: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }>;
}

export function ShareSheet({ isOpen, onClose, data, additionalActions = [] }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1500);
  };

  const encodedUrl = encodeURIComponent(data.url);
  const encodedTitle = encodeURIComponent(data.title);

  const actions = [
    {
      icon: <Copy className="w-6 h-6" />,
      label: copied ? 'Copied!' : 'Copy Link',
      onClick: copyLink,
    },
    ...additionalActions,
  ];

  const socials = [
    {
      icon: <Twitter className="w-6 h-6" />,
      label: 'Twitter',
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      icon: <Facebook className="w-6 h-6" />,
      label: 'Facebook',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      icon: <Linkedin className="w-6 h-6" />,
      label: 'LinkedIn',
      url: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      label: 'WhatsApp',
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      icon: <Mail className="w-6 h-6" />,
      label: 'Email',
      url: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-3xl z-50 max-h-[80vh] overflow-auto"
          >
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3" />
            
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Share
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-1">
                {data.title}
              </p>

              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                {socials.map(social => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 shrink-0"
                  >
                    <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300">
                      {social.icon}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {social.label}
                    </span>
                  </a>
                ))}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-2 space-y-1">
                {actions.map((action, i) => (
                  <button
                    key={i}
                    onClick={action.onClick}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-700 dark:text-gray-300"
                  >
                    {action.icon}
                    <span className="font-medium">{action.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full mt-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
