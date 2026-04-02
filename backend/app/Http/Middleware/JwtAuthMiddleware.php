<?php

namespace App\Http\Middleware;

use App\Models\SsoUser;
use App\Models\User;
use Closure;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class JwtAuthMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->extractToken($request);

        if (!$token) {
            return response()->json(['message' => 'Token not provided'], 401);
        }

        try {
            $payload = JWT::decode($token, new Key(config('jwt.secret'), config('jwt.algo')));
        } catch (ExpiredException) {
            return response()->json(['message' => 'Token expired'], 401);
        } catch (SignatureInvalidException) {
            return response()->json(['message' => 'Token signature invalid'], 401);
        } catch (\Exception) {
            return response()->json(['message' => 'Token invalid'], 401);
        }

        $user = $this->resolveLocalUser($payload);

        $request->attributes->set('jwt_payload', $payload);
        $request->attributes->set('current_user', $user);

        return $next($request);
    }

    private function resolveLocalUser(object $payload): User
    {
        $ssoUserId = $payload->userId;

        $mapping = SsoUser::where('sso_user_id', $ssoUserId)->first();

        if ($mapping) {
            return $mapping->localUser;
        }

        $user = User::create([
            'name'  => $payload->name ?? '',
            'email' => $payload->email ?? null,
        ]);

        SsoUser::create([
            'sso_user_id'   => $ssoUserId,
            'local_user_id' => $user->id,
        ]);

        return $user;
    }

    private function extractToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');
        if (str_starts_with($header, 'Bearer ')) {
            return substr($header, 7);
        }
        return null;
    }
}
