<?php
require_once '../config/Database.php';
require_once '../middlewares/AuthMiddleware.php';
require_once '../utils/UploadHelper.php';

class AbastecimentoController {
    private $conn;
    private $uploadDir;

    private const COMBUSTIVEIS = ['Gasolina','Etanol','Diesel S10','Diesel Comum','GNV'];

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
        $this->uploadDir = realpath(__DIR__ . '/../../uploads/abastecimentos/');
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
            default:
                http_response_code(405);
                echo json_encode(["message" => "Método não permitido."]);
                break;
        }
    }

    private function getAll() {
        $userData = AuthMiddleware::authenticate();

        $query = "SELECT a.*, v.placa as veiculo_placa, v.modelo as veiculo_modelo, v.marca as veiculo_marca,
                         u.nome as motorista_nome
                  FROM abastecimentos a
                  LEFT JOIN veiculos v ON a.veiculo_id = v.id
                  LEFT JOIN usuarios u ON a.motorista_id = u.id
                  ORDER BY a.data_hora DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Motorista só vê os seus
        if ($userData['perfil'] === 'motorista') {
            $rows = array_filter($rows, fn($r) => $r['motorista_id'] == $userData['id']);
        }

        echo json_encode(array_values($rows));
    }

    private function create() {
        // Admin ou motorista podem registrar abastecimento
        $userData = AuthMiddleware::authenticate(['motorista', 'fiscal']);

        $veiculo_id       = isset($_POST['veiculo_id'])       ? intval($_POST['veiculo_id'])       : null;
        $cartao_frota_id  = isset($_POST['cartao_frota_id'])  ? intval($_POST['cartao_frota_id'])  : null;
        $km               = isset($_POST['km_abastecimento']) ? intval($_POST['km_abastecimento']) : null;
        $litros           = isset($_POST['litros'])           ? floatval($_POST['litros'])          : null;
        $valor_total      = isset($_POST['valor_total'])      ? floatval($_POST['valor_total'])     : null;
        $valor_litro      = isset($_POST['valor_litro'])      ? floatval($_POST['valor_litro'])     : null;
        $tipo_combustivel = isset($_POST['tipo_combustivel']) ? trim($_POST['tipo_combustivel'])    : null;

        if (!$veiculo_id || !$cartao_frota_id || !$km || !$litros || !$valor_total || !$valor_litro || !$tipo_combustivel) {
            http_response_code(400);
            echo json_encode(['message' => 'Dados incompletos.']);
            return;
        }

        // Validar enum de combustível
        if (!in_array($tipo_combustivel, self::COMBUSTIVEIS, true)) {
            http_response_code(400);
            echo json_encode(['message' => 'Tipo de combustível inválido.']);
            return;
        }

        // Cartão precisa pertencer ao veículo e estar ativo
        $stmtCard = $this->conn->prepare('SELECT id, veiculo_id, status FROM cartoes_frota WHERE id = :id LIMIT 1');
        $stmtCard->bindParam(':id', $cartao_frota_id, PDO::PARAM_INT);
        $stmtCard->execute();
        $cartao = $stmtCard->fetch(PDO::FETCH_ASSOC);

        if (!$cartao) {
            http_response_code(400);
            echo json_encode(['message' => 'Cartão de frota não encontrado.']);
            return;
        }

        if ((int)$cartao['veiculo_id'] !== $veiculo_id || (int)$cartao['status'] !== 1) {
            http_response_code(403);
            echo json_encode(['message' => 'Cartão inválido para este veículo.']);
            return;
        }

        // Veículo precisa estar com checklist de abertura ativo
        $stmtChecklist = $this->conn->prepare("SELECT tipo FROM checklists WHERE veiculo_id = :veiculo_id ORDER BY data_hora DESC, id DESC LIMIT 1");
        $stmtChecklist->bindParam(':veiculo_id', $veiculo_id, PDO::PARAM_INT);
        $stmtChecklist->execute();
        $ultimoChecklist = $stmtChecklist->fetch(PDO::FETCH_ASSOC);

        if (!$ultimoChecklist || $ultimoChecklist['tipo'] !== 'abertura') {
            http_response_code(403);
            echo json_encode(['message' => 'Este veículo está fechado. Faça o checklist de abertura antes de abastecer.']);
            return;
        }

        // Foto do cupom é obrigatória
        if (empty($_FILES['foto_cupom']['tmp_name'])) {
            http_response_code(400);
            echo json_encode(["message" => "Foto do cupom fiscal é obrigatória."]);
            return;
        }

        try {
            // Upload foto cupom com validação de MIME real
            $caminho_cupom = UploadHelper::save($_FILES['foto_cupom'], $this->uploadDir, 'cupom');

            // Upload foto bomba (opcional)
            $caminho_bomba = null;
            if (!empty($_FILES['foto_bomba']['tmp_name']) && $_FILES['foto_bomba']['error'] === UPLOAD_ERR_OK) {
                $caminho_bomba = UploadHelper::save($_FILES['foto_bomba'], $this->uploadDir, 'bomba');
            }

            $motorista_id = $userData['id'];
            $data_hora    = date('Y-m-d H:i:s');

            $query = "INSERT INTO abastecimentos 
                      (veiculo_id, cartao_frota_id, motorista_id, data_hora, km_abastecimento, litros, valor_total, valor_litro, tipo_combustivel, foto_cupom, foto_bomba)
                      VALUES (:veiculo_id, :cartao_frota_id, :motorista_id, :data_hora, :km, :litros, :valor_total, :valor_litro, :tipo_comb, :foto_cupom, :foto_bomba)";

            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':veiculo_id',   $veiculo_id);
            $stmt->bindParam(':cartao_frota_id', $cartao_frota_id);
            $stmt->bindParam(':motorista_id', $motorista_id);
            $stmt->bindParam(':data_hora',    $data_hora);
            $stmt->bindParam(':km',           $km);
            $stmt->bindParam(':litros',       $litros);
            $stmt->bindParam(':valor_total',  $valor_total);
            $stmt->bindParam(':valor_litro',  $valor_litro);
            $stmt->bindParam(':tipo_comb',    $tipo_combustivel);
            $stmt->bindParam(':foto_cupom',   $caminho_cupom);
            $stmt->bindParam(':foto_bomba',   $caminho_bomba);
            $stmt->execute();

            // Atualiza KM do veículo
            $upd = $this->conn->prepare("UPDATE veiculos SET km_atual = :km WHERE id = :id");
            $upd->bindParam(':km', $km);
            $upd->bindParam(':id', $veiculo_id);
            $upd->execute();

            http_response_code(201);
            echo json_encode(["message" => "Abastecimento registrado com sucesso."]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(["message" => "Erro: " . $e->getMessage()]);
        }
    }


}
?>
