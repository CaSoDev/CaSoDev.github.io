<?php
require_once '../config/Database.php';
require_once '../middlewares/AuthMiddleware.php';
require_once '../utils/UploadHelper.php';

class ChecklistController {
    private $conn;
    private $uploadDir;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
        $this->uploadDir = realpath(__DIR__ . '/../../uploads/fotos/');
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

        if (isset($_GET['id'])) {
            $id = intval($_GET['id']);
            $query = "SELECT c.*, v.placa as veiculo_placa, v.marca as veiculo_marca, v.modelo as veiculo_modelo, v.ano as veiculo_ano,
                             m.nome as motorista_nome, f.nome as fiscal_nome 
                      FROM checklists c 
                      LEFT JOIN veiculos v ON c.veiculo_id = v.id 
                      LEFT JOIN usuarios m ON c.motorista_id = m.id 
                      LEFT JOIN usuarios f ON c.fiscal_id = f.id 
                      WHERE c.id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $checklist = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$checklist) {
                http_response_code(404);
                echo json_encode(["message" => "Checklist não encontrado."]);
                return;
            }

            if ($userData['perfil'] === 'motorista' && $checklist['motorista_id'] != $userData['id']) {
                http_response_code(403);
                echo json_encode(["message" => "Acesso negado."]);
                return;
            }
            if ($userData['perfil'] === 'fiscal' && $checklist['fiscal_id'] != $userData['id']) {
                http_response_code(403);
                echo json_encode(["message" => "Acesso negado."]);
                return;
            }

            // Busca os itens do checklist
            $query_itens = "SELECT * FROM checklist_itens WHERE checklist_id = :checklist_id";
            $stmt_itens = $this->conn->prepare($query_itens);
            $stmt_itens->bindParam(':checklist_id', $id, PDO::PARAM_INT);
            $stmt_itens->execute();
            $checklist['itens'] = $stmt_itens->fetchAll(PDO::FETCH_ASSOC);

            // Busca as fotos do checklist
            $query_fotos = "SELECT * FROM checklist_fotos WHERE checklist_id = :checklist_id";
            $stmt_fotos = $this->conn->prepare($query_fotos);
            $stmt_fotos->bindParam(':checklist_id', $id, PDO::PARAM_INT);
            $stmt_fotos->execute();
            $checklist['fotos'] = $stmt_fotos->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($checklist);
            return;
        }

        $query = "SELECT c.*, v.placa as veiculo_placa, m.nome as motorista_nome, f.nome as fiscal_nome 
                  FROM checklists c 
                  LEFT JOIN veiculos v ON c.veiculo_id = v.id 
                  LEFT JOIN usuarios m ON c.motorista_id = m.id 
                  LEFT JOIN usuarios f ON c.fiscal_id = f.id 
                  ORDER BY c.data_hora DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $checklists = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if ($userData['perfil'] === 'motorista') {
            $checklists = array_filter($checklists, function($c) use ($userData) {
                return $c['motorista_id'] == $userData['id'];
            });
        } elseif ($userData['perfil'] === 'fiscal') {
            $checklists = array_filter($checklists, function($c) use ($userData) {
                return $c['fiscal_id'] == $userData['id'];
            });
        }

        echo json_encode(array_values($checklists));
    }

    private function create() {
        // Fiscal ou admin podem criar checklist
        $userData = AuthMiddleware::authenticate(['fiscal']);
        
        // Agora recebemos multipart/form-data (para suportar upload de arquivos)
        // Dados gerais chegam em $_POST e arquivos em $_FILES
        $veiculo_id       = isset($_POST['veiculo_id'])   ? intval($_POST['veiculo_id'])   : null;
        $motorista_id     = isset($_POST['motorista_id']) ? intval($_POST['motorista_id']) : null;
        $tipo             = isset($_POST['tipo'])          ? $_POST['tipo']                 : null;
        $km_registrado    = isset($_POST['km_registrado'])? intval($_POST['km_registrado']): null;
        $itens_json       = isset($_POST['itens'])         ? $_POST['itens']                : '[]';
        $assinatura_fiscal     = isset($_POST['assinatura_fiscal'])    ? $_POST['assinatura_fiscal']    : '';
        $assinatura_motorista  = isset($_POST['assinatura_motorista']) ? $_POST['assinatura_motorista'] : '';

        if (!$veiculo_id || !$motorista_id || !$tipo || !$km_registrado) {
            http_response_code(400);
            echo json_encode(["message" => "Dados incompletos."]);
            return;
        }

        $itens = json_decode($itens_json, true);

        try {
            $this->conn->beginTransaction();

            // Insere o checklist principal
            $query = "INSERT INTO checklists (veiculo_id, fiscal_id, motorista_id, tipo, data_hora, km_registrado, assinatura_fiscal, assinatura_motorista, status) 
                      VALUES (:veiculo_id, :fiscal_id, :motorista_id, :tipo, NOW(), :km_registrado, :assinatura_fiscal, :assinatura_motorista, 'concluido')";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':veiculo_id',       $veiculo_id);
            $stmt->bindParam(':fiscal_id',        $userData['id']);
            $stmt->bindParam(':motorista_id',     $motorista_id);
            $stmt->bindParam(':tipo',             $tipo);
            $stmt->bindParam(':km_registrado',    $km_registrado);
            $stmt->bindParam(':assinatura_fiscal',    $assinatura_fiscal);
            $stmt->bindParam(':assinatura_motorista', $assinatura_motorista);
            $stmt->execute();

            $checklist_id = $this->conn->lastInsertId();

            // Atualiza KM do veículo
            $stmt_km = $this->conn->prepare("UPDATE veiculos SET km_atual = :km WHERE id = :id");
            $stmt_km->bindParam(':km', $km_registrado);
            $stmt_km->bindParam(':id', $veiculo_id);
            $stmt_km->execute();

            // Salva os itens de inspeção
            if (!empty($itens)) {
                $query_item = "INSERT INTO checklist_itens (checklist_id, nome_item, status_item, observacao) VALUES (:checklist_id, :nome_item, :status_item, :observacao)";
                $stmt_item = $this->conn->prepare($query_item);

                foreach ($itens as $item) {
                    $obs = isset($item['observacao']) ? $item['observacao'] : '';
                    $nome = $item['nome_item'];
                    $status = $item['status_item'];
                    $stmt_item->bindParam(':checklist_id', $checklist_id);
                    $stmt_item->bindParam(':nome_item',    $nome);
                    $stmt_item->bindParam(':status_item',  $status);
                    $stmt_item->bindParam(':observacao',   $obs);
                    $stmt_item->execute();
                }
            }

            // Salva as fotos (arquivos físicos) com validação segura
            if (!empty($_FILES['fotos'])) {
                $query_foto = 'INSERT INTO checklist_fotos (checklist_id, tipo_foto, caminho_arquivo) VALUES (:checklist_id, :tipo_foto, :caminho)';
                $stmt_foto  = $this->conn->prepare($query_foto);

                $fotos      = $_FILES['fotos'];
                $totalFotos = is_array($fotos['name']) ? count($fotos['name']) : 0;

                for ($i = 0; $i < $totalFotos; $i++) {
                    if ($fotos['error'][$i] !== UPLOAD_ERR_OK) continue;

                    // Re-montar array single-file para o UploadHelper
                    $singleFile = [
                        'name'     => $fotos['name'][$i],
                        'type'     => $fotos['type'][$i],
                        'tmp_name' => $fotos['tmp_name'][$i],
                        'error'    => $fotos['error'][$i],
                        'size'     => $fotos['size'][$i],
                    ];

                    try {
                        $caminho_relativo = UploadHelper::save($singleFile, $this->uploadDir, 'foto');
                        $tipo_foto = 'adicional';
                        $stmt_foto->bindParam(':checklist_id', $checklist_id);
                        $stmt_foto->bindParam(':tipo_foto',    $tipo_foto);
                        $stmt_foto->bindParam(':caminho',      $caminho_relativo);
                        $stmt_foto->execute();
                    } catch (RuntimeException $uploadEx) {
                        // Log e continua (não cancela o checklist por falha de foto)
                        error_log('Erro ao salvar foto do checklist: ' . $uploadEx->getMessage());
                    }
                }
            }

            $this->conn->commit();

            http_response_code(201);
            echo json_encode(["message" => "Checklist registrado com sucesso.", "id" => $checklist_id]);

        } catch (Exception $e) {
            $this->conn->rollBack();
            http_response_code(400);
            echo json_encode(["message" => "Erro ao registrar checklist: " . $e->getMessage()]);
        }
    }
}
?>
