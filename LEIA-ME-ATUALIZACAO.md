# Atualização: catálogo, reservas e renovação

## Banco de dados EXISTENTE (sem perder dados)
1. Faça backup do banco `biblioteca_escolar` no phpMyAdmin.
2. Importe **somente** `DataBase/ATUALIZACAO_SEM_APAGAR_DADOS.sql`.
3. Não importe novamente `biblioteca_escolar.sql`, pois ele contém `DROP DATABASE`.

## Instalação do zero
Use `DataBase/biblioteca_escolar.sql`, que agora contém as novas tabelas.

## Funcionamento
- Aluno vê catálogo, disponibilidade e favoritos; pode enviar intenção de reserva de exemplar disponível.
- Reserva é apenas uma intenção: aprovação não cria empréstimo automaticamente; o bibliotecário ainda registra a retirada.
- Aluno solicita renovação de empréstimo ativo; bibliotecário aprova informando nova data ou recusa com mensagem.
- A resposta é registrada no banco e notificada ao aluno no sino.
- Ao consultar o sistema, empréstimos vencendo em até 2 dias ou atrasados geram alerta no sino, sem duplicar para o mesmo empréstimo/prazo.
- Bibliotecário não pode favoritar; consulta favoritos dos alunos no painel.
- Atualização automática enquanto a página estiver aberta a cada 60 segundos.

## Testes recomendados
1. Login como aluno: conferir catálogo, favoritar, pedir reserva.
2. Login como bibliotecário: aprovar/recusar reserva, consultar favoritos.
3. Registrar empréstimo para aluno e pedir renovação como aluno.
4. Aprovar renovação com data futura; verificar prazo atualizado e notificação.
5. Recusar outra renovação; verificar notificação.
6. Alterar data de devolução no banco para daqui a 2 dias e abrir painel do aluno para verificar aviso.

Mantenha seu `.env` existente no backend. Não foi incluído no ZIP por conter segredos.
