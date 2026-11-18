
"use strict";

// Geração de PDF independente de bibliotecas externas/CDN.
function baixarRelatorioPDF(registros, dataInicio, dataFim) {
    const encoder = new TextEncoder();
    const normalizar = (valor) => String(valor ?? "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "?");
    const escaparPDF = (valor) => normalizar(valor)
        .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const limitar = (valor, tamanho) => {
        const texto = normalizar(valor);
        return texto.length > tamanho ? texto.slice(0, tamanho - 3) + "..." : texto;
    };
    const campos = ["Leitor", "Livro", "Retirada", "Devolução prevista", "Devolução efetiva", "Situação"];
    const larguras = [25, 37, 13, 16, 16, 16];
    const linhas = registros.map(item =>
        campos.map((campo, indice) => limitar(item[campo], larguras[indice]))
            .map((valor, indice) => valor.padEnd(larguras[indice], " "))
            .join(" ")
    );
    const porPagina = 38;
    const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
    const objetos = [null];
    const adicionar = (valor) => { objetos.push(valor); return objetos.length - 1; };
    const catalogo = adicionar("");
    const paginasRaiz = adicionar("");
    const fonteNormal = adicionar("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
    const fonteNegrito = adicionar("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>");
    const idsPaginas = [];

    for (let pagina = 0; pagina < totalPaginas; pagina++) {
        const inicioLote = pagina * porPagina;
        const lote = linhas.slice(inicioLote, inicioLote + porPagina);
        const comandos = [];
        const escrever = (texto, x, y, tamanho = 9, negrito = false) => {
            comandos.push(`BT /${negrito ? "F2" : "F1"} ${tamanho} Tf 1 0 0 1 ${x} ${y} Tm (${escaparPDF(texto)}) Tj ET`);
        };
        escrever("BIBLIOTECA ESCOLAR | RELATORIO DE EMPRESTIMOS", 30, 556, 15, true);
        escrever(`Periodo: ${normalizar(dataInicio)} a ${normalizar(dataFim)}   Total: ${registros.length}`, 30, 533, 10);
        escrever(`Pagina ${pagina + 1} de ${totalPaginas}`, 695, 533, 9);
        escrever("Leitor                    Livro                                 Retirada      Prevista         Devolvida        Situacao", 30, 502, 8, true);
        comandos.push("0.75 w 30 494 m 810 494 l S");
        if (!registros.length) escrever("Nenhum emprestimo no periodo selecionado.", 30, 472, 10);
        lote.forEach((linha, indice) => escrever(linha, 30, 477 - indice * 11, 8));
        const stream = comandos.join("\n") + "\n";
        const streamId = adicionar(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
        const pageId = adicionar(`<< /Type /Page /Parent ${paginasRaiz} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fonteNormal} 0 R /F2 ${fonteNegrito} 0 R >> >> /Contents ${streamId} 0 R >>`);
        idsPaginas.push(pageId);
    }
    objetos[paginasRaiz] = `<< /Type /Pages /Kids [${idsPaginas.map(id => id + " 0 R").join(" ")}] /Count ${idsPaginas.length} >>`;
    objetos[catalogo] = `<< /Type /Catalog /Pages ${paginasRaiz} 0 R >>`;
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let id = 1; id < objetos.length; id++) {
        offsets[id] = encoder.encode(pdf).length;
        pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
    }
    const inicioXref = encoder.encode(pdf).length;
    pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objetos.length; id++) {
        pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objetos.length} /Root ${catalogo} 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
    const url = URL.createObjectURL(new Blob([encoder.encode(pdf)], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_biblioteca_${dataInicio}_${dataFim}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}


// ======================================================
// BIBLIOTECA ESCOLAR - JAVASCRIPT
// ======================================================

const API = "/api";
const DOMINIO_EMAIL_ALUNO = "@al.educacao.sp.gov.br";

// Tokens antigos podem conter uma foto em base64 e causar HTTP 431.
// Nunca reutilize tokens anormalmente grandes; a pessoa precisará entrar novamente.
let authToken = localStorage.getItem("bibliotecaToken") || sessionStorage.getItem("bibliotecaToken") || "";
if (authToken.length > 6000) {
    localStorage.removeItem("bibliotecaToken");
    sessionStorage.removeItem("bibliotecaToken");
    authToken = "";
}
let currentUser = null;

let biblioteca = {
    usuarios: [],
    livros: [],
    emprestimos: [],
    favoritos: [],
    reservas: [],
    renovacoes: [],
    configuracoes: {
        prazoPadrao: 7,
        notificacoes: []
    }
};

const metadataLivros = new Map();
let coverObserver = null;

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function elemento(id) {
    return document.getElementById(id);
}

function valor(id) {
    return elemento(id)?.value.trim() || "";
}

function escapeHtml(texto = "") {
    return String(texto).replace(/[&<>'"]/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    }[caractere]));
}

function formatarData(data) {
    if (!data) return "Não informado";

    const partes = String(data).slice(0, 10).split("-");

    if (partes.length !== 3) return String(data);

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function emailInstitucionalAluno(email) {
    return (
        emailValido(email) &&
        email.toLowerCase().endsWith(DOMINIO_EMAIL_ALUNO)
    );
}

// ======================================================
// MODAL DE AVISO
// ======================================================

function aviso(mensagem) {
    return new Promise(resolve => {
        const modal = elemento("avisoModal");
        const botao = elemento("avisoOk");
        const texto = elemento("avisoMensagem");

        if (!modal || !botao || !texto) {
            alert(mensagem);
            resolve();
            return;
        }

        texto.textContent = String(mensagem);

        modal.classList.add("visible");
        modal.setAttribute("aria-hidden", "false");

        botao.onclick = () => {
            modal.classList.remove("visible");
            modal.setAttribute("aria-hidden", "true");
            resolve();
        };

        botao.focus();
    });
}

function abrirFormularioSolicitacao({titulo, pedirData = false, mensagem = 'Mensagem (opcional)'}) {
    return new Promise(resolve => {
        const modal = elemento('solicitacaoModal');
        const tituloEl = elemento('solicitacaoTitulo');
        const dataEl = elemento('solicitacaoData');
        const campoData = elemento('solicitacaoCampoData');
        const mensagemEl = elemento('solicitacaoMensagem');
        const form = elemento('solicitacaoForm');
        tituloEl.textContent = titulo;
        campoData.hidden = !pedirData;
        mensagemEl.placeholder = mensagem;
        mensagemEl.value = '';
        const agora = new Date();
        const hoje = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
        dataEl.min = hoje;
        dataEl.value = '';
        modal.hidden = false;
        const fechar = resultado => {
            modal.hidden = true;
            form.onsubmit = null;
            elemento('solicitacaoCancelar').onclick = null;
            resolve(resultado);
        };
        form.onsubmit = e => {
            e.preventDefault();
            if (pedirData && (!dataEl.value || dataEl.value <= hoje)) {
                dataEl.setCustomValidity('Selecione uma data futura.');
                dataEl.reportValidity();
                return;
            }
            dataEl.setCustomValidity('');
            fechar({novaData: pedirData ? dataEl.value : null, resposta: mensagemEl.value.trim()});
        };
        dataEl.oninput = () => dataEl.setCustomValidity('');
        elemento('solicitacaoCancelar').onclick = () => fechar(null);
        (pedirData ? dataEl : mensagemEl).focus();
    });
}

// ======================================================
// API
// ======================================================

async function api(caminho, opcoes = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(opcoes.headers || {})
    };

    // O login é público: não envie um token antigo/expirado nessa requisição.
    const ehLogin = caminho === "/auth/login";
    if (ehLogin) {
        delete headers.Authorization;
    } else if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const resposta = await fetch(`${API}${caminho}`, {
        ...opcoes,
        headers
    });

    const dados = resposta.status === 204
        ? null
        : await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        throw new Error(
            dados?.erro ||
            dados?.message ||
            "Não foi possível realizar a operação."
        );
    }

    return dados;
}

async function carregarEstado() {
    const dados = await api("/state");

    biblioteca = {
        usuarios: dados.usuarios || [],
        livros: dados.livros || [],
        emprestimos: dados.emprestimos || [],
        favoritos: dados.favoritos || [],
        reservas: dados.reservas || [],
        renovacoes: dados.renovacoes || [],
        configuracoes: {
            prazoPadrao: dados.configuracoes?.prazoPadrao || 7,
            notificacoes: dados.configuracoes?.notificacoes || []
        }
    };
}

function loadData() {
    // Os dados são carregados pelo backend.
}

function saveData() {
    // Os dados são salvos pelo backend.
}

function getNextId() {
    return 0;
}

function addNotification() {
    // As notificações são gerenciadas pelo backend.
}

// ======================================================
// CADASTRO DE USUÁRIOS
// ======================================================
//
// ALUNO:
// Nome obrigatório
// E-mail institucional obrigatório
// RA obrigatório
// Série obrigatória
// Turma obrigatória
// Senha obrigatória
//
// FUNCIONÁRIO:
// Nome obrigatório
// E-mail comum ou institucional obrigatório
// Setor obrigatório
// Senha obrigatória
// Não precisa de RA ou matrícula
//
// ======================================================

async function cadastrarUsuario() {
    const perfil = valor("usuarioPerfil");

    if (!["aluno", "funcionario"].includes(perfil)) {
        await aviso("Selecione Aluno ou Funcionário.");
        return;
    }

    const nome = valor("usuarioNome");
    const email = valor("usuarioEmail");
    const senha = elemento("usuarioSenha")?.value || "";

    // Nome obrigatório para ambos.

    if (!nome) {
        await aviso("Informe o nome completo.");
        elemento("usuarioNome")?.focus();
        return;
    }

    // E-mail obrigatório para ambos.

    if (!email) {
        await aviso("O e-mail é obrigatório.");
        elemento("usuarioEmail")?.focus();
        return;
    }

    // Formato válido para ambos.

    if (!emailValido(email)) {
        await aviso("Digite um endereço de e-mail válido.");
        elemento("usuarioEmail")?.focus();
        return;
    }

    // Somente o aluno precisa de e-mail institucional.

    if (perfil === "aluno") {
        if (!emailInstitucionalAluno(email)) {
            await aviso(
                "O aluno deve utilizar um e-mail institucional terminado em @al.educacao.sp.gov.br."
            );

            elemento("usuarioEmail")?.focus();
            return;
        }
    }

    // Funcionários podem usar qualquer domínio válido.
    // Exemplos:
    // funcionario@gmail.com
    // funcionario@hotmail.com
    // funcionario@outlook.com

    // Senha obrigatória para ambos.

    if (!senha) {
        await aviso("A senha é obrigatória.");
        elemento("usuarioSenha")?.focus();
        return;
    }

    if (senha.length < 6) {
        await aviso(
            "A senha deve conter pelo menos 6 caracteres."
        );

        elemento("usuarioSenha")?.focus();
        return;
    }

    const body = {
        nome,
        email,
        perfil,
        senha
    };

    // ==================================================
    // CAMPOS EXCLUSIVOS DO ALUNO
    // ==================================================

    if (perfil === "aluno") {
        const ra = valor("usuarioMatricula");
        const serie = valor("usuarioSerie");
        const turma = valor("usuarioTurma");

        if (!ra) {
            await aviso("O RA do aluno é obrigatório.");
            elemento("usuarioMatricula")?.focus();
            return;
        }

        if (!serie) {
            await aviso("A série do aluno é obrigatória.");
            elemento("usuarioSerie")?.focus();
            return;
        }

        if (!turma) {
            await aviso("A turma do aluno é obrigatória.");
            elemento("usuarioTurma")?.focus();
            return;
        }

        body.ra = ra;
        body.matricula = ra;
        body.serie = serie;
        body.turma = turma;
    }

    // ==================================================
    // CAMPOS EXCLUSIVOS DO FUNCIONÁRIO
    // ==================================================

    if (perfil === "funcionario") {
        const setor = valor("usuarioSetor");

        if (!setor) {
            await aviso(
                "O setor do funcionário é obrigatório."
            );

            elemento("usuarioSetor")?.focus();
            return;
        }

        body.setor = setor;

        // Funcionário não recebe os campos:
        // ra, matricula, serie ou turma.
    }

    const botao = elemento("btnCadastrarUsuario");

    if (botao?.disabled) return;

    if (botao) {
        botao.disabled = true;
    }

    try {
        await api("/usuarios", {
            method: "POST",
            body: JSON.stringify(body)
        });

        await carregarEstado();

        // Limpa os campos.

        [
            "usuarioNome",
            "usuarioEmail",
            "usuarioMatricula",
            "usuarioSerie",
            "usuarioTurma",
            "usuarioSetor",
            "usuarioSenha"
        ].forEach(id => {
            const campo = elemento(id);

            if (campo) campo.value = "";
        });

        renderUsuariosLista();
        renderSelects();
        renderBiblioDashboard();

        await aviso("Usuário cadastrado com sucesso!");
    } catch (erro) {
        await aviso(erro.message);
    } finally {
        if (botao) botao.disabled = false;
    }
}

// ======================================================
// CAMPOS DINÂMICOS DO CADASTRO
// ======================================================

function iniciarCamposCadastroUsuario() {
    const selectPerfil = elemento("usuarioPerfil");

    if (!selectPerfil) return;

    function configurarCampo(idGrupo, idCampo, mostrar) {
        const campo = elemento(idCampo);

        if (!campo) return;

        const grupo =
            elemento(idGrupo) ||
            campo.closest(".form-group") ||
            campo.parentElement;

        if (grupo) {
            grupo.hidden = !mostrar;
            grupo.style.display = mostrar ? "" : "none";
        }

        campo.required = mostrar;
        campo.disabled = !mostrar;

        if (!mostrar) {
            campo.value = "";
        }
    }

    function atualizarCampos() {
        const perfil = selectPerfil.value;
        const aluno = perfil === "aluno";
        const funcionario = perfil === "funcionario";

        // RA, série e turma aparecem somente para alunos.

        configurarCampo(
            "campoUsuarioMatricula",
            "usuarioMatricula",
            aluno
        );

        configurarCampo(
            "campoUsuarioSerie",
            "usuarioSerie",
            aluno
        );

        configurarCampo(
            "campoUsuarioTurma",
            "usuarioTurma",
            aluno
        );

        // Setor aparece somente para funcionários.

        configurarCampo(
            "campoUsuarioSetor",
            "usuarioSetor",
            funcionario
        );

        // Nome, e-mail e senha sempre obrigatórios.

        [
            "usuarioNome",
            "usuarioEmail",
            "usuarioSenha"
        ].forEach(id => {
            const campo = elemento(id);

            if (campo) {
                campo.required = true;
                campo.disabled = false;
            }
        });

        // Configuração do campo de e-mail.

        const campoEmail = elemento("usuarioEmail");

        if (campoEmail) {
            campoEmail.type = "email";
            campoEmail.required = true;

            campoEmail.placeholder = aluno
                ? "exemplo@al.educacao.sp.gov.br"
                : "Digite o e-mail do funcionário";

            // Não aplicar uma restrição institucional
            // diretamente ao input, pois o funcionário
            // pode usar qualquer e-mail válido.
            campoEmail.removeAttribute("pattern");
            campoEmail.removeAttribute("title");
        }

        const labelEmail = document.querySelector(
            'label[for="usuarioEmail"]'
        );

        if (labelEmail) {
            labelEmail.textContent = aluno
                ? "E-mail institucional *"
                : "E-mail *";
        }

        // O campo de matrícula é identificado como RA.

        const campoRA = elemento("usuarioMatricula");

        if (campoRA) {
            campoRA.placeholder = "Digite o RA do aluno";
        }

        const labelRA =
            elemento("labelUsuarioMatricula") ||
            document.querySelector(
                'label[for="usuarioMatricula"]'
            );

        if (labelRA) {
            labelRA.textContent = "RA do aluno *";
        }
    }

    selectPerfil.addEventListener(
        "change",
        atualizarCampos
    );

    atualizarCampos();
}

// ======================================================
// LIVROS - METADADOS
// ======================================================

async function obterMetadataLivro(id) {
    const chave = Number(id);

    if (metadataLivros.has(chave)) {
        return metadataLivros.get(chave);
    }

    try {
        const dados = await api(
            `/livros/${chave}/metadata`
        );

        metadataLivros.set(chave, dados || {});

        return dados || {};
    } catch {
        metadataLivros.set(chave, {});
        return {};
    }
}

// ======================================================
// FAVORITOS
// ======================================================

function livroFavoritado(id) {
    return biblioteca.favoritos.some(
        favorito => Number(favorito) === Number(id)
    );
}

async function alternarFavorito(id) {
    if (!['aluno','funcionario'].includes(currentUser?.perfil)) return aviso('Apenas leitores podem favoritar livros.');
    if (!["aluno","funcionario"].includes(currentUser?.perfil)) return aviso("Apenas leitores podem favoritar livros.");
    const favoritado = livroFavoritado(id);

    try {
        await api(`/favoritos/${id}`, {
            method: favoritado ? "DELETE" : "POST"
        });

        if (favoritado) {
            biblioteca.favoritos =
                biblioteca.favoritos.filter(
                    item => Number(item) !== Number(id)
                );
        } else {
            biblioteca.favoritos.push(Number(id));
        }

        document.querySelectorAll(
            `[data-favorite-book="${id}"]`
        ).forEach(botao => {
            const ativo = livroFavoritado(id);

            botao.classList.toggle("active", ativo);

            botao.innerHTML = `
                <i class="${ativo ? "fas" : "far"} fa-heart"></i>
            `;
        });

    atualizarContadorFavoritos();

        if (
            elemento("alunoTabFavoritos")
                ?.classList.contains("active")
        ) {
            renderAlunoFavoritos();
        }
    } catch (erro) {
        await aviso(erro.message);
    }
}

function atualizarContadorFavoritos() {
    const contador = elemento("favoritosCount");

    if (contador) {
        contador.textContent =
            biblioteca.favoritos.length;
    }
}

// ======================================================
// CARDS DOS LIVROS
// ======================================================

function livroCard(livro) {
    const disponivel = Number(livro.disponivel) > 0;
    const favorito = livroFavoritado(livro.id);

    return `
        <article
            class="book-card-pro book-card-with-cover"
            data-book-id="${livro.id}"
            tabindex="0"
            role="button"
        >
            ${['aluno','funcionario'].includes(currentUser?.perfil) ? `<button
                type="button"
                class="book-favorite-btn ${favorito ? "active" : ""}"
                data-favorite-book="${livro.id}"
                aria-label="${favorito
                    ? "Remover dos favoritos"
                    : "Adicionar aos favoritos"}"
            >
                <i class="${favorito ? "fas" : "far"} fa-heart"></i>
            </button>` : ''}

            <div class="book-cover-frame"><img loading="lazy" src="${escapeHtml(livro.capa || '/assets/capas/capa-padrao.png')}" alt="Capa ilustrativa de ${escapeHtml(livro.nome)}" onerror="this.onerror=null;this.src='/assets/capas/capa-padrao.png'"></div>
            <div class="book-card-body">
                <span class="book-category">
                    ${escapeHtml(livro.categoria || "Sem categoria")}
                </span>

                <h4>${escapeHtml(livro.nome)}</h4>

                <p class="book-author">
                    ${escapeHtml(livro.autor || "Autor não informado")}
                </p>

                <div class="book-card-footer">
                    <span class="book-status ${disponivel
                        ? "available"
                        : "unavailable"}">
                        ${disponivel
                            ? `${livro.disponivel} disponíveis`
                            : "Indisponível"}
                    </span>

                    <span class="book-details-link">
                        Ver detalhes
                        <i class="fas fa-arrow-right"></i>
                    </span>
                </div>
            </div>
        </article>
    `;
}

function ativarCapasLazy() {
    if (coverObserver) {
        coverObserver.disconnect();
    }

    const imagens = document.querySelectorAll(
        ".book-cover-lazy"
    );

    if (
        !imagens.length ||
        !("IntersectionObserver" in window)
    ) {
        return;
    }

    coverObserver = new IntersectionObserver(
        entradas => {
            entradas.forEach(async entrada => {
                if (!entrada.isIntersecting) return;

                const imagem = entrada.target;

                coverObserver.unobserve(imagem);

                const id = Number(
                    imagem.dataset.bookCover
                );

                if (imagem.dataset.localCover) {
                    imagem.src =
                        imagem.dataset.localCover;
                    return;
                }

                const dados =
                    await obterMetadataLivro(id);

                if (dados.capa) {
                    imagem.src = dados.capa;
                }
            });
        },
        { rootMargin: "300px" }
    );

    imagens.forEach(imagem => {
        coverObserver.observe(imagem);
    });
}

function filtrarLivros(termo, filtroId) {
    const busca = String(termo || "")
        .trim()
        .toLowerCase();

    const filtro = elemento(filtroId)?.value || "all";

    if (!busca) return biblioteca.livros;

    return biblioteca.livros.filter(livro => {
        const campos = filtro === "all"
            ? [
                livro.nome,
                livro.autor,
                livro.isbn,
                livro.categoria
            ]
            : [livro[filtro]];

        return campos.some(campo =>
            String(campo || "")
                .toLowerCase()
                .includes(busca)
        );
    });
}

// ======================================================
// DETALHES DOS LIVROS
// ======================================================

async function abrirDetalhesLivro(id) {
    const livro = biblioteca.livros.find(
        item => Number(item.id) === Number(id)
    );

    if (!livro) return;

    const modal = elemento("livroModal");
    const conteudo = elemento("livroModalConteudo");

    if (!modal || !conteudo) return;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    conteudo.innerHTML = `
        <p>Carregando informações do livro...</p>
    `;

    const dados = await obterMetadataLivro(livro.id);

    const capa = dados.capa || livro.capa || "";

    const sinopse =
        dados.sinopse ||
        "Sinopse não encontrada para esta edição.";

    const favorito = livroFavoritado(livro.id);

    conteudo.innerHTML = `
        <div class="book-detail-layout">
            <div class="book-detail-cover">
                ${capa
                    ? `<img
                        src="${escapeHtml(capa)}"
                        alt="Capa de ${escapeHtml(livro.nome)}"
                    >`
                    : `<div class="book-cover-placeholder large">
                        <i class="fas fa-book-open"></i>
                    </div>`}
            </div>

            <div class="book-detail-info">
                <span class="book-category">
                    ${escapeHtml(livro.categoria || "Sem categoria")}
                </span>

                <h2 id="livroModalTitulo">
                    ${escapeHtml(livro.nome)}
                </h2>

                <p>
                    ${escapeHtml(livro.autor || "Autor não informado")}
                </p>

                ${['aluno','funcionario'].includes(currentUser?.perfil) ? `<div class="book-modal-acoes-aluno"><button
                    type="button"
                    class="book-modal-favorite"
                    data-favorite-book="${livro.id}"
                >
                    <i class="${favorito ? "fas" : "far"} fa-heart"></i>
                    ${favorito ? "Favoritado" : "Favoritar livro"}
                </button><button type="button" class="btn-primary" data-pedir-reserva="${Number(livro.id)}" ${Number(livro.disponivel)>0?'':'disabled'}>Solicitar reserva</button></div>` : ''}

                <div class="book-detail-facts">
                    <div>
                        <span>ISBN</span>
                        <strong>
                            ${escapeHtml(livro.isbn || dados.isbn || "Não informado")}
                        </strong>
                    </div>

                    <div>
                        <span>Editora</span>
                        <strong>
                            ${escapeHtml(livro.editora || dados.editora || "Não informada")}
                        </strong>
                    </div>

                    <div>
                        <span>Ano</span>
                        <strong>
                            ${escapeHtml(livro.ano || dados.ano || "Não informado")}
                        </strong>
                    </div>

                    <div>
                        <span>Disponibilidade</span>
                        <strong>
                            ${livro.disponivel} de ${livro.quantidade}
                        </strong>
                    </div>
                </div>

                ${currentUser?.perfil === 'bibliotecario' ? `
                <div class="livro-modal-acoes">
                    <button type="button" class="btn-primary" data-editar-livro="${Number(livro.id)}"><i class="fas fa-pen"></i> Editar livro</button>
                    <button type="button" class="btn-excluir-outline" data-excluir-livro="${Number(livro.id)}"><i class="fas fa-trash-alt"></i> Excluir livro</button>
                </div>` : ''}
                <div class="book-synopsis">
                    <h3>Sinopse</h3>
                    <p>${escapeHtml(sinopse)}</p>
                </div>
            </div>
        </div>
    `;
}

function fecharDetalhesLivro() {
    const modal = elemento("livroModal");

    if (modal) {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    }

    document.body.classList.remove("modal-open");
}

// ======================================================
// PAINEL DO ALUNO
// ======================================================

function renderAlunoDashboard() {
    if (!currentUser) return;

    if (currentUser.perfil === "bibliotecario") {
        return;
    }

    const emprestimos = biblioteca.emprestimos;
    const ativos = emprestimos.filter(
        item => Boolean(item.ativo)
    );

    const historico = emprestimos.filter(
        item => !item.ativo
    );

    const hoje = new Date()
        .toISOString()
        .slice(0, 10);

    function criarItem(item, ativo) {
        const atrasado =
            ativo &&
            String(item.dataDevolucaoPrevista)
                .slice(0, 10) < hoje;

        return `
            <div class="emprestimo-card ${atrasado ? "atrasado" : ""}">
                <strong>
                    ${escapeHtml(item.nomeLivro || "Livro")}
                </strong>

                <p>
                    Autor:
                    ${escapeHtml(item.autorLivro || "Não informado")}
                </p>

                <small>
                    Retirado em:
                    ${formatarData(item.dataRetirada)}
                </small>

                <br>

                <small>
                    ${ativo ? "Devolver até" : "Devolvido em"}:
                    ${formatarData(
                        ativo
                            ? item.dataDevolucaoPrevista
                            : item.dataDevolucaoReal
                    )}
                </small>

                <br>

                ${ativo ? `<div class="acoes-solicitacao"><button type="button" class="btn-primary" data-pedir-renovacao="${Number(item.id)}">Solicitar renovação</button></div>` : ''}
                <span class="status-badge">
                    ${ativo
                        ? atrasado
                            ? "Em atraso"
                            : "Em andamento"
                        : "Devolvido"}
                </span>
            </div>
        `;
    }

    const ativosEl = elemento("alunoEmprestimosAtivos");
    const historicoEl = elemento("alunoHistoricoLeitura");
    const resumoEl = elemento("alunoResumo");

    if (ativosEl) {
        ativosEl.innerHTML = ativos.length
            ? ativos.map(item =>
                criarItem(item, true)
            ).join("")
            : "<p>Nenhum empréstimo ativo.</p>";
    }

    if (historicoEl) {
        historicoEl.innerHTML = historico.length
            ? historico.map(item =>
                criarItem(item, false)
            ).join("")
            : "<p>Nenhum histórico de devoluções.</p>";
    }

    if (resumoEl) {
        resumoEl.innerHTML = `
            <div class="stat-item">
                <span class="stat-number">
                    ${ativos.length}
                </span>
                <span class="stat-label">
                    Em andamento
                </span>
            </div>

            <div class="stat-item">
                <span class="stat-number">
                    ${historico.length}
                </span>
                <span class="stat-label">
                    Devolvidos
                </span>
            </div>

            <div class="stat-item">
                <span class="stat-number">
                    ${emprestimos.length}
                </span>
                <span class="stat-label">
                    Total de empréstimos
                </span>
            </div>
        `;
    }
}

function renderAlunoBusca(termo = "") {
    const livros = filtrarLivros(
        termo,
        "alunoSearchFilter"
    );

    const container = elemento("alunoSearchResults");

    if (!container) return;

    container.innerHTML = livros.length
        ? livros.map(livroCard).join("")
        : "<p>Nenhum livro encontrado.</p>";

    ativarCapasLazy();
}

function renderAlunoFavoritos() {
    const container = elemento(
        "alunoFavoritosResults"
    );

    if (!container) return;

    const ids = new Set(
        biblioteca.favoritos.map(Number)
    );

    const livros = biblioteca.livros.filter(
        livro => ids.has(Number(livro.id))
    );

    container.innerHTML = livros.length
        ? livros.map(livroCard).join("")
        : `
            <div class="favorites-empty">
                <i class="far fa-heart"></i>
                <h3>Nenhum favorito ainda</h3>
                <p>
                    Clique no coração dos livros
                    para adicioná-los aos favoritos.
                </p>

                <button
                    type="button"
                    class="btn-secondary"
                    id="btnIrCatalogoFavoritos"
                >
                    Ir para o Catálogo
                </button>
            </div>
        `;

    ativarCapasLazy();
    atualizarContadorFavoritos();

    elemento("btnIrCatalogoFavoritos")
        ?.addEventListener("click", () => {
            document.querySelector(
                '[data-aluno-tab="catalogo"]'
            )?.click();
        });
}

// ======================================================
// PAINEL DO BIBLIOTECÁRIO
// ======================================================

function renderBiblioDashboard() {
    const totalLivros = elemento("statTotalLivros");
    const totalUsuarios = elemento("statTotalUsuarios");
    const totalAtivos = elemento("statEmprestimosAtivos");
    const totalAtrasados = elemento("statEmprestimosAtrasados");
    const alertas = elemento("alertasAtraso");

    if (totalLivros) {
        totalLivros.textContent =
            biblioteca.livros.length;
    }

    if (totalUsuarios) {
        totalUsuarios.textContent =
            biblioteca.usuarios.filter(
                usuario => usuario.perfil === "aluno"
            ).length;
    }

    const ativos = biblioteca.emprestimos.filter(
        emprestimo => Boolean(emprestimo.ativo)
    );

    if (totalAtivos) {
        totalAtivos.textContent = ativos.length;
    }

    const hoje = new Date()
        .toISOString()
        .slice(0, 10);

    const atrasados = ativos.filter(
        emprestimo =>
            emprestimo.dataDevolucaoPrevista < hoje
    );

    if (totalAtrasados) {
        totalAtrasados.textContent = atrasados.length;
    }

    if (alertas) {
        alertas.innerHTML = atrasados.map(emprestimo => {
            const livro = biblioteca.livros.find(
                item => item.id === emprestimo.idLivro
            );

            const usuario = biblioteca.usuarios.find(
                item => item.id === emprestimo.idUsuario
            );

            return `
                <div class="emprestimo-card atrasado">
                    ${escapeHtml(usuario?.nome || "Usuário")}
                    -
                    ${escapeHtml(livro?.nome || "Livro")}
                    -
                    Atrasado desde
                    ${formatarData(
                        emprestimo.dataDevolucaoPrevista
                    )}
                </div>
            `;
        }).join("") ||
        "<p>Nenhum empréstimo atrasado.</p>";
    }
}

function renderBiblioBusca(termo = "") {
    const livros = filtrarLivros(
        termo,
        "biblioSearchFilter"
    );

    const container = elemento("biblioSearchResults");

    if (!container) return;

    container.innerHTML = livros.length
        ? livros.map(livroCard).join("")
        : "<p>Nenhum livro encontrado.</p>";

    ativarCapasLazy();
}

// ======================================================
// LISTAGEM DE USUÁRIOS
// ======================================================

function renderUsuariosLista() {
    const container = elemento("listaUsuarios");

    if (!container) return;

    if (!biblioteca.usuarios.length) {
        container.innerHTML =
            "<p>Nenhum usuário cadastrado.</p>";
        return;
    }

    container.innerHTML = biblioteca.usuarios.map(
        usuario => {
            let detalhes = "";

            if (usuario.perfil === "aluno") {
                detalhes = `
                    <small>
                        RA:
                        ${escapeHtml(
                            usuario.ra ||
                            usuario.matricula ||
                            "-"
                        )}
                    </small>

                    <br>

                    <small>
                        Série:
                        ${escapeHtml(usuario.serie || "-")}
                    </small>

                    <br>

                    <small>
                        Turma:
                        ${escapeHtml(usuario.turma || "-")}
                    </small>
                `;
            }

            if (usuario.perfil === "funcionario") {
                detalhes = `
                    <small>
                        Setor:
                        ${escapeHtml(usuario.setor || "-")}
                    </small>
                `;
            }

            const nomePerfil =
                usuario.perfil === "aluno"
                    ? "Aluno"
                    : usuario.perfil === "funcionario"
                        ? "Funcionário"
                        : "Bibliotecário";

            return `
                <div class="emprestimo-card">
                    <strong>
                        ${escapeHtml(usuario.nome)}
                    </strong>

                    <br>

                    <small>
                        E-mail:
                        ${escapeHtml(usuario.email)}
                    </small>

                    <br>

                    ${detalhes}

                    <br>

                    <small>
                        Perfil: ${nomePerfil}
                    </small>
                    ${['aluno','funcionario'].includes(usuario.perfil) ? `<div style="margin-top:12px"><button type="button" class="btn-secondary" data-ver-favoritos-usuario="${Number(usuario.id)}">Ver favoritos deste usuário</button><div id="favoritos-usuario-${Number(usuario.id)}" class="info-list" hidden></div></div>` : ''}
                    <div style="margin-top:10px"><button type="button" class="btn-secondary" data-editar-usuario="${Number(usuario.id)}">Editar informações</button></div>
                </div>
            `;
        }
    ).join("");
}

// ======================================================
// CADASTRO DE LIVROS
// ======================================================

async function cadastrarLivro() {
    const body = {
        nome: valor("livroNome"),
        autor: valor("livroAutor"),
        isbn: valor("livroISBN"),
        categoria: valor("livroCategoria"),
        quantidade: Number(
            valor("livroQuantidade")
        ),
        editora: valor("livroEditora"),
        ano: Number(valor("livroAno")) || null,
        sinopse: valor("livroSinopse"),
        capa: ""
    };

    if (
        !body.nome ||
        !body.autor ||
        !body.categoria ||
        !Number.isInteger(body.quantidade) ||
        body.quantidade < 1
    ) {
        await aviso(
            "Preencha corretamente os campos obrigatórios do livro."
        );
        return;
    }

    try {
        const imagem = elemento("livroCapaArquivo")?.files?.[0];
        if (imagem) {
            if (!['image/png','image/jpeg','image/webp'].includes(imagem.type) || imagem.size > 4*1024*1024) {
                return await aviso('Escolha uma capa PNG, JPEG ou WebP de até 4 MB.');
            }
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imagem);
            });
            const upload = await api('/livros/capa', {method:'POST',body:JSON.stringify({imagem:base64})});
            body.capa = upload.capa;
        }
        await api("/livros", {
            method: "POST",
            body: JSON.stringify(body)
        });

        await carregarEstado();

        [
            "livroNome",
            "livroAutor",
            "livroISBN",
            "livroCategoria",
            "livroEditora",
            "livroAno", "livroSinopse", "livroCapaArquivo"
        ].forEach(id => {
            const campo = elemento(id);

            if (campo) campo.value = "";
        });

        const quantidade = elemento(
            "livroQuantidade"
        );

        if (quantidade) quantidade.value = "1";

        renderLivrosCadastro();
        renderSelects();
        renderBiblioBusca("");
        renderBiblioDashboard();

        await aviso("Livro cadastrado com sucesso!");
    } catch (erro) {
        await aviso(erro.message);
    }
}

function renderLivrosCadastro() {
    const container = elemento("listaLivrosCadastro");
    if (!container) return;
    container.innerHTML = biblioteca.livros.length
        ? biblioteca.livros.map(livroCard).join("")
        : "<p>Nenhum livro cadastrado.</p>";
    ativarCapasLazy();
}

// Edição acessível somente nos detalhes, para bibliotecários.
function abrirEdicaoLivro(id) {
    const livro = biblioteca.livros.find(l => Number(l.id) === Number(id));
    if (!livro) return aviso('Livro não encontrado.');
    const campos = {editarLivroId:livro.id, editarLivroNome:livro.nome, editarLivroAutor:livro.autor,
        editarLivroISBN:livro.isbn, editarLivroCategoria:livro.categoria, editarLivroQuantidade:livro.quantidade,
        editarLivroEditora:livro.editora, editarLivroAno:livro.ano, editarLivroSinopse:livro.sinopse};
    for (const [idCampo, valorCampo] of Object.entries(campos)) {
        const campo = elemento(idCampo); if (campo) campo.value = valorCampo ?? '';
    }
    const arquivo = elemento('editarLivroCapaArquivo'); if (arquivo) arquivo.value = '';
    const nomeArquivo = elemento('editarLivroCapaArquivoNome');
    if (nomeArquivo) nomeArquivo.textContent = 'PNG, JPG ou WebP (até 4 MB). Deixe vazio para manter a atual.';
    const preview = elemento('editarLivroCapaPreview');
    if (preview) { preview.src = livro.capa || ''; preview.style.display = livro.capa ? 'block' : 'none'; }
    fecharDetalhesLivro();
    const painel = elemento('painelEditarLivro');
    if (painel) { painel.hidden = false; painel.classList.add('aberto'); painel.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
}
function fecharEdicaoLivro() {
    const painel = elemento('painelEditarLivro');
    if (painel) { painel.hidden = true; painel.classList.remove('aberto'); painel.setAttribute('aria-hidden','true'); }
    document.body.classList.remove('modal-open');
}
async function enviarImagemCapa(arquivo){
    if(!['image/png','image/jpeg','image/webp'].includes(arquivo.type)||arquivo.size>4*1024*1024)throw new Error('Escolha uma capa PNG, JPEG ou WebP de até 4 MB.');
    const imagem=await new Promise((resolve,reject)=>{const leitor=new FileReader();leitor.onload=()=>resolve(leitor.result);leitor.onerror=reject;leitor.readAsDataURL(arquivo);});
    const resultado=await api('/livros/capa',{method:'POST',body:JSON.stringify({imagem})});return resultado.capa;
}
async function salvarEdicaoLivro(){
    const id=Number(valor('editarLivroId'));
    const body={nome:valor('editarLivroNome'),autor:valor('editarLivroAutor'),isbn:valor('editarLivroISBN'),
        categoria:valor('editarLivroCategoria'),quantidade:Number(valor('editarLivroQuantidade')),
        editora:valor('editarLivroEditora'),ano:Number(valor('editarLivroAno'))||null,
        sinopse:valor('editarLivroSinopse')};
    if(!id||!body.nome||!body.autor||!body.categoria||!Number.isInteger(body.quantidade)||body.quantidade<1)return aviso('Preencha título, autor, categoria e quantidade válida.');
    const botao=elemento('btnSalvarEdicaoLivro');if(botao?.disabled)return;if(botao)botao.disabled=true;
    try{
        const arquivo=elemento('editarLivroCapaArquivo')?.files?.[0];if(arquivo)body.capa=await enviarImagemCapa(arquivo);
        await api(`/livros/${id}`,{method:'PUT',body:JSON.stringify(body)});
        metadataLivros.delete(id);await carregarEstado();fecharEdicaoLivro();
        renderLivrosCadastro();renderBiblioBusca('');renderSelects();renderBiblioDashboard();renderEstatisticas();
        await aviso('Livro atualizado com sucesso!');
    }catch(erro){await aviso(erro.message);}finally{if(botao)botao.disabled=false;}
}
let livroPendenteExclusao = null;
function excluirLivro(id) {
    const livro = biblioteca.livros.find(l => Number(l.id) === Number(id));
    if (!livro) return;
    livroPendenteExclusao = Number(id);
    const texto = elemento('textoExcluirLivro');
    if (texto) texto.textContent = `Você está prestes a excluir "${livro.nome}" do catálogo. Deseja continuar?`;
    fecharDetalhesLivro();
    const modal = elemento('modalExcluirLivro');
    if (modal) { modal.hidden = false; modal.classList.add('aberto'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
}
function cancelarExclusaoLivro() {
    livroPendenteExclusao = null;
    const modal = elemento('modalExcluirLivro');
    if (modal) { modal.hidden = true; modal.classList.remove('aberto'); modal.setAttribute('aria-hidden','true'); }
    document.body.classList.remove('modal-open');
}
async function confirmarExclusaoLivro() {
    if (!livroPendenteExclusao) return;
    const id = livroPendenteExclusao;
    const botao = elemento('btnConfirmarExcluirLivro');
    if (botao?.disabled) return;
    if (botao) botao.disabled = true;
    try {
        await api(`/livros/${id}`, {method:'DELETE'});
        metadataLivros.delete(id);
        await carregarEstado();
        cancelarExclusaoLivro();
        renderLivrosCadastro(); renderBiblioBusca(''); renderSelects(); renderBiblioDashboard(); renderEstatisticas();
        await aviso('Livro excluído do catálogo.');
    } catch (erro) { await aviso(erro.message); }
    finally { if (botao) botao.disabled = false; }
}

// ======================================================
// SELEÇÕES DE EMPRÉSTIMOS
// ======================================================

function renderSelects() {
    const alunos = biblioteca.usuarios.filter(
        usuario => usuario.perfil === "aluno"
    );

    const selectUsuario = elemento(
        "selectUserEmprestimo"
    );

    if (selectUsuario) {
        if (!alunos.some(
            aluno => String(aluno.id) === selectUsuario.value
        )) {
            selectUsuario.value = "";
        }
    }

    const selectLivro = elemento(
        "selectLivroEmprestimo"
    );

    if (selectLivro) {
        const disponiveis = biblioteca.livros.filter(
            livro => livro.disponivel > 0
        );

        selectLivro.innerHTML = `
            <option value="">
                Selecione o livro
            </option>
        ` + disponiveis.map(livro => `
            <option value="${livro.id}">
                ${escapeHtml(livro.nome)}
                -
                ${escapeHtml(livro.autor)}
                (${livro.disponivel} disponíveis)
            </option>
        `).join("");
    }

    const selectDevolucao = elemento(
        "selectEmprestimoDevolucao"
    );

    if (selectDevolucao) {
        const ativos = biblioteca.emprestimos.filter(
            emprestimo => Boolean(emprestimo.ativo)
        );

        selectDevolucao.innerHTML = `
            <option value="">
                Selecione um empréstimo
            </option>
        ` + ativos.map(emprestimo => {
            const livro = biblioteca.livros.find(
                item => item.id === emprestimo.idLivro
            );

            const usuario = biblioteca.usuarios.find(
                item => item.id === emprestimo.idUsuario
            );

            return `
                <option value="${emprestimo.id}">
                    ${escapeHtml(usuario?.nome || "Usuário")}
                    -
                    ${escapeHtml(livro?.nome || "Livro")}
                </option>
            `;
        }).join("");
    }
}

// ======================================================
// BUSCA DE ALUNOS PARA EMPRÉSTIMOS
// ======================================================

function iniciarBuscaAlunos() {
    const campo = elemento("buscaAlunoEmprestimo");
    const lista = elemento("sugestoesAlunos");
    const escolhido = elemento(
        "selectUserEmprestimo"
    );

    if (!campo || !lista || !escolhido) return;

    function normalizar(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    campo.addEventListener("input", () => {
        escolhido.value = "";

        const busca = normalizar(campo.value.trim());

        lista.replaceChildren();

        if (!busca) return;

        const alunos = biblioteca.usuarios
            .filter(usuario =>
                usuario.perfil === "aluno" &&
                normalizar(
                    `${usuario.nome} ${usuario.ra || ""} ${usuario.matricula || ""}`
                ).includes(busca)
            )
            .slice(0, 10);

        alunos.forEach(usuario => {
            const botao = document.createElement(
                "button"
            );

            botao.type = "button";
            botao.className = "sugestao-aluno";

            botao.textContent =
                `${usuario.nome} - ${usuario.ra || usuario.matricula || "Sem RA"}`;

            botao.addEventListener("click", () => {
                escolhido.value = String(usuario.id);
                campo.value = usuario.nome;
                lista.replaceChildren();
            });

            lista.appendChild(botao);
        });
    });

    document.addEventListener("click", evento => {
        if (
            !campo.contains(evento.target) &&
            !lista.contains(evento.target)
        ) {
            lista.replaceChildren();
        }
    });
}

// ======================================================
// REALIZAR EMPRÉSTIMO
// ======================================================

async function realizarEmprestimo() {
    const body = {
        idUsuario: Number(
            elemento("selectUserEmprestimo")?.value
        ),
        idLivro: Number(
            elemento("selectLivroEmprestimo")?.value
        ),
        dias: Number(
            elemento("diasDevolucao")?.value || 7
        )
    };

    if (!body.idUsuario || !body.idLivro) {
        await aviso(
            "Selecione um aluno e um livro."
        );
        return;
    }

    try {
        await api("/emprestimos", {
            method: "POST",
            body: JSON.stringify(body)
        });

        await carregarEstado();

        const selectUsuario = elemento(
            "selectUserEmprestimo"
        );

        const buscaAluno = elemento(
            "buscaAlunoEmprestimo"
        );

        if (selectUsuario) selectUsuario.value = "";
        if (buscaAluno) buscaAluno.value = "";

        renderSelects();
        renderEmprestimosAtivos();
        renderEstatisticas();
        renderLivrosCadastro();
        renderBiblioDashboard();

        await aviso(
            "Empréstimo realizado com sucesso!"
        );
    } catch (erro) {
        await aviso(erro.message);
    }
}

// ======================================================
// REALIZAR DEVOLUÇÃO
// ======================================================

async function realizarDevolucao() {
    const id = Number(
        elemento("selectEmprestimoDevolucao")?.value
    );

    if (!id) {
        await aviso(
            "Selecione um empréstimo para devolver."
        );
        return;
    }

    try {
        await api(`/emprestimos/${id}/devolucao`, {
            method: "PATCH"
        });

        await carregarEstado();

        renderSelects();
        renderEmprestimosAtivos();
        renderEstatisticas();
        renderLivrosCadastro();
        renderBiblioDashboard();

        await aviso(
            "Devolução registrada com sucesso!"
        );
    } catch (erro) {
        await aviso(erro.message);
    }
}

// ======================================================
// EMPRÉSTIMOS ATIVOS
// ======================================================

function renderEmprestimosAtivos() {
    const container = elemento(
        "emprestimosAtivosList"
    );

    if (!container) return;

    const ativos = biblioteca.emprestimos.filter(
        emprestimo => Boolean(emprestimo.ativo)
    );

    if (!ativos.length) {
        container.innerHTML =
            "<p>Nenhum empréstimo ativo.</p>";
        return;
    }

    const hoje = new Date()
        .toISOString()
        .slice(0, 10);

    container.innerHTML = ativos.map(emprestimo => {
        const livro = biblioteca.livros.find(
            item => item.id === emprestimo.idLivro
        );

        const usuario = biblioteca.usuarios.find(
            item => item.id === emprestimo.idUsuario
        );

        const atrasado =
            emprestimo.dataDevolucaoPrevista < hoje;

        return `
            <div class="emprestimo-card ${atrasado ? "atrasado" : ""}">
                <strong>
                    ${escapeHtml(usuario?.nome || "Usuário")}
                </strong>

                -
                ${escapeHtml(livro?.nome || "Livro")}

                <br>

                <small>
                    Retirada:
                    ${formatarData(emprestimo.dataRetirada)}

                    |

                    Devolução:
                    ${formatarData(
                        emprestimo.dataDevolucaoPrevista
                    )}

                    ${atrasado ? " - ATRASADO" : ""}
                </small>
            </div>
        `;
    }).join("");
}

// ======================================================
// RELATÓRIOS
// ======================================================

function renderEstatisticas() {
    const totalLivros = biblioteca.livros.length;

    const totalAlunos = biblioteca.usuarios.filter(
        usuario => usuario.perfil === "aluno"
    ).length;

    const totalEmprestimos =
        biblioteca.emprestimos.length;

    const ativos = biblioteca.emprestimos.filter(
        emprestimo => Boolean(emprestimo.ativo)
    ).length;

    const stats = elemento("estatisticas");

    if (stats) {
        stats.innerHTML = `
            <div class="stat-item">
                <span class="stat-number">
                    ${totalLivros}
                </span>
                <span class="stat-label">
                    Livros no acervo
                </span>
            </div>

            <div class="stat-item">
                <span class="stat-number">
                    ${totalAlunos}
                </span>
                <span class="stat-label">
                    Alunos
                </span>
            </div>

            <div class="stat-item">
                <span class="stat-number">
                    ${totalEmprestimos}
                </span>
                <span class="stat-label">
                    Total de empréstimos
                </span>
            </div>

            <div class="stat-item">
                <span class="stat-number">
                    ${ativos}
                </span>
                <span class="stat-label">
                    Empréstimos ativos
                </span>
            </div>
        `;
    }

    const contagemLivros = {};

    biblioteca.emprestimos.forEach(emprestimo => {
        contagemLivros[emprestimo.idLivro] =
            (contagemLivros[emprestimo.idLivro] || 0) + 1;
    });

    const topLivros = Object.entries(contagemLivros)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const rankingLivros = elemento("rankingLivros");

    if (rankingLivros) {
        rankingLivros.innerHTML = topLivros.map(
            ([id, quantidade]) => {
                const livro = biblioteca.livros.find(
                    item => String(item.id) === String(id)
                );

                return `
                    <div>
                        ${escapeHtml(livro?.nome || "Livro")}
                        -
                        ${quantidade} empréstimos
                    </div>
                `;
            }
        ).join("") ||
        "<p>Nenhum empréstimo registrado.</p>";
    }

    const contagemUsuarios = {};

    biblioteca.emprestimos.forEach(emprestimo => {
        contagemUsuarios[emprestimo.idUsuario] =
            (contagemUsuarios[emprestimo.idUsuario] || 0) + 1;
    });

    const topUsuarios = Object.entries(contagemUsuarios)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const rankingLeitores = elemento(
        "rankingLeitores"
    );

    if (rankingLeitores) {
        rankingLeitores.innerHTML = topUsuarios.map(
            ([id, quantidade]) => {
                const usuario = biblioteca.usuarios.find(
                    item => String(item.id) === String(id)
                );

                return `
                    <div>
                        ${escapeHtml(usuario?.nome || "Usuário")}
                        -
                        ${quantidade} empréstimos
                    </div>
                `;
            }
        ).join("") ||
        "<p>Nenhum dado disponível.</p>";
    }

    const historico = elemento("historicoCompleto");

    if (historico) {
        historico.innerHTML = [
            ...biblioteca.emprestimos
        ].reverse().map(emprestimo => {
            const livro = biblioteca.livros.find(
                item => item.id === emprestimo.idLivro
            );

            const usuario = biblioteca.usuarios.find(
                item => item.id === emprestimo.idUsuario
            );

            return `
                <div class="emprestimo-card">
                    ${escapeHtml(usuario?.nome || "Usuário")}
                    -
                    ${escapeHtml(livro?.nome || "Livro")}
                    -
                    Retirada:
                    ${formatarData(emprestimo.dataRetirada)}
                    -
                    ${emprestimo.ativo
                        ? "Em andamento"
                        : `Devolvido em ${formatarData(
                            emprestimo.dataDevolucaoReal
                        )}`}
                </div>
            `;
        }).join("") ||
        "<p>Nenhum empréstimo registrado.</p>";
    }
}

// ======================================================
// NOTIFICAÇÕES
// ======================================================

function updateNotificationBadge() {
    if (!currentUser) return;

    const notificacoes =
        biblioteca.configuracoes.notificacoes || [];

    const quantidade = notificacoes.filter(
        notificacao =>
            notificacao.userId === currentUser.id &&
            !notificacao.read
    ).length;

    const badge = elemento("notificationBadge");

    if (badge) {
        badge.textContent = quantidade;
    }
}

function renderNotificationsList() {
    const container = elemento(
        "notificationsList"
    );

    if (!container) return;

    if (!currentUser) {
        container.innerHTML =
            "<p>Faça login para ver notificações.</p>";
        return;
    }

    const notificacoes = (
        biblioteca.configuracoes.notificacoes || []
    ).filter(
        notificacao =>
            notificacao.userId === currentUser.id
    ).reverse();

    if (!notificacoes.length) {
        container.innerHTML =
            "<p>Nenhuma notificação.</p>";
        return;
    }

    container.innerHTML = notificacoes.map(
        notificacao => `
            <div
                class="notification-item ${!notificacao.read ? "unread" : ""}"
                data-id="${notificacao.id}"
            >
                <strong>
                    ${escapeHtml(notificacao.title)}
                </strong>

                <p>
                    ${escapeHtml(notificacao.message)}
                </p>

                <small>
                    ${escapeHtml(notificacao.data || "")}
                </small>
            </div>
        `
    ).join("");
}

function checkExpiredLoans() {
    const hoje = new Date()
        .toISOString()
        .slice(0, 10);

    return biblioteca.emprestimos.filter(
        emprestimo =>
            Boolean(emprestimo.ativo) &&
            emprestimo.dataDevolucaoPrevista < hoje
    );
}

function renderSolicitacoes(){
 const aluno=['aluno','funcionario'].includes(currentUser?.perfil);
 const badge=s=>s==='pendente'?'Aguardando bibliotecário':s==='aprovada'?'Aprovada':s==='recusada'?'Recusada':s;
 const card=(p,tipo)=>`<div class="pedido-item"><strong>${escapeHtml(p.livro)}</strong><p>${aluno?'':`Aluno: ${escapeHtml(p.aluno)} · `}Solicitado em ${escapeHtml(p.criadoEm)} · <span class="pedido-status">${badge(p.status)}</span></p>${tipo==='renovacao'?`<p>Prazo atual: ${escapeHtml(p.prazoAtual)} ${p.novaData?' · Novo prazo: '+escapeHtml(p.novaData):''}</p>`:''}${p.resposta?`<p>Mensagem: ${escapeHtml(p.resposta)}</p>`:''}${!aluno&&p.status==='pendente'?`<div class="acoes-solicitacao"><button type="button" class="btn-primary" data-responder-${tipo}="${Number(p.id)}" data-acao="aprovada">Aprovar</button><button type="button" class="btn-secondary" data-responder-${tipo}="${Number(p.id)}" data-acao="recusada">Recusar</button></div>`:''}</div>`;
 const preencher=(id,items,tipo)=>{const el=elemento(id);if(el)el.innerHTML=items.length?items.map(p=>card(p,tipo)).join(''):'<p>Nenhuma solicitação registrada.</p>';};
 if(aluno){preencher('minhasReservas',biblioteca.reservas,'reserva');preencher('minhasRenovacoes',biblioteca.renovacoes,'renovacao');}
 else if(currentUser?.perfil==='bibliotecario'){
 preencher('pedidosReservaBibliotecario',biblioteca.reservas,'reserva');preencher('pedidosRenovacaoBibliotecario',biblioteca.renovacoes,'renovacao');

 }
}

// ======================================================
// LOGIN
// ======================================================

async function fazerLogin() {
    const login = valor("loginEmail");

    const senha =
        elemento("loginPassword")?.value || "";

    if (!login || !senha) {
        await aviso(
            "Informe seu login e sua senha."
        );
        return;
    }

    try {
        const resposta = await api("/auth/login", {
            method: "POST",
            body: JSON.stringify({
                login,
                senha
            })
        });

        authToken = resposta.token;

        localStorage.setItem(
            "bibliotecaToken",
            authToken
        );

        currentUser = resposta.user;

        await carregarEstado();

        mostrarPainelAutenticado();
    } catch (erro) {
        await aviso(erro.message);
    }
}

function mostrarPainelAutenticado() {
    const loginSection = elemento("loginSection");
    const registerSection = elemento("registerSection");
    const mainPanel = elemento("mainPanel");

    if (loginSection) {
        loginSection.style.display = "none";
    }

    if (registerSection) {
        registerSection.style.display = "none";
    }

    if (mainPanel) {
        mainPanel.style.display = "block";
    }
    document.body.classList.add('sessao-ativa');

    const nome = elemento("userNameDisplay");
    const perfil = elemento("userPerfilDisplay");

    if (nome) {
        nome.textContent = currentUser.nome;
    }

    if (perfil) {
        perfil.textContent =
            currentUser.perfil === "aluno"
                ? "Aluno"
                : currentUser.perfil === "funcionario"
                    ? "Funcionário"
                    : "Bibliotecário";
    }

    atualizarAvatarPerfil();
    const painelAluno = elemento("alunoPanel");
    const leitorPortal = elemento("leitorPortal");
    const painelBibliotecario = elemento(
        "bibliotecarioPanel"
    );

    if (currentUser.perfil === "bibliotecario") {
        if (leitorPortal) leitorPortal.style.display = "none";
        if (painelAluno) {
            painelAluno.style.display = "none";
        }

        if (painelBibliotecario) {
            painelBibliotecario.style.display = "block";
        }

        renderBiblioDashboard();
        renderBiblioBusca("");
        renderSelects();
        renderEmprestimosAtivos();
        renderLivrosCadastro();
        renderUsuariosLista();
        renderEstatisticas();
        renderSolicitacoes();
    } else {
        if (leitorPortal) leitorPortal.style.display = "block";
        if (painelAluno) {
            painelAluno.style.display = "block";
        }

        if (painelBibliotecario) {
            painelBibliotecario.style.display = "none";
        }

        document.querySelector('#leitorPortal [data-portal-tab="resumo"]')?.click();
        renderAlunoDashboard();
        renderAlunoBusca("");
        renderAlunoFavoritos();
        renderSolicitacoes();
    }

    updateNotificationBadge();
}

// ======================================================
// LOGOUT
// ======================================================

function logout() {
    currentUser = null;
    authToken = "";

    sessionStorage.removeItem("bibliotecaToken");
    localStorage.removeItem("bibliotecaToken");

    const loginSection = elemento("loginSection");
    const registerSection = elemento("registerSection");
    const mainPanel = elemento("mainPanel");

    if (loginSection) {
        loginSection.style.display = "flex";
    }

    if (registerSection) {
        registerSection.style.display = "none";
    }

    if (mainPanel) {
        mainPanel.style.display = "none";
    }
    document.body.classList.remove('sessao-ativa');

    const login = elemento("loginEmail");
    const senha = elemento("loginPassword");

    if (login) login.value = "";
    if (senha) senha.value = "";

    const notificacoes = elemento(
        "notificationsPanel"
    );

    if (notificacoes) {
        notificacoes.style.display = "none";
    }
}

// ======================================================
// MOSTRAR / OCULTAR SENHA
// ======================================================

function initTogglePassword() {
    const botao = elemento("togglePassword");
    const senha = elemento("loginPassword");

    if (!botao || !senha) return;

    botao.addEventListener("click", () => {
        senha.type =
            senha.type === "password"
                ? "text"
                : "password";

        botao.classList.toggle("fa-eye");
        botao.classList.toggle("fa-eye-slash");
    });
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function restaurarSessao() {
    if (!authToken) return;
    try {
        const usuario = await api('/auth/me');
        currentUser = usuario;
        await carregarEstado();
        mostrarPainelAutenticado();
    } catch (erro) {
        // Falhas temporárias de rede não devem apagar uma sessão válida.
        if (/token|autoriz|expirad|inválid|invalid|jwt|401/i.test(erro.message)) {
            authToken = '';
            currentUser = null;
            localStorage.removeItem('bibliotecaToken');
            sessionStorage.removeItem('bibliotecaToken');
        }
        console.error('Não foi possível restaurar a sessão:', erro);
    }
}

window.addEventListener("load", () => {
    const botaoLogin = elemento("btnLogin");
    if (botaoLogin) botaoLogin.addEventListener("click", fazerLogin);
    ["loginEmail", "loginPassword"].forEach(id => {
        elemento(id)?.addEventListener("keydown", evento => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                fazerLogin();
            }
        });
    });
    try { loadData(); } catch (erro) { console.error("Erro ao carregar dados locais:", erro); }
    Promise.resolve().then(() => restaurarSessao()).catch(erro => console.error("Erro ao restaurar sessão:", erro));

    initTogglePassword();

    iniciarCamposCadastroUsuario();

    iniciarBuscaAlunos();

    // LOGIN

    elemento("btnLogout")
        ?.addEventListener("click", logout);

    // CADASTRO DE USUÁRIOS

    elemento("btnCadastrarUsuario")
        ?.addEventListener(
            "click",
            cadastrarUsuario
        );

    elemento('btnSalvarEdicaoLivro')?.addEventListener('click',salvarEdicaoLivro);
    elemento('btnCancelarEdicaoLivro')?.addEventListener('click',fecharEdicaoLivro);
    elemento('btnConfirmarExcluirLivro')?.addEventListener('click',confirmarExclusaoLivro);
    document.querySelectorAll('[data-cancelar-exclusao]').forEach(el=>el.addEventListener('click',cancelarExclusaoLivro));
    document.querySelectorAll('[data-fechar-edicao]').forEach(el=>el.addEventListener('click',fecharEdicaoLivro));
    [['livroCapaArquivo','livroCapaArquivoNome'],['editarLivroCapaArquivo','editarLivroCapaArquivoNome']].forEach(([inputId,labelId])=>{
        elemento(inputId)?.addEventListener('change',event=>{
            const arquivo=event.target.files?.[0];
            const label=elemento(labelId);
            if(label && arquivo)label.textContent=arquivo.name;
            if(arquivo && inputId==='editarLivroCapaArquivo'){
                const preview=elemento('editarLivroCapaPreview');
                if(preview){preview.src=URL.createObjectURL(arquivo);preview.style.display='block';}
            }
        });
    });
    document.addEventListener('click',evento=>{
        const editar=evento.target.closest('[data-editar-livro]');
        const excluir=evento.target.closest('[data-excluir-livro]');
        if(editar){evento.preventDefault();evento.stopPropagation();abrirEdicaoLivro(editar.dataset.editarLivro);}
        if(excluir){evento.preventDefault();evento.stopPropagation();excluirLivro(excluir.dataset.excluirLivro);}
    });

    // CADASTRO DE LIVROS

    elemento("btnCadastrarLivro")
        ?.addEventListener(
            "click",
            cadastrarLivro
        );

    // EMPRÉSTIMOS

    elemento("btnRealizarEmprestimo")
        ?.addEventListener(
            "click",
            realizarEmprestimo
        );

    elemento("btnRealizarDevolucao")
        ?.addEventListener(
            "click",
            realizarDevolucao
        );

    // BUSCA DE LIVROS DO ALUNO

    elemento("btnAlunoSearch")
        ?.addEventListener("click", () => {
            renderAlunoBusca(
                valor("alunoSearchInput")
            );
        });

    elemento("alunoSearchInput")
        ?.addEventListener("keypress", evento => {
            if (evento.key === "Enter") {
                renderAlunoBusca(evento.target.value);
            }
        });

    // BUSCA DE LIVROS DO BIBLIOTECÁRIO

    elemento("btnBiblioSearch")
        ?.addEventListener("click", () => {
            renderBiblioBusca(
                valor("biblioSearchInput")
            );
        });

    elemento("biblioSearchInput")
        ?.addEventListener("keypress", evento => {
            if (evento.key === "Enter") {
                renderBiblioBusca(evento.target.value);
            }
        });

    // ABAS DO ALUNO

    document.querySelectorAll(
        ".aluno-tab-btn"
    ).forEach(botao => {
        botao.addEventListener("click", () => {
            document.querySelectorAll(
                ".aluno-tab-btn"
            ).forEach(item => {
                item.classList.remove("active");
            });

            document.querySelectorAll(
                ".aluno-tab-pane"
            ).forEach(item => {
                item.classList.remove("active");
            });

            botao.classList.add("active");

            const aba = botao.dataset.alunoTab;

            const paineis = {
                catalogo: "alunoTabCatalogo",
                favoritos: "alunoTabFavoritos",
                minhaBiblioteca: "alunoTabMinhaBiblioteca"
            };

            elemento(paineis[aba])
                ?.classList.add("active");

            if (aba === "catalogo") {
                renderAlunoBusca(
                    valor("alunoSearchInput")
                );
            }

            if (aba === "favoritos") {
                renderAlunoFavoritos();
            }

            if (aba === "minhaBiblioteca") {
                renderAlunoDashboard();
            }
        });
    });

    // Consulta individual de favoritos: disponível somente ao bibliotecário.
    document.addEventListener('click', async (evento) => {
        const botao = evento.target.closest('[data-ver-favoritos-usuario]');
        if (!botao || currentUser?.perfil !== 'bibliotecario') return;
        const id = Number(botao.dataset.verFavoritosUsuario);
        const painel = elemento(`favoritos-usuario-${id}`);
        if (!painel) return;
        if (!painel.hidden) { painel.hidden = true; return; }
        painel.hidden = false;
        painel.textContent = 'Carregando favoritos...';
        try {
            const livros = await api(`/usuarios/${id}/favoritos`);
            painel.innerHTML = livros.length
                ? livros.map(l => `<div class="pedido-item"><strong>${escapeHtml(l.nome)}</strong> — ${escapeHtml(l.autor || 'Autor não informado')}</div>`).join('')
                : '<p>Este usuário ainda não possui livros favoritos.</p>';
        } catch (erro) { painel.textContent = erro.message; }
    });

    elemento('portalMenuToggle')?.addEventListener('click', () => {
        const nav = document.querySelector('#leitorPortal .portal-tabs');
        const aberto = nav.classList.toggle('mobile-open');
        elemento('portalMenuToggle').setAttribute('aria-expanded', String(aberto));
    });

    // NAVEGAÇÃO EXCLUSIVA DO ALUNO
    document.querySelectorAll('#leitorPortal [data-portal-tab]').forEach(botao => {
        botao.addEventListener('click', () => {
            if (!['aluno','funcionario'].includes(currentUser?.perfil)) return;
            const destino = botao.dataset.portalTab;
            document.querySelector('#leitorPortal .portal-tabs')?.classList.remove('mobile-open');
            elemento('portalMenuToggle')?.setAttribute('aria-expanded','false');
            document.querySelectorAll('#leitorPortal [data-portal-tab]').forEach(b => b.classList.toggle('active', b === botao));
            document.querySelectorAll('#alunoPanel [data-portal-pane]').forEach(p => { p.hidden = p.dataset.portalPane !== destino; });
            if (destino === 'catalogo') renderAlunoBusca(valor('alunoSearchInput'));
            if (destino === 'favoritos') renderAlunoFavoritos();
            if (destino === 'reservas' || destino === 'renovacoes') renderSolicitacoes();
        });
    });

    // ABAS DO BIBLIOTECÁRIO

    document.querySelectorAll(
        "#bibliotecarioPanel .tab-btn"
    ).forEach(botao => {
        botao.addEventListener("click", () => {
            document.querySelectorAll(
                "#bibliotecarioPanel .tab-btn"
            ).forEach(item => {
                item.classList.remove("active");
            });

            document.querySelectorAll(
                "#bibliotecarioPanel .tab-pane"
            ).forEach(item => {
                item.classList.remove("active");
            });

            botao.classList.add("active");

            const aba = botao.dataset.tab;

            const idPainel =
                "tab" +
                aba.charAt(0).toUpperCase() +
                aba.slice(1);

            elemento(idPainel)?.classList.add("active");

            if (aba === "dashboard") {
                renderBiblioDashboard();
            }

            if (aba === "relatorios") {
                renderEstatisticas();
            }

            if (aba === "cadastroLivro") {
                renderLivrosCadastro();
            }

            if (aba === "cadastroUsuario") {
                renderUsuariosLista();
            }

            if (aba === "emprestimos") {
                renderSelects();
                renderEmprestimosAtivos();
            }
        });
    });

    document.addEventListener('click', async evento => {
        const reserva=evento.target.closest('[data-pedir-reserva]');
        const renovacao=evento.target.closest('[data-pedir-renovacao]');
        const respostaReserva=evento.target.closest('[data-responder-reserva]');
        const respostaRenovacao=evento.target.closest('[data-responder-renovacao]');
        if(!reserva&&!renovacao&&!respostaReserva&&!respostaRenovacao)return;
        evento.preventDefault();evento.stopPropagation();
        const btn=reserva||renovacao||respostaReserva||respostaRenovacao;
        if(btn.disabled)return;btn.disabled=true;
        try{
            if(reserva)await api('/reservas',{method:'POST',body:JSON.stringify({idLivro:Number(reserva.dataset.pedirReserva)})});
            if(renovacao)await api('/renovacoes',{method:'POST',body:JSON.stringify({idEmprestimo:Number(renovacao.dataset.pedirRenovacao)})});
            if(respostaReserva){const dados=await abrirFormularioSolicitacao({titulo:respostaReserva.dataset.acao==='aprovada'?'Aprovar reserva':'Recusar reserva'});if(!dados)return;await api(`/reservas/${respostaReserva.dataset.responderReserva}`,{method:'PATCH',body:JSON.stringify({status:respostaReserva.dataset.acao,resposta:dados.resposta})});}
            if(respostaRenovacao){const aprovado=respostaRenovacao.dataset.acao==='aprovada';const dados=await abrirFormularioSolicitacao({titulo:aprovado?'Aprovar renovação':'Recusar renovação',pedirData:aprovado});if(!dados)return;await api(`/renovacoes/${respostaRenovacao.dataset.responderRenovacao}`,{method:'PATCH',body:JSON.stringify({status:respostaRenovacao.dataset.acao,...dados})});}
            await carregarEstado();renderSolicitacoes();
            if(['aluno','funcionario'].includes(currentUser?.perfil)){renderAlunoDashboard();renderAlunoBusca(valor('alunoSearchInput'));renderAlunoFavoritos();}
            else{renderEmprestimosAtivos();renderBiblioDashboard();}
            updateNotificationBadge();await aviso('Solicitação registrada com sucesso.');
        }catch(erro){await aviso(erro.message);}finally{btn.disabled=false;}
    });

    // FAVORITOS E DETALHES DOS LIVROS

    document.addEventListener("click", evento => {
        const favorito = evento.target.closest(
            "[data-favorite-book]"
        );

        if (favorito) {
            evento.preventDefault();
            evento.stopPropagation();

            alternarFavorito(
                Number(favorito.dataset.favoriteBook)
            );

            return;
        }

        const card = evento.target.closest(
            ".book-card-pro"
        );

        if (card) {
            abrirDetalhesLivro(
                card.dataset.bookId
            );
        }

        if (
            evento.target.closest(
                "[data-close-book-modal]"
            )
        ) {
            fecharDetalhesLivro();
        }
    });

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            fecharDetalhesLivro();
        }

        const card = evento.target.closest?.(
            ".book-card-pro"
        );

        if (
            card &&
            (evento.key === "Enter" || evento.key === " ")
        ) {
            evento.preventDefault();

            abrirDetalhesLivro(
                card.dataset.bookId
            );
        }
    });

    // NOTIFICAÇÕES

    elemento("btnNotifications")
        ?.addEventListener("click", () => {
            const painel = elemento(
                "notificationsPanel"
            );

            if (!painel) return;

            const aberto =
                painel.style.display === "block";

            painel.style.display =
                aberto ? "none" : "block";
            elemento("btnNotifications")?.setAttribute("aria-expanded", String(!aberto));

            if (!aberto) {
                renderNotificationsList();
            }
        });

    // Fecha o painel ao clicar fora, pressionar Esc ou sair da sessão.
    const botaoNotificacoes = elemento("btnNotifications");
    const painelNotificacoes = elemento("notificationsPanel");
    if (botaoNotificacoes && painelNotificacoes) {
        botaoNotificacoes.setAttribute("aria-expanded", "false");
        botaoNotificacoes.setAttribute("aria-controls", "notificationsPanel");
        const fecharNotificacoes = () => {
            painelNotificacoes.style.display = "none";
            botaoNotificacoes.setAttribute("aria-expanded", "false");
        };
        document.addEventListener("pointerdown", evento => {
            if (painelNotificacoes.style.display !== "none" &&
                !painelNotificacoes.contains(evento.target) &&
                !botaoNotificacoes.contains(evento.target)) fecharNotificacoes();
        });
        document.addEventListener("keydown", evento => {
            if (evento.key === "Escape") fecharNotificacoes();
        });
        elemento("btnLogout")?.addEventListener("click", fecharNotificacoes);
    }

    elemento("btnClearNotifications")
        ?.addEventListener("click", async () => {
            if (!currentUser) return;

            try {
                await api(
                    "/notificacoes/ler-todas",
                    { method: "PATCH" }
                );

                await carregarEstado();

                updateNotificationBadge();
                renderNotificationsList();

                await aviso(
                    "Notificações marcadas como lidas!"
                );
            } catch (erro) {
                await aviso(erro.message);
            }
        });

    // ATUALIZAÇÃO PERIÓDICA DO PAINEL

    setInterval(() => {
        if (!currentUser) return;

        checkExpiredLoans();

        if (
            currentUser.perfil === "bibliotecario"
        ) {
            renderBiblioDashboard();
        } else {
            renderAlunoDashboard();
        }

        updateNotificationBadge();
    }, 30000);

    atualizarContadorFavoritos();
    setInterval(async()=>{if(!currentUser)return;try{await carregarEstado();updateNotificationBadge();renderSolicitacoes();if(['aluno','funcionario'].includes(currentUser.perfil))renderAlunoDashboard();}catch(e){console.warn('Falha na atualização:',e.message);}},60000);
});

document.addEventListener('DOMContentLoaded',()=>{
 const toggle=document.getElementById('adminMobileToggle');
 const nav=document.getElementById('adminMobileNav');
 if(!toggle||!nav)return;
 toggle.addEventListener('click',()=>{
  const opened=nav.classList.toggle('mobile-open');
  toggle.setAttribute('aria-expanded',String(opened));
 });
 nav.querySelectorAll('.tab-btn').forEach(button=>button.addEventListener('click',()=>{
  nav.classList.remove('mobile-open');toggle.setAttribute('aria-expanded','false');
 }));
});


// Exportação de relatórios: dados já recebidos do backend, sem alterar endpoints.
(function configurarRelatorios(){
  function pronto(){
    const periodo=document.getElementById('relPeriodo'), inicio=document.getElementById('relInicio'), fim=document.getElementById('relFim');
    if(!periodo||!inicio||!fim)return;
    const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    function datas(){
      if(periodo.value!=='custom'){
        const agora=new Date(), antes=new Date(agora);
        antes.setDate(agora.getDate()-Number(periodo.value)+1);
        inicio.value=localDate(antes);fim.value=localDate(agora);
      }
      inicio.disabled=fim.disabled=periodo.value!=='custom';
      atualizarResumo();
    }
    function registros(){
      if(!inicio.value||!fim.value||inicio.value>fim.value)throw Error('Escolha um período válido: a data inicial não pode ser posterior à final.');
      return (biblioteca.emprestimos||[]).filter(e=>{
        const data=String(e.dataRetirada||'').slice(0,10);
        return data>=inicio.value&&data<=fim.value;
      }).map(e=>{
        const u=biblioteca.usuarios.find(x=>String(x.id)===String(e.idUsuario));
        const l=biblioteca.livros.find(x=>String(x.id)===String(e.idLivro));
        return {'Leitor':u?.nome||'Usuário não encontrado','Livro':l?.nome||'Livro não encontrado','Retirada':formatarData(e.dataRetirada),'Devolução prevista':formatarData(e.dataDevolucaoPrevista||e.dataDevolucao),'Devolução efetiva':e.dataDevolucaoReal?formatarData(e.dataDevolucaoReal):'','Situação':e.ativo?'Em andamento':'Devolvido'};
      });
    }
    function atualizarResumo(){
      const el=document.getElementById('relResumo');
      try{const r=registros();el.textContent=`${r.length} empréstimo(s) entre ${formatarData(inicio.value)} e ${formatarData(fim.value)}.`}
      catch(e){el.textContent=e.message}
    }
    periodo.addEventListener('change',datas);
    [inicio,fim].forEach(el=>el.addEventListener('change',atualizarResumo));
    document.getElementById('relPDF').addEventListener('click', async () => {
      try {
        baixarRelatorioPDF(registros(), inicio.value, fim.value);
      } catch (e) {
        console.error('Erro ao gerar relatório PDF:', e);
        await aviso('Não foi possível gerar o PDF: ' + e.message);
      }
    });
    document.getElementById('relExcel').addEventListener('click',async()=>{
      try{
        const rows=registros();
        if(!window.XLSX)throw Error('Biblioteca Excel indisponível. Verifique a conexão com a internet.');
        const wb=XLSX.utils.book_new();
        const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{'Leitor':'Nenhum empréstimo no período'}]);
        ws['!cols']=[{wch:28},{wch:44},{wch:18},{wch:22},{wch:22},{wch:18}];
        XLSX.utils.book_append_sheet(wb,ws,'Emprestimos');
        XLSX.writeFile(wb,`relatorio_biblioteca_${inicio.value}_${fim.value}.xlsx`);
      }catch(e){await aviso(e.message)}
    });
    datas();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pronto);else pronto();
})();


// Perfil: menu, visualização e edição em modais acessíveis.
function atualizarAvatarPerfil(){
 const a=elemento('userAvatar');if(!a)return;
 a.innerHTML=currentUser?.foto_perfil?`<img alt="Foto de perfil" src="${currentUser.foto_perfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:'<i class="fas fa-user-circle"></i>';
}
const perfilEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fecharModalPerfil(){elemento('perfilModal').hidden=true;}
function abrirModalPerfil(titulo,conteudo){elemento('perfilModalTitulo').textContent=titulo;elemento('perfilModalConteudo').innerHTML=conteudo;elemento('perfilModal').hidden=false;}
function usuarioPerfil(id){return id==null?currentUser:biblioteca.usuarios.find(u=>String(u.id)===String(id));}
function verInformacoesPerfil(id=null){
 const u=usuarioPerfil(id);if(!u)return aviso('Usuário não encontrado.');
 const campos=[['Nome',u.nome],['E-mail',u.email],['Perfil',u.perfil],['RA',u.ra],['Matrícula',u.matricula],['Série',u.serie],['Turma',u.turma],['Setor',u.setor],['Data do cadastro',u.dataCadastro]];
 abrirModalPerfil('Informações do perfil',`${u.foto_perfil?`<img class="perfil-foto" src="${u.foto_perfil}" alt="Foto de perfil">`:''}${campos.filter(([k,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`<div class="perfil-dado"><strong>${k}</strong>${perfilEscape(v)}</div>`).join('')}<div class="perfil-acoes"><button type="button" id="perfilFechar">Fechar</button><button type="button" class="primary" id="perfilEditarDaVisualizacao" data-id="${perfilEscape(id??'')}">Editar perfil</button></div>`);
}
function abrirEditorPerfil(id=null){
 const u=usuarioPerfil(id);if(!u)return aviso('Usuário não encontrado.');
 const campos=[['nome','Nome',u.nome],['email','E-mail',u.email]];
 if(u.perfil==='aluno')campos.push(['serie','Série',u.serie],['turma','Turma',u.turma]);
 if(u.perfil==='funcionario')campos.push(['setor','Setor',u.setor]);
 const form=`<form id="formEditarPerfil" class="perfil-form" data-id="${perfilEscape(id??'')}">${campos.map(([k,label,v])=>`<label class="${k==='nome'||k==='email'?'wide':''}">${label}<input name="${k}" value="${perfilEscape(v)}" required maxlength="180"></label>`).join('')}<label class="wide">Nova senha (opcional)<input type="password" name="senha" minlength="8" autocomplete="new-password" placeholder="Deixe em branco para manter"></label>${id==null?'<div class="wide"><button type="button" id="perfilEscolherFoto">Alterar minha foto</button></div>':''}<div class="perfil-acoes wide"><button type="button" id="perfilCancelar">Cancelar</button><button type="submit">Salvar alterações</button></div><p id="perfilErro" class="perfil-erro wide" role="alert"></p></form>`;
 abrirModalPerfil('Editar perfil',form);
}
document.addEventListener('click',async e=>{
 if(e.target.closest('.user-info')){elemento('perfilMenu').hidden=!elemento('perfilMenu').hidden;return;}
 if(e.target.closest('#verMeuPerfil')){elemento('perfilMenu').hidden=true;verInformacoesPerfil();return;}
 if(e.target.closest('#editarMeuPerfil')){elemento('perfilMenu').hidden=true;abrirEditorPerfil();return;}
 if(e.target.closest('[data-editar-usuario]')){abrirEditorPerfil(e.target.closest('[data-editar-usuario]').dataset.editarUsuario);return;}
 if(e.target.closest('#perfilEditarDaVisualizacao')){const id=e.target.closest('#perfilEditarDaVisualizacao').dataset.id;abrirEditorPerfil(id||null);return;}
 if(e.target.closest('#perfilEscolherFoto')){elemento('fotoPerfilInput').click();return;}
 if(e.target.closest('#fecharPerfilModal,#perfilCancelar,#perfilFechar')||e.target===elemento('perfilModal')){fecharModalPerfil();return;}
 if(!e.target.closest('#perfilMenu'))elemento('perfilMenu').hidden=true;
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharModalPerfil();});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='formEditarPerfil')return;e.preventDefault();
 const f=e.target, id=f.dataset.id, dados=Object.fromEntries(new FormData(f));if(!dados.senha)delete dados.senha;
 const b=f.querySelector('[type=submit]');b.disabled=true;
 try{const atualizado=await api(id?`/usuarios/${id}`:'/perfil',{method:'PATCH',body:JSON.stringify(dados)});
 if(!id){currentUser={...currentUser,...atualizado};elemento('userNameDisplay').textContent=currentUser.nome;atualizarAvatarPerfil();}
 await carregarEstado();if(currentUser?.perfil==='bibliotecario')renderUsuariosLista();fecharModalPerfil();aviso('Perfil atualizado com sucesso.');
 }catch(err){elemento('perfilErro').textContent=err.message;}finally{b.disabled=false;}
});
document.addEventListener('change',async e=>{
 if(e.target.id!=='fotoPerfilInput'||!e.target.files[0])return;
 const f=e.target.files[0];
 // O navegador decodifica qualquer formato de imagem que suportar e converte para JPEG.
 try{
 const bitmap=await createImageBitmap(f);const canvas=document.createElement('canvas');
 const escala=Math.min(1,600/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*escala));canvas.height=Math.max(1,Math.round(bitmap.height*escala));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 const foto=canvas.toDataURL('image/jpeg',0.78);
 const atualizado=await api('/perfil/foto',{method:'PATCH',body:JSON.stringify({foto})});currentUser={...currentUser,...atualizado};atualizarAvatarPerfil();aviso('Foto atualizada com sucesso.');
 }catch(err){aviso('Não foi possível processar esta imagem. Escolha uma foto que seu navegador consiga abrir. '+(err.message||''));}
 e.target.value='';
});
