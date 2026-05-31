import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

@Injectable()
export class ImportsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('imports') private importsQueue: Queue,
  ) {}

  /**
   * Valida e processa arquivo (CSV ou Excel) retornando array de objetos
   */
  private parseFile(file: Express.Multer.File): any[] {
    const fileName = file.originalname.toLowerCase();

    // Validar extensão
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExtension = validExtensions.some((ext) =>
      fileName.endsWith(ext),
    );

    if (!hasValidExtension) {
      throw new BadRequestException(
        'Apenas arquivos CSV (.csv) ou Excel (.xlsx, .xls) são suportados',
      );
    }

    // Processar CSV
    if (fileName.endsWith('.csv')) {
      const csvContent = file.buffer.toString('utf-8');
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
      });
      return parsed.data as any[];
    }

    // Processar Excel
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0]; // Primeira aba
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      return data as any[];
    }

    throw new BadRequestException('Formato de arquivo não suportado');
  }

  async importClients(file: Express.Multer.File, userId: string) {
    // Validar arquivo
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
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

    // Parse arquivo (CSV ou Excel)
    const rows = this.parseFile(file);

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

    // Criar job de importação
    const importJob = await this.prisma.importJob.create({
      data: {
        userId,
        type: 'AGENDAMENTOS',
        fileName: file.originalname,
        status: 'NA_FILA',
      },
    });

    // Parse arquivo (CSV ou Excel)
    const rows = this.parseFile(file);

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
