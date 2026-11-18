const db = require('../config/db');

function normalizar(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
async function fetchJson(url){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),3500);
  try{const r=await fetch(url,{signal:controller.signal,headers:{'Accept':'application/json','User-Agent':'BibliotecaEscolar/4.0'}});return r.ok?await r.json():null;}
  catch(_){return null;} finally{clearTimeout(timer);}
}
function imagem(links={}){const u=links.extraLarge||links.large||links.medium||links.small||links.thumbnail||links.smallThumbnail;return u?String(u).replace(/^http:/,'https:').replace(/&edge=curl/g,''):null;}
function ano(v){const m=String(v||'').match(/\d{4}/);return m?Number(m[0]):null;}
function score(item,l){const v=item?.volumeInfo||{},t=normalizar(v.title),a=normalizar((v.authors||[]).join(' ')),lt=normalizar(l.titulo),la=normalizar(l.autor);let p=0;if(t===lt)p+=20;else if(t.includes(lt)||lt.includes(t))p+=8;const sn=la.split(' ').filter(Boolean).pop();if(sn&&a.includes(sn))p+=8;if(v.language==='pt')p+=10;if(imagem(v.imageLinks))p+=8;if(v.description&&v.language==='pt')p+=5;return p;}
async function google(l){
  const key=process.env.GOOGLE_BOOKS_API_KEY?`&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}`:'';
  const q=`intitle:${l.titulo} inauthor:${l.autor||''}`;
  const d=await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&printType=books&maxResults=10${key}`);
  const item=(d?.items||[]).sort((a,b)=>score(b,l)-score(a,l))[0]; if(!item)return null; const v=item.volumeInfo||{};
  return {capa:imagem(v.imageLinks),sinopse:v.language==='pt'?v.description||null:null,editora:v.publisher||null,ano:ano(v.publishedDate),paginas:v.pageCount||null,gid:item.id||null,isbn:v.industryIdentifiers?.find(x=>x.type==='ISBN_13')?.identifier||null};
}
async function openLibrary(l){
  const d=await fetchJson(`https://openlibrary.org/search.json?title=${encodeURIComponent(l.titulo)}&author=${encodeURIComponent(l.autor||'')}&fields=key,cover_i,first_publish_year,publisher,isbn&limit=8`);
  const x=(d?.docs||[]).find(x=>x.cover_i)||null; if(!x)return null;
  return {capa:`https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`,olid:x.key||null,ano:x.first_publish_year||null,editora:x.publisher?.[0]||null,isbn:x.isbn?.find(v=>String(v).length===13)||null};
}
async function enriquecerLivro(l){
  const [g,o]=await Promise.all([google(l),openLibrary(l)]);
  const capa=g?.capa||o?.capa||null; const sinopse=g?.sinopse||null;
  if(!capa&&!sinopse&&!g&&!o)return false;
  await db.query(`UPDATE livros SET capa_url=COALESCE(capa_url,?), sinopse=COALESCE(sinopse,?), google_books_id=COALESCE(google_books_id,?), open_library_id=COALESCE(open_library_id,?), numero_paginas=COALESCE(numero_paginas,?), editora=COALESCE(editora,?), ano_publicacao=COALESCE(ano_publicacao,?), isbn=COALESCE(isbn,?) WHERE id_livro=?`,[capa,sinopse,g?.gid||null,o?.olid||null,g?.paginas||null,g?.editora||o?.editora||null,g?.ano||o?.ano||null,g?.isbn||o?.isbn||null,l.id_livro]);
  return !!capa;
}
async function enriquecerPendentes(){
  const [rows]=await db.query(`SELECT id_livro,titulo,autor FROM livros WHERE ativo=1 AND (capa_url IS NULL OR capa_url='') ORDER BY id_livro LIMIT 120`);
  if(!rows.length)return console.log('Capas: banco já enriquecido.');
  console.log(`Capas: enriquecendo ${rows.length} livros em segundo plano...`);
  let ok=0;
  for(const l of rows){try{if(await enriquecerLivro(l))ok++;}catch(_){} await new Promise(r=>setTimeout(r,250));}
  console.log(`Capas: enriquecimento concluído (${ok}/${rows.length} capas encontradas). Recarregue a página.`);
}
module.exports={enriquecerPendentes};
