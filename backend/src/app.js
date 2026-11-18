const express=require('express');const cors=require('cors');const path=require('path');const app=express();app.use(cors());app.use(express.json({limit:'8mb'}));app.use('/api/auth',require('./routers/authRoutes'));app.use('/api',require('./routers/apiRoutes'));app.get('/api/health',(req,res)=>res.json({status:'ok'}));app.use(express.static(path.join(__dirname,'../..')));app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'../../index.html')));app.use((err,req,res,next)=>{
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  const mensagem = err.code === 'ER_BAD_FIELD_ERROR'
    ? 'O banco de dados está com uma estrutura diferente da esperada. Confira se as atualizações SQL do projeto foram aplicadas.'
    : err.code === 'ECONNREFUSED'
      ? 'Não foi possível conectar ao MySQL. Verifique se o MySQL está iniciado e confira o .env.'
      : (err.message || 'Erro interno do servidor.');
  res.status(err.status || 500).json({erro:mensagem});
});module.exports=app;
