# 📤 Guia de Testes - Importação em Massa

## 🔑 Pré-requisitos

1. **Fazer login como GESTOR:**

```bash
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "gestor@marquei.com",
  "password": "123456"
}
```

**Resposta:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

**Copie o `access_token` para usar nos próximos testes!**

---

## 📋 Teste 1: Importar Clientes

### Usando cURL:

```bash
curl -X POST http://localhost:3000/imports/clients \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -F "file=@examples/clientes-exemplo.csv"
```

### Usando Postman/Insomnia:

1. **Método:** POST
2. **URL:** `http://localhost:3000/imports/clients`
3. **Headers:**
   - `Authorization: Bearer SEU_TOKEN_AQUI`
4. **Body:**
   - Tipo: `form-data`
   - Key: `file` (tipo: File)
   - Value: Selecione o arquivo `examples/clientes-exemplo.csv`

### Resposta esperada:

```json
{
  "id": "uuid-do-job",
  "userId": "uuid-do-gestor",
  "type": "CLIENTES",
  "fileName": "clientes-exemplo.csv",
  "status": "NA_FILA",
  "totalRows": 5,
  "processedRows": 0,
  "successRows": 0,
  "failedRows": 0,
  "errors": null,
  "createdAt": "2026-05-27T...",
  "updatedAt": "2026-05-27T...",
  "completedAt": null
}
```

---

## 📋 Teste 2: Acompanhar Progresso

### Listar todos os jobs:

```bash
GET http://localhost:3000/imports
Authorization: Bearer SEU_TOKEN_AQUI
```

### Ver detalhes de um job específico:

```bash
GET http://localhost:3000/imports/{id-do-job}
Authorization: Bearer SEU_TOKEN_AQUI
```

### Resposta quando concluído:

```json
{
  "id": "uuid-do-job",
  "status": "CONCLUIDO",
  "totalRows": 5,
  "processedRows": 5,
  "successRows": 5,
  "failedRows": 0,
  "errors": null,
  "completedAt": "2026-05-27T..."
}
```

### Resposta com erros:

```json
{
  "id": "uuid-do-job",
  "status": "CONCLUIDO_COM_FALHAS",
  "totalRows": 5,
  "processedRows": 5,
  "successRows": 3,
  "failedRows": 2,
  "errors": [
    {
      "line": 3,
      "data": { "email": "invalido", "name": "Teste" },
      "error": "Email já cadastrado"
    },
    {
      "line": 5,
      "data": { "email": "", "name": "Teste 2" },
      "error": "Email e nome são obrigatórios"
    }
  ],
  "completedAt": "2026-05-27T..."
}
```

---

## 📋 Teste 3: Importar Agendamentos

### Usando cURL:

```bash
curl -X POST http://localhost:3000/imports/appointments \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -F "file=@examples/agendamentos-exemplo.csv"
```

### Usando Postman/Insomnia:

1. **Método:** POST
2. **URL:** `http://localhost:3000/imports/appointments`
3. **Headers:**
   - `Authorization: Bearer SEU_TOKEN_AQUI`
4. **Body:**
   - Tipo: `form-data`
   - Key: `file` (tipo: File)
   - Value: Selecione o arquivo `examples/agendamentos-exemplo.csv`

---

## 🔍 Monitorar Logs do Servidor

No terminal onde o servidor está rodando, você verá:

```
✅ Importação de clientes concluída: 5 sucesso, 0 falhas
```

ou

```
✅ Importação de agendamentos concluída: 3 sucesso, 0 falhas
```

---

## 📝 Formato dos Arquivos CSV

### Clientes (clientes-exemplo.csv):

```csv
email,name,password,phone
joao.silva@example.com,João Silva,senha123,11999999999
ana.costa@example.com,Ana Costa,senha456,11988888888
```

**Campos:**

- `email` (obrigatório) - Email único do cliente
- `name` (obrigatório) - Nome completo
- `password` (opcional) - Senha (padrão: 123456)
- `phone` (opcional) - Telefone

### Agendamentos (agendamentos-exemplo.csv):

```csv
clientEmail,professionalEmail,serviceName,startTime,status
maria@cliente.com,carlos@marquei.com,Corte de Cabelo,2026-06-01T10:00:00.000Z,AGENDADO
```

**Campos:**

- `clientEmail` (obrigatório) - Email do cliente (deve existir)
- `professionalEmail` (obrigatório) - Email do profissional (deve existir)
- `serviceName` (obrigatório) - Nome do serviço (deve existir)
- `startTime` (obrigatório) - Data/hora no formato ISO 8601
- `status` (opcional) - Status do agendamento (padrão: AGENDADO)

---

## ⚠️ Erros Comuns

### 1. "Apenas arquivos CSV são suportados"

- Certifique-se de que o arquivo tem extensão `.csv`

### 2. "Cliente não encontrado" (ao importar agendamentos)

- O email do cliente deve existir no banco
- Importe os clientes primeiro

### 3. "Profissional não encontrado"

- O email do profissional deve existir no banco
- Use: `carlos@marquei.com` (do seed)

### 4. "Serviço não encontrado"

- O nome do serviço deve ser exato
- Serviços disponíveis (do seed):
  - Corte de Cabelo
  - Barba
  - Corte + Barba

### 5. "Email já cadastrado"

- O email já existe no banco
- Use emails diferentes ou limpe o banco

---

## 🧪 Teste Completo (Passo a Passo)

1. **Login como gestor**
2. **Importar clientes** → Aguardar conclusão
3. **Verificar progresso** → Status: CONCLUIDO
4. **Listar clientes** → `GET /clients` (verificar se foram criados)
5. **Importar agendamentos** → Aguardar conclusão
6. **Verificar progresso** → Status: CONCLUIDO
7. **Listar agendamentos** → `GET /appointments` (verificar se foram criados)

---

## 🎯 Dicas

- Use Postman ou Insomnia para facilitar os testes
- Monitore os logs do servidor para ver o progresso em tempo real
- Verifique o Prisma Studio para visualizar os dados importados
- Os jobs são processados de forma assíncrona (não trava a API)
