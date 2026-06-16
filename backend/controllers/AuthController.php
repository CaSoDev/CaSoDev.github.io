<?php
require_once '../config/Database.php';
require_once '../utils/JwtHandler.php';

class AuthController {
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function login() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['message' => 'Método não permitido.']);
            return;
        }

        $data = json_decode(file_get_contents('php://input'));

        if (!isset($data->email) || !isset($data->senha)) {
            http_response_code(400);
            echo json_encode(['message' => 'Email e senha são obrigatórios.']);
            return;
        }

        // Validar formato de email antes de ir ao banco
        $email = filter_var(trim($data->email), FILTER_VALIDATE_EMAIL);
        if (!$email) {
            // Mensagem genérica para não revelar informação
            http_response_code(401);
            echo json_encode(['message' => 'Credenciais inválidas.']);
            return;
        }

        $query = 'SELECT id, nome, perfil, senha, status FROM usuarios WHERE email = :email LIMIT 1';
        $stmt  = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        $row = $stmt->fetch();

        // SEGURANÇA: Mesma mensagem para email não encontrado e senha errada
        // Isso previne "user enumeration attacks"
        $genericError = 'Credenciais inválidas.';

        if (!$row) {
            // Simula custo de password_verify para evitar timing attack
            password_verify($data->senha, '$2y$10$invalidhashfortimingprotection!!!!!!!');
            http_response_code(401);
            echo json_encode(['message' => $genericError]);
            return;
        }

        if ($row['status'] == 0) {
            http_response_code(403);
            echo json_encode(['message' => 'Usuário inativo. Contate o administrador.']);
            return;
        }

        if (!password_verify($data->senha, $row['senha'])) {
            http_response_code(401);
            echo json_encode(['message' => $genericError]);
            return;
        }

        $jwtHandler = new JwtHandler();
        $payload = [
            'iss'  => 'jangadeiro_api',
            'iat'  => time(),
            'exp'  => time() + (60 * 60 * 8), // 8 horas (jornada de trabalho)
            'data' => [
                'id'     => (int)$row['id'],
                'nome'   => $row['nome'],
                'email'  => $email,
                'perfil' => $row['perfil'],
            ],
        ];

        $token = $jwtHandler->encode($payload);

        http_response_code(200);
        echo json_encode([
            'message'  => 'Login bem sucedido.',
            'token'    => $token,
            'usuario'  => $payload['data'],
        ]);
    }
}
?>
