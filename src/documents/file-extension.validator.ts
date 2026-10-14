import { FileValidator } from '@nestjs/common';
import type { UploadedTextFile } from './uploaded-file.js';

export interface FileExtensionValidatorOptions {
  /** Lowercase, with the dot: ['.md', '.txt']. */
  extensions: string[];
}

// Nest 12's FileTypeValidator checks magic bytes; plain text has none, so .md and .txt would always fail.
export class FileExtensionValidator extends FileValidator<FileExtensionValidatorOptions, UploadedTextFile> {
  isValid(file?: UploadedTextFile): boolean {
    if (!file?.originalname) return false;
    const dot = file.originalname.lastIndexOf('.');
    return dot > 0 && this.validationOptions.extensions.includes(file.originalname.slice(dot).toLowerCase());
  }

  buildErrorMessage(): string {
    return `Validation failed (allowed file types: ${this.validationOptions.extensions.join(', ')})`;
  }
}
