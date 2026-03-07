/**
 * Input Sanitization & XSS Protection
 * Utilities for sanitizing user input and preventing XSS attacks
 * 
 * @example
 * import { sanitize, sanitizeHtml, escapeHtml } from '@/lib/security/sanitize';
 * 
 * // Sanitize user input
 * const cleanInput = sanitize.string(userInput);
 * 
 * // Sanitize HTML content
 * const cleanHtml = sanitizeHtml(richTextContent);
 */

// ============================================================================
// HTML Entity Encoding
// ============================================================================

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

const ENTITY_PATTERN = /[&<>"'`=/]/g;

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(ENTITY_PATTERN, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Unescape HTML entities
 */
export function unescapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
    '&#39;': "'",
    '&apos;': "'",
  };
  
  return str.replace(
    /&(?:amp|lt|gt|quot|#x27|#x2F|#x60|#x3D|#39|apos);/gi,
    (entity) => entities[entity.toLowerCase()] ?? entity
  );
}

// ============================================================================
// String Sanitization
// ============================================================================

/**
 * Remove potentially dangerous characters from string
 */
export function sanitizeString(
  str: unknown,
  options: {
    maxLength?: number;
    trim?: boolean;
    lowercase?: boolean;
    removeHtml?: boolean;
    allowedChars?: RegExp;
  } = {}
): string {
  const {
    maxLength = 10000,
    trim = true,
    lowercase = false,
    removeHtml = true,
    allowedChars,
  } = options;

  // Convert to string
  let result = String(str ?? '');
  
  // Trim whitespace
  if (trim) {
    result = result.trim();
  }
  
  // Remove HTML tags
  if (removeHtml) {
    result = stripHtml(result);
  }
  
  // Remove null bytes
  result = result.replace(/\0/g, '');
  
  // Remove control characters (except newlines and tabs)
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Apply allowed chars filter
  if (allowedChars) {
    result = result.split('').filter(char => allowedChars.test(char)).join('');
  }
  
  // Lowercase
  if (lowercase) {
    result = result.toLowerCase();
  }
  
  // Truncate to max length
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  
  return result;
}

/**
 * Strip all HTML tags from string
 */
export function stripHtml(str: string): string {
  if (typeof str !== 'string') return '';
  
  // Remove script and style contents entirely
  let result = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove HTML tags
  result = result.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  result = unescapeHtml(result);
  
  return result;
}

// ============================================================================
// HTML Sanitization (for rich text)
// ============================================================================

interface SanitizeHtmlOptions {
  /** Allowed HTML tags */
  allowedTags?: string[];
  /** Allowed attributes per tag */
  allowedAttributes?: Record<string, string[]>;
  /** Allowed URL schemes */
  allowedSchemes?: string[];
  /** Allow data URIs */
  allowDataUrls?: boolean;
  /** Strip all tags (output plain text) */
  stripAll?: boolean;
}

const DEFAULT_ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'strike', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'blockquote', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div',
];

const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['class', 'id'],
};

const DEFAULT_ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/**
 * Sanitize HTML content while preserving allowed tags
 */
export function sanitizeHtml(
  html: string,
  options: SanitizeHtmlOptions = {}
): string {
  const {
    allowedTags = DEFAULT_ALLOWED_TAGS,
    allowedAttributes = DEFAULT_ALLOWED_ATTRIBUTES,
    allowedSchemes = DEFAULT_ALLOWED_SCHEMES,
    allowDataUrls = false,
    stripAll = false,
  } = options;

  if (typeof html !== 'string') return '';
  
  if (stripAll) {
    return stripHtml(html);
  }

  // Create a simple parser
  let result = '';
  let i = 0;
  
  while (i < html.length) {
    if (html[i] === '<') {
      // Find the end of the tag
      const tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) {
        result += escapeHtml(html.slice(i));
        break;
      }
      
      const tagContent = html.slice(i + 1, tagEnd);
      const isClosing = tagContent.startsWith('/');
      const tagParts = (isClosing ? tagContent.slice(1) : tagContent).split(/\s+/);
      const tagName = (tagParts[0] ?? '').toLowerCase();
      
      if (allowedTags.includes(tagName)) {
        // Sanitize attributes
        const sanitizedAttrs = sanitizeAttributes(
          tagContent,
          tagName,
          allowedAttributes,
          allowedSchemes,
          allowDataUrls
        );
        
        if (isClosing) {
          result += `</${tagName}>`;
        } else {
          result += `<${tagName}${sanitizedAttrs}>`;
        }
      }
      // Skip disallowed tags (don't output anything)
      
      i = tagEnd + 1;
    } else {
      // Regular text - escape it
      let textEnd = html.indexOf('<', i);
      if (textEnd === -1) textEnd = html.length;
      
      result += escapeHtml(html.slice(i, textEnd));
      i = textEnd;
    }
  }
  
  return result;
}

/**
 * Sanitize tag attributes
 */
function sanitizeAttributes(
  tagContent: string,
  tagName: string,
  allowedAttributes: Record<string, string[]>,
  allowedSchemes: string[],
  allowDataUrls: boolean
): string {
  const attrMatch = tagContent.match(/\s+(.+)/);
  if (!attrMatch) return '';
  
  const attrString = attrMatch[1] ?? '';
  const attrs: string[] = [];
  
  // Parse attributes
  const attrPattern = /([a-z-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
  let match;
  
  while ((match = attrPattern.exec(attrString)) !== null) {
    const attrName = (match[1] ?? '').toLowerCase();
    const attrValue = match[2] ?? match[3] ?? match[4] ?? '';
    
    // Check if attribute is allowed
    const tagAllowed = allowedAttributes[tagName] ?? [];
    const globalAllowed = allowedAttributes['*'] ?? [];
    
    if (!tagAllowed.includes(attrName) && !globalAllowed.includes(attrName)) {
      continue;
    }
    
    // Special handling for URLs
    if (['href', 'src', 'action'].includes(attrName)) {
      const sanitizedUrl = sanitizeUrl(attrValue, allowedSchemes, allowDataUrls);
      if (sanitizedUrl) {
        attrs.push(`${attrName}="${escapeHtml(sanitizedUrl)}"`);
      }
    } else if (attrName.startsWith('on')) {
      // Skip event handlers
      continue;
    } else {
      attrs.push(`${attrName}="${escapeHtml(attrValue)}"`);
    }
  }
  
  return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
}

// ============================================================================
// URL Sanitization
// ============================================================================

/**
 * Sanitize URL to prevent javascript: and other dangerous schemes
 */
export function sanitizeUrl(
  url: string,
  allowedSchemes = DEFAULT_ALLOWED_SCHEMES,
  allowDataUrls = false
): string | null {
  if (typeof url !== 'string') return null;
  
  const trimmed = url.trim().toLowerCase();
  
  // Check for javascript: or other dangerous schemes
  if (trimmed.startsWith('javascript:') || 
      trimmed.startsWith('vbscript:') ||
      trimmed.startsWith('data:text/html')) {
    return null;
  }
  
  // Allow data URLs only if explicitly enabled
  if (trimmed.startsWith('data:')) {
    if (!allowDataUrls) return null;
    // Only allow safe data URL types
    if (!trimmed.startsWith('data:image/')) return null;
  }
  
  // Check scheme
  const schemeMatch = url.match(/^([a-z][a-z0-9+.-]*):/) ;
  if (schemeMatch) {
    const scheme = schemeMatch[1]?.toLowerCase();
    if (scheme && !allowedSchemes.includes(scheme)) {
      return null;
    }
  }
  
  // Allow relative URLs
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return url;
  }
  
  // Allow protocol-relative URLs
  if (url.startsWith('//')) {
    return url;
  }
  
  return url;
}

// ============================================================================
// SQL Injection Prevention
// ============================================================================

/**
 * Escape string for use in SQL queries (use parameterized queries instead!)
 * This is a fallback - always prefer parameterized queries
 */
export function escapeSql(str: string): string {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
}

/**
 * Check if string contains potential SQL injection patterns
 */
export function hasSqlInjection(str: string): boolean {
  if (typeof str !== 'string') return false;
  
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(-{2}|;|\*|'|"|`)/,
    /(OR|AND)\s+\d+\s*=\s*\d+/i,
    /SLEEP\s*\(/i,
    /BENCHMARK\s*\(/i,
    /LOAD_FILE\s*\(/i,
    /INTO\s+(OUT|DUMP)FILE/i,
  ];
  
  return patterns.some(pattern => pattern.test(str));
}

// ============================================================================
// Path Traversal Prevention
// ============================================================================

/**
 * Sanitize file path to prevent directory traversal attacks
 */
export function sanitizePath(path: string): string {
  if (typeof path !== 'string') return '';
  
  return path
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove path traversal sequences
    .replace(/\.\./g, '')
    .replace(/\.{2,}/g, '.')
    // Remove leading slashes
    .replace(/^[/\\]+/, '')
    // Normalize separators
    .replace(/[/\\]+/g, '/')
    // Remove query strings
    .split('?')[0] ?? '';
}

/**
 * Check if path contains traversal attempt
 */
export function hasPathTraversal(path: string): boolean {
  if (typeof path !== 'string') return false;
  
  return path.includes('..') || 
         path.includes('%2e%2e') ||
         path.includes('%252e%252e');
}

// ============================================================================
// Comprehensive Sanitizer Object
// ============================================================================

export const sanitize = {
  /** Sanitize plain string */
  string: sanitizeString,
  
  /** Sanitize HTML content */
  html: sanitizeHtml,
  
  /** Strip all HTML tags */
  stripHtml,
  
  /** Escape HTML entities */
  escape: escapeHtml,
  
  /** Unescape HTML entities */
  unescape: unescapeHtml,
  
  /** Sanitize URL */
  url: sanitizeUrl,
  
  /** Sanitize file path */
  path: sanitizePath,
  
  /** Sanitize email */
  email: (email: string): string => {
    const sanitized = sanitizeString(email, { 
      maxLength: 254, 
      trim: true, 
      lowercase: true 
    });
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : '';
  },
  
  /** Sanitize username */
  username: (username: string): string => {
    return sanitizeString(username, {
      maxLength: 50,
      trim: true,
      lowercase: true,
      allowedChars: /[a-z0-9_-]/,
    });
  },
  
  /** Sanitize filename */
  filename: (filename: string): string => {
    return sanitizeString(filename, {
      maxLength: 255,
      trim: true,
      allowedChars: /[a-zA-Z0-9._-]/,
    }).replace(/^\.+/, ''); // Remove leading dots
  },
  
  /** Sanitize slug */
  slug: (str: string): string => {
    return sanitizeString(str, { trim: true, lowercase: true })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  },
  
  /** Sanitize phone number */
  phone: (phone: string): string => {
    return sanitizeString(phone, {
      maxLength: 20,
      allowedChars: /[0-9+()-\s]/,
    });
  },
  
  /** Sanitize number string */
  number: (str: string): string => {
    return sanitizeString(str, {
      allowedChars: /[0-9.-]/,
    });
  },
  
  /** Sanitize alphanumeric */
  alphanumeric: (str: string): string => {
    return sanitizeString(str, {
      allowedChars: /[a-zA-Z0-9]/,
    });
  },
  
  /** Sanitize JSON string */
  json: <T>(str: string, fallback: T): T => {
    try {
      const parsed = JSON.parse(str);
      return parsed as T;
    } catch {
      return fallback;
    }
  },
  
  /** Sanitize object recursively */
  object: <T extends Record<string, unknown>>(obj: T): T => {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key, { maxLength: 100 });
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map(item => 
          typeof item === 'string' ? sanitizeString(item) :
          typeof item === 'object' && item !== null ? sanitize.object(item as Record<string, unknown>) :
          item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = sanitize.object(value as Record<string, unknown>);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    
    return sanitized as T;
  },
};

// ============================================================================
// Validation Helpers
// ============================================================================

export const validate = {
  /** Check for XSS patterns */
  hasXss: (str: string): boolean => {
    if (typeof str !== 'string') return false;
    
    const patterns = [
      /<script\b/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe\b/i,
      /<object\b/i,
      /<embed\b/i,
      /<link\b/i,
      /<meta\b/i,
      /expression\s*\(/i,
      /url\s*\(/i,
    ];
    
    return patterns.some(pattern => pattern.test(str));
  },
  
  /** Check for SQL injection */
  hasSqlInjection,
  
  /** Check for path traversal */
  hasPathTraversal,
  
  /** Check if string is safe */
  isSafe: (str: string): boolean => {
    return !validate.hasXss(str) && 
           !validate.hasSqlInjection(str) && 
           !validate.hasPathTraversal(str);
  },
};

// ============================================================================
// Exports
// ============================================================================

export {
  DEFAULT_ALLOWED_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  DEFAULT_ALLOWED_SCHEMES,
};
