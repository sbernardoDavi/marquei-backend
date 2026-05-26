import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('professionals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Post()
  @Roles('GESTOR')
  create(@Body() createProfessionalDto: CreateProfessionalDto) {
    return this.professionalsService.create(createProfessionalDto);
  }

  @Get()
  findAll() {
    return this.professionalsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.professionalsService.findOne(id);
  }

  @Patch(':id')
  @Roles('GESTOR')
  update(
    @Param('id') id: string,
    @Body() updateProfessionalDto: UpdateProfessionalDto,
  ) {
    return this.professionalsService.update(id, updateProfessionalDto);
  }

  @Delete(':id')
  @Roles('GESTOR')
  remove(@Param('id') id: string) {
    return this.professionalsService.remove(id);
  }

  @Post(':id/work-schedules')
  @Roles('GESTOR')
  createWorkSchedule(
    @Param('id') id: string,
    @Body() createWorkScheduleDto: CreateWorkScheduleDto,
  ) {
    return this.professionalsService.createWorkSchedule(
      id,
      createWorkScheduleDto,
    );
  }

  @Get(':id/work-schedules')
  getWorkSchedules(@Param('id') id: string) {
    return this.professionalsService.getWorkSchedules(id);
  }

  @Delete(':id/work-schedules/:scheduleId')
  @Roles('GESTOR')
  deleteWorkSchedule(
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.professionalsService.deleteWorkSchedule(id, scheduleId);
  }
}
