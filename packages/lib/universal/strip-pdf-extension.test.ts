import { describe, expect, it } from 'vitest';

import { stripPdfExtension } from './strip-pdf-extension';

describe('stripPdfExtension', () => {
  it('removes a single trailing .pdf', () => {
    expect(stripPdfExtension('Contract.pdf')).toBe('Contract');
    expect(stripPdfExtension('PI KAPPA ALPHA USC 04.03.2026.pdf')).toBe('PI KAPPA ALPHA USC 04.03.2026');
  });

  it('is case-insensitive on the extension', () => {
    expect(stripPdfExtension('Contract.PDF')).toBe('Contract');
    expect(stripPdfExtension('Contract.Pdf')).toBe('Contract');
  });

  it('only strips one extension and only at the end', () => {
    // Guards the doubled-extension bug: a title already carrying .pdf must not
    // keep it, so downstream re-adds land on exactly one.
    expect(stripPdfExtension('Contract.pdf.pdf')).toBe('Contract.pdf');
    expect(stripPdfExtension('report.pdf.summary')).toBe('report.pdf.summary');
  });

  it('leaves titles without the extension untouched', () => {
    expect(stripPdfExtension('Contract')).toBe('Contract');
    expect(stripPdfExtension('2026 Q1 pdf notes')).toBe('2026 Q1 pdf notes');
    expect(stripPdfExtension('')).toBe('');
  });
});
