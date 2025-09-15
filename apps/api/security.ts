import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// File upload validation schema
export const fileUploadSchema = z.object({
  filename: z.string()
    .max(255)
    .regex(/^[a-zA-Z0-9\-_.() ]+$/, 'Invalid filename characters'),
  mimetype: z.enum([
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  size: z.number().max(100 * 1024 * 1024, 'File size must be less than 100MB'),
});

// Contract ID validation
export const contractIdSchema = z.string().regex(
  /^doc-\d{13}-[a-f0-9]{6}$/,
  'Invalid contract ID format'
);

// Tenant ID validation
export const tenantIdSchema = z.string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid tenant ID format');

// Basic HTML entity encoding to prevent XSS
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Sanitize user input to prevent XSS
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove any script tags and escape HTML entities
    const withoutScripts = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return escapeHtml(withoutScripts);
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
}

// Validate contract ID format
export function validateContractId(id: string): boolean {
  try {
    contractIdSchema.parse(id);
    return true;
  } catch {
    return false;
  }
}

// Validate tenant ID format
export function validateTenantId(id: string): boolean {
  try {
    tenantIdSchema.parse(id);
    return true;
  } catch {
    return false;
  }
}

// Prevent path traversal attacks
export function validatePath(path: string): boolean {
  return !path.includes('..') && 
         !path.includes('~') && 
         !/^\//.test(path) &&
         !/[<>:"|?*]/.test(path); // Additional invalid characters
}

// Rate limiting configuration
export const rateLimitConfig = {
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  errorResponseBuilder: function (request: FastifyRequest, context: any) {
    return {
      code: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      retryAfter: Math.ceil(context.ttl / 1000)
    };
  }
};

// Input validation middleware
export async function validateInput(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Sanitize all input data
    if (request.body) {
      request.body = sanitizeInput(request.body);
    }
    if (request.query) {
      request.query = sanitizeInput(request.query);
    }
    if (request.params) {
      request.params = sanitizeInput(request.params);
    }

    // Validate tenant ID if present
    const tenantId = request.headers['x-tenant-id'] as string;
    if (tenantId && !validateTenantId(tenantId)) {
      return reply.code(400).send({ 
        error: 'Invalid tenant ID format',
        details: 'Tenant ID must contain only alphanumeric characters, hyphens, and underscores'
      });
    }

    // Validate contract ID in params if present
    const contractId = (request.params as any)?.contractId || (request.params as any)?.id;
    if (contractId && !validateContractId(contractId)) {
      return reply.code(400).send({ 
        error: 'Invalid contract ID format',
        details: 'Contract ID must follow the format: doc-{timestamp}-{hash}'
      });
    }

  } catch (error) {
    console.error('Input validation error:', error);
    return reply.code(400).send({ 
      error: 'Input validation failed',
      details: 'Invalid request data'
    });
  }
}

// CORS security headers
// CORS configuration
export const corsOptions = {
  origin: (origin: any, callback: any) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-tenant-id']
};

// Security headers middleware
export async function securityHeaders(request: FastifyRequest, reply: FastifyReply) {
  reply.headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
}

// File type validation
export function validateFileType(mimetype: string, filename: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const fileExtension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  
  return allowedTypes.includes(mimetype) && allowedExtensions.includes(fileExtension);
}

// Request logging middleware
export async function requestLogger(request: FastifyRequest, reply: FastifyReply) {
  const startTime = Date.now();
  
  request.log.info({
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    tenantId: request.headers['x-tenant-id'],
    ip: request.ip
  }, 'Incoming request');

  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime;
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      tenantId: request.headers['x-tenant-id']
    }, 'Request completed');
  });
}
