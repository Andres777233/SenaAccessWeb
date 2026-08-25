<?php

namespace App\Http\Controllers;

use App\Models\Sugerencia;
use App\Models\Notificacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class SugerenciaController extends Controller
{
    public const MAX_POR_DIA = 3; //LIMITE ANTI-SPAM DE SUGERENCIAS POR USUARIO AL DIA

    //BANDEJA SEGUN EL ROL: EL ADMIN VE TODAS (FILTRABLE Y PAGINADA), LOS DEMAS SOLO LAS PROPIAS
    public function index(Request $request)
    {
        $esAdmin = Auth::user()->role->rol_name === 'admin'; //VALIDA SI EL USUARIO ES ADMIN

        $query = Sugerencia::with('user'); //CARGA EL AUTOR DE CADA SUGERENCIA

        if (!$esAdmin) { //SI NO ES ADMIN SOLO VE SUS PROPIAS SUGERENCIAS
            $query->where('fk_id_usuario', Auth::id()); //FILTRA POR EL USUARIO AUTENTICADO

            $sugerencias = $query->orderBy('created_at', 'desc')->get(); //OBTIENE LAS SUGERENCIAS ORDENADAS POR FECHA
            return response()->json($sugerencias); //RETORNA LAS SUGERENCIAS
        }

        if ($search = $request->query('q')) { //BUSCADOR POR ASUNTO, DESCRIPCION O AUTOR
            $query->where(function ($q) use ($search) {
                $q->where('sugerencia_asunto', 'like', "%{$search}%")
                  ->orWhere('sugerencia_body', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($u) use ($search) {
                      $u->where('user_name', 'like', "%{$search}%")
                        ->orWhere('user_lastname', 'like', "%{$search}%");
                  });
            });
        }

        if ($status = $request->query('status')) { //FILTRO POR ESTADO
            $query->where('sugerencia_status', $status);
        }

        if ($categoria = $request->query('categoria')) { //FILTRO POR CATEGORIA
            $query->where('sugerencia_categoria', $categoria);
        }

        $sugerencias = $query->orderBy('created_at', 'desc')->paginate($request->query('per_page', 15)); //PAGINA 15 POR DEFECTO
        return response()->json($sugerencias); //RETORNA LA RESPUESTA ESTANDAR DE PAGINATE
    }

    //FUNCION PARA OBTENER MIS SUGERENCIAS
    public function getMySugerencias()
    {
        $sugerencias = Sugerencia::with('user')->where('fk_id_usuario', Auth::id())->orderBy('created_at', 'desc')->get(); //OBTIENE LAS SUGERENCIAS DEL USUARIO
        return response()->json($sugerencias); //RETORNA LAS SUGERENCIAS
    }

    //FUNCION PARA CREAR UNA NUEVA SUGERENCIA (CUALQUIER ROL AUTENTICADO)
    public function store(Request $request)
    {
        $enviadasHoy = Sugerencia::where('fk_id_usuario', Auth::id())->whereDate('created_at', today())->count(); //CUENTA LAS SUGERENCIAS DEL DIA
        if ($enviadasHoy >= self::MAX_POR_DIA) { //VALIDA EL LIMITE ANTI-SPAM
            throw ValidationException::withMessages([
                'sugerencia_body' => ['Has alcanzado el límite de ' . self::MAX_POR_DIA . ' sugerencias por día. Intenta nuevamente mañana.'],
            ]);
        }

        $request->validate([
            'sugerencia_asunto' => 'required|string|max:150',
            'sugerencia_body' => 'required|string|max:5000',
            'sugerencia_categoria' => 'required|in:' . implode(',', Sugerencia::CATEGORIAS),
        ]);

        $sugerencia = Sugerencia::create([
            'sugerencia_asunto' => $request->sugerencia_asunto,
            'sugerencia_body' => $request->sugerencia_body,
            'sugerencia_categoria' => $request->sugerencia_categoria,
            'sugerencia_status' => 'Pendiente',
            'fk_id_usuario' => Auth::id(),
        ]);

        // Notificar a los admins sobre la nueva sugerencia
        $autor = Auth::user();
        Notificacion::notifyAdmins(
            'Nueva sugerencia recibida',
            ($autor ? $autor->user_name . ' ' . $autor->user_lastname : 'Un usuario') . ' sugirió: ' . $request->sugerencia_asunto,
            'sugerencia'
        );

        return response()->json($sugerencia, 201);
    }

    //EL ADMIN RESPONDE UNA SUGERENCIA Y/O ACTUALIZA SU ESTADO
    public function respond(Request $request, $id)
    {
        $sugerencia = Sugerencia::findOrFail($id); //OBTIENE LA SUGERENCIA

        // SOLO EL ADMIN PUEDE RESPONDER
        if (Auth::user()->role->rol_name !== 'admin') { //VALIDA QUE EL USUARIO SEA ADMIN
            return response()->json(['message' => 'No tienes permiso para responder sugerencias'], 403);
        }

        $request->validate([
            'respuesta_admin' => 'required|string|max:5000',
            'sugerencia_status' => 'required|in:' . implode(',', Sugerencia::ESTADOS),
        ]);

        $sugerencia->update([
            'respuesta_admin' => $request->respuesta_admin,
            'sugerencia_status' => $request->sugerencia_status,
            'responded_at' => now(),
        ]);

        // Notificar al autor que su sugerencia fue respondida
        Notificacion::create([
            'fk_id_usuario' => $sugerencia->fk_id_usuario,
            'notification_title' => 'Tu sugerencia fue respondida',
            'notification_body' => '"' . $sugerencia->sugerencia_asunto . '" ahora está: ' . $sugerencia->sugerencia_status,
            'notification_type' => 'sugerencia',
        ]);

        return response()->json($sugerencia->load('user'));
    }

    public function destroy($id)
    {
        $sugerencia = Sugerencia::findOrFail($id);

        // SOLO EL ADMIN PUEDE ELIMINAR
        if (Auth::user()->role->rol_name !== 'admin') {
            return response()->json(['message' => 'No tienes permiso para eliminar esta sugerencia'], 403);
        }

        $sugerencia->delete(); // ELIMINA LA SUGERENCIA POR ID

        return response()->json(['message' => 'Sugerencia eliminada correctamente']);
    }
}
