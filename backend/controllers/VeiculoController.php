<?php
require_once '../config/Database.php';
require_once '../middlewares/AuthMiddleware.php';

class VeiculoController {
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];

        switch ($method) {
            case 'GET':
                $this->getAll();
                break;
            case 'POST':
                $this->create();
                break;
            case 'PUT':
                $this->update();
                break;
            case 'DELETE':
                $this->delete();
                break;
            default:
                http_response_code(405);
                echo json_encode(["message" => "Método não permitido."]);
                break;
        }
    }

    private function getAll() {
        // Autenticar: Admin, Fiscal ou Motorista podem ver veículos
        AuthMiddleware::authenticate(); 

        $query = "SELECT * FROM veiculos WHERE status = 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        $veiculos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($veiculos);
    }

    private function create() {
        AuthMiddleware::authenticate('admin');

        $data = json_decode(file_get_contents("php://input"));

        if (!isset($data->placa) || !isset($data->modelo) || !isset($data->marca) || !isset($data->ano)) {
            http_response_code(400);
            echo json_encode(["message" => "Dados incompletos."]);
            return;
        }

        $query = "INSERT INTO veiculos (placa, modelo, marca, ano, cor, km_atual, proxima_troca_oleo, tipo_combustivel, status) 
                  VALUES (:placa, :modelo, :marca, :ano, :cor, :km_atual, :proxima_troca_oleo, :tipo_combustivel, :status)";
        
        $stmt = $this->conn->prepare($query);
        
        $status = isset($data->status) ? $data->status : 1;
        $km_atual = isset($data->km_atual) ? $data->km_atual : 0;

        $stmt->bindParam(':placa', $data->placa);
        $stmt->bindParam(':modelo', $data->modelo);
        $stmt->bindParam(':marca', $data->marca);
        $stmt->bindParam(':ano', $data->ano);
        $stmt->bindParam(':cor', $data->cor);
        $stmt->bindParam(':km_atual', $km_atual);
        $stmt->bindParam(':proxima_troca_oleo', $data->proxima_troca_oleo);
        $stmt->bindParam(':tipo_combustivel', $data->tipo_combustivel);
        $stmt->bindParam(':status', $status);

        try {
            if ($stmt->execute()) {
                http_response_code(201);
                echo json_encode(["message" => "Veículo criado com sucesso."]);
            } else {
                http_response_code(503);
                echo json_encode(["message" => "Não foi possível criar o veículo."]);
            }
        } catch (PDOException $e) {
            http_response_code(400);
            echo json_encode(["message" => "Erro ao criar veículo: " . $e->getMessage()]);
        }
    }

    private function update() {
        AuthMiddleware::authenticate('admin');

        $data = json_decode(file_get_contents("php://input"));

        if (!isset($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "ID do veículo não fornecido."]);
            return;
        }

        $query = "UPDATE veiculos SET placa = :placa, modelo = :modelo, marca = :marca, ano = :ano, cor = :cor, km_atual = :km_atual, proxima_troca_oleo = :proxima_troca_oleo, tipo_combustivel = :tipo_combustivel, status = :status WHERE id = :id";
        
        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':placa', $data->placa);
        $stmt->bindParam(':modelo', $data->modelo);
        $stmt->bindParam(':marca', $data->marca);
        $stmt->bindParam(':ano', $data->ano);
        $stmt->bindParam(':cor', $data->cor);
        $stmt->bindParam(':km_atual', $data->km_atual);
        $stmt->bindParam(':proxima_troca_oleo', $data->proxima_troca_oleo);
        $stmt->bindParam(':tipo_combustivel', $data->tipo_combustivel);
        $stmt->bindParam(':status', $data->status);
        $stmt->bindParam(':id', $data->id);

        if ($stmt->execute()) {
            echo json_encode(["message" => "Veículo atualizado com sucesso."]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Não foi possível atualizar o veículo."]);
        }
    }

    private function delete() {
        AuthMiddleware::authenticate('admin');

        $id = isset($_GET['id']) ? $_GET['id'] : null;

        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "ID do veículo não fornecido."]);
            return;
        }

        $query = "UPDATE veiculos SET status = 0 WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);

        if ($stmt->execute()) {
            echo json_encode(["message" => "Veículo desativado com sucesso."]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Não foi possível desativar o veículo."]);
        }
    }
}
?>
