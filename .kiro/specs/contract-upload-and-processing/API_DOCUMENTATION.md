# Contract Upload and Processing API Documentation

## Overview

This document provides comprehensive API documentation for the contract upload and processing endpoints. These endpoints enable users to upload contract files (PDF or HTML), track processing progress in real-time, and retrieve generated artifacts.

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

All endpoints require authentication via session cookies or JWT tokens (depending on your auth configuration).

## Endpoints

### 1. Upload Contract

Upload a contract file for processing.

**Endpoint:** `POST /api/contracts/upload`

**Content-Type:** `multipart/form-data`

#### Request

**Form Data Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | File | Yes | Contract file (PDF or HTML format) |
| name | string | No | Custom name for the contract |
| supplier | string | No | Supplier/vendor name |
| client | string | No | Client/customer name |

**File Constraints:**
- Maximum file size: 50MB
- Allowed formats: PDF (`.pdf`), HTML (`.html`, `.htm`)
- File must be readable and not corrupted

#### Response

**Success Response (200 OK):**

```json
{
  "contractId": "clx1234567890abcdef",
  "status": "processing",
  "progressStreamUrl": "/api/contracts/clx1234567890abcdef/progress",
  "message": "Contract uploaded successfully and processing has started"
}
```

**Error Responses:**

**400 Bad Request - File Too Large:**
```json
{
  "error": "File size exceeds maximum allowed size",
  "code": "FILE_TOO_LARGE",
  "details": "Maximum file size is 50MB. Your file is 75MB."
}
```

**400 Bad Request - Invalid Format:**
```json
{
  "error": "Invalid file format",
  "code": "INVALID_FORMAT",
  "details": "Only PDF and HTML files are supported. Received: application/msword"
}
```

**400 Bad Request - Validation Failed:**
```json
{
  "error": "File validation failed",
  "code": "VALIDATION_FAILED",
  "details": "File appears to be corrupted or unreadable"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to process upload",
  "code": "UPLOAD_FAILED",
  "details": "An unexpected error occurred during upload processing"
}
```

#### Example Request

**Using cURL:**

```bash
curl -X POST http://localhost:3000/api/contracts/upload \
  -H "Cookie: session=your-session-token" \
  -F "file=@/path/to/contract.pdf" \
  -F "name=Acme Corp Service Agreement" \
  -F "supplier=Acme Corporation" \
  -F "client=Your Company Inc"
```

**Using JavaScript (Fetch API):**

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', 'Acme Corp Service Agreement');
formData.append('supplier', 'Acme Corporation');
formData.append('client', 'Your Company Inc');

const response = await fetch('/api/contracts/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include'
});

const result = await response.json();
console.log('Contract ID:', result.contractId);
console.log('Progress URL:', result.progressStreamUrl);
```

**Using TypeScript with React:**

```typescript
const handleUpload = async (file: File, metadata: ContractMetadata) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', metadata.name);
  formData.append('supplier', metadata.supplier);
  formData.append('client', metadata.client);

  try {
    const response = await fetch('/api/contracts/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};
```

---

### 2. Track Processing Progress

Subscribe to real-time processing progress updates using Server-Sent Events (SSE).

**Endpoint:** `GET /api/contracts/[id]/progress`

**Content-Type:** `text/event-stream`

#### Request

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Contract ID returned from upload endpoint |

#### Response

**Success Response (200 OK):**

The endpoint returns a stream of Server-Sent Events. Each event contains progress information.

**Event Types:**

1. **Progress Event**
2. **Stage Completion Event**
3. **Error Event**
4. **Completion Event**

#### Event Formats

**Progress Event:**

```
event: progress
data: {
  "type": "progress",
  "stage": "extracting",
  "progress": 45,
  "message": "Extracting text from document...",
  "estimatedTimeRemaining": 30000
}
```

**Stage Completion Event:**

```
event: stage_complete
data: {
  "type": "stage_complete",
  "stage": "analyzing",
  "progress": 70,
  "message": "Document analysis complete",
  "timestamp": "2025-11-02T10:30:45.123Z"
}
```

**Error Event:**

```
event: error
data: {
  "type": "error",
  "stage": "analyzing",
  "error": "AI service timeout",
  "code": "AI_TIMEOUT",
  "recoverable": true,
  "suggestions": [
    "The system will automatically retry",
    "If the issue persists, try uploading a smaller file"
  ]
}
```

**Completion Event:**

```
event: complete
data: {
  "type": "complete",
  "progress": 100,
  "message": "Processing completed successfully",
  "artifactCount": 4,
  "duration": 45000,
  "timestamp": "2025-11-02T10:31:15.456Z"
}
```

#### Processing Stages

| Stage | Description | Typical Progress Range |
|-------|-------------|----------------------|
| started | Processing initiated | 0-10% |
| extracting | Extracting text from document | 10-30% |
| analyzing | AI analysis in progress | 30-70% |
| generating | Generating artifacts | 70-90% |
| finalizing | Finalizing and storing results | 90-99% |
| completed | Processing complete | 100% |

#### Example Request

**Using JavaScript (EventSource API):**

```javascript
const contractId = 'clx1234567890abcdef';
const eventSource = new EventSource(`/api/contracts/${contractId}/progress`);

eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Progress: ${data.progress}% - ${data.message}`);
  updateProgressBar(data.progress);
});

eventSource.addEventListener('stage_complete', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Stage "${data.stage}" completed`);
});

eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error(`Error during ${data.stage}:`, data.error);
  if (data.suggestions) {
    console.log('Suggestions:', data.suggestions);
  }
});

eventSource.addEventListener('complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Processing complete!', data);
  eventSource.close();
  navigateToContractDetails(contractId);
});

// Handle connection errors
eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  eventSource.close();
};
```

**Using TypeScript with React Hook:**

```typescript
import { useEffect, useState } from 'react';

interface ProgressData {
  type: string;
  stage: string;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export const useContractProgress = (contractId: string) => {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/contracts/${contractId}/progress`
    );

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
    });

    eventSource.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      setError(data.error);
    });

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
      setIsComplete(true);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setError('Connection lost');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [contractId]);

  return { progress, error, isComplete };
};
```

**Using cURL (for testing):**

```bash
curl -N -H "Cookie: session=your-session-token" \
  http://localhost:3000/api/contracts/clx1234567890abcdef/progress
```

---

## Complete Workflow Example

Here's a complete example showing how to upload a contract and track its progress:

```typescript
import { useState } from 'react';

interface UploadResult {
  contractId: string;
  status: string;
  progressStreamUrl: string;
}

interface ProgressUpdate {
  stage: string;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export const ContractUploadWorkflow = () => {
  const [uploading, setUploading] = useState(false);
  const [contractId, setContractId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadContract = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);

      const uploadResponse = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.details || errorData.error);
      }

      const result: UploadResult = await uploadResponse.json();
      setContractId(result.contractId);
      setUploading(false);

      // Step 2: Connect to progress stream
      const eventSource = new EventSource(
        `/api/contracts/${result.contractId}/progress`
      );

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        setProgress(data);
      });

      eventSource.addEventListener('error', (event) => {
        const data = JSON.parse(event.data);
        setError(data.error);
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        setProgress(data);
        eventSource.close();
        
        // Navigate to contract details or show success message
        console.log('Processing complete!', data);
      });

      eventSource.onerror = () => {
        setError('Connection to progress stream lost');
        eventSource.close();
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Your UI components here */}
      {uploading && <p>Uploading...</p>}
      {progress && (
        <div>
          <p>{progress.message}</p>
          <progress value={progress.progress} max={100} />
          {progress.estimatedTimeRemaining && (
            <p>Estimated time: {progress.estimatedTimeRemaining / 1000}s</p>
          )}
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};
```

---

## Error Handling Best Practices

### Client-Side Error Handling

1. **Validate files before upload:**
```typescript
const validateFile = (file: File): string | null => {
  const maxSize = 50 * 1024 * 1024; // 50MB
  const allowedTypes = ['application/pdf', 'text/html'];

  if (file.size > maxSize) {
    return `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum of 50MB`;
  }

  if (!allowedTypes.includes(file.type)) {
    return `File type ${file.type} is not supported. Please upload PDF or HTML files.`;
  }

  return null;
};
```

2. **Handle network errors:**
```typescript
const uploadWithRetry = async (file: File, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadContract(file);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

3. **Handle SSE connection issues:**
```typescript
const connectWithReconnect = (contractId: string, maxReconnects = 3) => {
  let reconnectAttempts = 0;
  let eventSource: EventSource;

  const connect = () => {
    eventSource = new EventSource(`/api/contracts/${contractId}/progress`);

    eventSource.onerror = () => {
      eventSource.close();
      
      if (reconnectAttempts < maxReconnects) {
        reconnectAttempts++;
        setTimeout(connect, 2000 * reconnectAttempts);
      } else {
        console.error('Max reconnection attempts reached');
      }
    };

    // Add other event listeners...
  };

  connect();
  return () => eventSource?.close();
};
```

---

## Rate Limiting

The upload endpoint is rate-limited to prevent abuse:

- **Limit:** 10 uploads per hour per user
- **Response when limit exceeded:**

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": "You have exceeded the maximum number of uploads. Please try again in 30 minutes.",
  "retryAfter": 1800
}
```

---

## Performance Considerations

### Upload Performance

- Files under 10MB typically upload in < 2 seconds
- Large files (40-50MB) may take 5-10 seconds depending on network speed
- Use chunked uploads for files > 25MB (handled automatically)

### Processing Performance

- Simple contracts (< 10 pages): 30-60 seconds
- Medium contracts (10-50 pages): 1-3 minutes
- Complex contracts (> 50 pages): 3-5 minutes

### Optimization Tips

1. **Compress PDFs before upload** to reduce file size
2. **Use progress events** to provide user feedback
3. **Implement client-side caching** for repeated uploads
4. **Close SSE connections** when no longer needed

---

## Security Considerations

### File Security

- All uploaded files are scanned for malware
- Files are stored with secure permissions
- SHA-256 hashes are calculated for integrity verification
- File names are sanitized to prevent path traversal attacks

### API Security

- All endpoints require authentication
- CSRF protection is enabled
- Rate limiting prevents abuse
- Input validation prevents injection attacks

### Data Privacy

- Uploaded contracts are encrypted at rest
- Processing logs do not contain sensitive data
- Files can be deleted upon request
- Access is restricted to authorized users only

---

## Troubleshooting

### Common Issues

**Issue: Upload fails with "FILE_TOO_LARGE"**
- **Solution:** Compress the PDF or split into multiple files

**Issue: Progress stream disconnects**
- **Solution:** Implement reconnection logic (see example above)

**Issue: Processing takes longer than expected**
- **Solution:** Check AI service status, verify file is not corrupted

**Issue: "INVALID_FORMAT" error for valid PDF**
- **Solution:** Ensure PDF is not password-protected or corrupted

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
DEBUG=contract:upload,contract:processing
```

This will log detailed information about the upload and processing workflow.

---

## API Versioning

Current API version: **v1**

Future versions will be accessible via:
```
/api/v2/contracts/upload
```

Breaking changes will be announced 90 days in advance.

---

## Support

For API support or to report issues:
- Email: api-support@your-domain.com
- Documentation: https://docs.your-domain.com
- Status Page: https://status.your-domain.com
