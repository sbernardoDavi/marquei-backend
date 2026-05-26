import { IsDateString, IsNotEmpty } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString()
  @IsNotEmpty()
  newStartTime: string; // ISO 8601 format
}
