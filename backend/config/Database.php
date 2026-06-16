<?php

class Database {
    private $config;

    public function __construct() {
        $this->config = require __DIR__ . '/.env.php';
    }

    public function getConnection() {
        $isProduction = ($this->config['app_env'] === 'production');

        try {
            $dsn  = "mysql:host={$this->config['db_host']};dbname={$this->config['db_name']};charset=utf8mb4";
            $conn = new PDO($dsn, $this->config['db_user'], $this->config['db_pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,  // Previne SQL injection em edge cases
            ]);
            return $conn;
        } catch (PDOException $e) {
            // Em produção nunca expõe detalhes do erro
            if ($isProduction) {
                http_response_code(503);
                echo json_encode(['message' => 'Serviço temporariamente indisponível.']);
            } else {
                http_response_code(503);
                echo json_encode(['message' => 'Erro de conexão com o banco de dados: ' . $e->getMessage()]);
            }
            exit;
        }
    }
}
?>
