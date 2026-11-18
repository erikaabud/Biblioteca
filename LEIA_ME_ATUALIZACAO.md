# Atualização TCC — 20/10/2026

- Cadastro público ocultado e rota POST /api/auth/cadastro bloqueada (403). Usuários cadastrados no painel do bibliotecário.
- Campo de aluno no empréstimo agora pesquisa por nome, matrícula ou RA; clique na sugestão para selecionar.
- Prazo de cada empréstimo permanece na tela Empréstimos; prazo padrão e backup/restauração permanecem em Administração.
- Corrigida a identificação de empréstimos ativos: o MySQL devolve 1/0, não booleano true/false. Isso impedia listar empréstimos ativos para devolução.
- A conclusão da devolução não é mais apresentada como falha caso somente a notificação dê erro.

## Instalação
Substitua os arquivos do projeto pelos desta versão, preservando seu arquivo backend/.env e seu banco MySQL existente. Reinicie o backend com npm run dev e atualize a página com Ctrl+F5.
Não execute importações ou restaurações de banco para esta atualização.
