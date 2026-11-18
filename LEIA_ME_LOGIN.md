# Recuperar o acesso do bibliotecário

O projeto precisa de uma chave `JWT_SECRET` no `backend/.env` para emitir o token de autenticação. Ela já foi incluída neste pacote. Não a compartilhe e não a altere enquanto houver sessões/tokens ativos.

Se o bibliotecário já existia no banco, o backend preserva a senha antiga por segurança. Para sincronizar a senha configurada em `ADMIN_PASSWORD` com a conta do bibliotecário, execute o procedimento abaixo **uma única vez**.

1. Faça uma cópia de segurança do banco de dados.
2. Confira no `backend/.env` os parâmetros `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Não compartilhe esse arquivo.
3. Inicie o MySQL e confirme que o banco configurado existe.
4. Abra um terminal na pasta `backend` e execute:

   ```bash
   npm install
   npm run recuperar-bibliotecario
   npm run dev
   ```

5. Na tela de login, use o e-mail e a senha definidos em `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env`.

O script `recuperar-bibliotecario` atualiza somente a conta de bibliotecário correspondente (ou a primeira conta com perfil bibliotecário, se o e-mail configurado ainda não existir). Ele não apaga livros, alunos, empréstimos, reservas ou favoritos. Se `ADMIN_EMAIL` já pertencer a uma conta que não seja bibliotecário, o script interrompe a operação.

## Se ainda não entrar

- Confira se o terminal do backend mostra `Biblioteca: http://localhost:3000` e não apresenta erro de conexão com o MySQL.
- Abra `http://localhost:3000/api/health`; a resposta esperada é `{"status":"ok"}`.
- Tente novamente em uma janela anônima ou atualize a página com `Ctrl + F5`.
- Se aparecer erro, copie somente a mensagem do erro. Não envie o `.env`, senhas, tokens ou dados pessoais.

**Importante:** não importe o SQL de instalação limpa em um banco que já contém dados, pois ele pode recriar/apagar estruturas e registros.
