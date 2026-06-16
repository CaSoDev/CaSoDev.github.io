<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: OPTIONS,GET,POST,PUT,DELETE');
header('Access-Control-Max-Age: 3600');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
// Headers de segurança HTTP
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Roteamento
$endpoint = $_GET['endpoint'] ?? '';

if ($endpoint === '') {
    $request_uri = explode('?', $_SERVER['REQUEST_URI'], 2)[0];
    $uri_parts   = explode('/', trim($request_uri, '/'));
    $endpoint    = $uri_parts[count($uri_parts) - 1] ?? '';
}

// Handler global de exceções não capturadas
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    $config = require __DIR__ . '/../config/.env.php';
    if ($config['app_env'] === 'development') {
        echo json_encode(['message' => 'Erro interno: ' . $e->getMessage()]);
    } else {
        echo json_encode(['message' => 'Erro interno no servidor.']);
    }
});

switch ($endpoint) {
    case 'login':
        require_once '../controllers/AuthController.php';
        (new AuthController())->login();
        break;
    case 'usuarios':
        require_once '../controllers/UsuarioController.php';
        (new UsuarioController())->handleRequest();
        break;
    case 'veiculos':
        require_once '../controllers/VeiculoController.php';
        (new VeiculoController())->handleRequest();
        break;
    case 'checklists':
        require_once '../controllers/ChecklistController.php';
        (new ChecklistController())->handleRequest();
        break;
    case 'abastecimentos':
        require_once '../controllers/AbastecimentoController.php';
        (new AbastecimentoController())->handleRequest();
        break;
    case 'cartoes-frota':
        require_once '../controllers/CartaoFrotaController.php';
        (new CartaoFrotaController())->handleRequest();
        break;
    default:
        http_response_code(404);
        echo json_encode(['message' => 'Endpoint não encontrado.']);
        break;
}
?>
