import { IsOptional, IsString } from 'class-validator';

export class ReviewComponentRequestDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
