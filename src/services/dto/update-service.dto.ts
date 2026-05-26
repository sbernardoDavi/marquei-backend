import {
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;
}
