import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ProfessionalsService {
  constructor(private prisma: PrismaService) {}

  async create(createProfessionalDto: CreateProfessionalDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createProfessionalDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(
      createProfessionalDto.password,
      10,
    );

    const user = await this.prisma.user.create({
      data: {
        email: createProfessionalDto.email,
        password: hashedPassword,
        name: createProfessionalDto.name,
        role: 'PROFISSIONAL',
        professional: {
          create: {},
        },
      },
      include: {
        professional: true,
      },
    });

    if (!user.professional) {
      throw new ConflictException('Erro ao criar profissional');
    }

    // Associar serviços se fornecidos
    if (
      createProfessionalDto.serviceIds &&
      createProfessionalDto.serviceIds.length > 0
    ) {
      await this.addServices(
        user.professional.id,
        createProfessionalDto.serviceIds,
      );
    }

    return this.findOne(user.professional.id);
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
        dayOfWeek: createWorkScheduleDto.dayOfWeek,
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
        ...createWorkScheduleDto,
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
