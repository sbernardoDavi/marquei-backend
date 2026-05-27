import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Processor('imports')
export class ImportsProcessor extends WorkerHost {
  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { name, data } = job;

    if (name === 'process-clients') {
      return this.processClients(data);
    } else if (name === 'process-appointments') {
      return this.processAppointments(data);
    }
  }

  private async processClients(data: {
    importJobId: string;
    rows: any[];
  }): Promise<void> {
    const { importJobId, rows } = data;

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'PROCESSANDO' },
    });

    const errors: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        if (!row.email || !row.name) {
          throw new Error('Email e nome são obrigatórios');
        }

        const existingUser = await this.prisma.user.findUnique({
          where: { email: row.email },
        });

        if (existingUser) {
          throw new Error('Email já cadastrado');
        }

        const hashedPassword = await bcrypt.hash(row.password || '123456', 10);

        const user = await this.prisma.user.create({
          data: {
            email: row.email,
            name: row.name,
            password: hashedPassword,
            role: 'CLIENTE',
          },
        });

        await this.prisma.client.create({
          data: {
            userId: user.id,
            phone: row.phone || null,
          },
        });

        successCount++;
      } catch (error: any) {
        failedCount++;
        errors.push({
          line: i + 2,
          data: row,
          error: error.message,
        });
      }

      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: {
          processedRows: i + 1,
          successRows: successCount,
          failedRows: failedCount,
        },
      });
    }

    const status =
      failedCount > 0 && successCount > 0
        ? 'CONCLUIDO_COM_FALHAS'
        : failedCount > 0
          ? 'FALHOU'
          : 'CONCLUIDO';

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status,
        errors: errors.length > 0 ? (errors as any) : undefined,
        completedAt: new Date(),
      },
    });

    console.log(
      `✅ Importação de clientes concluída: ${successCount} sucesso, ${failedCount} falhas`,
    );
  }

  private async processAppointments(data: {
    importJobId: string;
    rows: any[];
  }): Promise<void> {
    const { importJobId, rows } = data;

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'PROCESSANDO' },
    });

    const errors: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        if (
          !row.clientEmail ||
          !row.professionalEmail ||
          !row.serviceName ||
          !row.startTime
        ) {
          throw new Error(
            'clientEmail, professionalEmail, serviceName e startTime são obrigatórios',
          );
        }

        const clientUser = await this.prisma.user.findUnique({
          where: { email: row.clientEmail },
          include: { client: true },
        });

        if (!clientUser || !clientUser.client) {
          throw new Error('Cliente não encontrado');
        }

        const professionalUser = await this.prisma.user.findUnique({
          where: { email: row.professionalEmail },
          include: { professional: true },
        });

        if (!professionalUser || !professionalUser.professional) {
          throw new Error('Profissional não encontrado');
        }

        const service = await this.prisma.service.findFirst({
          where: { name: row.serviceName },
        });

        if (!service) {
          throw new Error('Serviço não encontrado');
        }

        const professionalService =
          await this.prisma.professionalService.findFirst({
            where: {
              professionalId: professionalUser.professional.id,
              serviceId: service.id,
            },
          });

        if (!professionalService) {
          throw new Error('Profissional não oferece este serviço');
        }

        const startTime = new Date(row.startTime);
        const endTime = new Date(
          startTime.getTime() + service.durationMinutes * 60000,
        );

        await this.prisma.appointment.create({
          data: {
            clientId: clientUser.client.id,
            professionalId: professionalUser.professional.id,
            serviceId: service.id,
            userId: clientUser.id,
            startTime,
            endTime,
            status: row.status || 'AGENDADO',
          },
        });

        successCount++;
      } catch (error: any) {
        failedCount++;
        errors.push({
          line: i + 2,
          data: row,
          error: error.message,
        });
      }

      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: {
          processedRows: i + 1,
          successRows: successCount,
          failedRows: failedCount,
        },
      });
    }

    const status =
      failedCount > 0 && successCount > 0
        ? 'CONCLUIDO_COM_FALHAS'
        : failedCount > 0
          ? 'FALHOU'
          : 'CONCLUIDO';

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status,
        errors: errors.length > 0 ? (errors as any) : undefined,
        completedAt: new Date(),
      },
    });

    console.log(
      `✅ Importação de agendamentos concluída: ${successCount} sucesso, ${failedCount} falhas`,
    );
  }
}
