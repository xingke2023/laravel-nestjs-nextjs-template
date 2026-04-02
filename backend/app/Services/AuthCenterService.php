<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class AuthCenterService
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = config('services.auth_center.url');
    }

    public function login(string $identifier, string $password): array
    {
        return $this->post('/auth/login', [
            'identifier' => $identifier,
            'password'   => $password,
        ]);
    }

    public function register(string $username, string $password, string $name, ?string $email = null): array
    {
        $data = compact('username', 'password', 'name');
        if ($email) $data['email'] = $email;

        return $this->post('/auth/register', $data);
    }

    public function refreshToken(string $refreshToken): array
    {
        return $this->post('/token/refresh', [
            'refreshToken' => $refreshToken,
        ]);
    }

    public function logout(string $refreshToken): array
    {
        return $this->post('/token/logout', [
            'refreshToken' => $refreshToken,
        ]);
    }

    private function post(string $path, array $data): array
    {
        $response = Http::baseUrl($this->baseUrl)
            ->timeout(10)
            ->post($path, $data);

        if ($response->failed()) {
            $body = $response->json();
            throw new \RuntimeException(
                $body['message'] ?? '认证中心请求失败',
                $response->status()
            );
        }

        return $response->json();
    }
}
