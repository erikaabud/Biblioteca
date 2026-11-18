require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

(async () => {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !senha || senha.length < 6) {
    throw new Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD (mínimo de 6 caracteres) no backend/.env.');
  }
  try {
    const [porEmail] = await db.query(
      'SELECT id_usuario, perfil FROM usuarios WHERE LOWER(TRIM(email))=LOWER(?) LIMIT 1',
      [email]
    );
    const [admins] = await db.query(
      "SELECT id_usuario, email FROM usuarios WHERE perfil='bibliotecario' ORDER BY id_usuario LIMIT 1"
    );
    const existente = porEmail[0] || admins[0];
    const hash = await bcrypt.hash(senha, 10);
    if (existente) {
      // Atualiza somente a conta de bibliotecário. Se o e-mail já pertence a outro perfil, interrompe.
      if (porEmail[0] && porEmail[0].perfil !== 'bibliotecario') {
        throw new Error('ADMIN_EMAIL já pertence a uma conta que não é bibliotecário. Corrija o e-mail no .env.');
      }
      await db.query(
        "UPDATE usuarios SET email=?, senha_hash=?, perfil='bibliotecario', ativo=1 WHERE id_usuario=?",
        [email, hash, existente.id_usuario]
      );
      console.log('Senha e e-mail do bibliotecário atualizados. Faça login com ADMIN_EMAIL e ADMIN_PASSWORD do .env.');
    } else {
      await db.query(
        "INSERT INTO usuarios (nome,email,senha_hash,perfil,matricula,ativo) VALUES (?,?,?,?,?,1)",
        ['Administrador da Biblioteca', email, hash, 'bibliotecario', 'ADMIN001']
      );
      console.log('Conta de bibliotecário criada. Faça login com ADMIN_EMAIL e ADMIN_PASSWORD do .env.');
    }
  } finally {
    await db.end();
  }
})().catch(e => { console.error('Não foi possível recuperar o bibliotecário:', e.message); process.exit(1); });
