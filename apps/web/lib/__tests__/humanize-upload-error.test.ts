import { describe, expect, it } from 'vitest';

import { humanizeUploadError } from '../utils';

describe('humanizeUploadError', () => {
  it('maps virus / security scan rejections', () => {
    expect(humanizeUploadError('Virus detected in upload')).toEqual({
      message: 'File rejected by security scan',
      detail: 'Virus detected in upload',
    });
  });

  it('maps quota errors', () => {
    expect(humanizeUploadError('Upload quota exceeded')).toEqual({
      message: 'Upload quota reached — delete unused contracts or retry later',
      detail: 'Upload quota exceeded',
    });
  });

  it('maps OCR / document intelligence failures', () => {
    expect(humanizeUploadError('OCR failed: Document Intelligence could not read the file')).toEqual({
      message: 'Could not read the document text — retry or try a clearer PDF',
      detail: 'OCR failed: Document Intelligence could not read the file',
    });
  });

  it('passes plain short messages through', () => {
    expect(humanizeUploadError('Page count exceeds the trial limit')).toEqual({
      message: 'Page count exceeds the trial limit',
      detail: 'Page count exceeds the trial limit',
    });
  });

  it('uses the retry fallback for empty input', () => {
    expect(humanizeUploadError(null)).toEqual({ message: 'Processing failed — retry' });
    expect(humanizeUploadError('')).toEqual({ message: 'Processing failed — retry' });
  });
});
