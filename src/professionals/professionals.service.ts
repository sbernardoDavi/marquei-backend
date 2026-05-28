import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';

@Injectable()
export class ProfessionalsService {
  constructor(private prisma: PrismaService) {}

  async create(createProfessionalDto: CreateProfessionalDto) {
    const { userId, serviceIds } = createProfessionalDto;

    // Verificar se o usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar se o usuário tem a role PROFISSIONAL
    if (user.role !== 'PROFISSIONAL') {
      throw new ConflictException(
        'Usuário deve ter a role PROFISSIONAL para ser cadastrado como profissional',
      );
    }

    // Verificar se já existe um profissional para este usuário
    let professional = await this.prisma.professional.findUnique({
      where: { userId },
    });

    // Se já existe, retornar o existente (idempotência)
    if (professional) {
      // Se forneceu serviceIds, atualizar os serviços
      if (serviceIds && serviceIds.length > 0) {
        // Remover serviços antigos
        await this.prisma.professionalService.deleteMany({
          where: { professionalId: professional.id },
        });
        // Adicionar novos serviços
        await this.addServices(professional.id, serviceIds);
      }
      return this.findOne(professional.id);
    }

    // Criar profissional
    professional = await this.prisma.professional.create({
      data: {
        userId,
      },
    });

    // Associar serviços se fornecidos
    if (serviceIds && serviceIds.length > 0) {
      await this.addServices(professional.id, serviceIds);
    }

    return this.findOne(professional.id);
  }

  async findAll() {
    return this.prisma.professional.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        services: {
          include: {
            service: true,
          },
        },
        workSchedules: true,
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });
  }

  async findOne(id: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        services: {
          include: {
            service: true,
          },
        },
        workSchedules: {
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
      },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    return professional;
  }

  async update(id: string, updateProfessionalDto: UpdateProfessionalDto) {
    await this.findOne(id);

    const professional = await this.prisma.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    // Atualizar nome do usuário se fornecido
    if (updateProfessionalDto.name) {
      await this.prisma.user.update({
        where: { id: professional.userId },
        data: { name: updateProfessionalDto.name },
      });
    }

    // Atualizar serviços se fornecidos
    if (updateProfessionalDto.serviceIds) {
      // Remover serviços antigos
      await this.prisma.professionalService.deleteMany({
        where: { professionalId: id },
      });

      // Adicionar novos serviços
      if (updateProfessionalDto.serviceIds.length > 0) {
        await this.addServices(id, updateProfessionalDto.serviceIds);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    const professional = await this.prisma.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    // Deletar o usuário (cascade vai deletar o profissional)
    await this.prisma.user.delete({
      where: { id: professional.userId },
    });

    return { message: 'Profissional removido com sucesso' };
  }

  async addServices(professionalId: string, serviceIds: string[]) {
    await this.findOne(professionalId);

    const data = serviceIds.map((serviceId) => ({
      professionalId,
      serviceId,
    }));

    await this.prisma.professionalService.createMany({
      data,
      skipDuplicates: true,
    });

    return this.findOne(professionalId);
  }

  async createWorkSchedule(
    professionalId: string,
    createWorkScheduleDto: CreateWorkScheduleDto,
  ) {
    await this.findOne(professionalId);

    // Verificar se já existe um horário para esse dia
    const existing = await this.prisma.workSchedule.findFirst({
      where: {
        professionalId,
        dayOfWeek: createWorkScheduleDto.dayOfWeek as any,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Já existe um horário cadastrado para este dia',
      );
    }

    return this.prisma.workSchedule.create({
      data: {
        professionalId,
        dayOfWeek: createWorkScheduleDto.dayOfWeek as any,
        startTime: createWorkScheduleDto.startTime,
        endTime: createWorkScheduleDto.endTime,
      },
    });
  }

  async getWorkSchedules(professionalId: string) {
    await this.findOne(professionalId);

    return this.prisma.workSchedule.findMany({
      where: { professionalId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async deleteWorkSchedule(professionalId: string, scheduleId: string) {
    const schedule = await this.prisma.workSchedule.findFirst({
      where: {
        id: scheduleId,
        professionalId,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Horário de trabalho não encontrado');
    }

    await this.prisma.workSchedule.delete({
      where: { id: scheduleId },
    });

    return { message: 'Horário removido com sucesso' };
  }
}
