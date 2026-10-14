/** The part of multer's file object we use. Declared here so @types/multer is not needed. */
export interface UploadedTextFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
