-- Execute uma vez em bancos de dados já existentes.
ALTER TABLE solicitacoes_reserva MODIFY COLUMN status ENUM('pendente','aprovada','recusada','cancelada','concluida') NOT NULL DEFAULT 'pendente';
