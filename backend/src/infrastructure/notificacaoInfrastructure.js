const db=require('../config/db');
async function listar(idUsuario){const [r]=await db.query('SELECT id_notificacao id,id_usuario userId,titulo title,mensagem message,tipo type,lida `read`,data_criacao data FROM notificacoes WHERE id_usuario=? ORDER BY data_criacao DESC',[idUsuario]);return r.map(n=>({...n,read:!!n.read}));}
async function criar({userId,title,message,type='info'}){const [r]=await db.query('INSERT INTO notificacoes(id_usuario,titulo,mensagem,tipo) VALUES(?,?,?,?)',[userId,title,message,type]);return r.insertId;}
async function limpar(idUsuario){await db.query('UPDATE notificacoes SET lida=1 WHERE id_usuario=?',[idUsuario]);}
module.exports={listar,criar,limpar};
