const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const usuarios=require('../infrastructure/usuarioInfrastructure');

async function login(login,senha){
  if(!login||!senha) throw Object.assign(new Error('Informe seu e-mail/matrícula/RA e a senha.'),{status:400});
  const u=await usuarios.porLogin(login);
  if(!u) throw Object.assign(new Error('Usuário não encontrado ou conta desativada. Confira o e-mail usado no cadastro.'),{status:401});
  if(!u.senha_hash || !(await bcrypt.compare(String(senha),u.senha_hash))) throw Object.assign(new Error('Senha incorreta. Se for o bibliotecário, execute o script de recuperação descrito em LEIA_ME_LOGIN.md.'),{status:401});
  // Fotos ficam no banco e são retornadas separadamente; nunca coloque base64 no JWT.
  // O token deve conter somente os dados pequenos necessários para autorização.
  const user={id:u.id_usuario,nome:u.nome,email:u.email,perfil:u.perfil,matricula:u.matricula,ra:u.ra,serie:u.serie,turma:u.turma,setor:u.setor};
  const tokenPayload={id:user.id,nome:user.nome,email:user.email,perfil:user.perfil};
  return {token:jwt.sign(tokenPayload,process.env.JWT_SECRET,{expiresIn:'8h'}),user:{...user,foto_perfil:u.foto_perfil||null}};
}

async function cadastrarPublico(d){
  if(!['aluno','funcionario'].includes(d.perfil)) throw Object.assign(new Error('Tipo de usuário inválido.'),{status:400});
  if(!d.nome||!d.email||!d.senha) throw Object.assign(new Error('Preencha todos os campos obrigatórios.'),{status:400});
  if(d.senha.length<6) throw Object.assign(new Error('A senha deve ter pelo menos 6 caracteres.'),{status:400});
  if(d.perfil==='aluno' && (!d.ra||!d.serie||!d.turma)) throw Object.assign(new Error('Aluno deve informar RA, série e turma.'),{status:400});
  if(d.perfil==='funcionario' && (!d.setor||!d.matricula)) throw Object.assign(new Error('Funcionário deve informar setor e matrícula na escola.'),{status:400});
  if(await usuarios.porEmail(d.email)) throw Object.assign(new Error('E-mail já cadastrado.'),{status:409});
  const documento=d.perfil==='aluno'?d.ra:d.matricula;
  if(await usuarios.porDocumento(documento)) throw Object.assign(new Error('RA ou matrícula já cadastrado.'),{status:409});
  const dados={nome:d.nome,email:d.email,perfil:d.perfil,senhaHash:await bcrypt.hash(d.senha,10),ra:d.perfil==='aluno'?d.ra:null,serie:d.perfil==='aluno'?d.serie:null,turma:d.perfil==='aluno'?d.turma:null,setor:d.perfil==='funcionario'?d.setor:null,matricula:d.perfil==='funcionario'?d.matricula:null};
  const id=await usuarios.criar(dados);
  return {id,nome:d.nome,email:d.email,perfil:d.perfil};
}
module.exports={login,cadastrarPublico};
