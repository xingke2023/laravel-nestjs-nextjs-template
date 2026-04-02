<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// 公开接口
Route::get('/health', fn() => response()->json(['status' => 'ok']));

// 认证（无需 JWT）
Route::prefix('auth')->group(function () {
    Route::post('/login',    [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
});
Route::post('/token/refresh', [AuthController::class, 'refresh']);

// 需要 JWT 认证的接口
Route::middleware('jwt.auth')->group(function () {
    Route::post('/token/logout', [AuthController::class, 'logout']);

    Route::get('/me', function (Request $request) {
        return response()->json($request->attributes->get('current_user'));
    });
});
