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
    const appointmentDate = new Date(appointment.startTime);
    const dateStr = appointmentDate.toLocaleDateString('pt-BR');
    const timeStr = appointmentDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Notificar o cliente
    await this.createNotification({
      userId: appointment.client.userId,
      appointmentId: appointment.id,
      type: 'CONFIRMACAO',
      message: `Agendamento confirmado para ${dateStr} às ${timeStr} com ${appointment.professional.user.name}`,
    });

    // Notificar o profissional
    await this.createNotification({
      userId: appointment.professional.userId,
      appointmentId: appointment.id,
      type: 'CONFIRMACAO',
      message: `Novo agendamento: ${appointment.service.name} com ${appointment.client.user.name} em ${dateStr} às ${timeStr}`,
    });

    // Agendar lembrete para 24h antes
    await this.scheduleReminder(appointment);
  }

  async sendCancellationNotification(appointment: any): Promise<void> {
    const appointmentDate = new Date(appointment.startTime);
    const dateStr = appointmentDate.toLocaleDateString('pt-BR');
    const timeStr = appointmentDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Notificar o cliente
    await this.createNotification({
      userId: appointment.client.userId,
      appointmentId: appointment.id,
      type: 'CANCELAMENTO',
      message: `Agendamento cancelado: ${appointment.service.name} em ${dateStr} às ${timeStr}`,
    });

    // Notificar o profissional
    await this.createNotification({
      userId: appointment.professional.userId,
      appointmentId: appointment.id,
      type: 'CANCELAMENTO',
      message: `Agendamento cancelado: ${appointment.service.name} com ${appointment.client.user.name} em ${dateStr} às ${timeStr}`,
    });
  }

  async sendRescheduleNotification(
    appointment: any,
    oldTime: Date,
  ): Promise<void> {
    const oldDate = new Date(oldTime);
    const oldDateStr = oldDate.toLocaleDateString('pt-BR');
    const oldTimeStr = oldDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newDate = new Date(appointment.startTime);
    const newDateStr = newDate.toLocaleDateString('pt-BR');
    const newTimeStr = newDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Notificar o cliente
    await this.createNotification({
      userId: appointment.client.userId,
      appointmentId: appointment.id,
      type: 'REMARCACAO',
      message: `Agendamento remarcado de ${oldDateStr} às ${oldTimeStr} para ${newDateStr} às ${newTimeStr}`,
    });

    // Notificar o profissional
    await this.createNotification({
      userId: appointment.professional.userId,
      appointmentId: appointment.id,
      type: 'REMARCACAO',
      message: `Agendamento remarcado: ${appointment.service.name} com ${appointment.client.user.name} para ${newDateStr} às ${newTimeStr}`,
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
      where.read = false;
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
        read: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return {
      message: 'Todas as notificações foram marcadas como lidas',
      count: result.count,
    };
  }
}
