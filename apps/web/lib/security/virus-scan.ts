/**
 * Virus/Malware Scanning Service
 * 
 * Provides file scanning before storage. In production, connects to ClamAV daemon.
 * Falls back to basic heuristic checks when ClamAV is unavailable.
 */

import { logger } from '@/lib/logger';
import { getCircuitBreaker, CircuitOpenError } from '@/lib/scalability/circuit-breaker';

// Circuit breaker for ClamAV connections — opens after 5 failures in 60s, resets after 30s
const clamavBreaker = getCircuitBreaker('clamav-scan', {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 30000,
  failureWindow: 60000,
});

export interface ScanResult {
  clean: boolean;
  threats: string[];
  scanner: 'clamav' | 'heuristic' | 'disabled';
  scannedAt: string;
  durationMs: number;
}

// ClamAV configuration
const CLAMAV_HOST = process.env.CLAMAV_HOST || 'localhost';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310');
const SCAN_ENABLED = process.env.VIRUS_SCAN_ENABLED === 'true';

// Known malicious file signatures (magic bytes)
const MALICIOUS_SIGNATURES: Array<{ name: string; bytes: number[] }> = [
  // EICAR test file
  { name: 'EICAR-Test-File', bytes: [0x58, 0x35, 0x4F, 0x21, 0x50, 0x25] },
  // Executable in disguise
  { name: 'PE-Executable', bytes: [0x4D, 0x5A] }, // MZ header
  // ELF binary
  { name: 'ELF-Binary', bytes: [0x7F, 0x45, 0x4C, 0x46] },
];

// File extensions that should never be uploaded as contracts
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.js', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.psm1', '.psd1',
  '.sh', '.bash', '.csh',
  '.dll', '.sys', '.drv',
];

/**
 * Scan a file buffer for viruses/malware
 */
export async function scanBuffer(buffer: Buffer, fileName?: string): Promise<ScanResult> {
  const startTime = Date.now();

  // Check if scanning is explicitly disabled
  if (!SCAN_ENABLED) {
    return {
      clean: true,
      threats: [],
      scanner: 'disabled',
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  // Try ClamAV first (via circuit breaker)
  try {
    const result = await clamavBreaker.execute(() => scanWithClamAV(buffer));
    return {
      ...result,
      scanner: 'clamav',
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  } catch (clamError) {
    if (clamError instanceof CircuitOpenError) {
      logger.warn(`ClamAV circuit open, using heuristic scan. Retry in ${Math.ceil(clamError.retryAfter / 1000)}s`);
    } else {
      logger.warn(`ClamAV unavailable, falling back to heuristic scan: ${clamError instanceof Error ? clamError.message : 'unknown'}`);
    }
  }

  // Fallback: heuristic scanning
  const threats: string[] = [];

  // 1. Check blocked extensions
  if (fileName) {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      threats.push(`Blocked file extension: ${ext}`);
    }
  }

  // 2. Check magic bytes for known malicious signatures
  for (const sig of MALICIOUS_SIGNATURES) {
    if (buffer.length >= sig.bytes.length) {
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        threats.push(`Suspicious file signature: ${sig.name}`);
      }
    }
  }

  // 3. Check for embedded scripts in documents
  const textSample = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
  if (/<script\b/i.test(textSample) && fileName && /\.(pdf|doc|docx)$/i.test(fileName)) {
    threats.push('Embedded script detected in document');
  }

  return {
    clean: threats.length === 0,
    threats,
    scanner: 'heuristic',
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Scan buffer using ClamAV daemon (clamd) via TCP
 */
async function scanWithClamAV(buffer: Buffer): Promise<Pick<ScanResult, 'clean' | 'threats'>> {
  const net = await import('net');

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let response = '';

    socket.setTimeout(30000); // 30s timeout

    socket.connect(CLAMAV_PORT, CLAMAV_HOST, () => {
      // Send INSTREAM command
      socket.write('zINSTREAM\0');

      // Send file data in chunks
      const chunkSize = 2048;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, offset + chunkSize);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }

      // Signal end of data
      const endChunk = Buffer.alloc(4);
      endChunk.writeUInt32BE(0, 0);
      socket.write(endChunk);
    });

    socket.on('data', (data) => {
      response += data.toString();
    });

    socket.on('end', () => {
      const trimmed = response.trim();
      if (trimmed.includes('OK')) {
        resolve({ clean: true, threats: [] });
      } else if (trimmed.includes('FOUND')) {
        const threat = trimmed.replace('stream: ', '').replace(' FOUND', '');
        resolve({ clean: false, threats: [threat] });
      } else {
        reject(new Error(`Unexpected ClamAV response: ${trimmed}`));
      }
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('ClamAV scan timeout'));
    });
  });
}
