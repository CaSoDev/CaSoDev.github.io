<?php
require_once '../config/Database.php';
require_once '../middlewares/AuthMiddleware.php';

class UsuarioController {
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
        AuthMiddleware::authenticate(); // Qualquer autenticado pode listar para ver motoristas

        $query = "SELECT id, nome, cpf, email, telefone, perfil, status, created_at FROM usuarios";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($usuarios);
    }

    private function create() {
        AuthMiddleware::authenticate('admin');

        $data = json_decode(file_get_contents("php://input"));

        if (!isset($data->nome) || !isset($data->cpf) || !isset($data->senha) || !isset($data->perfil)) {
            http_response_code(400);
            echo json_encode(["message" => "Dados incompletos."]);
            return;
        }

        $query = "INSERT INTO usuarios (nome, cpf, email, telefone, senha, perfil, status) 
                  VALUES (:nome, :cpf, :email, :telefone, :senha, :perfil, :status)";
        
        $stmt = $this->conn->prepare($query);
        
        $senhaHash = password_hash($data->senha, PASSWORD_DEFAULT);
        $status = isset($data->status) ? $data->status : 1;

        $stmt->bindParam(':nome', $data->nome);
        $stmt->bindParam(':cpf', $data->cpf);
        $stmt->bindParam(':email', $data->email);
        $stmt->bindParam(':telefone', $data->telefone);
        $stmt->bindParam(':senha', $senhaHash);
        $stmt->bindParam(':perfil', $data->perfil);
        $stmt->bindParam(':status', $status);

        try {
            if ($stmt->execute()) {
                http_response_code(201);
                echo json_encode(["message" => "Usuário criado com sucesso."]);
            } else {
                http_response_code(503);
                echo json_encode(["message" => "Não foi possível criar o usuário."]);
            }
        } catch (PDOException $e) {
            http_response_code(400);
            echo json_encode(["message" => "Erro ao criar usuário: " . $e->getMessage()]);
        }
    }

    private function update() {
        AuthMiddleware::authenticate('admin');

        $data = json_decode(file_get_contents("php://input"));

        if (!isset($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "ID do usuário não fornecido."]);
            return;
        }

        $query = "UPDATE usuarios SET nome = :nome, cpf = :cpf, email = :email, telefone = :telefone, perfil = :perfil, status = :status";
        
        if (!empty($data->senha)) {
            $query .= ", senha = :senha";
        }
        $query .= " WHERE id = :id";

        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':nome', $data->nome);
        $stmt->bindParam(':cpf', $data->cpf);
        $stmt->bindParam(':email', $data->email);
        $stmt->bindParam(':telefone', $data->telefone);
        $stmt->bindParam(':perfil', $data->perfil);
        $stmt->bindParam(':status', $data->status);
        $stmt->bindParam(':id', $data->id);

        if (!empty($data->senha)) {
            $senhaHash = password_hash($data->senha, PASSWORD_DEFAULT);
            $stmt->bindParam(':senha', $senhaHash);
        }

        if ($stmt->execute()) {
            echo json_encode(["message" => "Usuário atualizado com sucesso."]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Não foi possível atualizar o usuário."]);
        }
    }

    private function delete() {
        AuthMiddleware::authenticate('admin');

        $data = json_decode(file_get_contents("php://input"));
        // Se for via DELETE, podemos pegar o id da URL, mas por simplicidade vamos assumir no body ou querystring.
        $id = isset($_GET['id']) ? $_GET['id'] : (isset($data->id) ? $data->id : null);

        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "ID do usuário não fornecido."]);
            return;
        }

        // Recomendado Soft Delete
        $query = "UPDATE usuarios SET status = 0 WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);

        if ($stmt->execute()) {
            echo json_encode(["message" => "Usuário desativado com sucesso."]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "Não foi possível desativar o usuário."]);
        }
    }
}
?>
