<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SsoUser;
use App\Models\User;
use App\Services\AuthCenterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private AuthCenterService $authCenter) {}

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $identifier = $request->input('identifier') ?? $request->input('login');
        if (empty($identifier)) {
            return response()->json(['message' => 'The identifier field is required.'], 422);
        }

        try {
            $result = $this->authCenter->login(
                $identifier,
                $request->password
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 401);
        }

        $user = $this->syncUser($result['data']['user']);

        return response()->json([
            'accessToken'  => $result['data']['accessToken'],
            'refreshToken' => $result['data']['refreshToken'],
            'user'         => $user,
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        try {
            $result = $this->authCenter->register(
                $request->username,
                $request->password,
                $request->username,
                null
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 422);
        }

        $user = $this->syncUser($result['data']['user']);

        return response()->json([
            'accessToken'  => $result['data']['accessToken'],
            'refreshToken' => $result['data']['refreshToken'],
            'user'         => $user,
        ], 201);
    }

    public function refresh(Request $request): JsonResponse
    {
        $request->validate([
            'refreshToken' => 'required|string',
        ]);

        try {
            $result = $this->authCenter->refreshToken($request->refreshToken);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 401);
        }

        return response()->json([
            'accessToken'  => $result['data']['accessToken'],
            'refreshToken' => $result['data']['refreshToken'],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->validate([
            'refreshToken' => 'required|string',
        ]);

        try {
            $this->authCenter->logout($request->refreshToken);
        } catch (\RuntimeException $e) {
            // 登出失败不影响前端清除本地 Token
        }

        return response()->json(['message' => 'Logged out successfully']);
    }

    private function syncUser(array $authUser): User
    {
        $mapping = SsoUser::where('sso_user_id', $authUser['id'])->first();

        if ($mapping) {
            return tap($mapping->localUser, function (User $user) use ($authUser) {
                $user->update([
                    'name'     => $authUser['name'],
                    'username' => $authUser['username'],
                    'email'    => $authUser['email'] ?? $user->email,
                ]);
            });
        }

        $user = User::create([
            'username' => $authUser['username'],
            'name'     => $authUser['name'],
            'email'    => $authUser['email'] ?? null,
        ]);

        SsoUser::create([
            'sso_user_id'   => $authUser['id'],
            'local_user_id' => $user->id,
        ]);

        return $user;
    }
}
