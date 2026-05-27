import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { ImportsProcessor } from './imports.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'imports',
    }),
  ],
  controllers: [ImportsController],
  providers: [ImportsService, ImportsProcessor],
})
export class ImportsModule {}
