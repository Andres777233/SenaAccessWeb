<?php

namespace App\Http\Controllers;

use App\Models\AprendizInstructor;
use App\Models\User;
use Illuminate\Http\Request;

class AprendizInstructorController extends Controller
{
    public function index()
    {
        $asignaciones = AprendizInstructor::with(['aprendiz', 'instructor'])
            ->orderBy('fk_id_aprendiz')
            ->get();
        return response()->json($asignaciones);
    }

    public function store(Request $request)
    {
        $request->validate([
            'fk_id_aprendiz' => 'required|exists:usuarios,id_usuario',
            'fk_id_instructor' => 'required|exists:usuarios,id_usuario',
            'jornada' => 'nullable|string|in:Mañana,Tarde,Noche',
        ]);

        $aprendiz = User::findOrFail($request->fk_id_aprendiz);
        if (strtolower($aprendiz->role?->rol_name) !== 'aprendiz') {
            return response()->json(['message' => 'El usuario seleccionado no es un aprendiz'], 422);
        }

        $instructor = User::findOrFail($request->fk_id_instructor);
        if (strtolower($instructor->role?->rol_name) !== 'instructor') {
            return response()->json(['message' => 'El usuario seleccionado no es un instructor'], 422);
        }

        $asignacion = AprendizInstructor::updateOrCreate(
            [
                'fk_id_aprendiz' => $request->fk_id_aprendiz,
                'fk_id_instructor' => $request->fk_id_instructor,
            ],
            [
                'jornada' => $request->jornada,
            ]
        );

        return response()->json($asignacion->load(['aprendiz', 'instructor']), 201);
    }

    public function destroy($id)
    {
        $asignacion = AprendizInstructor::findOrFail($id);
        $asignacion->delete();
        return response()->json(['message' => 'Asignación eliminada correctamente']);
    }
}