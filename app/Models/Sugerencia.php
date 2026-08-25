<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sugerencia extends Model
{
    use HasFactory;

    protected $table = 'sugerencias';
    protected $primaryKey = 'id_sugerencia';

    public const CATEGORIAS = ['Sistema', 'Ambientes', 'Procesos', 'Otro'];
    public const ESTADOS = ['Pendiente', 'En revisión', 'Implementada', 'Rechazada'];

    protected $fillable = [
        'sugerencia_asunto',
        'sugerencia_body',
        'sugerencia_categoria',
        'sugerencia_status',
        'respuesta_admin',
        'responded_at',
        'fk_id_usuario',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_usuario', 'id_usuario');
    }
}
