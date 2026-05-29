import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto, userId?: string) {
    let { clientId, professionalId, serviceId, startTime } =
      createAppointmentDto;

    // Se clientId não foi fornecido, buscar do usuário logado
    if (!clientId && userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { client: true },
      });

      if (user?.role === 'CLIENTE' && user.client) {
        clientId = user.client.id;
      }
    }

    // Validar que temos um clientId
    if (!clientId) {
      throw new BadRequestException(
        'clientId é obrigatório ou usuário deve ser um CLIENTE',
      );
    }

    // Validar que o serviço existe
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    // Validar que o profissional existe e oferece o serviço
    const professionalService = await this.prisma.professionalService.findFirst(
      {
        where: {
          professionalId,
          serviceId,
        },
      },
    );

    if (!professionalService) {
      throw new BadRequestException('Profissional não oferece este serviço');
    }

    // Validar que o cliente existe
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.durationMinutes * 60000);

    // Validar que o horário está no futuro
    if (start < new Date()) {
      throw new BadRequestException('Não é possível agendar no passado');
    }

    // Validar disponibilidade do profissional (jornada de trabalho)
    await this.validateWorkSchedule(professionalId, start, end);

    // CRITICAL: Usar transação com lock para prevenir double-booking
    try {
      const appointment = await this.prisma.$transaction(async (tx) => {
        // Lock pessimista: buscar agendamentos conflitantes com FOR UPDATE
        const conflictingAppointments = await tx.$queryRaw<any[]>`
          SELECT id FROM appointments
          WHERE "professionalId" = ${professionalId}
          AND status = 'AGENDADO'
          AND (
            ("startTime" < ${end} AND "endTime" > ${start})
          )
          FOR UPDATE
        `;

        if (conflictingAppointments.length > 0) {
          throw new ConflictException('Horário não disponível');
        }

        // Criar o agendamento
        return tx.appointment.create({
          data: {
            clientId,
            professionalId,
            serviceId,
            userId,
            startTime: start,
            endTime: end,
            status: 'AGENDADO',
          },
          include: {
            client: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            professional: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            service: true,
          },
        });
      });

      // Disparar notificações de forma assíncrona
      await this.notificationsService.sendAppointmentConfirmation(appointment);

      return appointment;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Erro ao criar agendamento');
    }
  }

  async getAvailableSlots(availableSlotsDto: AvailableSlotsDto) {
    const { professionalId, serviceId, date } = availableSlotsDto;

    // Buscar o serviço
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    // Validar que o profissional oferece o serviço
    const professionalService = await this.prisma.professionalService.findFirst(
      {
        where: {
          professionalId,
          serviceId,
        },
      },
    );

    if (!professionalService) {
      throw new BadRequestException('Profissional não oferece este serviço');
    }

    // Corrigir timezone: parse manual da data para UTC
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayOfWeek = this.getDayOfWeek(targetDate) as any;

    // Buscar jornada de trabalho do profissional para o dia
    const workSchedule = await this.prisma.workSchedule.findFirst({
      where: {
        professionalId,
        dayOfWeek,
      },
    });

    if (!workSchedule) {
      return { slots: [] };
    }

    // Buscar agendamentos existentes para o dia (em UTC)
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        status: 'AGENDADO',
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Gerar slots disponíveis
    const slots = this.generateAvailableSlots(
      targetDate,
      workSchedule.startTime,
      workSchedule.endTime,
      service.durationMinutes,
      existingAppointments,
    );

    return { slots };
  }

  async findAll(filters?: {
    clientId?: string;
    professionalId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: any = {};

    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.professionalId) where.professionalId = filters.professionalId;
    if (filters?.status) where.status = filters.status;

    if (filters?.startDate || filters?.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = new Date(filters.startDate);
      if (filters.endDate) where.startTime.lte = new Date(filters.endDate);
    }

    // Paginação
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // Ordenação
    const sortBy = filters?.sortBy || 'startTime';
    const sortOrder = filters?.sortOrder || 'desc';

    // Buscar total de registros
    const total = await this.prisma.appointment.count({ where });

    // Buscar registros paginados
    const data = await this.prisma.appointment.findMany({
      where,
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        professional: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        service: true,
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });

    // Retornar com metadados de paginação
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async getClientAppointments(
    userId: string,
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    // Buscar o cliente pelo userId
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });

    if (!user || !user.client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const where: any = {
      clientId: user.client.id,
    };

    if (filters?.status) where.status = filters.status;

    if (filters?.startDate || filters?.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = new Date(filters.startDate);
      if (filters.endDate) where.startTime.lte = new Date(filters.endDate);
    }

    // Paginação
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // Ordenação
    const sortBy = filters?.sortBy || 'startTime';
    const sortOrder = filters?.sortOrder || 'desc';

    // Buscar total de registros
    const total = await this.prisma.appointment.count({ where });

    // Buscar registros paginados
    const data = await this.prisma.appointment.findMany({
      where,
      include: {
        professional: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        service: true,
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });

    // Retornar com metadados de paginação
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        professional: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    return appointment;
  }

  async updateStatus(id: string, updateStatusDto: UpdateAppointmentStatusDto) {
    await this.findOne(id);

    return this.prisma.appointment.update({
      where: { id },
      data: { status: updateStatusDto.status },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        professional: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        service: true,
      },
    });
  }

  async reschedule(id: string, rescheduleDto: RescheduleAppointmentDto) {
    const appointment = await this.findOne(id);

    if (appointment.status !== 'AGENDADO') {
      throw new BadRequestException(
        'Apenas agendamentos com status AGENDADO podem ser remarcados',
      );
    }

    const oldTime = appointment.startTime;
    const newStart = new Date(rescheduleDto.newStartTime);
    const service = appointment.service;
    const newEnd = new Date(
      newStart.getTime() + service.durationMinutes * 60000,
    );

    // Validar antecedência mínima (24 horas)
    const now = new Date();
    const minAdvanceTime = new Date(
      appointment.startTime.getTime() - 24 * 60 * 60 * 1000,
    );

    if (now > minAdvanceTime) {
      throw new BadRequestException(
        'Remarcação deve ser feita com pelo menos 24 horas de antecedência',
      );
    }

    // Validar disponibilidade
    await this.validateWorkSchedule(
      appointment.professionalId,
      newStart,
      newEnd,
    );

    // Verificar conflitos (excluindo o próprio agendamento)
    const conflicts = await this.prisma.appointment.findMany({
      where: {
        professionalId: appointment.professionalId,
        status: 'AGENDADO',
        id: { not: id },
        OR: [
          {
            AND: [{ startTime: { lt: newEnd } }, { endTime: { gt: newStart } }],
          },
        ],
      },
    });

    if (conflicts.length > 0) {
      throw new ConflictException('Novo horário não disponível');
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        startTime: newStart,
        endTime: newEnd,
      },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        professional: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        service: true,
      },
    });

    // Enviar notificações de remarcação
    await this.notificationsService.sendRescheduleNotification(
      updatedAppointment,
      oldTime,
    );

    return updatedAppointment;
  }

  async cancel(id: string) {
    const appointment = await this.findOne(id);

    if (appointment.status !== 'AGENDADO') {
      throw new BadRequestException(
        'Apenas agendamentos com status AGENDADO podem ser cancelados',
      );
    }

    // Validar antecedência mínima (24 horas)
    const now = new Date();
    const minAdvanceTime = new Date(
      appointment.startTime.getTime() - 24 * 60 * 60 * 1000,
    );

    if (now > minAdvanceTime) {
      throw new BadRequestException(
        'Cancelamento deve ser feito com pelo menos 24 horas de antecedência',
      );
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELADO' },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        professional: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        service: true,
      },
    });

    // Enviar notificações de cancelamento
    await this.notificationsService.sendCancellationNotification(
      updatedAppointment,
    );

    return updatedAppointment;
  }

  // Métodos auxiliares privados

  private async validateWorkSchedule(
    professionalId: string,
    start: Date,
    end: Date,
  ) {
    const dayOfWeek = this.getDayOfWeek(start) as any;

    const workSchedule = await this.prisma.workSchedule.findFirst({
      where: {
        professionalId,
        dayOfWeek,
      },
    });

    if (!workSchedule) {
      throw new BadRequestException('Profissional não trabalha neste dia');
    }

    const [startHour, startMinute] = workSchedule.startTime
      .split(':')
      .map(Number);
    const [endHour, endMinute] = workSchedule.endTime.split(':').map(Number);

    const workStart = new Date(start);
    workStart.setHours(startHour, startMinute, 0, 0);

    const workEnd = new Date(start);
    workEnd.setHours(endHour, endMinute, 0, 0);

    if (start < workStart || end > workEnd) {
      throw new BadRequestException(
        'Horário fora da jornada de trabalho do profissional',
      );
    }
  }

  private getDayOfWeek(date: Date): string {
    const days = [
      'DOMINGO',
      'SEGUNDA',
      'TERCA',
      'QUARTA',
      'QUINTA',
      'SEXTA',
      'SABADO',
    ];
    return days[date.getDay()];
  }

  private generateAvailableSlots(
    date: Date,
    startTime: string,
    endTime: string,
    durationMinutes: number,
    existingAppointments: any[],
  ): string[] {
    const slots: string[] = [];
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    // Criar horários em UTC
    const current = new Date(date);
    current.setUTCHours(startHour, startMinute, 0, 0);

    const workEnd = new Date(date);
    workEnd.setUTCHours(endHour, endMinute, 0, 0);

    const now = new Date();

    while (current < workEnd) {
      const slotEnd = new Date(current.getTime() + durationMinutes * 60000);

      if (slotEnd > workEnd) break;

      // Verificar se o slot está no futuro
      if (current > now) {
        // Verificar se não há conflito com agendamentos existentes
        const hasConflict = existingAppointments.some((appointment) => {
          return (
            current < new Date(appointment.endTime) &&
            slotEnd > new Date(appointment.startTime)
          );
        });

        if (!hasConflict) {
          slots.push(current.toISOString());
        }
      }

      // Avançar 30 minutos (intervalo entre slots)
      current.setMinutes(current.getMinutes() + 30);
    }

    return slots;
  }
}
