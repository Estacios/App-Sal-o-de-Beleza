# Sistema de Agendamento para Salão - Railway

Este projeto foi adaptado para subir no Railway com Node.js + MySQL.

## O que já vem pronto
- Página pública para a cliente agendar
- Painel administrativo com login simples
- Cadastro e exclusão de serviços
- Controle de agendamentos
- Limite de dias para agendamento (15 por padrão)
- Bloqueio de dias de atendimento
- Horários ocupados ficam indisponíveis automaticamente
- Suporte a variáveis padrão e variáveis automáticas do Railway para MySQL

## Arquivos principais
- `server.js`
- `railway.json`
- `db.sql`
- `.env.example`
- `public/index.html`
- `public/app.js`
- `public/style.css`

## Como subir no Railway
1. Crie um novo projeto no Railway
2. Envie esta pasta por GitHub ou upload
3. Adicione um serviço MySQL no projeto
4. No serviço do app, configure as variáveis:
   - `SESSION_SECRET`
   - `ADMIN_USER`
   - `ADMIN_PASS`
5. As variáveis do MySQL podem vir automáticas do Railway
6. Rode o SQL do arquivo `db.sql` no banco MySQL
7. Faça o deploy

## Banco de dados
O backend já tenta usar primeiro:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

Se essas não existirem, ele tenta usar as variáveis do Railway:
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`

## Comando de start
```bash
npm start
```

## Login do painel
O painel usa o usuário e senha definidos em:
- `ADMIN_USER`
- `ADMIN_PASS`

## Observação importante
Você ainda precisa importar o banco com o arquivo `db.sql`.
