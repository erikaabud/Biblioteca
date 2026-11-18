# Instalação e separação de áreas

1. Importe `DataBase/BIBLIOTECA_COMPLETA_INSTALACAO_LIMPA.sql` no phpMyAdmin. ATENÇÃO: o script apaga o banco biblioteca_escolar.
2. Abra `backend/.env`, ajuste DB_PASSWORD e substitua ADMIN_PASSWORD por uma senha forte.
3. Na pasta backend, execute `npm install` e `npm start` (ou o comando do README).
4. Entre com aluno para ver abas Catálogo, Favoritos, Minhas reservas e Renovações.
5. Entre com bibliotecário para ver Solicitações dos alunos e Favoritos dos alunos (consulta).
6. As notificações de prazo dependem do backend em execução; teste com um empréstimo próximo do vencimento.

O sistema não foi testado com MySQL e navegador neste ambiente.
