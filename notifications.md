# ✅ Verificação - Sistema de Notificações 24h

## 📋 Como Funciona

O sistema envia **notificações automáticas 24h antes** de cada agendamento:

1. **Quando um agendamento é criado:**
   - Envia notificação de CONFIRMAÇÃO imediatamente (salva no banco)
   - Agenda LEMBRETE para 24h antes (fica na fila do Redis)

2. **24h antes do agendamento:**
   - BullMQ processa automaticamente o job agendado
   - Envia lembrete para cliente e profissional
   - Salva no banco com `sent = true`

---

## 🧪 Teste Rápido (Comandos que Funcionaram)

### 1. Verificar se Redis está rodando

```bash
# Iniciar containers
docker-compose up -d

# Testar conexão
docker exec -it marquei-redis redis-cli ping
# Deve retornar: PONG
```

### 2. Criar dados de teste

```bash
# Rodar seed (cria agendamentos e notificações)
npm run seed
```

### 3. Verificar se há jobs na fila do Redis

```bash
# Listar todas as chaves do BullMQ
docker exec -it marquei-redis redis-cli KEYS "bull:notifications:*"

# Ver jobs agendados (lembretes de 24h)
docker exec -it marquei-redis redis-cli ZRANGE bull:notifications:delayed 0 -1 WITHSCORES

# Ver detalhes de um job específico (substitua 57 pelo ID que aparecer)
docker exec marquei-redis redis-cli HGETALL bull:notifications:57
```

**Exemplo de saída esperada:**

```
name: send-reminder
type: LEMBRETE
message: Lembrete: Você tem um agendamento amanhã às 13:00 - Corte + Barba com Carlos Barbeiro
delay: 70049084  (tempo em ms até executar)
```

### 4. Verificar notificações no banco de dados

```bash
# Ver resumo de notificações por tipo
docker exec marquei-postgres psql -U postgres -d marquei -c 'SELECT type, COUNT(*) as total, sent FROM notifications GROUP BY type, sent ORDER BY type;'
```

**Exemplo de saída esperada:**

```
     type     | total | sent
-------------+-------+------
 CONFIRMACAO |     6 | t      <- Notificações imediatas (já enviadas)
```

Os lembretes (LEMBRETE) ainda não aparecem no banco porque estão agendados no Redis. Eles só serão salvos quando forem processados (24h antes do agendamento).

---

## 📊 Interpretando os Resultados

### ✅ Sistema Funcionando Corretamente:

1. **Redis tem jobs agendados:**

   ```
   bull:notifications:delayed  <- Fila com lembretes de 24h
   bull:notifications:53, 54, 57, 58  <- Jobs individuais
   ```

2. **Banco tem notificações de confirmação:**

   ```
   CONFIRMACAO | 6 | t  <- 6 notificações enviadas imediatamente
   ```

3. **Jobs têm o tipo correto:**
   ```json
   {
     "type": "LEMBRETE",
     "message": "Lembrete: Você tem um agendamento amanhã às..."
   }
   ```

### ⚠️ Se algo não funcionar:

**Redis não conecta:**

```bash
docker-compose up -d redis
docker logs marquei-redis
```

**Notificações não são criadas:**

- Verificar logs da aplicação: `npm run start:dev`
- Procurar por: `✅ Notificação enviada`

**Lembretes não são agendados:**

- Agendamentos devem estar a mais de 24h no futuro
- Verificar código em `src/notifications/notifications.service.ts`:
  ```typescript
  if (reminderTime > now) { // Só agenda se for no futuro
  ```

---

## 🎯 Checklist de Verificação

Execute estes comandos em sequência:

```bash
# 1. Redis está rodando?
docker exec -it marquei-redis redis-cli ping

# 2. Há jobs na fila?
docker exec -it marquei-redis redis-cli KEYS "bull:notifications:*"

# 3. Há lembretes agendados?
docker exec -it marquei-redis redis-cli ZRANGE bull:notifications:delayed 0 -1 WITHSCORES

# 4. Ver detalhes de um lembrete (use um ID da lista acima)
docker exec marquei-redis redis-cli HGETALL bull:notifications:57

# 5. Notificações no banco?
docker exec marquei-postgres psql -U postgres -d marquei -c 'SELECT type, COUNT(*) as total, sent FROM notifications GROUP BY type, sent ORDER BY type;'
```

Se todos os comandos retornarem dados, **o sistema está funcionando!** ✅

---

## 📝 Arquivos Importantes

- **Serviço:** `src/notifications/notifications.service.ts` (lógica de 24h)
- **Processador:** `src/notifications/notifications.processor.ts` (executa os jobs)
- **Configuração:** `src/app.module.ts` (conexão BullMQ + Redis)
- **Docker:** `docker-compose.yml` (container Redis)
