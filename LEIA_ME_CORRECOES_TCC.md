# Correções das regras de negócio para TCC

## Antes de iniciar
1. Faça backup do banco MySQL atual.
2. Em um banco já instalado, execute `DataBase/ATUALIZACAO_REGRAS_TCC.sql` **uma vez**. Em instalações novas, use o SQL de instalação limpa atualizado.
3. Mantenha o `.env` original e não compartilhe suas senhas. O pacote distribuído não inclui o `.env` real.
4. Execute `npm install` na pasta `backend` e depois `npm start`.

## Alterações
- Cadastro de livros passa a aplicar a validação que já existia na edição.
- Cada leitor pode manter até 3 empréstimos ativos; funcionários também podem receber empréstimos via API. A interface de administração pode exigir adaptação para selecionar funcionários.
- Reservas aprovadas comprometem exemplares até o empréstimo correspondente, quando passam para `concluida`.
- Renovação limitada a uma aprovação por empréstimo e exige data posterior ao vencimento atual.
- A senha de um bibliotecário existente não é mais redefinida em cada reinicialização.
- Prazo de configuração passa a ser validado.

## Atenção
Não foi possível testar o sistema integrado a um banco MySQL ativo neste ambiente. Execute testes de cadastro, reservas simultâneas, empréstimos, devoluções e renovações antes de apresentar. Reservas aprovadas antigas permanecem comprometendo exemplares até serem atendidas. O limite de três livros é uma política sugerida e pode ser alterado no código.
