<?php

class JwtHandler {
    private string $secret;

    public function __construct() {
        $config = require __DIR__ . '/../config/.env.php';
        $this->secret = $config['jwt_secret'];
    }

    public function encode(array $payload): string {
        $header           = $this->base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $encodedPayload   = $this->base64url_encode(json_encode($payload));
        $signature        = $this->sign($header . '.' . $encodedPayload);
        return $header . '.' . $encodedPayload . '.' . $signature;
    }

    public function decode(string $jwt): array|false {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) return false;

        [$headerB64, $payloadB64, $sigProvided] = $parts;

        // Verificar assinatura com comparação segura contra timing attacks
        $expectedSig = $this->sign($headerB64 . '.' . $payloadB64);
        if (!hash_equals($expectedSig, $sigProvided)) return false;

        $decoded = json_decode(base64_decode(strtr($payloadB64, '-_', '+/')), true);
        if (!$decoded) return false;

        // Verificar expiração
        if (isset($decoded['exp']) && $decoded['exp'] < time()) return false;

        // Verificar emissão no futuro (clock skew protection)
        if (isset($decoded['iat']) && $decoded['iat'] > time() + 60) return false;

        return $decoded;
    }

    private function sign(string $data): string {
        return $this->base64url_encode(
            hash_hmac('sha256', $data, $this->secret, true)
        );
    }

    private function base64url_encode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
?>
