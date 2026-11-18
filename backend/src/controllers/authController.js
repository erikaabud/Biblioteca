const service=require('../services/authService');
exports.login=async(req,res)=>res.json(await service.login(req.body.login||req.body.email,req.body.senha));
exports.cadastrar=async(req,res)=>res.status(201).json(await service.cadastrarPublico(req.body));
