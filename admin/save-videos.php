<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'erro' => 'Método não permitido.']);
    exit;
}

$corpo = file_get_contents('php://input');
// Decodifica como stdClass (sem "true") para preservar a distinção entre objeto {} e array [] do JSON original
$dados = json_decode($corpo);

if (!is_object($dados) || json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'erro' => 'JSON inválido.']);
    exit;
}

$destino = __DIR__ . '/../assets/json/videos.json';
$conteudo = json_encode($dados, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

if ($conteudo === false || file_put_contents($destino, $conteudo, LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'erro' => 'Falha ao gravar o arquivo no servidor.']);
    exit;
}

echo json_encode(['ok' => true]);
