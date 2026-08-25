<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AprendizInstructor extends Model
{
    use HasFactory;

    protected $table = 'aprendiz_instructor';
    protected $primaryKey = 'id_asignacion';

    protected $fillable = [
        'fk_id_aprendiz',
        'fk_id_instructor',
        'jornada',
    ];

    public function aprendiz()
    {
        return $this->belongsTo(User::class, 'fk_id_aprendiz', 'id_usuario');
    }

    public function instructor()
    {
        return $this->belongsTo(User::class, 'fk_id_instructor', 'id_usuario');
    }
}