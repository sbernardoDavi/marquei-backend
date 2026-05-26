import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class AvailableSlotsDto {
  @IsString()
  @IsNotEmpty()
  professionalId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD format
}
