const db=require('../config/db');
async function porLogin(login){
  const valor = String(login || '').trim();
  if (!valor) return undefined;
  // Normaliza e-mail sem diferenciar maiúsculas/minúsculas e remove espaços digitados.
  const [r] = await db.query(
    `SELECT * FROM usuarios
     WHERE (LOWER(TRIM(email))=LOWER(?) OR TRIM(matricula)=? OR TRIM(ra)=?)
       AND (ativo=1 OR ativo IS NULL)
     LIMIT 1`,
    [valor, valor, valor]
  );
  return r[0];
}
async function porEmail(email){const [r]=await db.query('SELECT * FROM usuarios WHERE email=? LIMIT 1',[email]);return r[0];}
async function porDocumento(documento){const [r]=await db.query('SELECT * FROM usuarios WHERE matricula=? OR ra=? LIMIT 1',[documento,documento]);return r[0];}
async function listar(){const [r]=await db.query(`SELECT id_usuario id,nome,email,perfil,COALESCE(ra,matricula) matricula,ra,serie,turma,setor,matricula,foto_perfil,data_cadastro dataCadastro FROM usuarios WHERE ativo=1 ORDER BY nome`);return r;}
async function criar({nome,email,senhaHash,perfil,matricula=null,ra=null,serie=null,turma=null,setor=null}){
  const [r]=await db.query(`INSERT INTO usuarios(nome,email,senha_hash,perfil,matricula,ra,serie,turma,setor) VALUES(?,?,?,?,?,?,?,?,?)`,[nome,email,senhaHash,perfil,matricula,ra,serie,turma,setor]);return r.insertId;
}
module.exports={porLogin,porEmail,porDocumento,listar,criar};
