<?php

/**
 * Helper seguro para upload de arquivos de imagem.
 * Valida extensão, MIME type real e tamanho máximo.
 */
class UploadHelper {

    // Extensões e MIME types permitidos
    private const ALLOWED_MIME = [
        'image/jpeg' => 'jpg',
        'image/jpg'  => 'jpg',
        'image/png'  => 'png',
        'image/gif'  => 'gif',
        'image/webp' => 'webp',
        'image/heic' => 'heic', // iOS
        'image/heif' => 'heif', // iOS
    ];

    private const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

    /**
     * Processa e salva um arquivo de upload.
     *
     * @param array  $file      Entrada do $_FILES
     * @param string $uploadDir Caminho absoluto do diretório de destino
     * @param string $prefix    Prefixo do nome do arquivo (ex: 'cupom', 'foto')
     * @return string|null      Caminho relativo salvo, ou null em caso de erro
     * @throws RuntimeException Em caso de erro de validação ou gravação
     */
    public static function save(array $file, string $uploadDir, string $prefix): ?string {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $erros = [
                UPLOAD_ERR_INI_SIZE   => 'Arquivo excede o tamanho máximo do servidor.',
                UPLOAD_ERR_FORM_SIZE  => 'Arquivo excede o tamanho máximo do formulário.',
                UPLOAD_ERR_PARTIAL    => 'Upload incompleto.',
                UPLOAD_ERR_NO_FILE    => 'Nenhum arquivo enviado.',
                UPLOAD_ERR_NO_TMP_DIR => 'Pasta temporária ausente.',
                UPLOAD_ERR_CANT_WRITE => 'Falha ao gravar em disco.',
            ];
            throw new RuntimeException($erros[$file['error']] ?? 'Erro desconhecido no upload.');
        }

        // Verificar tamanho
        if ($file['size'] > self::MAX_SIZE_BYTES) {
            throw new RuntimeException('Arquivo muito grande. Máximo permitido: 10 MB.');
        }

        // Verificar MIME type REAL (lê os bytes do arquivo, não confia no header do browser)
        $finfo    = new finfo(FILEINFO_MIME_TYPE);
        $mimeReal = $finfo->file($file['tmp_name']);

        if (!array_key_exists($mimeReal, self::ALLOWED_MIME)) {
            throw new RuntimeException("Tipo de arquivo não permitido ($mimeReal). Envie apenas imagens.");
        }

        $ext      = self::ALLOWED_MIME[$mimeReal];
        $filename = $prefix . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $dest     = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $filename;

        // Pasta precisa existir
        if (!is_dir($uploadDir)) {
            throw new RuntimeException('Diretório de upload não encontrado: ' . $uploadDir);
        }

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new RuntimeException('Falha ao mover o arquivo para o destino.');
        }

        // Determinar caminho relativo a partir do diretório raiz do projeto
        $docRoot = realpath($_SERVER['DOCUMENT_ROOT']);
        $destReal = realpath($dest);
        $relativePath = str_replace($docRoot . DIRECTORY_SEPARATOR, '', $destReal);

        return str_replace('\\', '/', $relativePath);
    }
}
?>
