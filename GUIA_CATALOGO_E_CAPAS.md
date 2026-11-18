# Catálogo e capas - versão atualizada

## O que foi incluído
- 104 títulos já presentes no SQL original, com 104 capas ilustrativas locais geradas para o catálogo. **Estas imagens são artes ilustrativas do sistema, NÃO capas oficiais das editoras.**
- Resumos em português preparados para 69 obras conhecidas; demais livros ainda podem receber sinopse no cadastro ou pela consulta de metadados.
- Capas aparecem diretamente nos cards, com imagem padrão quando não houver capa.
- Cadastro manual permite enviar capa PNG/JPEG/WebP até 4 MB ou informar URL, e cadastrar sinopse.
- As imagens enviadas são salvas em assets/capas/enviadas, com caminho no MySQL.
- Validação do backend: aluno usa @al.educacao.sp.gov.br, funcionário usa qualquer e-mail válido e não precisa de matrícula.

## Instalação
1. Faça backup do seu banco atual. **O arquivo DataBase/biblioteca_escolar.sql começa com DROP DATABASE**: importá-lo apaga o banco existente. Use somente para uma instalação limpa.
2. Importe DataBase/biblioteca_escolar.sql no phpMyAdmin.
3. Configure backend/.env e execute `npm install` e `npm start` dentro de backend.
4. Abra http://localhost:3000.
5. Para banco existente, NÃO reimporte o SQL completo. Aplique apenas as instruções UPDATE de capa/sinopse do fim do SQL e altere a restrição CHECK do funcionário, caso exista.

## Limitações
- Não há ISBN para títulos sem edição identificada: ISBN é específico de uma edição e não deve ser inventado.
- O projeto não inclui capas comerciais oficiais. O bibliotecário pode enviar a imagem da edição que possui, respeitando os direitos de uso.
- Não foi possível testar uma conexão real ao MySQL neste ambiente.
