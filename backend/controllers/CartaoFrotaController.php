<?php
require_once '../config/Database.php';
require_once '../middlewares/AuthMiddleware.php';

class CartaoFrotaController {
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
                echo json_encode(['message' => 'Método não permitido.']);
                break;
        }
    }

    private function getAll() {
        $userData = AuthMiddleware::authenticate();
        $veiculoId = isset($_GET['veiculo_id']) ? intval($_GET['veiculo_id']) : null;

        $query = "SELECT cf.*, v.placa as veiculo_placa, v.marca as veiculo_marca, v.modelo as veiculo_modelo
                  FROM cartoes_frota cf
                  LEFT JOIN veiculos v ON cf.veiculo_id = v.id
                  WHERE 1=1";

        if ($veiculoId) {
            $query .= " AND cf.veiculo_id = :veiculo_id";
        }

        if ($userData['perfil'] !== 'admin') {
            $query .= " AND cf.status = 1";
        }

        $query .= " ORDER BY cf.created_at DESC";

        $stmt = $this->conn->prepare($query);
        if ($veiculoId) {
            $stmt->bindParam(':veiculo_id', $veiculoId, PDO::PARAM_INT);
        }
        $stmt->execute();

        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function create() {
        AuthMiddleware::authenticate('admin');

        $data = json_decode(file_get_contents('php://input'));

        if (!isset($data->veiculo_id) || !isset($data->numero_cartao)) {
            http_response_code(400);
            echo json_encode(['message' => 'Dados incompletos.']);
            return;
        }

        $query = "INSERT INTO cartoes_frota (veiculo_id, numero_cartao, apelido, bandeira, status)
                  VALUES (:veiculo_id, :numero_cartao, :apelido, :bandeira, :status)";
        $stmt = $this->conn->prepare($query);

        $status = isset($data->status) ? intval($data->status) : 1;
        $apelido = isset($data->apelido) ? trim($data->apelido) : null;
        $bandeira = isset($data->bandeira) ? trim($data->bandeira) : null;

        $stmt->bindParam(':veiculo_id', $data->veiculo_id);
        $stmt->bindParam(':numero_cartao', $data->numero_cartao);
        $stmt->bindParam(':apelido', $apelido);
        $stmt->bindParam(':bandeira', $bandeira);
        $stmt->bindParam(':status', $status);

        try {
            $stmt->execute();
            http_response_code(201);
            echo json_encode(['message' => 'Cartão cadastrado com sucesso.']);
        } catch (PDOException $e) {
            http_response_code(400);
            echo json_encode(['message' => 'Erro ao cadastrar cartão: ' . $e->getMessage()]);
        }
    }

    private function update() {
        AuthMiddleware::authenticate('admin');

        $data = json_decode(file_get_contents('php://input'));

        if (!isset($data->id) || !isset($data->veiculo_id) || !isset($data->numero_cartao)) {
            http_response_code(400);
            echo json_encode(['message' => 'Dados incompletos.']);
            return;
        }

        $query = "UPDATE cartoes_frota
                  SET veiculo_id = :veiculo_id, numero_cartao = :numero_cartao, apelido = :apelido, bandeira = :bandeira, status = :status
                  WHERE id = :id";
        $stmt = $this->conn->prepare($query);

        $status = isset($data->status) ? intval($data->status) : 1;
        $apelido = isset($data->apelido) ? trim($data->apelido) : null;
        $bandeira = isset($data->bandeira) ? trim($data->bandeira) : null;

        $stmt->bindParam(':veiculo_id', $data->veiculo_id);
        $stmt->bindParam(':numero_cartao', $data->numero_cartao);
        $stmt->bindParam(':apelido', $apelido);
        $stmt->bindParam(':bandeira', $bandeira);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':id', $data->id);

        try {
            $stmt->execute();
            echo json_encode(['message' => 'Cartão atualizado com sucesso.']);
        } catch (PDOException $e) {
            http_response_code(400);
            echo json_encode(['message' => 'Erro ao atualizar cartão: ' . $e->getMessage()]);
        }
    }

    private function delete() {
        AuthMiddleware::authenticate('admin');

        $id = isset($_GET['id']) ? intval($_GET['id']) : null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['message' => 'ID do cartão não fornecido.']);
            return;
        }

        $stmt = $this->conn->prepare('UPDATE cartoes_frota SET status = 0 WHERE id = :id');
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);

        if ($stmt->execute()) {
            echo json_encode(['message' => 'Cartão desativado com sucesso.']);
        } else {
            http_response_code(503);
            echo json_encode(['message' => 'Não foi possível desativar o cartão.']);
        }
    }
}
?>