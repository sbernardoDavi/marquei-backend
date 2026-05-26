import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createClientDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(createClientDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: createClientDto.email,
        password: hashedPassword,
        name: createClientDto.name,
        role: 'CLIENTE',
        client: {
          create: {
            phone: createClientDto.phone,
          },
        },
      },
      include: {
        client: true,
      },
    });

    return this.findOne(user.client.id);
  }

  async findAll() {
    return this.prisma.client.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    await this.findOne(id);

    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    // Atualizar nome do usuário se fornecido
    if (updateClientDto.name) {
      await this.prisma.user.update({
        where: { id: client.userId },
        data: { name: updateClientDto.name },
      });
    }

    // Atualizar telefone do cliente
    if (updateClientDto.phone !== undefined) {
      await this.prisma.client.update({
        where: { id },
        data: { phone: updateClientDto.phone },
      });
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    // Deletar o usuário (cascade vai deletar o cliente)
    await this.prisma.user.delete({
      where: { id: client.userId },
    });

    return { message: 'Cliente removido com sucesso' };
  }
}
