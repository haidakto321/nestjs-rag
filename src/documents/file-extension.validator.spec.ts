import { FileExtensionValidator } from './file-extension.validator.js';
import type { UploadedTextFile } from './uploaded-file.js';

const validator = new FileExtensionValidator({ extensions: ['.md', '.txt'] });
const file = (originalname: string): UploadedTextFile => ({
  originalname,
  mimetype: 'application/octet-stream',
  size: 1,
  buffer: Buffer.from('x'),
});

describe('FileExtensionValidator', () => {
  it.each(['notes.md', 'NOTES.MD', 'a.b.txt'])('accepts %s', (name) => {
    expect(validator.isValid(file(name))).toBe(true);
  });

  it.each(['report.pdf', 'noextension', '.md', 'archive.md.zip'])('rejects %s', (name) => {
    expect(validator.isValid(file(name))).toBe(false);
  });

  it('rejects a missing file', () => {
    expect(validator.isValid(undefined)).toBe(false);
  });

  it('names the allowed types in its error', () => {
    expect(validator.buildErrorMessage()).toBe('Validation failed (allowed file types: .md, .txt)');
  });
});
