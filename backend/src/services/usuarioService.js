const bcrypt=require('bcryptjs'); const repo=require('../infrastructure/usuarioInfrastructure');
async function criar(d){
  if(!d.nome||!d.email||!d.senha||!['aluno','funcionario'].includes(d.perfil)) throw Object.assign(new Error('Dados de usuário inválidos.'),{status:400});
  if(d.perfil==='aluno' && (!d.matricula||!d.serie||!d.turma)) throw Object.assign(new Error('Informe RA, série e turma.'),{status:400});
  if(d.perfil==='funcionario' && !d.setor) throw Object.assign(new Error('Informe o setor.'),{status:400});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw Object.assign(new Error('E-mail inválido.'),{status:400});
  if(d.perfil==='aluno' && !d.email.toLowerCase().endsWith('@al.educacao.sp.gov.br')) throw Object.assign(new Error('O aluno precisa de e-mail @al.educacao.sp.gov.br.'),{status:400});
  if(String(d.senha).length<6) throw Object.assign(new Error('A senha precisa ter 6 caracteres.'),{status:400});
  if(await repo.porEmail(d.email)) throw Object.assign(new Error('E-mail já cadastrado.'),{status:409});
  if(d.perfil==='aluno' && await repo.porDocumento(d.ra||d.matricula)) throw Object.assign(new Error('RA ou matrícula já cadastrado.'),{status:409});
  return repo.criar({nome:d.nome,email:d.email,perfil:d.perfil,senhaHash:await bcrypt.hash(d.senha,10),ra:d.perfil==='aluno'?(d.ra||d.matricula):null,serie:d.perfil==='aluno'?d.serie:null,turma:d.perfil==='aluno'?d.turma:null,matricula:null,setor:d.perfil==='funcionario'?d.setor:null});
}
module.exports={criar};
