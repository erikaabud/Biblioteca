const db = require('../config/db');

async function listarPorUsuario(idUsuario) {
  const [rows] = await db.query('SELECT id_livro idLivro FROM favoritos WHERE id_usuario=? ORDER BY criado_em DESC', [idUsuario]);
  return rows.map(r => Number(r.idLivro));
}

async function adicionar(idUsuario, idLivro) {
  await db.query('INSERT IGNORE INTO favoritos(id_usuario,id_livro) VALUES(?,?)', [idUsuario, idLivro]);
}

async function remover(idUsuario, idLivro) {
  await db.query('DELETE FROM favoritos WHERE id_usuario=? AND id_livro=?', [idUsuario, idLivro]);
}

module.exports = { listarPorUsuario, adicionar, remover };
