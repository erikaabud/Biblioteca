const db=require('../config/db');
const solicitacoes=require('./solicitacaoService');
const favoritos=require('../infrastructure/favoritoInfrastructure');
const usuarios=require('../infrastructure/usuarioInfrastructure');
const livros=require('../infrastructure/livroInfrastructure');
const emprestimos=require('../infrastructure/emprestimoInfrastructure');
const notificacoes=require('../infrastructure/notificacaoInfrastructure');
async function obter(user){
 await solicitacoes.avisarVencimentos(user);
 const notificacoesUsuario=await notificacoes.listar(user.id);
 const [[bloqueio]]=await db.query("SELECT COUNT(*) quantidade FROM emprestimos WHERE id_usuario=? AND status='ativo' AND data_devolucao_prevista<CURDATE()",[user.id]);
 const bloqueado=Number(bloqueio.quantidade)>0;
 const pedidosReserva=await solicitacoes.reservas(user);
 const pedidosRenovacao=await solicitacoes.renovacoes(user);
 if(user.perfil!=='bibliotecario'){
  const [r]=await db.query(`SELECT e.id_emprestimo id,e.id_usuario idUsuario,e.id_livro idLivro,DATE_FORMAT(e.data_retirada,'%Y-%m-%d') dataRetirada,DATE_FORMAT(e.data_devolucao_prevista,'%Y-%m-%d') dataDevolucaoPrevista,DATE_FORMAT(e.data_devolucao_real,'%Y-%m-%d') dataDevolucaoReal,(e.status='ativo') ativo,l.titulo nomeLivro,l.autor autorLivro FROM emprestimos e INNER JOIN livros l ON l.id_livro=e.id_livro WHERE e.id_usuario=? ORDER BY e.id_emprestimo DESC`,[user.id]);
  return {bloqueadoPorAtraso:bloqueado,usuarios:[],livros:await livros.listar(),emprestimos:r,favoritos:await favoritos.listarPorUsuario(user.id),reservas:pedidosReserva,renovacoes:pedidosRenovacao,configuracoes:{prazoPadrao:7,notificacoes:notificacoesUsuario}};
 }
 const [[config]]=await db.query('SELECT prazo_padrao prazoPadrao FROM configuracoes WHERE id_configuracao=1');
 return {usuarios:await usuarios.listar(),livros:await livros.listar(),emprestimos:await emprestimos.listar(),favoritos:[],reservas:pedidosReserva,renovacoes:pedidosRenovacao,configuracoes:{prazoPadrao:config?.prazoPadrao||7,notificacoes:notificacoesUsuario}};
}
module.exports={obter};
