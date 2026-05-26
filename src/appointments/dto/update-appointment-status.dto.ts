import { IsEnum, IsNotEmpty } from 'class-validator';

export enum AppointmentStatus {
  AGENDADO = 'AGENDADO',
  REALIZADO = 'REALIZADO',
  NO_SHOW = 'NO_SHOW',
  CANCELADO = 'CANCELADO',
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  @IsNotEmpty()
  status: AppointmentStatus;
}
