import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationData } from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationData>): Promise<void> {
    const { userId, appointmentId, type, message } = job.data;

    try {
      await this.prisma.notification.create({
        data: {
          userId,
          appointmentId,
          type,
          message,
          sent: true,
          sentAt: new Date(),
        },
      });

      console.log(`✅ Notificação enviada para usuário ${userId}: ${message}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação:`, error);
      throw error;
    }
  }
}
