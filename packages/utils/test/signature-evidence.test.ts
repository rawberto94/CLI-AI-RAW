import { describe, expect, it } from 'vitest';

import { assessSignatureEvidence } from '../src/signature-evidence';

describe('assessSignatureEvidence', () => {
  it('does not treat filled name and title fields as signatures', () => {
    const text = `Buyer
Supplier
Alpine Retail AG
Nordic Components GmbH
Name: Markus Keller
Name: Dr. Stefan Vogt
Title: Head of Procurement
Title: Managing Director
Date:
Date:
Signature:
Signature:

--- EXTRACTED TABLES ---
| Buyer | Supplier |
| --- | --- |
| Name: Markus Keller | Name: Dr. Stefan Vogt |
| Title: Head of Procurement | Title: Managing Director |
| Date: | Date: |
| Signature: | Signature: |`;

    expect(assessSignatureEvidence(text)).toMatchObject({
      hasSignatureBlock: true,
      hasActualSignatureEvidence: false,
      hasBlankSignatureMarkers: true,
    });
  });

  it('detects slash-s signatures', () => {
    expect(assessSignatureEvidence('Signature: /s/ Jane Doe')).toMatchObject({
      hasSignatureBlock: true,
      hasActualSignatureEvidence: true,
    });
  });

  it('detects digital signatures', () => {
    expect(assessSignatureEvidence('Digitally signed by Jane Doe on 1 April 2026')).toMatchObject({
      hasSignatureBlock: true,
      hasActualSignatureEvidence: true,
    });
  });

  it('detects completed signature fields', () => {
    expect(assessSignatureEvidence('Signature: Jane Doe\nName: Jane Doe\nTitle: CEO')).toMatchObject({
      hasSignatureBlock: true,
      hasActualSignatureEvidence: true,
    });
  });

  it('does not treat the next typed name label as a signature', () => {
    expect(assessSignatureEvidence('Signature:\nName: Jane Doe\nTitle: CEO')).toMatchObject({
      hasSignatureBlock: true,
      hasActualSignatureEvidence: false,
    });
  });

  it('does not treat generic obligations to sign as execution evidence', () => {
    expect(assessSignatureEvidence('This Agreement shall be signed by Buyer before work starts.')).toMatchObject({
      hasActualSignatureEvidence: false,
    });
  });

  it('returns no signature block for ordinary contract text', () => {
    expect(assessSignatureEvidence('This agreement starts on 1 April 2026.')).toMatchObject({
      hasSignatureBlock: false,
      hasActualSignatureEvidence: false,
      hasBlankSignatureMarkers: false,
    });
  });

  it('detects persisted visual signature evidence', () => {
    const text = `--- VISUAL SIGNATURE EVIDENCE ---
Signature status: signed
Confidence: 95%
Signed by: Jane Doe; John Smith
Signature date(s): 17.01.2025
Evidence type: visible handwritten or digital signatures on the execution page.`;

    expect(assessSignatureEvidence(text)).toMatchObject({
      hasSignatureBlock: true,
      hasActualSignatureEvidence: true,
      signatureDateText: '17.01.2025',
    });
  });

  it('does not treat unsigned visual evidence as signed', () => {
    const text = `--- VISUAL SIGNATURE EVIDENCE ---
Signature status: unsigned
Confidence: 95%
Reason: Signature blocks are present but empty.`;

    expect(assessSignatureEvidence(text)).toMatchObject({
      hasSignatureBlock: true,
      hasActualSignatureEvidence: false,
    });
  });
});