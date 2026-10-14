import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../common/transforms.js';

export class RegisterDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  // bcrypt only reads the first 72 bytes, so longer passwords would be silently cut.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
