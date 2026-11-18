# Alterações de perfis e favoritos

- Abas de leitor são exibidas apenas no painel de aluno/funcionário.
- Bibliotecário não possui mais a aba geral de favoritos.
- Na lista de usuários, abra **Ver favoritos deste aluno** para consultar os livros desse aluno.
- O endpoint autenticado `GET /api/usuarios/:id/favoritos` é exclusivo de bibliotecários e valida o perfil do aluno.
- Alunos e funcionários podem favoritar, reservar e solicitar renovação dos próprios livros.
- As tabelas existentes `favoritos`, `solicitacoes_reserva` e `solicitacoes_renovacao` já possuem chaves estrangeiras para `usuarios` e `livros`; não é necessário recriá-las nem apagar dados.
- Reinicie o backend e atualize a página com Ctrl+F5.
