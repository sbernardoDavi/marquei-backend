import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:1937@localhost:5432/marquei';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // Limpar dados existentes
  console.log('🧹 Limpando dados existentes...');
  await prisma.notification.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.professionalService.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  // Criar Gestor
  console.log('👤 Criando Gestor...');
  const hashedPassword = await bcrypt.hash('123456', 10);

  const gestor = await prisma.user.create({
    data: {
      email: 'gestor@marquei.com',
      password: hashedPassword,
      name: 'João Gestor',
      role: 'GESTOR',
    },
  });
  console.log(`✅ Gestor criado: ${gestor.email}`);

  // Criar Serviços
  console.log('\n💇 Criando Serviços...');
  const corte = await prisma.service.create({
    data: {
      name: 'Corte de Cabelo',
      durationMinutes: 30,
      price: 50.0,
    },
  });
  console.log(`✅ Serviço criado: ${corte.name}`);

  const barba = await prisma.service.create({
    data: {
      name: 'Barba',
      durationMinutes: 20,
      price: 30.0,
    },
  });
  console.log(`✅ Serviço criado: ${barba.name}`);

  const combo = await prisma.service.create({
    data: {
      name: 'Corte + Barba',
      durationMinutes: 50,
      price: 70.0,
    },
  });
  console.log(`✅ Serviço criado: ${combo.name}`);

  // Criar Profissional
  console.log('\n👨‍💼 Criando Profissional...');
  const profissionalUser = await prisma.user.create({
    data: {
      email: 'carlos@marquei.com',
      password: hashedPassword,
      name: 'Carlos Barbeiro',
      role: 'PROFISSIONAL',
    },
  });

  const profissional = await prisma.professional.create({
    data: {
      userId: profissionalUser.id,
    },
  });
  console.log(`✅ Profissional criado: ${profissionalUser.name}`);

  // Associar serviços ao profissional
  console.log('\n🔗 Associando serviços ao profissional...');
  await prisma.professionalService.createMany({
    data: [
      { professionalId: profissional.id, serviceId: corte.id },
      { professionalId: profissional.id, serviceId: barba.id },
      { professionalId: profissional.id, serviceId: combo.id },
    ],
  });
  console.log('✅ Serviços associados');

  // Criar jornada de trabalho
  console.log('\n📅 Criando jornada de trabalho...');
  const diasSemana = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];

  for (const dia of diasSemana) {
    await prisma.workSchedule.create({
      data: {
        professionalId: profissional.id,
        dayOfWeek: dia as any,
        startTime: '09:00',
        endTime: '18:00',
      },
    });
  }
  console.log('✅ Jornada criada: Segunda a Sexta, 09:00 - 18:00');

  // Criar Clientes
  console.log('\n👥 Criando Clientes...');
  const cliente1User = await prisma.user.create({
    data: {
      email: 'maria@cliente.com',
      password: hashedPassword,
      name: 'Maria Silva',
      role: 'CLIENTE',
    },
  });

  const cliente1 = await prisma.client.create({
    data: {
      userId: cliente1User.id,
      phone: '11999999999',
    },
  });
  console.log(`✅ Cliente criado: ${cliente1User.name}`);

  const cliente2User = await prisma.user.create({
    data: {
      email: 'pedro@cliente.com',
      password: hashedPassword,
      name: 'Pedro Santos',
      role: 'CLIENTE',
    },
  });

  const cliente2 = await prisma.client.create({
    data: {
      userId: cliente2User.id,
      phone: '11988888888',
    },
  });
  console.log(`✅ Cliente criado: ${cliente2User.name}`);

  // Criar Agendamentos (isso vai disparar as notificações!)
  console.log('\n📆 Criando Agendamentos...');

  // Agendamento 1
  const data1 = new Date();
  data1.setDate(data1.getDate() + 10);
  data1.setHours(10, 0, 0, 0);

  const agendamento1 = await prisma.appointment.create({
    data: {
      clientId: cliente1.id,
      professionalId: profissional.id,
      serviceId: corte.id,
      userId: cliente1User.id,
      startTime: data1,
      endTime: new Date(data1.getTime() + corte.durationMinutes * 60000),
      status: 'AGENDADO',
    },
  });
  console.log(
    `✅ Agendamento criado: ${cliente1User.name} - ${corte.name} - ${data1.toLocaleString('pt-BR')}`,
  );

  // Agendamento 2
  const data2 = new Date();
  data2.setDate(data2.getDate() + 5);
  data2.setHours(14, 0, 0, 0);

  const agendamento2 = await prisma.appointment.create({
    data: {
      clientId: cliente2.id,
      professionalId: profissional.id,
      serviceId: combo.id,
      userId: cliente2User.id,
      startTime: data2,
      endTime: new Date(data2.getTime() + combo.durationMinutes * 60000),
      status: 'AGENDADO',
    },
  });
  console.log(
    `✅ Agendamento criado: ${cliente2User.name} - ${combo.name} - ${data2.toLocaleString('pt-BR')}`,
  );

  // Criar notificações manualmente para demonstração
  console.log('\n🔔 Criando notificações de exemplo...');

  await prisma.notification.create({
    data: {
      userId: cliente1User.id,
      appointmentId: agendamento1.id,
      type: 'CONFIRMACAO',
      message: `Agendamento confirmado para ${data1.toLocaleString('pt-BR')} com ${profissionalUser.name}`,
      sent: true,
      sentAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: profissionalUser.id,
      appointmentId: agendamento1.id,
      type: 'CONFIRMACAO',
      message: `Novo agendamento: ${corte.name} com ${cliente1User.name} em ${data1.toLocaleString('pt-BR')}`,
      sent: true,
      sentAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: cliente2User.id,
      appointmentId: agendamento2.id,
      type: 'CONFIRMACAO',
      message: `Agendamento confirmado para ${data2.toLocaleString('pt-BR')} com ${profissionalUser.name}`,
      sent: true,
      sentAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: profissionalUser.id,
      appointmentId: agendamento2.id,
      type: 'CONFIRMACAO',
      message: `Novo agendamento: ${combo.name} com ${cliente2User.name} em ${data2.toLocaleString('pt-BR')}`,
      sent: true,
      sentAt: new Date(),
    },
  });

  console.log('✅ 4 notificações criadas');

  console.log('\n✨ Seed concluído com sucesso!\n');
  console.log('📊 Resumo:');
  console.log('  - 1 Gestor');
  console.log('  - 1 Profissional');
  console.log('  - 2 Clientes');
  console.log('  - 3 Serviços');
  console.log('  - 5 Dias de jornada');
  console.log('  - 2 Agendamentos');
  console.log('  - 4 Notificações');
  console.log('\n🔑 Credenciais de acesso:');
  console.log('  Email: gestor@marquei.com | Senha: 123456');
  console.log('  Email: carlos@marquei.com | Senha: 123456');
  console.log('  Email: maria@cliente.com | Senha: 123456');
  console.log('  Email: pedro@cliente.com | Senha: 123456');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
