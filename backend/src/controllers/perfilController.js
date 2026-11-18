const db=require('../config/db');
const bcrypt=require('bcryptjs');
function erro(m,status=400){throw Object.assign(new Error(m),{status});}
async function salvar(id,d,proprio){
 const [rows]=await db.query('SELECT * FROM usuarios WHERE id_usuario=? AND ativo=1',[id]);
 if(!rows.length)erro('Usuário não encontrado.',404);
 const u=rows[0]; const campos={};
 for(const k of ['nome','email','serie','turma','setor'])if(Object.prototype.hasOwnProperty.call(d,k)){
   if(['serie','turma'].includes(k)&&u.perfil!=='aluno')continue;
   if(k==='setor'&&u.perfil!=='funcionario')continue;
   if(typeof d[k]!=='string'||!d[k].trim()||d[k].length>180)erro('Valor inválido para '+k);
   campos[k]=d[k].trim();
 }
 if(campos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.email))erro('E-mail inválido.');
 if(campos.email&&u.perfil==='aluno'&&!campos.email.toLowerCase().endsWith('@al.educacao.sp.gov.br'))erro('O aluno deve usar e-mail institucional.');
 if(d.senha!==undefined&&d.senha!==''){
   if(typeof d.senha!=='string'||d.senha.length<8)erro('A senha deve ter ao menos 8 caracteres.');
   campos.senha_hash=await bcrypt.hash(d.senha,10);
 }
 if(!Object.keys(campos).length)erro('Nenhuma alteração informada.');
 try {await db.query('UPDATE usuarios SET '+Object.keys(campos).map(k=>k+'=?').join(',')+' WHERE id_usuario=?',[...Object.values(campos),id]);}
 catch(e){if(e.code==='ER_DUP_ENTRY')erro('E-mail já cadastrado.',409);throw e;}
 const [r]=await db.query('SELECT id_usuario id,nome,email,perfil,ra,matricula,serie,turma,setor,foto_perfil FROM usuarios WHERE id_usuario=?',[id]);return r[0];
}
exports.atualizarProprio=async(req,res)=>res.json(await salvar(req.user.id,req.body,true));
exports.atualizarUsuario=async(req,res)=>res.json(await salvar(req.params.id,req.body,false));
exports.atualizarFoto=async(req,res)=>{
 const foto=req.body.foto;
 if(typeof foto!=='string'||foto.length>1500000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(foto))erro('Imagem inválida. Use JPG, PNG ou WebP de até 1 MB.');
 const b=Buffer.from(foto.split(',')[1],'base64');if(b.length>1048576||b.length<10)erro('Tamanho de foto inválido.');
 const mime=foto.slice(5,foto.indexOf(';'));
 if(!(mime==='image/png'&&b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) || mime==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255 || mime==='image/webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'))erro('Conteúdo da imagem inválido.');
 await db.query('UPDATE usuarios SET foto_perfil=? WHERE id_usuario=?',[foto,req.user.id]);
 const [r]=await db.query('SELECT id_usuario id,nome,email,perfil,ra,matricula,serie,turma,setor,foto_perfil FROM usuarios WHERE id_usuario=?',[req.user.id]);res.json(r[0]);
};
