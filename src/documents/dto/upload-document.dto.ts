import { IsIn, IsOptional } from 'class-validator';
import { VISIBILITIES, type Visibility } from '../entities/document.entity.js';

/** The text fields of the multipart form. The file itself is handled by FileInterceptor. */
export class UploadDocumentDto {
  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: Visibility;
}
