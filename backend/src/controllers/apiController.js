const db=require('../config/db');const solicitacoes=require('../services/solicitacaoService');const favoritos=require('../infrastructure/favoritoInfrastructure');const bcrypt=require('bcryptjs');const state=require('../services/stateService');const users=require('../infrastructure/usuarioInfrastructure');const userService=require('../services/usuarioService');const livros=require('../infrastructure/livroInfrastructure');const emp=require('../infrastructure/emprestimoInfrastructure');const notif=require('../infrastructure/notificacaoInfrastructure');
exports.state=async(req,res)=>res.json(await state.obter(req.user));
exports.criarLivro=async(req,res)=>{const erro=validarLivro(req.body);if(erro)return res.status(400).json({erro});res.status(201).json({id:await livros.criar({...req.body,quantidade:Number(req.body.quantidade)})});};
function validarLivro(body){
 const quantidade=Number(body?.quantidade);
 if(!body?.nome?.trim()||!body?.autor?.trim()||!body?.categoria?.trim()||!Number.isInteger(quantidade)||quantidade<1) return 'Preencha título, autor, categoria e quantidade válida.';
 if(body.ano && (!Number.isInteger(Number(body.ano))||Number(body.ano)<0))return 'Ano inválido.';
 if(body.capa && !(/^(https?:\/\/|\/assets\/capas\/)/i.test(body.capa)))return 'URL de capa inválida.';
 return null;
}
exports.atualizarLivro=async(req,res)=>{
 const erro=validarLivro(req.body);if(erro)return res.status(400).json({erro});
 const atual=await livros.buscarPorId(req.params.id);if(!atual)return res.status(404).json({erro:'Livro não encontrado.'});
 const ativos=await livros.emprestimosAtivos(req.params.id);
 if(Number(req.body.quantidade)<ativos)return res.status(409).json({erro:`Existem ${ativos} empréstimos ativos deste livro. A quantidade não pode ser menor.`});
 await livros.atualizar(req.params.id,{...req.body,quantidade:Number(req.body.quantidade)});
 metadataCache.delete(String(req.params.id));res.json({ok:true});
};
exports.excluirLivro=async(req,res)=>{
 const atual=await livros.buscarPorId(req.params.id);if(!atual)return res.status(404).json({erro:'Livro não encontrado.'});
 const ativos=await livros.emprestimosAtivos(req.params.id);
 if(ativos)return res.status(409).json({erro:`Não é possível excluir: existem ${ativos} empréstimos ativos. Registre as devoluções primeiro.`});
 await livros.excluir(req.params.id);metadataCache.delete(String(req.params.id));res.json({ok:true});
};

exports.criarUsuario=async(req,res)=>res.status(201).json({id:await userService.criar(req.body)});
exports.criarEmprestimo=async(req,res)=>{const id=await emp.criar(req.body);const ls=await livros.listar();const l=ls.find(x=>x.id==req.body.idLivro);await notif.criar({userId:req.body.idUsuario,title:'📚 Novo Empréstimo',message:`Você pegou o livro "${l?.nome||''}".`,type:'info'});res.status(201).json({id});};
exports.devolver=async(req,res)=>{const all=await emp.listar();const e=all.find(x=>x.id==req.params.id);if(!e||!(await emp.devolver(req.params.id))) return res.status(404).json({erro:'Empréstimo ativo não encontrado.'});try{await notif.criar({userId:e.idUsuario,title:'✅ Devolução Registrada',message:'Sua devolução foi registrada. Obrigado!',type:'success'});}catch(err){console.error('Falha ao notificar devolução:',err.message);}res.json({ok:true});};
exports.limparNotificacoes=async(req,res)=>{await notif.limpar(req.user.id);res.json({ok:true});};
exports.config=async(req,res)=>{const dias=Number(req.body.prazoPadrao);if(!Number.isInteger(dias)||dias<1||dias>365)return res.status(400).json({erro:'Prazo deve estar entre 1 e 365 dias.'});await db.query('UPDATE configuracoes SET prazo_padrao=? WHERE id_configuracao=1',[dias]);res.json({ok:true});};

exports.favoritar=async(req,res)=>{await favoritos.adicionar(req.user.id,Number(req.params.id));res.json({favoritado:true});};
exports.desfavoritar=async(req,res)=>{await favoritos.remover(req.user.id,Number(req.params.id));res.json({favoritado:false});};
exports.reset=async(req,res)=>{await db.query('SET FOREIGN_KEY_CHECKS=0');for(const t of ['favoritos','notificacoes','emprestimos','livros','usuarios']) await db.query(`TRUNCATE TABLE ${t}`);await db.query('SET FOREIGN_KEY_CHECKS=1');res.json({ok:true});};

const metadataCache=new Map();
async function fetchJson(url,headers={}){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),3500);
  try{const r=await fetch(url,{headers,signal:controller.signal});if(!r.ok)return null;return await r.json();}
  catch(_){return null;} finally{clearTimeout(timer);}
}
function anoDe(data){const m=String(data||'').match(/\d{4}/);return m?Number(m[0]):null;}
function melhorImagem(links={}){return links.extraLarge||links.large||links.medium||links.small||links.thumbnail||links.smallThumbnail||null;}
function limparImagem(url){return url?String(url).replace(/^http:/,'https:').replace(/&edge=curl/g,'').replace(/&zoom=\d+/g,'&zoom=2'):null;}
function normalizar(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function pontuarGoogle(item,livro){
  const v=item?.volumeInfo||{}; const t=normalizar(v.title); const a=normalizar((v.authors||[]).join(' '));
  const lt=normalizar(livro.nome); const la=normalizar(livro.autor);
  let p=0;if(t===lt)p+=20;else if(t.includes(lt)||lt.includes(t))p+=8;
  const sobrenome=la.split(' ').filter(Boolean).pop();if(sobrenome&&a.includes(sobrenome))p+=8;
  if(v.language==='pt')p+=12;if(v.description&&v.language==='pt')p+=6;if(melhorImagem(v.imageLinks))p+=6;if(v.industryIdentifiers?.length)p+=2;return p;
}
async function buscarGoogle(livro){
  const key=process.env.GOOGLE_BOOKS_API_KEY?`&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}`:'';
  const isbn=String(livro.isbn||'').replace(/[^0-9Xx]/g,'');
  const consultas=[]; if(isbn)consultas.push(`isbn:${isbn}`); consultas.push(`intitle:${livro.nome} inauthor:${livro.autor||''}`); consultas.push(`${livro.nome} ${livro.autor||''}`);
  let candidatos=[];
  for(const q of consultas){
    const g=await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&printType=books&langRestrict=pt&maxResults=20${key}`,{'Accept':'application/json'});
    candidatos.push(...(g?.items||[])); if(candidatos.length)break;
  }
  if(!candidatos.length)return null;
  const item=[...candidatos].sort((a,b)=>pontuarGoogle(b,livro)-pontuarGoogle(a,livro))[0]; const v=item?.volumeInfo||{};
  return {capa:limparImagem(melhorImagem(v.imageLinks)),sinopse:v.language==='pt'?(v.description||null):null,ano:anoDe(v.publishedDate),editora:v.publisher||null,isbn:v.industryIdentifiers?.find(x=>x.type==='ISBN_13')?.identifier||v.industryIdentifiers?.find(x=>x.type==='ISBN_10')?.identifier||null,paginas:v.pageCount||null,googleBooksId:item.id||null,fonte:'Google Books (PT-BR)'};
}
async function buscarOpenLibrary(livro){
  const headers={'User-Agent':'BibliotecaEscolar/3.0 (projeto educacional)','Accept':'application/json'}; const isbn=String(livro.isbn||'').replace(/[^0-9Xx]/g,''); let doc=null;
  if(isbn){const d=await fetchJson(`https://openlibrary.org/search.json?q=isbn:${encodeURIComponent(isbn)}&fields=key,title,author_name,cover_i,first_publish_year,publisher,isbn&limit=3`,headers);doc=(d?.docs||[]).find(x=>x.cover_i)||d?.docs?.[0]||null;}
  if(!doc){const d=await fetchJson(`https://openlibrary.org/search.json?title=${encodeURIComponent(livro.nome)}&author=${encodeURIComponent(livro.autor||'')}&fields=key,title,author_name,cover_i,first_publish_year,publisher,isbn&limit=10`,headers);doc=(d?.docs||[]).find(x=>x.cover_i)||d?.docs?.[0]||null;}
  if(!doc)return null;
  return {capa:doc.cover_i?`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`:null,ano:doc.first_publish_year||null,editora:doc.publisher?.[0]||null,isbn:doc.isbn?.find(x=>String(x).length===13)||doc.isbn?.[0]||null,openLibraryId:doc.key||null,fonte:'Open Library (capa)'};
}
async function buscarWikipediaPT(livro){
  const termo=`${livro.nome} ${livro.autor||''} livro`;
  const url=`https://pt.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(termo)}&gsrlimit=5&prop=extracts&exintro=1&explaintext=1&exsentences=5&format=json&origin=*`;
  const d=await fetchJson(url,{'Accept':'application/json','User-Agent':'BibliotecaEscolar/3.0 (projeto educacional)'});
  const paginas=Object.values(d?.query?.pages||{}); if(!paginas.length)return null;
  const titulo=normalizar(livro.nome); const melhor=paginas.sort((a,b)=>{const pa=normalizar(a.title).includes(titulo)?1:0;const pb=normalizar(b.title).includes(titulo)?1:0;return pb-pa;})[0];
  const texto=String(melhor?.extract||'').trim(); if(texto.length<80)return null;
  return {sinopse:texto.slice(0,1800),fonte:'Wikipédia em português'};
}
exports.metadataLivro=async(req,res)=>{
  const livro=await livros.buscarPorId(req.params.id); if(!livro)return res.status(404).json({erro:'Livro não encontrado.'});
  const cacheKey=String(livro.id);if(metadataCache.has(cacheKey))return res.json(metadataCache.get(cacheKey));
  if(livro.capa && livro.sinopse) return res.json({capa:livro.capa,sinopse:livro.sinopse,ano:livro.ano,editora:livro.editora,isbn:livro.isbn,paginas:livro.paginas,fonte:'Cadastro local'});
  // Busca capa e texto em fontes separadas: Open Library é especialmente confiável para cover_i;
  // Google Books é priorizado para edições em português e Wikipédia PT só complementa a sinopse.
  const [google,open] = await Promise.all([buscarGoogle(livro),buscarOpenLibrary(livro)]);
  let resultado={capa:livro.capa||google?.capa||open?.capa||null,sinopse:null,ano:livro.ano||google?.ano||open?.ano||null,editora:livro.editora||google?.editora||open?.editora||null,isbn:livro.isbn||google?.isbn||open?.isbn||null,paginas:livro.paginas||google?.paginas||null,googleBooksId:google?.googleBooksId||null,openLibraryId:livro.openLibraryId||open?.openLibraryId||null,gutendexId:null,fonte:[]};
  // Não reaproveita automaticamente sinopses antigas em inglês. Prefere descrição PT do Google.
  if(google?.sinopse)resultado.sinopse=google.sinopse;
  if(!resultado.sinopse){const wiki=await buscarWikipediaPT(livro);if(wiki?.sinopse){resultado.sinopse=wiki.sinopse;resultado.fonte.push(wiki.fonte);}}
  if(!resultado.sinopse && livro.sinopse) resultado.sinopse=livro.sinopse;
  if(google)resultado.fonte.unshift(google.fonte);if(open)resultado.fonte.push(open.fonte);
  resultado.fonte=[...new Set(resultado.fonte)].join(' → ')||'Banco local';
  try{await livros.salvarMetadata(livro.id,resultado);}catch(_){} metadataCache.set(cacheKey,resultado);res.json(resultado);
};

// Upload seguro de capa em JPEG, PNG ou WebP; arquivos armazenados no próprio projeto.
exports.uploadCapa=async(req,res)=>{
  const fs=require('fs/promises'),path=require('path'),crypto=require('crypto');
  const match=String(req.body?.imagem||'').match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if(!match)return res.status(400).json({erro:'Envie uma imagem PNG, JPEG ou WebP.'});
  const bytes=Buffer.from(match[2],'base64');
  if(bytes.length>4*1024*1024)return res.status(400).json({erro:'A capa deve ter no máximo 4 MB.'});
  const ext={png:'png',jpeg:'jpg',webp:'webp'}[match[1]];
  const assinatura=bytes.subarray(0,12);
  const valido=ext==='png'?assinatura.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):ext==='jpg'?assinatura[0]===255&&assinatura[1]===216&&assinatura[2]===255:assinatura.toString('ascii',0,4)==='RIFF'&&assinatura.toString('ascii',8,12)==='WEBP';
  if(!valido)return res.status(400).json({erro:'Arquivo de imagem inválido.'});
  const pasta=path.join(__dirname,'../../../assets/capas/enviadas');await fs.mkdir(pasta,{recursive:true});
  const nome=crypto.randomUUID()+'.'+ext;await fs.writeFile(path.join(pasta,nome),bytes,{flag:'wx'});
  res.status(201).json({capa:'/assets/capas/enviadas/'+nome});
};

exports.pedirReserva=async(req,res)=>res.status(201).json({id:await solicitacoes.pedirReserva(req.user,Number(req.body.idLivro))});
exports.responderReserva=async(req,res)=>{await solicitacoes.responderReserva(req.params.id,req.body.status,req.body.resposta);res.json({ok:true});};
exports.pedirRenovacao=async(req,res)=>res.status(201).json({id:await solicitacoes.pedirRenovacao(req.user,Number(req.body.idEmprestimo))});
exports.responderRenovacao=async(req,res)=>{await solicitacoes.responderRenovacao(req.params.id,req.body.status,req.body.novaData,req.body.resposta);res.json({ok:true});};
exports.favoritosUsuario=async(req,res)=>{
 const id=Number(req.params.id);
 if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({erro:'Usuário inválido.'});
 const [[usuario]]=await db.query('SELECT id_usuario FROM usuarios WHERE id_usuario=? AND perfil=? AND ativo=1',[id,'aluno']);
 if(!usuario)return res.status(404).json({erro:'Aluno não encontrado.'});
 const [rows]=await db.query('SELECT l.id_livro id,l.titulo nome,l.autor FROM favoritos f JOIN livros l ON l.id_livro=f.id_livro WHERE f.id_usuario=? ORDER BY f.criado_em DESC',[id]);
 res.json(rows);
};
