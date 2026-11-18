-- Execute no banco existente, sem apagar dados.
CREATE OR REPLACE VIEW vw_leitores_bloqueados_atraso AS
SELECT u.id_usuario,u.nome,u.perfil,COUNT(*) AS emprestimos_atrasados
FROM usuarios u JOIN emprestimos e ON e.id_usuario=u.id_usuario
WHERE e.status='ativo' AND e.data_devolucao_prevista<CURDATE()
GROUP BY u.id_usuario,u.nome,u.perfil;
