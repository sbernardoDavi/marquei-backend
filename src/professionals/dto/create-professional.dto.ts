import { IsNotEmpty, IsString, IsArray, IsOptional } from 'class-validator';

export class CreateProfessionalDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceIds?: string[];
}
