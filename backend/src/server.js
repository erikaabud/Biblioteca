require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const app = require('./app');

async function garantirAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'bibliotecario@escola.com').trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha || senha.length < 6) throw new Error('Defina ADMIN_PASSWORD com pelo menos 6 caracteres no .env');
  const [rows] = await db.query("SELECT id_usuario, senha_hash FROM usuarios WHERE email=? LIMIT 1", [email]);
  if (rows.length) {
    console.log('Bibliotecário existente preservado; senha não será redefinida.');
    return;
  }
  const [admins] = await db.query("SELECT id_usuario FROM usuarios WHERE perfil='bibliotecario' LIMIT 1");
  if (admins.length) {
    console.log('Bibliotecário existente preservado; configure acesso pela conta existente.');
    return;
  }
  const hash = await bcrypt.hash(senha, 10);
  await db.query("INSERT INTO usuarios(nome,email,senha_hash,perfil,matricula) VALUES(?,?,?,?,?)",
    ['Administrador da Biblioteca', email, hash, 'bibliotecario', 'ADMIN001']);
  console.log('Bibliotecário inicial criado.');
}

(async () => {
  try {
    await db.query('SELECT 1');
    await garantirAdmin();
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Biblioteca: http://localhost:${port}`));
  } catch (e) {
    console.error('Falha ao iniciar:', e.message);
    process.exit(1);
  }
})();
