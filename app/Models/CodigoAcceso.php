<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Codigo temporal (QR + PIN) para que porteria registre la Entrada del
// usuario que lo genero desde la web. Un solo uso y 5 minutos de vigencia.
class CodigoAcceso extends Model
{
    protected $table = 'codigos_acceso';

    protected $fillable = [
        'fk_id_usuario',
        'token',
        'pin',
        'tipo',
        'expira_en',
        'usado_en',
    ];

    protected $casts = [
        'expira_en' => 'datetime',
        'usado_en' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_usuario', 'id_usuario');
    }
}
