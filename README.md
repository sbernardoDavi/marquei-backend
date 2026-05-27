# 💈 Marquei - Backend API

Sistema de agendamento online para salões de beleza e clínicas de estética com múltiplos profissionais.

## 📋 Sobre o Projeto

O Marquei é uma plataforma completa de agendamento que substitui processos manuais (planilhas e telefonemas) por um sistema automatizado, eliminando conflitos de horário, no-shows sem comunicação e fornecendo visibilidade total sobre o desempenho do negócio.

## 🚀 Tecnologias

- **NestJS** - Framework Node.js progressivo
- **TypeScript** - Superset JavaScript com tipagem estática
- **Prisma ORM** - ORM moderno para Node.js e TypeScript
- **PostgreSQL** - Banco de dados relacional
- **Redis** - Cache e filas de mensagens
- **BullMQ** - Processamento de jobs assíncronos
- **JWT** - Autenticação baseada em tokens
- **Docker** - Containerização

## ✨ Funcionalidades

### 🔐 Autenticação

- Login com JWT
- 3 perfis de usuário: GESTOR, PROFISSIONAL, CLIENTE
- Controle de acesso baseado em roles

### 👥 Gestão de Usuários

- **Serviços**: CRUD completo (nome, duração, preço)
- **Profissionais**: Gestão de profissionais com jornada de trabalho e serviços oferecidos
- **Clientes**: Auto-cadastro ou cadastro pelo gestor

### 📅 Agendamentos

- Consulta de horários disponíveis
- Criação de agendamentos com validação de disponibilidade
- **Prevenção de double-booking** com locks pessimistas
- Remarcação e cancelamento (com regra de antecedência)
- Atualização de status (AGENDADO, REALIZADO, NO_SHOW, CANCELADO)

### 🔔 Notificações Automáticas

- Confirmação após agendamento
- Lembrete 24h antes do horário
- Notificações de cancelamento e remarcação
- Processamento assíncrono com BullMQ
- Sem duplicação e sem atrasos

### 📊 Dashboard

- Taxa de ocupação por profissional
- Taxa de no-show
- Faturamento estimado por período
- Serviços mais procurados
- Filtros por data e profissional

### 📤 Importação em Massa

- Upload de CSV para clientes e agendamentos
- Processamento assíncrono
- Relatório de erros por linha
- Status em tempo real (NA_FILA, PROCESSANDO, CONCLUIDO)

### 📖 Histórico

- Listagem de atendimentos com filtros avançados
- Paginação e ordenação
- Filtros por cliente, profissional, serviço, status e período

## 🛠️ Instalação

### Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Git

### 1. Clone o repositório

```bash
git clone https://github.com/sbernardoDavi/marquei-backend.git
cd marquei-backend
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env`:

```env
DATABASE_URL="postgresql://postgres:1937@localhost:5432/marquei"
JWT_SECRET="seu-secret-super-seguro-aqui"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### 4. Inicie os serviços Docker

```bash
docker-compose up -d
```

Isso iniciará:

- PostgreSQL na porta 5432
- Redis na porta 6379

### 5. Execute as migrações do banco

```bash
npx prisma db push
```

### 6. Popule o banco com dados de teste

```bash
npm run seed
```

Isso criará:

- 1 Gestor: `gestor@marquei.com` / `123456`
- 1 Profissional: `carlos@marquei.com` / `123456`
- 2 Clientes: `maria@cliente.com` e `pedro@cliente.com` / `123456`
- 3 Serviços (Corte, Barba, Combo)
- Jornada de trabalho (Segunda a Sexta, 09:00-18:00)
- 2 Agendamentos de exemplo

### 7. Inicie o servidor

```bash
npm run start:dev
```

O servidor estará rodando em `http://localhost:3000`

## 📚 Documentação da API

### Autenticação

#### Registrar

```http
POST /auth/register
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "senha123",
  "name": "Nome Completo",
  "role": "CLIENTE"
}
```

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "gestor@marquei.com",
  "password": "123456"
}
```

### Serviços

```http
GET    /services           # Listar todos
POST   /services           # Criar (GESTOR)
GET    /services/:id       # Buscar por ID
PATCH  /services/:id       # Atualizar (GESTOR)
DELETE /services/:id       # Deletar (GESTOR)
```

### Profissionais

```http
GET    /professionals                              # Listar todos
POST   /professionals                              # Criar (GESTOR)
GET    /professionals/:id                          # Buscar por ID
PATCH  /professionals/:id                          # Atualizar (GESTOR)
DELETE /professionals/:id                          # Deletar (GESTOR)
POST   /professionals/:id/work-schedules           # Adicionar jornada
GET    /professionals/:id/work-schedules           # Listar jornadas
DELETE /professionals/:id/work-schedules/:scheduleId  # Remover jornada
```

### Clientes

```http
GET    /clients      # Listar todos
POST   /clients      # Criar (GESTOR)
GET    /clients/:id  # Buscar por ID
PATCH  /clients/:id  # Atualizar
DELETE /clients/:id  # Deletar (GESTOR)
```

### Agendamentos

```http
POST   /appointments                    # Criar agendamento
POST   /appointments/available-slots    # Consultar horários disponíveis
GET    /appointments                    # Listar (com filtros e paginação)
GET    /appointments/:id                # Buscar por ID
PATCH  /appointments/:id/status         # Atualizar status (GESTOR/PROFISSIONAL)
PATCH  /appointments/:id/reschedule     # Remarcar (GESTOR/CLIENTE)
DELETE /appointments/:id                # Cancelar (GESTOR/CLIENTE)
```

**Parâmetros de consulta:**

- `page` - Número da página (padrão: 1)
- `limit` - Registros por página (padrão: 10)
- `sortBy` - Campo para ordenar (padrão: startTime)
- `sortOrder` - Ordem: asc ou desc (padrão: desc)
- `clientId` - Filtrar por cliente
- `professionalId` - Filtrar por profissional
- `status` - Filtrar por status
- `startDate` - Data início (ISO 8601)
- `endDate` - Data fim (ISO 8601)

### Notificações

```http
GET   /notifications              # Listar notificações do usuário
PATCH /notifications/:id/read     # Marcar como lida
PATCH /notifications/read-all     # Marcar todas como lidas
```

### Dashboard (GESTOR apenas)

```http
GET /dashboard/metrics           # Métricas gerais
GET /dashboard/occupancy         # Taxa de ocupação
GET /dashboard/revenue           # Faturamento
GET /dashboard/popular-services  # Serviços mais procurados
```

**Parâmetros de consulta:**

- `startDate` - Data início
- `endDate` - Data fim
- `professionalId` - Filtrar por profissional
- `groupBy` - Agrupar por: day, week, month
- `limit` - Limite de resultados

### Importação em Massa (GESTOR apenas)

```http
POST /imports/clients       # Importar clientes (CSV)
POST /imports/appointments  # Importar agendamentos (CSV)
GET  /imports               # Listar jobs de importação
GET  /imports/:id           # Detalhes do job
```

## 📝 Exemplos de Uso

Consulte os arquivos:

- `API_TESTS.md` - Testes completos da API
- `IMPORT_TESTS.md` - Guia de importação em massa
- `examples/` - Arquivos CSV de exemplo

## 🗄️ Estrutura do Banco de Dados

### Principais Modelos

- **User** - Usuários do sistema (GESTOR, PROFISSIONAL, CLIENTE)
- **Professional** - Dados dos profissionais
- **Client** - Dados dos clientes
- **Service** - Serviços oferecidos
- **ProfessionalService** - Relação profissional-serviço
- **WorkSchedule** - Jornada de trabalho dos profissionais
- **Appointment** - Agendamentos
- **Notification** - Notificações
- **ImportJob** - Jobs de importação em massa

## 🔒 Segurança

- Senhas criptografadas com bcrypt
- Autenticação JWT com expiração de 7 dias
- Guards de autenticação e autorização
- Validação de dados com class-validator
- Proteção contra double-booking com locks pessimistas

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e

# Cobertura
npm run test:cov
```

## 📦 Scripts Disponíveis

```bash
npm run start          # Iniciar em modo produção
npm run start:dev      # Iniciar em modo desenvolvimento
npm run start:debug    # Iniciar em modo debug
npm run build          # Build para produção
npm run seed           # Popular banco com dados de teste
npm run lint           # Executar linter
npm run format         # Formatar código
```

## 🐳 Docker

### Serviços disponíveis

```bash
docker-compose up -d     # Iniciar todos os serviços
docker-compose down      # Parar todos os serviços
docker-compose logs -f   # Ver logs
```

### Acessar Prisma Studio

```bash
npx prisma studio
```

Acesse: `http://localhost:5555`

## 📄 Licença

Este projeto está sob a licença MIT.
