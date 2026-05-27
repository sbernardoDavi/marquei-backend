import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';

@Injectable()
export class ImportsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('imports') private importsQueue: Queue,
  ) {}

  async importClients(file: Express.Multer.File, userId: string) {
    // Validar arquivo
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }

    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('Apenas arquivos CSV são suportados');
    }

    // Criar job de importação
    const importJob = await this.prisma.importJob.create({
      data: {
        userId,
        type: 'CLIENTES',
        fileName: file.originalname,
        status: 'NA_FILA',
      },
    });

    // Parse CSV
    const csvContent = file.buffer.toString('utf-8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data as any[];

    // Atualizar total de linhas
    await this.prisma.importJob.update({
      where: { id: importJob.id },
      data: { totalRows: rows.length },
    });

    // Adicionar job na fila
    await this.importsQueue.add('process-clients', {
      importJobId: importJob.id,
      rows,
    });

    return importJob;
  }

  async importAppointments(file: Express.Multer.File, userId: string) {
    // Validar arquivo
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }

    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('Apenas arquivos CSV são suportados');
    }

    // Criar job de importação
    const importJob = await this.prisma.importJob.create({
      data: {
        userId,
        type: 'AGENDAMENTOS',
        fileName: file.originalname,
        status: 'NA_FILA',
      },
    });

    // Parse CSV
    const csvContent = file.buffer.toString('utf-8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data as any[];

    // Atualizar total de linhas
    await this.prisma.importJob.update({
      where: { id: importJob.id },
      data: { totalRows: rows.length },
    });

    // Adicionar job na fila
    await this.importsQueue.add('process-appointments', {
      importJobId: importJob.id,
      rows,
    });

    return importJob;
  }

  async findAll(userId: string) {
    return this.prisma.importJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const importJob = await this.prisma.importJob.findFirst({
      where: { id, userId },
    });

    if (!importJob) {
      throw new BadRequestException('Job de importação não encontrado');
    }

    return importJob;
  }
}
