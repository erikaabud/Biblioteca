# Atualização do sistema de biblioteca

## O que mudou
- Portal do aluno: somente Minha Biblioteca, com empréstimos ativos, vencimentos e histórico de devoluções.
- O backend não envia o catálogo, outros usuários, relatórios nem dados de terceiros ao aluno.
- Metadados e gerenciamento do acervo são exclusivos do bibliotecário; favoritos foram desativados na API.
- Alertas JavaScript substituídos por modal de aviso com botão OK.
- Telas de login e cadastro receberam ajustes visuais.
- Validação de aluno e prazo na criação de empréstimos.

## Banco de dados
Use o arquivo DataBase/biblioteca_escolar.sql apenas em instalação nova. Se já tem dados, **não reimporte o SQL**, pois isso pode apagar registros. As alterações usam as tabelas existentes; não é necessária migração estrutural. Faça backup antes de qualquer intervenção.

## Execução
1. Configure backend/.env com os dados do MySQL e JWT_SECRET.
2. Importe DataBase/biblioteca_escolar.sql somente se o banco ainda não existir.
3. No terminal: cd backend && npm install && npm start (ou npm run dev).
4. Acesse http://localhost:3000 (confirme PORT no .env).

## Observações
- A conta do bibliotecário deve ser criada/definida por administrador no banco; o cadastro público não concede esse perfil.
- A exclusão completa de dados via botão reset foi desabilitada preventivamente.
- Validação final com MySQL em execução é necessária antes de apresentar o TCC.
