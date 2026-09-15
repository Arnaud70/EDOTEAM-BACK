import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class AddMediaDto {
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  url: string;

  @IsIn(['PROFILE', 'WORK', 'DOCUMENT'])
  type: 'PROFILE' | 'WORK' | 'DOCUMENT';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicId?: string;

  @IsOptional()
  @IsIn(['image', 'raw', 'video'])
  resourceType?: string;
}
