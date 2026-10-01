import { IsOptional, IsString } from 'class-validator';

export class ReturnComponentAllocationDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
