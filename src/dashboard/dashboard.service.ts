import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getMetrics(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    // Total de agendamentos
    const totalAppointments = await this.prisma.appointment.count({ where });

    // Agendamentos por status
    const appointmentsByStatus = await this.prisma.appointment.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    // Taxa de no-show
    const noShowCount =
      appointmentsByStatus.find((s) => s.status === 'NO_SHOW')?._count || 0;
    const completedCount =
      appointmentsByStatus.find((s) => s.status === 'REALIZADO')?._count || 0;
    const totalFinished = noShowCount + completedCount;
    const noShowRate =
      totalFinished > 0 ? (noShowCount / totalFinished) * 100 : 0;

    // Faturamento estimado (apenas agendamentos realizados)
    const revenue = await this.prisma.appointment.findMany({
      where: {
        ...where,
        status: 'REALIZADO',
      },
      include: {
        service: true,
      },
    });

    const totalRevenue = revenue.reduce(
      (sum, apt) => sum + Number(apt.service.price),
      0,
    );

    // Serviços mais procurados
    const popularServices = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      where,
      _count: true,
      orderBy: {
        _count: {
          serviceId: 'desc',
        },
      },
      take: 5,
    });

    const servicesWithDetails = await Promise.all(
      popularServices.map(async (item) => {
        const service = await this.prisma.service.findUnique({
          where: { id: item.serviceId },
        });
        return {
          service,
          count: item._count,
        };
      }),
    );

    return {
      totalAppointments,
      appointmentsByStatus: appointmentsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      noShowRate: Math.round(noShowRate * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      popularServices: servicesWithDetails,
    };
  }

  async getOccupancyRate(
    professionalId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = {};

    if (professionalId) where.professionalId = professionalId;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    // Buscar todos os profissionais ou apenas o especificado
    const professionals = professionalId
      ? [
          await this.prisma.professional.findUnique({
            where: { id: professionalId },
            include: {
              user: true,
              workSchedules: true,
            },
          }),
        ]
      : await this.prisma.professional.findMany({
          include: {
            user: true,
            workSchedules: true,
          },
        });

    const occupancyData = await Promise.all(
      professionals.map(async (prof) => {
        if (!prof) return null;

        // Total de horas disponíveis na semana
        const weeklyHours = prof.workSchedules.reduce((sum, schedule) => {
          const [startHour, startMin] = schedule.startTime
            .split(':')
            .map(Number);
          const [endHour, endMin] = schedule.endTime.split(':').map(Number);
          const hours = endHour - startHour + (endMin - startMin) / 60;
          return sum + hours;
        }, 0);

        // Agendamentos do profissional
        const appointments = await this.prisma.appointment.findMany({
          where: {
            professionalId: prof.id,
            ...where,
            status: {
              in: ['AGENDADO', 'REALIZADO'],
            },
          },
          include: {
            service: true,
          },
        });

        // Total de horas agendadas
        const bookedHours = appointments.reduce((sum, apt) => {
          return sum + apt.service.durationMinutes / 60;
        }, 0);

        // Calcular taxa de ocupação
        const occupancyRate =
          weeklyHours > 0 ? (bookedHours / weeklyHours) * 100 : 0;

        return {
          professional: {
            id: prof.id,
            name: prof.user.name,
          },
          weeklyHours: Math.round(weeklyHours * 100) / 100,
          bookedHours: Math.round(bookedHours * 100) / 100,
          occupancyRate: Math.round(occupancyRate * 100) / 100,
          totalAppointments: appointments.length,
        };
      }),
    );

    return occupancyData.filter((data) => data !== null);
  }

  async getRevenue(startDate?: string, endDate?: string, groupBy?: string) {
    const where: any = {
      status: 'REALIZADO',
    };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        service: true,
        professional: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Agrupar por dia, semana ou mês
    const revenueByPeriod: { [key: string]: number } = {};
    const revenueByProfessional: {
      [key: string]: { name: string; total: number };
    } = {};

    appointments.forEach((apt) => {
      const date = new Date(apt.startTime);
      let periodKey: string;

      if (groupBy === 'day') {
        periodKey = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        // month
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const revenue = Number(apt.service.price);
      revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + revenue;

      // Por profissional
      const profId = apt.professional.id;
      if (!revenueByProfessional[profId]) {
        revenueByProfessional[profId] = {
          name: apt.professional.user.name,
          total: 0,
        };
      }
      revenueByProfessional[profId].total += revenue;
    });

    const totalRevenue = Object.values(revenueByPeriod).reduce(
      (sum, val) => sum + val,
      0,
    );

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      revenueByPeriod: Object.entries(revenueByPeriod).map(
        ([period, total]) => ({
          period,
          total: Math.round(total * 100) / 100,
        }),
      ),
      revenueByProfessional: Object.entries(revenueByProfessional).map(
        ([id, data]) => ({
          professionalId: id,
          professionalName: data.name,
          total: Math.round(data.total * 100) / 100,
        }),
      ),
    };
  }

  async getPopularServices(startDate?: string, endDate?: string, limit = 10) {
    const where: any = {};

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const popularServices = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      where,
      _count: true,
      orderBy: {
        _count: {
          serviceId: 'desc',
        },
      },
      take: limit,
    });

    const servicesWithDetails = await Promise.all(
      popularServices.map(async (item) => {
        const service = await this.prisma.service.findUnique({
          where: { id: item.serviceId },
        });

        // Calcular receita total deste serviço
        const appointments = await this.prisma.appointment.count({
          where: {
            serviceId: item.serviceId,
            status: 'REALIZADO',
            ...where,
          },
        });

        const revenue = appointments * Number(service?.price || 0);

        return {
          service: {
            id: service?.id,
            name: service?.name,
            price: Number(service?.price || 0),
            durationMinutes: service?.durationMinutes,
          },
          totalAppointments: item._count,
          totalRevenue: Math.round(revenue * 100) / 100,
        };
      }),
    );

    return servicesWithDetails;
  }
}
