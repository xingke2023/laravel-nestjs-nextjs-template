<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SsoUser extends Model
{
    public $timestamps = false;

    protected $fillable = ['sso_user_id', 'local_user_id'];

    public function localUser()
    {
        return $this->belongsTo(User::class, 'local_user_id');
    }
}
