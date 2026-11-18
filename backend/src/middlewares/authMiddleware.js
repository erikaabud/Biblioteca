const jwt = require('jsonwebtoken');
function autenticar(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');
  if(!token) return res.status(401).json({erro:'Token não informado.'});
  try { req.user=jwt.verify(token,process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({erro:'Token inválido ou expirado.'}); }
}
function permitir(...perfis){ return (req,res,next)=> perfis.includes(req.user.perfil) ? next() : res.status(403).json({erro:'Acesso não autorizado.'}); }
module.exports={autenticar,permitir};
