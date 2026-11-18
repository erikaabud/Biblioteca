CORREÇÃO DO ERRO HTTP 431

Causa identificada no código: o login incluía foto_perfil (data URI/base64) dentro do JWT. Fotos podem ser grandes; o token era então enviado em todos os cabeçalhos Authorization e excedia o limite do servidor, provocando HTTP 431.

Correções aplicadas:
- JWT contém somente id, nome, e-mail e perfil.
- Foto continua sendo devolvida separadamente ao frontend e armazenada na coluna foto_perfil.
- O frontend não envia Authorization ao endpoint público /api/auth/login.
- Tokens antigos acima de 6000 caracteres são removidos para forçar novo login e impedir repetir o 431.

Instalação:
1. Faça uma cópia da pasta atual.
2. Extraia este ZIP para uma pasta nova e mantenha o seu backend/.env atual (não substitua por exemplo).
3. Na pasta backend, execute npm install e npm run dev.
4. Abra http://localhost:3000 e pressione Ctrl+F5. O código limpa tokens antigos grandes automaticamente.
5. Tente entrar novamente. Não é necessário alterar o banco de dados nem executar SQL.

Se o navegador continuar com dados antigos, abra DevTools > Application > Local Storage e Session Storage para http://localhost:3000 e remova somente a chave bibliotecaToken; depois faça login novamente.
