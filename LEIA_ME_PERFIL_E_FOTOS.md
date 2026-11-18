# Atualização do perfil e fotos

1. Faça backup do banco atual.
2. Execute SOMENTE `DataBase/ATUALIZACAO_PERFIL_TCC.sql` no banco já existente. Não execute o arquivo de instalação limpa sobre dados existentes.
3. Em `backend/.env`, preencha a senha do MySQL, o nome do banco e um JWT_SECRET seguro; mantenha o JWT_SECRET antigo para preservar sessões. O arquivo incluso é um MODELO e não contém suas credenciais reais.
4. Na pasta backend: `npm install` e `npm run dev`.
5. Teste edição de perfil, foto e visualização de favoritos de funcionários.

**Observações:** fotos são armazenadas em MEDIUMTEXT no MySQL (até 1 MB de arquivo), o que facilita implantação acadêmica, mas não é ideal para produção. O editor de dados utiliza diálogos simples do navegador, sem refazer as telas existentes. O administrador pode editar dados básicos, mas não pode alterar perfil ou identificadores RA/matrícula. Alterações de nome/email não atualizam imediatamente o JWT até novo login. Não foi possível validar com banco MySQL ativo neste ambiente.
