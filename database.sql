CREATE DATABASE IF NOT EXISTS jangadeiro_checklist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jangadeiro_checklist;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    telefone VARCHAR(20),
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('admin', 'fiscal', 'motorista') NOT NULL,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS veiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    placa VARCHAR(10) UNIQUE NOT NULL,
    modelo VARCHAR(50) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    ano INT NOT NULL,
    cor VARCHAR(30),
    km_atual INT NOT NULL DEFAULT 0,
    proxima_troca_oleo INT,
    tipo_combustivel ENUM('Gasolina', 'Etanol', 'Diesel S10', 'Diesel Comum', 'GNV') NOT NULL,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cartoes_frota (
    id INT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id INT NOT NULL,
    numero_cartao VARCHAR(40) NOT NULL,
    apelido VARCHAR(100),
    bandeira VARCHAR(50),
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cartao_frota_numero (numero_cartao),
    FOREIGN KEY (veiculo_id) REFERENCES veiculos(id)
);

CREATE TABLE IF NOT EXISTS checklists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id INT NOT NULL,
    fiscal_id INT NOT NULL,
    motorista_id INT NOT NULL,
    tipo ENUM('abertura', 'fechamento') NOT NULL,
    data_hora DATETIME NOT NULL,
    km_registrado INT NOT NULL,
    assinatura_fiscal TEXT NOT NULL,
    assinatura_motorista TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status ENUM('em_andamento', 'concluido') DEFAULT 'concluido',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (veiculo_id) REFERENCES veiculos(id),
    FOREIGN KEY (fiscal_id) REFERENCES usuarios(id),
    FOREIGN KEY (motorista_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS checklist_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    checklist_id INT NOT NULL,
    nome_item VARCHAR(100) NOT NULL,
    status_item ENUM('conforme', 'nao_conforme') NOT NULL,
    observacao TEXT,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklist_fotos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    checklist_id INT NOT NULL,
    tipo_foto VARCHAR(50) NOT NULL, -- frente, traseira, esquerdo, direito, painel, adicional
    caminho_arquivo VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS abastecimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id INT NOT NULL,
    cartao_frota_id INT,
    motorista_id INT NOT NULL,
    data_hora DATETIME NOT NULL,
    km_abastecimento INT NOT NULL,
    litros DECIMAL(8,2) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    valor_litro DECIMAL(10,2) NOT NULL,
    tipo_combustivel ENUM('Gasolina', 'Etanol', 'Diesel S10', 'Diesel Comum', 'GNV') NOT NULL,
    foto_cupom VARCHAR(255) NOT NULL,
    foto_bomba VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (veiculo_id) REFERENCES veiculos(id),
    FOREIGN KEY (cartao_frota_id) REFERENCES cartoes_frota(id),
    FOREIGN KEY (motorista_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    acao VARCHAR(255) NOT NULL,
    tabela_afetada VARCHAR(50),
    registro_id INT,
    detalhes TEXT,
    ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Inserir Admin inicial
INSERT INTO usuarios (nome, cpf, email, senha, perfil) VALUES 
('Administrador', '00000000000', 'admin@jangadeiro.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
-- A senha padrão é 'password' (hash base gerado pelo password_hash do PHP)
