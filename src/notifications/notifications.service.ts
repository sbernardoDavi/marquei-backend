import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationData {
  userId: string;
  appointmentId: string;
  type: 'CONFIRMACAO' | 'LEMBRETE' | 'CANCELAMENTO' | 'REMARCACAO';
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async sendAppointmentConfirmation(appointment: any): Promise<void> {
    // Notificar o cliente
    await this.createNotification({
      userId: appointment.client.userId,
      appointmentId: appointment.id,
      type: 'CONFIRMACAO',
      message: `Agendamento confirmado para ${new Date(appointment.startTime).toLocaleString('pt-BR')} com ${appointment.professional.user.name}`,
    });

    // Notificar o profissional
    await this.createNotification({
      userId: appointment.professional.userId,
      appointmentId: appointment.id,
      type: 'CONFIRMACAO',
      message: `Novo agendamento: ${appointment.service.name} com ${appointment.client.user.name} em ${new Date(appointment.startTime).toLocaleString('pt-BR')}`,
    });

    // Agendar lembrete para 24h antes
    await this.scheduleReminder(appointment);
  }

  async sendCancellationNotification(appointment: any): Promise<void> {
    // Notificar o cliente
    await this.createNotification({
      userId: appointment.client.userId,
      appointmentId: appointment.id,
      type: 'CANCELAMENTO',
      message: `Agendamento cancelado: ${appointment.service.name} em ${new Date(appointment.startTime).toLocaleString('pt-BR')}`,
    });

    // Notificar o profissional
    await this.createNotification({
      userId: appointment.professional.userId,
      appointmentId: appointment.id,
      type: 'CANCELAMENTO',
      message: `Agendamento cancelado: ${appointment.service.name} com ${appointment.client.user.name} em ${new Date(appointment.startTime).toLocaleString('pt-BR')}`,
    });
  }

  async sendRescheduleNotification(
    appointment: any,
    oldTime: Date,
  ): Promise<void> {
    // Notificar o cliente
    await this.createNotification({
      userId: appointment.client.userId,
      appointmentId: appointment.id,
      type: 'REMARCACAO',
      message: `Agendamento remarcado de ${oldTime.toLocaleString('pt-BR')} para ${new Date(appointment.startTime).toLocaleString('pt-BR')}`,
    });

    // Notificar o profissional
    await this.createNotification({
      userId: appointment.professional.userId,
      appointmentId: appointment.id,
      type: 'REMARCACAO',
      message: `Agendamento remarcado: ${appointment.service.name} com ${appointment.client.user.name} para ${new Date(appointment.startTime).toLocaleString('pt-BR')}`,
    });

    // Agendar novo lembrete
    await this.scheduleReminder(appointment);
  }

  private async scheduleReminder(appointment: any): Promise<void> {
    const appointmentTime = new Date(appointment.startTime);
    const reminderTime = new Date(
      appointmentTime.getTime() - 24 * 60 * 60 * 1000,
    ); // 24h antes
    const now = new Date();

    // Só agendar se o lembrete for no futuro
    if (reminderTime > now) {
      const delay = reminderTime.getTime() - now.getTime();

      await this.notificationsQueue.add(
        'send-reminder',
        {
          userId: appointment.client.userId,
          appointmentId: appointment.id,
          type: 'LEMBRETE',
          message: `Lembrete: Você tem um agendamento amanhã às ${appointmentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${appointment.service.name} com ${appointment.professional.user.name}`,
        },
        {
          delay,
          removeOnComplete: true,
        },
      );

      // Lembrete para o profissional também
      await this.notificationsQueue.add(
        'send-reminder',
        {
          userId: appointment.professional.userId,
          appointmentId: appointment.id,
          type: 'LEMBRETE',
          message: `Lembrete: Você tem um atendimento amanhã às ${appointmentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${appointment.service.name} com ${appointment.client.user.name}`,
        },
        {
          delay,
          removeOnComplete: true,
        },
      );
    }
  }

  private async createNotification(data: NotificationData): Promise<void> {
    // Adicionar à fila para processamento assíncrono
    await this.notificationsQueue.add('send-notification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
    });
  }

  async getNotifications(userId: string, unreadOnly = false) {
    const where: any = { userId };

    if (unreadOnly) {
      where.sent = false;
    }

    return this.prisma.notification.findMany({
      where,
      include: {
        appointment: {
          include: {
            service: true,
            professional: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        sent: true,
        sentAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        sent: false,
      },
      data: {
        sent: true,
        sentAt: new Date(),
      },
    });
  }
}
