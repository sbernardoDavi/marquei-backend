import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('GESTOR')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('clients')
  @UseInterceptors(FileInterceptor('file'))
  importClients(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.importsService.importClients(file, user.id);
  }

  @Post('appointments')
  @UseInterceptors(FileInterceptor('file'))
  importAppointments(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.importsService.importAppointments(file, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.importsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.importsService.findOne(id, user.id);
  }
}
