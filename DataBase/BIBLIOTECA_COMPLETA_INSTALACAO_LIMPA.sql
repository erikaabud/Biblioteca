-- BANCO DO SISTEMA DE GERENCIAMENTO DA BIBLIOTECA
-- Para uma instalação limpa, apague o banco antigo antes de importar este arquivo.
DROP DATABASE IF EXISTS biblioteca_escolar;
CREATE DATABASE biblioteca_escolar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE biblioteca_escolar;

CREATE TABLE IF NOT EXISTS usuarios (
 id_usuario BIGINT PRIMARY KEY AUTO_INCREMENT,
 nome VARCHAR(150) NOT NULL,
 email VARCHAR(180) NOT NULL UNIQUE,
 senha_hash VARCHAR(255) NOT NULL,
 perfil ENUM('aluno','bibliotecario','funcionario') NOT NULL,
 matricula VARCHAR(50) NULL UNIQUE COMMENT 'Matrícula exclusiva do bibliotecário',
 ra VARCHAR(50) NULL UNIQUE COMMENT 'RA exclusivo do aluno',
 serie VARCHAR(50) NULL,
 turma VARCHAR(50) NULL,
 setor VARCHAR(100) NULL,
 foto_perfil MEDIUMTEXT NULL,
 ativo BOOLEAN NOT NULL DEFAULT TRUE,
 data_cadastro DATE NOT NULL DEFAULT (CURRENT_DATE),
 CHECK (
   (perfil='aluno' AND ra IS NOT NULL AND serie IS NOT NULL AND turma IS NOT NULL AND matricula IS NULL AND setor IS NULL)
   OR (perfil='funcionario' AND matricula IS NULL AND setor IS NOT NULL AND ra IS NULL AND serie IS NULL AND turma IS NULL)
   OR (perfil='bibliotecario' AND matricula IS NOT NULL AND ra IS NULL)
 )
);

-- Regra institucional: apenas alunos precisam de e-mail @al.educacao.sp.gov.br
ALTER TABLE usuarios ADD CONSTRAINT chk_email_institucional_aluno CHECK (perfil <> 'aluno' OR LOWER(email) LIKE '%@al.educacao.sp.gov.br');

CREATE TABLE IF NOT EXISTS livros (
 id_livro BIGINT PRIMARY KEY AUTO_INCREMENT,
 titulo VARCHAR(200) NOT NULL,
 autor VARCHAR(180) NOT NULL,
 isbn VARCHAR(30) UNIQUE,
 categoria VARCHAR(100) NOT NULL,
 quantidade_total INT UNSIGNED NOT NULL DEFAULT 1,
 editora VARCHAR(150),
 ano_publicacao SMALLINT UNSIGNED,
 sinopse TEXT NULL,
 capa_url VARCHAR(1000) NULL,
 open_library_id VARCHAR(100) NULL,
 google_books_id VARCHAR(100) NULL,
 gutendex_id BIGINT NULL,
 numero_paginas INT UNSIGNED NULL,
 ativo BOOLEAN NOT NULL DEFAULT TRUE,
 data_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (quantidade_total > 0)
);

CREATE TABLE IF NOT EXISTS favoritos (
 id_favorito BIGINT PRIMARY KEY AUTO_INCREMENT,
 id_usuario BIGINT NOT NULL,
 id_livro BIGINT NOT NULL,
 criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_favorito_usuario FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
 CONSTRAINT fk_favorito_livro FOREIGN KEY(id_livro) REFERENCES livros(id_livro) ON DELETE CASCADE,
 UNIQUE KEY uq_favorito_usuario_livro(id_usuario,id_livro),
 INDEX idx_favorito_usuario(id_usuario)
);

CREATE TABLE IF NOT EXISTS emprestimos (
 id_emprestimo BIGINT PRIMARY KEY AUTO_INCREMENT,
 id_usuario BIGINT NOT NULL,
 id_livro BIGINT NOT NULL,
 data_retirada DATE NOT NULL,
 data_devolucao_prevista DATE NOT NULL,
 data_devolucao_real DATE NULL,
 status ENUM('ativo','devolvido') NOT NULL DEFAULT 'ativo',
 criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_emprestimo_usuario FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 CONSTRAINT fk_emprestimo_livro FOREIGN KEY(id_livro) REFERENCES livros(id_livro),
 INDEX idx_emprestimo_status(status), INDEX idx_emprestimo_usuario(id_usuario), INDEX idx_emprestimo_livro(id_livro)
);

CREATE TABLE IF NOT EXISTS notificacoes (
 id_notificacao BIGINT PRIMARY KEY AUTO_INCREMENT,
 id_usuario BIGINT NOT NULL,
 titulo VARCHAR(150) NOT NULL,
 mensagem VARCHAR(500) NOT NULL,
 tipo ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
 lida BOOLEAN NOT NULL DEFAULT FALSE,
 data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_notificacao_usuario FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
 INDEX idx_notificacao_usuario_lida(id_usuario,lida)
);

CREATE TABLE IF NOT EXISTS configuracoes (
 id_configuracao TINYINT PRIMARY KEY,
 prazo_padrao INT UNSIGNED NOT NULL DEFAULT 7,
 atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO configuracoes(id_configuracao,prazo_padrao) VALUES(1,7) ON DUPLICATE KEY UPDATE id_configuracao=id_configuracao;

-- Recursos de solicitação de reserva, renovação e alertas (instalação limpa).
CREATE TABLE IF NOT EXISTS solicitacoes_reserva (
 id_reserva BIGINT PRIMARY KEY AUTO_INCREMENT,
 id_usuario BIGINT NOT NULL,
 id_livro BIGINT NOT NULL,
 status ENUM('pendente','aprovada','recusada','cancelada','concluida') NOT NULL DEFAULT 'pendente',
 resposta VARCHAR(500) NULL,
 criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 respondido_em TIMESTAMP NULL,
 FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
 FOREIGN KEY (id_livro) REFERENCES livros(id_livro),
 INDEX idx_reserva_status(status)
);
CREATE TABLE IF NOT EXISTS solicitacoes_renovacao (
 id_renovacao BIGINT PRIMARY KEY AUTO_INCREMENT,
 id_emprestimo BIGINT NOT NULL,
 id_usuario BIGINT NOT NULL,
 status ENUM('pendente','aprovada','recusada') NOT NULL DEFAULT 'pendente',
 nova_data DATE NULL,
 resposta VARCHAR(500) NULL,
 criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 respondido_em TIMESTAMP NULL,
 FOREIGN KEY (id_emprestimo) REFERENCES emprestimos(id_emprestimo),
 FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
 INDEX idx_renovacao_status(status)
);
CREATE TABLE IF NOT EXISTS avisos_prazo (
 id_emprestimo BIGINT NOT NULL,
 data_prazo DATE NOT NULL,
 PRIMARY KEY (id_emprestimo,data_prazo),
 FOREIGN KEY (id_emprestimo) REFERENCES emprestimos(id_emprestimo)
);


INSERT IGNORE INTO livros(titulo,autor,isbn,categoria,quantidade_total,editora,ano_publicacao) VALUES
('Dom Casmurro','Machado de Assis',NULL,'Literatura Brasileira',3,'Editora Abril',1899),
('Harry Potter','J.K. Rowling',NULL,'Fantasia',2,'Rocco',1997),
('O Pequeno Príncipe','Saint-Exupéry',NULL,'Infantil',4,'Agir',1943),
('1984','George Orwell',NULL,'Distopia',2,'Companhia das Letras',1949);

-- 100 obras adicionais adequadas a uma biblioteca escolar.
-- ISBN fica NULL para não vincular a uma edição errada; a capa é resolvida por título + autor.
INSERT IGNORE INTO livros(titulo,autor,isbn,categoria,quantidade_total,editora,ano_publicacao) VALUES
('Memórias Póstumas de Brás Cubas','Machado de Assis',NULL,'Literatura Brasileira',4,NULL,1881),
('Quincas Borba','Machado de Assis',NULL,'Literatura Brasileira',3,NULL,1891),
('O Alienista','Machado de Assis',NULL,'Literatura Brasileira',4,NULL,1882),
('Helena','Machado de Assis',NULL,'Literatura Brasileira',2,NULL,1876),
('Iracema','José de Alencar',NULL,'Romance',3,NULL,1865),
('Senhora','José de Alencar',NULL,'Romance',3,NULL,1875),
('O Guarani','José de Alencar',NULL,'Romance',3,NULL,1857),
('Lucíola','José de Alencar',NULL,'Romance',2,NULL,1862),
('O Cortiço','Aluísio Azevedo',NULL,'Naturalismo',4,NULL,1890),
('Casa de Pensão','Aluísio Azevedo',NULL,'Naturalismo',2,NULL,1884),
('Vidas Secas','Graciliano Ramos',NULL,'Literatura Brasileira',5,NULL,1938),
('São Bernardo','Graciliano Ramos',NULL,'Literatura Brasileira',3,NULL,1934),
('Memórias do Cárcere','Graciliano Ramos',NULL,'Memórias',2,NULL,1953),
('Capitães da Areia','Jorge Amado',NULL,'Literatura Brasileira',5,NULL,1937),
('Gabriela, Cravo e Canela','Jorge Amado',NULL,'Literatura Brasileira',3,NULL,1958),
('Tieta do Agreste','Jorge Amado',NULL,'Literatura Brasileira',2,NULL,1977),
('A Hora da Estrela','Clarice Lispector',NULL,'Literatura Brasileira',5,NULL,1977),
('Laços de Família','Clarice Lispector',NULL,'Contos',3,NULL,1960),
('Perto do Coração Selvagem','Clarice Lispector',NULL,'Literatura Brasileira',2,NULL,1943),
('Felicidade Clandestina','Clarice Lispector',NULL,'Contos',4,NULL,1971),
('Grande Sertão: Veredas','João Guimarães Rosa',NULL,'Literatura Brasileira',3,NULL,1956),
('Sagarana','João Guimarães Rosa',NULL,'Contos',3,NULL,1946),
('Auto da Compadecida','Ariano Suassuna',NULL,'Teatro',5,NULL,1955),
('Morte e Vida Severina','João Cabral de Melo Neto',NULL,'Poesia',4,NULL,1955),
('Alguma Poesia','Carlos Drummond de Andrade',NULL,'Poesia',3,NULL,1930),
('A Rosa do Povo','Carlos Drummond de Andrade',NULL,'Poesia',3,NULL,1945),
('Romanceiro da Inconfidência','Cecília Meireles',NULL,'Poesia',3,NULL,1953),
('Ou Isto ou Aquilo','Cecília Meireles',NULL,'Poesia Infantil',4,NULL,1964),
('Marília de Dirceu','Tomás Antônio Gonzaga',NULL,'Arcadismo',3,NULL,1792),
('Triste Fim de Policarpo Quaresma','Lima Barreto',NULL,'Pré-Modernismo',4,NULL,1915),
('O Quinze','Rachel de Queiroz',NULL,'Literatura Brasileira',4,NULL,1930),
('Menino de Engenho','José Lins do Rego',NULL,'Literatura Brasileira',3,NULL,1932),
('Macunaíma','Mário de Andrade',NULL,'Modernismo',4,NULL,1928),
('Pauliceia Desvairada','Mário de Andrade',NULL,'Poesia',2,NULL,1922),
('Serafim Ponte Grande','Oswald de Andrade',NULL,'Modernismo',2,NULL,1933),
('O Tempo e o Vento','Erico Verissimo',NULL,'Literatura Brasileira',3,NULL,1949),
('Incidente em Antares','Erico Verissimo',NULL,'Literatura Brasileira',2,NULL,1971),
('Dois Irmãos','Milton Hatoum',NULL,'Literatura Brasileira',3,NULL,2000),
('Torto Arado','Itamar Vieira Junior',NULL,'Literatura Brasileira',3,NULL,2019),
('Olhos d’Água','Conceição Evaristo',NULL,'Contos',4,NULL,2014),
('O Meu Pé de Laranja Lima','José Mauro de Vasconcelos',NULL,'Infantojuvenil',5,NULL,1968),
('A Bolsa Amarela','Lygia Bojunga',NULL,'Infantojuvenil',5,NULL,1976),
('A Casa da Madrinha','Lygia Bojunga',NULL,'Infantojuvenil',3,NULL,1978),
('Marcelo, Marmelo, Martelo','Ruth Rocha',NULL,'Infantil',5,NULL,1976),
('O Reizinho Mandão','Ruth Rocha',NULL,'Infantil',4,NULL,1978),
('Menina Bonita do Laço de Fita','Ana Maria Machado',NULL,'Infantil',5,NULL,1986),
('Bisa Bia, Bisa Bel','Ana Maria Machado',NULL,'Infantojuvenil',4,NULL,1981),
('Histórias de Alexandre','Graciliano Ramos',NULL,'Infantojuvenil',3,NULL,1944),
('Reinações de Narizinho','Monteiro Lobato',NULL,'Infantil',5,NULL,1931),
('Caçadas de Pedrinho','Monteiro Lobato',NULL,'Infantil',3,NULL,1933),
('Alice no País das Maravilhas','Lewis Carroll',NULL,'Fantasia',5,NULL,1865),
('As Aventuras de Tom Sawyer','Mark Twain',NULL,'Aventura',4,NULL,1876),
('As Aventuras de Huckleberry Finn','Mark Twain',NULL,'Aventura',3,NULL,1884),
('A Ilha do Tesouro','Robert Louis Stevenson',NULL,'Aventura',4,NULL,1883),
('Vinte Mil Léguas Submarinas','Júlio Verne',NULL,'Ficção Científica',4,NULL,1870),
('Viagem ao Centro da Terra','Júlio Verne',NULL,'Aventura',4,NULL,1864),
('A Volta ao Mundo em 80 Dias','Júlio Verne',NULL,'Aventura',5,NULL,1872),
('Robinson Crusoé','Daniel Defoe',NULL,'Aventura',3,NULL,1719),
('O Livro da Selva','Rudyard Kipling',NULL,'Aventura',4,NULL,1894),
('As Aventuras de Sherlock Holmes','Arthur Conan Doyle',NULL,'Mistério',4,NULL,1892),
('O Cão dos Baskervilles','Arthur Conan Doyle',NULL,'Mistério',4,NULL,1902),
('Assassinato no Expresso do Oriente','Agatha Christie',NULL,'Mistério',4,NULL,1934),
('E Não Sobrou Nenhum','Agatha Christie',NULL,'Mistério',4,NULL,1939),
('Morte no Nilo','Agatha Christie',NULL,'Mistério',3,NULL,1937),
('Orgulho e Preconceito','Jane Austen',NULL,'Romance',4,NULL,1813),
('Razão e Sensibilidade','Jane Austen',NULL,'Romance',3,NULL,1811),
('Jane Eyre','Charlotte Brontë',NULL,'Romance',3,NULL,1847),
('O Morro dos Ventos Uivantes','Emily Brontë',NULL,'Romance',3,NULL,1847),
('Frankenstein','Mary Shelley',NULL,'Terror',4,NULL,1818),
('Drácula','Bram Stoker',NULL,'Terror',3,NULL,1897),
('O Retrato de Dorian Gray','Oscar Wilde',NULL,'Clássico',4,NULL,1890),
('Os Miseráveis','Victor Hugo',NULL,'Clássico',3,NULL,1862),
('O Corcunda de Notre-Dame','Victor Hugo',NULL,'Clássico',3,NULL,1831),
('Dom Quixote','Miguel de Cervantes',NULL,'Clássico',4,NULL,1605),
('Romeu e Julieta','William Shakespeare',NULL,'Teatro',5,NULL,1597),
('Hamlet','William Shakespeare',NULL,'Teatro',4,NULL,1603),
('Sonho de uma Noite de Verão','William Shakespeare',NULL,'Teatro',3,NULL,1595),
('A Odisseia','Homero',NULL,'Clássico',4,NULL,NULL),
('A Ilíada','Homero',NULL,'Clássico',3,NULL,NULL),
('A Divina Comédia','Dante Alighieri',NULL,'Clássico',3,NULL,1321),
('A Revolução dos Bichos','George Orwell',NULL,'Distopia',5,NULL,1945),
('Admirável Mundo Novo','Aldous Huxley',NULL,'Distopia',4,NULL,1932),
('Fahrenheit 451','Ray Bradbury',NULL,'Distopia',4,NULL,1953),
('O Hobbit','J. R. R. Tolkien',NULL,'Fantasia',5,NULL,1937),
('A Sociedade do Anel','J. R. R. Tolkien',NULL,'Fantasia',4,NULL,1954),
('As Duas Torres','J. R. R. Tolkien',NULL,'Fantasia',4,NULL,1954),
('O Retorno do Rei','J. R. R. Tolkien',NULL,'Fantasia',4,NULL,1955),
('Harry Potter e a Câmara Secreta','J. K. Rowling',NULL,'Fantasia',5,NULL,1998),
('Harry Potter e o Prisioneiro de Azkaban','J. K. Rowling',NULL,'Fantasia',5,NULL,1999),
('Harry Potter e o Cálice de Fogo','J. K. Rowling',NULL,'Fantasia',4,NULL,2000),
('Percy Jackson e o Ladrão de Raios','Rick Riordan',NULL,'Fantasia',5,NULL,2005),
('Percy Jackson e o Mar de Monstros','Rick Riordan',NULL,'Fantasia',4,NULL,2006),
('As Crônicas de Nárnia','C. S. Lewis',NULL,'Fantasia',5,NULL,1950),
('O Leão, a Feiticeira e o Guarda-Roupa','C. S. Lewis',NULL,'Fantasia',4,NULL,1950),
('Anne de Green Gables','L. M. Montgomery',NULL,'Infantojuvenil',4,NULL,1908),
('Pollyanna','Eleanor H. Porter',NULL,'Infantojuvenil',4,NULL,1913),
('Heidi','Johanna Spyri',NULL,'Infantojuvenil',3,NULL,1881),
('O Jardim Secreto','Frances Hodgson Burnett',NULL,'Infantojuvenil',4,NULL,1911),
('Mulherzinhas','Louisa May Alcott',NULL,'Clássico',4,NULL,1868),
('O Diário de Anne Frank','Anne Frank',NULL,'Biografia',5,NULL,1947);

-- O bibliotecário administrador é criado automaticamente pelo backend na primeira inicialização.
-- Credenciais padrão (podem ser alteradas no .env):
-- e-mail: bibliotecario@escola.com
-- senha: 123456


-- Capas ilustrativas locais: artes próprias do catálogo, não reproduções de capas editoriais.
UPDATE livros SET capa_url='/assets/capas/livro-001.png' WHERE titulo='Dom Casmurro' AND autor='Machado de Assis' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-002.png' WHERE titulo='Harry Potter' AND autor='J.K. Rowling' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-003.png' WHERE titulo='O Pequeno Príncipe' AND autor='Saint-Exupéry' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-004.png' WHERE titulo='1984' AND autor='George Orwell' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-005.png' WHERE titulo='Memórias Póstumas de Brás Cubas' AND autor='Machado de Assis' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-006.png' WHERE titulo='Quincas Borba' AND autor='Machado de Assis' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-007.png' WHERE titulo='O Alienista' AND autor='Machado de Assis' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-008.png' WHERE titulo='Helena' AND autor='Machado de Assis' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-009.png' WHERE titulo='Iracema' AND autor='José de Alencar' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-010.png' WHERE titulo='Senhora' AND autor='José de Alencar' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-011.png' WHERE titulo='O Guarani' AND autor='José de Alencar' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-012.png' WHERE titulo='Lucíola' AND autor='José de Alencar' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-013.png' WHERE titulo='O Cortiço' AND autor='Aluísio Azevedo' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-014.png' WHERE titulo='Casa de Pensão' AND autor='Aluísio Azevedo' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-015.png' WHERE titulo='Vidas Secas' AND autor='Graciliano Ramos' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-016.png' WHERE titulo='São Bernardo' AND autor='Graciliano Ramos' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-017.png' WHERE titulo='Memórias do Cárcere' AND autor='Graciliano Ramos' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-018.png' WHERE titulo='Capitães da Areia' AND autor='Jorge Amado' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-019.png' WHERE titulo='Gabriela, Cravo e Canela' AND autor='Jorge Amado' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-020.png' WHERE titulo='Tieta do Agreste' AND autor='Jorge Amado' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-021.png' WHERE titulo='A Hora da Estrela' AND autor='Clarice Lispector' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-022.png' WHERE titulo='Laços de Família' AND autor='Clarice Lispector' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-023.png' WHERE titulo='Perto do Coração Selvagem' AND autor='Clarice Lispector' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-024.png' WHERE titulo='Felicidade Clandestina' AND autor='Clarice Lispector' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-025.png' WHERE titulo='Grande Sertão: Veredas' AND autor='João Guimarães Rosa' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-026.png' WHERE titulo='Sagarana' AND autor='João Guimarães Rosa' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-027.png' WHERE titulo='Auto da Compadecida' AND autor='Ariano Suassuna' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-028.png' WHERE titulo='Morte e Vida Severina' AND autor='João Cabral de Melo Neto' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-029.png' WHERE titulo='Alguma Poesia' AND autor='Carlos Drummond de Andrade' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-030.png' WHERE titulo='A Rosa do Povo' AND autor='Carlos Drummond de Andrade' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-031.png' WHERE titulo='Romanceiro da Inconfidência' AND autor='Cecília Meireles' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-032.png' WHERE titulo='Ou Isto ou Aquilo' AND autor='Cecília Meireles' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-033.png' WHERE titulo='Marília de Dirceu' AND autor='Tomás Antônio Gonzaga' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-034.png' WHERE titulo='Triste Fim de Policarpo Quaresma' AND autor='Lima Barreto' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-035.png' WHERE titulo='O Quinze' AND autor='Rachel de Queiroz' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-036.png' WHERE titulo='Menino de Engenho' AND autor='José Lins do Rego' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-037.png' WHERE titulo='Macunaíma' AND autor='Mário de Andrade' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-038.png' WHERE titulo='Pauliceia Desvairada' AND autor='Mário de Andrade' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-039.png' WHERE titulo='Serafim Ponte Grande' AND autor='Oswald de Andrade' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-040.png' WHERE titulo='O Tempo e o Vento' AND autor='Erico Verissimo' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-041.png' WHERE titulo='Incidente em Antares' AND autor='Erico Verissimo' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-042.png' WHERE titulo='Dois Irmãos' AND autor='Milton Hatoum' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-043.png' WHERE titulo='Torto Arado' AND autor='Itamar Vieira Junior' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-044.png' WHERE titulo='Olhos d’Água' AND autor='Conceição Evaristo' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-045.png' WHERE titulo='O Meu Pé de Laranja Lima' AND autor='José Mauro de Vasconcelos' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-046.png' WHERE titulo='A Bolsa Amarela' AND autor='Lygia Bojunga' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-047.png' WHERE titulo='A Casa da Madrinha' AND autor='Lygia Bojunga' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-048.png' WHERE titulo='Marcelo, Marmelo, Martelo' AND autor='Ruth Rocha' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-049.png' WHERE titulo='O Reizinho Mandão' AND autor='Ruth Rocha' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-050.png' WHERE titulo='Menina Bonita do Laço de Fita' AND autor='Ana Maria Machado' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-051.png' WHERE titulo='Bisa Bia, Bisa Bel' AND autor='Ana Maria Machado' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-052.png' WHERE titulo='Histórias de Alexandre' AND autor='Graciliano Ramos' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-053.png' WHERE titulo='Reinações de Narizinho' AND autor='Monteiro Lobato' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-054.png' WHERE titulo='Caçadas de Pedrinho' AND autor='Monteiro Lobato' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-055.png' WHERE titulo='Alice no País das Maravilhas' AND autor='Lewis Carroll' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-056.png' WHERE titulo='As Aventuras de Tom Sawyer' AND autor='Mark Twain' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-057.png' WHERE titulo='As Aventuras de Huckleberry Finn' AND autor='Mark Twain' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-058.png' WHERE titulo='A Ilha do Tesouro' AND autor='Robert Louis Stevenson' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-059.png' WHERE titulo='Vinte Mil Léguas Submarinas' AND autor='Júlio Verne' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-060.png' WHERE titulo='Viagem ao Centro da Terra' AND autor='Júlio Verne' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-061.png' WHERE titulo='A Volta ao Mundo em 80 Dias' AND autor='Júlio Verne' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-062.png' WHERE titulo='Robinson Crusoé' AND autor='Daniel Defoe' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-063.png' WHERE titulo='O Livro da Selva' AND autor='Rudyard Kipling' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-064.png' WHERE titulo='As Aventuras de Sherlock Holmes' AND autor='Arthur Conan Doyle' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-065.png' WHERE titulo='O Cão dos Baskervilles' AND autor='Arthur Conan Doyle' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-066.png' WHERE titulo='Assassinato no Expresso do Oriente' AND autor='Agatha Christie' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-067.png' WHERE titulo='E Não Sobrou Nenhum' AND autor='Agatha Christie' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-068.png' WHERE titulo='Morte no Nilo' AND autor='Agatha Christie' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-069.png' WHERE titulo='Orgulho e Preconceito' AND autor='Jane Austen' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-070.png' WHERE titulo='Razão e Sensibilidade' AND autor='Jane Austen' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-071.png' WHERE titulo='Jane Eyre' AND autor='Charlotte Brontë' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-072.png' WHERE titulo='O Morro dos Ventos Uivantes' AND autor='Emily Brontë' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-073.png' WHERE titulo='Frankenstein' AND autor='Mary Shelley' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-074.png' WHERE titulo='Drácula' AND autor='Bram Stoker' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-075.png' WHERE titulo='O Retrato de Dorian Gray' AND autor='Oscar Wilde' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-076.png' WHERE titulo='Os Miseráveis' AND autor='Victor Hugo' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-077.png' WHERE titulo='O Corcunda de Notre-Dame' AND autor='Victor Hugo' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-078.png' WHERE titulo='Dom Quixote' AND autor='Miguel de Cervantes' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-079.png' WHERE titulo='Romeu e Julieta' AND autor='William Shakespeare' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-080.png' WHERE titulo='Hamlet' AND autor='William Shakespeare' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-081.png' WHERE titulo='Sonho de uma Noite de Verão' AND autor='William Shakespeare' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-082.png' WHERE titulo='A Odisseia' AND autor='Homero' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-083.png' WHERE titulo='A Ilíada' AND autor='Homero' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-084.png' WHERE titulo='A Divina Comédia' AND autor='Dante Alighieri' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-085.png' WHERE titulo='A Revolução dos Bichos' AND autor='George Orwell' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-086.png' WHERE titulo='Admirável Mundo Novo' AND autor='Aldous Huxley' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-087.png' WHERE titulo='Fahrenheit 451' AND autor='Ray Bradbury' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-088.png' WHERE titulo='O Hobbit' AND autor='J. R. R. Tolkien' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-089.png' WHERE titulo='A Sociedade do Anel' AND autor='J. R. R. Tolkien' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-090.png' WHERE titulo='As Duas Torres' AND autor='J. R. R. Tolkien' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-091.png' WHERE titulo='O Retorno do Rei' AND autor='J. R. R. Tolkien' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-092.png' WHERE titulo='Harry Potter e a Câmara Secreta' AND autor='J. K. Rowling' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-093.png' WHERE titulo='Harry Potter e o Prisioneiro de Azkaban' AND autor='J. K. Rowling' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-094.png' WHERE titulo='Harry Potter e o Cálice de Fogo' AND autor='J. K. Rowling' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-095.png' WHERE titulo='Percy Jackson e o Ladrão de Raios' AND autor='Rick Riordan' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-096.png' WHERE titulo='Percy Jackson e o Mar de Monstros' AND autor='Rick Riordan' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-097.png' WHERE titulo='As Crônicas de Nárnia' AND autor='C. S. Lewis' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-098.png' WHERE titulo='O Leão, a Feiticeira e o Guarda-Roupa' AND autor='C. S. Lewis' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-099.png' WHERE titulo='Anne de Green Gables' AND autor='L. M. Montgomery' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-100.png' WHERE titulo='Pollyanna' AND autor='Eleanor H. Porter' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-101.png' WHERE titulo='Heidi' AND autor='Johanna Spyri' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-102.png' WHERE titulo='O Jardim Secreto' AND autor='Frances Hodgson Burnett' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-103.png' WHERE titulo='Mulherzinhas' AND autor='Louisa May Alcott' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET capa_url='/assets/capas/livro-104.png' WHERE titulo='O Diário de Anne Frank' AND autor='Anne Frank' AND (capa_url IS NULL OR capa_url='');
UPDATE livros SET sinopse='Bentinho relembra sua juventude, seu casamento com Capitu e as dúvidas que marcam sua memória.' WHERE titulo='Dom Casmurro' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um narrador já falecido conta sua vida com ironia e crítica aos costumes da sociedade brasileira.' WHERE titulo='Memórias Póstumas de Brás Cubas' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Rubião herda uma fortuna e se envolve em relações marcadas por interesses, ambição e ilusões.' WHERE titulo='Quincas Borba' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='O médico Simão Bacamarte decide estudar a loucura, transformando a rotina de Itaguaí.' WHERE titulo='O Alienista' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='A chegada de Helena a uma família muda as relações entre seus integrantes e revela segredos.' WHERE titulo='Helena' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='A história de amor entre Iracema e Martim combina romance e uma interpretação literária da formação do Ceará.' WHERE titulo='Iracema' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Aurélia usa sua fortuna para confrontar Fernando Seixas, em um romance sobre dinheiro, amor e orgulho.' WHERE titulo='Senhora' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Peri protege Cecília em uma narrativa indianista de aventura, lealdade e conflitos coloniais.' WHERE titulo='O Guarani' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Paulo conhece Lúcia no Rio de Janeiro imperial, em um romance sobre preconceito e afeto.' WHERE titulo='Lucíola' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='A vida dos moradores de um cortiço carioca revela conflitos sociais, exploração e desigualdade.' WHERE titulo='O Cortiço' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Amâncio chega ao Rio de Janeiro e enfrenta interesses e conflitos em uma pensão.' WHERE titulo='Casa de Pensão' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Uma família de retirantes atravessa o sertão nordestino enfrentando seca, pobreza e injustiça.' WHERE titulo='Vidas Secas' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Paulo Honório narra sua ascensão econômica e os conflitos de seu casamento com Madalena.' WHERE titulo='São Bernardo' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Graciliano Ramos relata a experiência da prisão política e as pessoas que conheceu.' WHERE titulo='Memórias do Cárcere' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um grupo de meninos em situação de rua vive aventuras e enfrenta desigualdades em Salvador.' WHERE titulo='Capitães da Areia' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Em Ilhéus, a chegada de Gabriela se mistura a mudanças sociais e disputas de poder.' WHERE titulo='Gabriela, Cravo e Canela' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Tieta retorna à cidade natal e provoca transformações em sua família e na comunidade.' WHERE titulo='Tieta do Agreste' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Macabéa, jovem nordestina no Rio de Janeiro, protagoniza uma narrativa sobre invisibilidade e existência.' WHERE titulo='A Hora da Estrela' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Contos que exploram relações familiares, conflitos íntimos e momentos de revelação.' WHERE titulo='Laços de Família' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Joana revisita experiências e sentimentos em uma narrativa de intensa introspecção.' WHERE titulo='Perto do Coração Selvagem' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Contos sobre infância, desejo, descobertas e os pequenos conflitos da vida cotidiana.' WHERE titulo='Felicidade Clandestina' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Riobaldo relembra sua vida entre jagunços e suas dúvidas sobre amor, destino e o bem e o mal.' WHERE titulo='Grande Sertão: Veredas' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Contos ambientados no interior de Minas Gerais, marcados por linguagem inventiva e tradições regionais.' WHERE titulo='Sagarana' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='João Grilo e Chicó tentam sobreviver com esperteza em uma comédia sobre fé e justiça.' WHERE titulo='Auto da Compadecida' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um retirante chamado Severino atravessa o sertão em busca de uma vida melhor.' WHERE titulo='Morte e Vida Severina' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Poemas que apresentam o olhar crítico, cotidiano e bem-humorado de Drummond.' WHERE titulo='Alguma Poesia' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Poemas que refletem sobre guerra, sociedade, política e experiência humana.' WHERE titulo='A Rosa do Povo' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Poemas que revisitam a Inconfidência Mineira e seus personagens históricos.' WHERE titulo='Romanceiro da Inconfidência' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Poemas infantis que brincam com escolhas, sons e imaginação.' WHERE titulo='Ou Isto ou Aquilo' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Poemas amorosos do Arcadismo brasileiro, associados à figura de Dirceu e sua amada Marília.' WHERE titulo='Marília de Dirceu' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um patriota idealista tenta transformar o Brasil e se choca com a realidade política.' WHERE titulo='Triste Fim de Policarpo Quaresma' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='A seca de 1915 no Ceará marca os destinos de famílias e trabalhadores.' WHERE titulo='O Quinze' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Carlinhos recorda a infância em um engenho de açúcar no Nordeste.' WHERE titulo='Menino de Engenho' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='O herói sem nenhum caráter percorre cenários brasileiros em uma narrativa modernista.' WHERE titulo='Macunaíma' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Poemas modernistas que retratam São Paulo e suas contradições.' WHERE titulo='Pauliceia Desvairada' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Romance experimental e satírico ligado às rupturas do Modernismo.' WHERE titulo='Serafim Ponte Grande' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Saga familiar que acompanha gerações e transformações históricas do Rio Grande do Sul.' WHERE titulo='O Tempo e o Vento' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um acontecimento fantástico expõe hipocrisias e disputas políticas de uma cidade.' WHERE titulo='Incidente em Antares' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Conflitos entre irmãos gêmeos atravessam a história de uma família em Manaus.' WHERE titulo='Dois Irmãos' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Duas irmãs vivem conflitos ligados à terra, ao trabalho e à ancestralidade no sertão baiano.' WHERE titulo='Torto Arado' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Contos sobre mulheres negras, família, memória e desigualdade social.' WHERE titulo='Olhos d’Água' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Zezé encontra amizade e imaginação em meio às dificuldades da infância.' WHERE titulo='O Meu Pé de Laranja Lima' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Raquel guarda seus desejos em uma bolsa e enfrenta os desafios de crescer.' WHERE titulo='A Bolsa Amarela' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Alexandre embarca em uma jornada de fantasia e descobertas.' WHERE titulo='A Casa da Madrinha' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Histórias infantis que exploram linguagem, curiosidade e imaginação.' WHERE titulo='Marcelo, Marmelo, Martelo' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Uma fábula sobre autoritarismo e o direito de falar.' WHERE titulo='O Reizinho Mandão' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um coelho admira uma menina e aprende sobre identidade e diversidade.' WHERE titulo='Menina Bonita do Laço de Fita' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Isabel descobre memórias familiares e reflete sobre diferentes gerações.' WHERE titulo='Bisa Bia, Bisa Bel' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Aventuras fantásticas das personagens do Sítio do Picapau Amarelo.' WHERE titulo='Reinações de Narizinho' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='As crianças do Sítio vivem aventuras e encontram desafios inesperados.' WHERE titulo='Caçadas de Pedrinho' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Alice entra em um mundo fantástico de criaturas e acontecimentos absurdos.' WHERE titulo='Alice no País das Maravilhas' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Tom Sawyer vive travessuras e aventuras às margens do rio Mississippi.' WHERE titulo='As Aventuras de Tom Sawyer' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um jovem encontra um mapa e embarca em uma aventura com piratas.' WHERE titulo='A Ilha do Tesouro' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='O capitão Nemo conduz uma viagem extraordinária a bordo do submarino Náutilus.' WHERE titulo='Vinte Mil Léguas Submarinas' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Exploradores seguem pistas para uma viagem fantástica ao interior da Terra.' WHERE titulo='Viagem ao Centro da Terra' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Phileas Fogg aceita o desafio de viajar ao redor do mundo em oitenta dias.' WHERE titulo='A Volta ao Mundo em 80 Dias' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Elizabeth Bennet e Darcy enfrentam diferenças sociais e julgamentos precipitados.' WHERE titulo='Orgulho e Preconceito' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um cientista cria um ser vivo e precisa enfrentar as consequências de sua experiência.' WHERE titulo='Frankenstein' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='A presença de um conde misterioso desencadeia uma história de horror e suspense.' WHERE titulo='Drácula' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um fidalgo decide tornar-se cavaleiro andante e vive aventuras ao lado de Sancho Pança.' WHERE titulo='Dom Quixote' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Dois jovens se apaixonam apesar da rivalidade entre suas famílias.' WHERE titulo='Romeu e Julieta' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um príncipe investiga a morte do pai e enfrenta dúvidas sobre vingança e justiça.' WHERE titulo='Hamlet' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Em um regime de vigilância total, Winston Smith tenta preservar sua liberdade de pensamento.' WHERE titulo='1984' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Animais assumem uma fazenda e descobrem como o poder pode ser corrompido.' WHERE titulo='A Revolução dos Bichos' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Em uma sociedade que proíbe livros, um bombeiro começa a questionar seu trabalho.' WHERE titulo='Fahrenheit 451' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Bilbo Bolseiro embarca em uma aventura com anões e encontra perigos inesperados.' WHERE titulo='O Hobbit' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='Um pequeno viajante conhece diferentes mundos e reflete sobre amizade e afeto.' WHERE titulo='O Pequeno Príncipe' AND (sinopse IS NULL OR sinopse='');
UPDATE livros SET sinopse='O diário registra pensamentos e experiências de Anne Frank durante a perseguição nazista.' WHERE titulo='O Diário de Anne Frank' AND (sinopse IS NULL OR sinopse='');
