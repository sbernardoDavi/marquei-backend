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
      // Criar registro de notificação no banco
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

      // Aqui você pode integrar com serviços reais de notificação:
      // - Email (SendGrid, AWS SES, Nodemailer)
      // - SMS (Twilio, AWS SNS)
      // - Push Notifications (Firebase, OneSignal)
      // - WhatsApp (Twilio, WhatsApp Business API)

      console.log(`✅ Notificação enviada para usuário ${userId}: ${message}`);

      // Exemplo de integração com email (descomente quando configurar):
      // await this.sendEmail(userId, message);

      // Exemplo de integração com SMS (descomente quando configurar):
      // await this.sendSMS(userId, message);
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação:`, error);
      throw error; // BullMQ vai tentar novamente
    }
  }

  // Exemplo de método para enviar email
  // private async sendEmail(userId: string, message: string): Promise<void> {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     select: { email: true, name: true },
  //   });
  //
  //   if (user) {
  //     // Integrar com serviço de email
  //     console.log(`📧 Email enviado para ${user.email}: ${message}`);
  //   }
  // }

  // Exemplo de método para enviar SMS
  // private async sendSMS(userId: string, message: string): Promise<void> {
  //   const client = await this.prisma.client.findUnique({
  //     where: { userId },
  //     select: { phone: true },
  //   });
  //
  //   if (client?.phone) {
  //     // Integrar com serviço de SMS
  //     console.log(`📱 SMS enviado para ${client.phone}: ${message}`);
  //   }
  // }
}
