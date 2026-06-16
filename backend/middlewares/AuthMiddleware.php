<?php
require_once __DIR__ . '/../utils/JwtHandler.php';

class AuthMiddleware {

    /**
     * Autentica e autoriza a requisição.
     *
     * @param string|array|null $allowedProfiles Perfil(is) permitidos.
     *        Exemplo: 'admin', ['admin','fiscal'], null (qualquer autenticado)
     * @return array Dados do usuário decodificados do token
     */
    public static function authenticate($allowedProfiles = null): array {
        // Suporte a diferentes servidores para buscar o header Authorization
        $authHeader = null;
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        }

        if (!$authHeader) {
            http_response_code(401);
            echo json_encode(['message' => 'Token não fornecido.']);
            exit;
        }

        if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
            http_response_code(401);
            echo json_encode(['message' => 'Formato de token inválido.']);
            exit;
        }

        $token      = $matches[1];
        $jwtHandler = new JwtHandler();
        $decoded    = $jwtHandler->decode($token);

        if (!$decoded || !isset($decoded['data'])) {
            http_response_code(401);
            echo json_encode(['message' => 'Token inválido ou expirado. Faça login novamente.']);
            exit;
        }

        $user = $decoded['data'];

        // Verificar perfil se exigido
        if ($allowedProfiles !== null) {
            $allowed = is_array($allowedProfiles) ? $allowedProfiles : [$allowedProfiles];
            // Admin sempre tem acesso a tudo
            if (!in_array($user['perfil'], $allowed) && $user['perfil'] !== 'admin') {
                http_response_code(403);
                echo json_encode(['message' => 'Acesso negado. Permissão insuficiente.']);
                exit;
            }
        }

        return $user;
    }
}
?>
