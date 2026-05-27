# Testes da API Marquei

Base URL: `http://localhost:3000`

## 1. Autenticação

### 1.1 Registrar Gestor

```http
POST /auth/register
Content-Type: application/json

{
  "email": "gestor@marquei.com",
  "password": "123456",
  "name": "João Gestor",
  "role": "GESTOR"
}
```

### 1.2 Registrar Cliente

```http
POST /auth/register
Content-Type: application/json

{
  "email": "cliente@teste.com",
  "password": "123456",
  "name": "Maria Cliente",
  "role": "CLIENTE"
}
```

### 1.3 Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "gestor@marquei.com",
  "password": "123456"
}
```

**Resposta:** Copie o `access_token` para usar nos próximos requests!

---

## 2. Serviços (Requer token de GESTOR)

### 2.1 Criar Serviço

```http
POST /services
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
  "name": "Corte de Cabelo",
  "durationMinutes": 30,
  "price": 50.00
}
```

### 2.2 Criar Outro Serviço

```http
POST /services
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
  "name": "Barba",
  "durationMinutes": 20,
  "price": 30.00
}
```

### 2.3 Listar Serviços

```http
GET /services
Authorization: Bearer SEU_TOKEN_AQUI
```

---

## 3. Profissionais (Requer token de GESTOR)

### 3.1 Criar Profissional

```http
POST /professionals
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
  "email": "profissional@marquei.com",
  "password": "123456",
  "name": "Carlos Barbeiro",
  "serviceIds": ["ID_DO_SERVICO_1", "ID_DO_SERVICO_2"]
}
```

### 3.2 Adicionar Jornada de Trabalho

```http
POST /professionals/ID_DO_PROFISSIONAL/work-schedules
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
  "dayOfWeek": "SEGUNDA",
  "startTime": "09:00",
  "endTime": "18:00"
}
```

### 3.3 Adicionar Mais Dias

```http
POST /professionals/ID_DO_PROFISSIONAL/work-schedules
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
  "dayOfWeek": "TERCA",
  "startTime": "09:00",
  "endTime": "18:00"
}
```

### 3.4 Listar Profissionais

```http
GET /professionals
Authorization: Bearer SEU_TOKEN_AQUI
```

---

## 4. Clientes

### 4.1 Criar Cliente (pelo Gestor)

```http
POST /clients
Authorization: Bearer TOKEN_DO_GESTOR
Content-Type: application/json

{
  "email": "cliente2@teste.com",
  "password": "123456",
  "name": "Pedro Cliente",
  "phone": "11999999999"
}
```

### 4.2 Listar Clientes

```http
GET /clients
Authorization: Bearer SEU_TOKEN_AQUI
```

---

## 5. Agendamentos

### 5.1 Consultar Horários Disponíveis

```http
POST /appointments/available-slots
Authorization: Bearer TOKEN_DO_CLIENTE
Content-Type: application/json

{
  "professionalId": "ID_DO_PROFISSIONAL",
  "serviceId": "ID_DO_SERVICO",
  "date": "2025-01-27"
}
```

### 5.2 Criar Agendamento

```http
POST /appointments
Authorization: Bearer TOKEN_DO_CLIENTE
Content-Type: application/json

{
  "clientId": "ID_DO_CLIENTE",
  "professionalId": "ID_DO_PROFISSIONAL",
  "serviceId": "ID_DO_SERVICO",
  "startTime": "2025-01-27T10:00:00.000Z"
}
```

### 5.3 Listar Agendamentos

```http
GET /appointments
Authorization: Bearer SEU_TOKEN_AQUI
```

### 5.4 Listar Agendamentos de um Cliente

```http
GET /appointments?clientId=ID_DO_CLIENTE
Authorization: Bearer SEU_TOKEN_AQUI
```

### 5.5 Listar Agendamentos de um Profissional

```http
GET /appointments?professionalId=ID_DO_PROFISSIONAL
Authorization: Bearer SEU_TOKEN_AQUI
```

### 5.6 Atualizar Status do Agendamento (Profissional/Gestor)

```http
PATCH /appointments/ID_DO_AGENDAMENTO/status
Authorization: Bearer TOKEN_DO_PROFISSIONAL
Content-Type: application/json

{
  "status": "REALIZADO"
}
```

**Status possíveis:** `AGENDADO`, `REALIZADO`, `NO_SHOW`, `CANCELADO`

### 5.7 Remarcar Agendamento

```http
PATCH /appointments/ID_DO_AGENDAMENTO/reschedule
Authorization: Bearer TOKEN_DO_CLIENTE
Content-Type: application/json

{
  "newStartTime": "2025-01-27T14:00:00.000Z"
}
```

### 5.8 Cancelar Agendamento

```http
DELETE /appointments/ID_DO_AGENDAMENTO
Authorization: Bearer TOKEN_DO_CLIENTE
```

---

## Fluxo de Teste Completo

1. **Registrar um Gestor** → Copiar o token
2. **Criar 2 Serviços** → Copiar os IDs
3. **Criar um Profissional** com os serviços → Copiar o ID
4. **Adicionar Jornada de Trabalho** para o profissional (Segunda e Terça)
5. **Registrar um Cliente** → Copiar o token e ID
6. **Consultar Horários Disponíveis** para amanhã
7. **Criar um Agendamento** com um dos horários disponíveis
8. **Listar Agendamentos** para ver o agendamento criado
9. **Login como Profissional** → Copiar o token
10. **Atualizar Status** do agendamento para REALIZADO

---

## Dicas

- Use **Thunder Client** (extensão do VS Code) para testar facilmente
- Substitua `SEU_TOKEN_AQUI` pelo token recebido no login
- Substitua os IDs pelos valores reais retornados nas respostas
- O servidor está rodando em `http://localhost:3000`
- Todos os endpoints (exceto `/auth/register` e `/auth/login`) requerem autenticação

---

## Testando Double-Booking Prevention

Para testar se o sistema previne agendamentos duplicados:

1. Crie um agendamento para um horário específico
2. Tente criar outro agendamento para o mesmo profissional no mesmo horário
3. Deve retornar erro: `"Horário não disponível"`
