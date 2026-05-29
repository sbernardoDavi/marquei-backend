import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    const { userId, phone } = createClientDto;

    // Verificar se o usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar se o usuário tem a role CLIENTE
    if (user.role !== 'CLIENTE') {
      throw new ConflictException(
        'Usuário deve ter a role CLIENTE para ser cadastrado como cliente',
      );
    }

    // Verificar se já existe um cliente para este usuário
    let client = await this.prisma.client.findUnique({
      where: { userId },
    });

    // Se já existe, retornar o existente (idempotência)
    if (client) {
      // Se forneceu phone, atualizar
      if (phone !== undefined) {
        client = await this.prisma.client.update({
          where: { id: client.id },
          data: { phone },
        });
      }
      return this.findOne(client.id);
    }

    // Criar cliente
    client = await this.prisma.client.create({
      data: {
        userId,
        phone,
      },
    });

    return this.findOne(client.id);
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

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

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

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // Deletar o usuário (cascade vai deletar o cliente)
    await this.prisma.user.delete({
      where: { id: client.userId },
    });

    return { message: 'Cliente removido com sucesso' };
  }
}
