<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WebauthnChallenge extends Model
{
    use HasFactory;

    protected $table = 'webauthn_challenges';

    protected $fillable = [
        'user_id',
        'challenge',
        'purpose',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];
}