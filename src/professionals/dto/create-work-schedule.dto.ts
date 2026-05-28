import { IsNotEmpty, IsString, Matches, IsIn } from 'class-validator';

export class CreateWorkScheduleDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(
    ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO'],
    {
      message:
        'dayOfWeek deve ser um dia válido: SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, SABADO, DOMINGO',
    },
  )
  dayOfWeek: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime deve estar no formato HH:mm',
  })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime deve estar no formato HH:mm',
  })
  endTime: string;
}
