<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

use App\Models\Ingreso;
use App\Models\Novedad;
use App\Models\IngresoEquipo;
use CloudinaryLabs\CloudinaryLaravel\Facades\Cloudinary;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AdminController extends Controller
{
    public function index()
    {
        $users = User::with('role')->get();
        return response()->json($users); //CONSULTA DE TODOS LOS USUARIOS
    }

    public function getIngresos(Request $request)
    {
        $query = Ingreso::with('user');

        if ($request->filled('tipo')) {
            $query->where('ingreso_type', $request->tipo);
        }

        if ($request->filled('desde')) {
            $query->whereDate('ingreso_datetime', '>=', $request->desde);
        }

        if ($request->filled('hasta')) {
            $query->whereDate('ingreso_datetime', '<=', $request->hasta);
        }

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('ingreso_place', 'like', "%{$q}%")
                    ->orWhereHas('user', function ($u) use ($q) {
                        $u->where('user_name', 'like', "%{$q}%")
                          ->orWhere('user_lastname', 'like', "%{$q}%")
                          ->orWhere('user_email', 'like', "%{$q}%");
                    });
            });
        }

        $perPage = $request->integer('per_page', 15); //CANTIDAD DE REGISTROS POR PAGINA
        if ($perPage > 500) { $perPage = 500; } //LIMITE PARA EVITAR RESPUESTAS ENORMES

        $ingresos = $query->orderBy('ingreso_datetime', 'desc')
            ->paginate($perPage);

        return response()->json($ingresos);
    }

    public function exportIngresos(Request $request)
    {
        $query = Ingreso::with('user');

        if ($request->filled('tipo')) {
            $query->where('ingreso_type', $request->tipo);
        }

        if ($request->filled('desde')) {
            $query->whereDate('ingreso_datetime', '>=', $request->desde);
        }

        if ($request->filled('hasta')) {
            $query->whereDate('ingreso_datetime', '<=', $request->hasta);
        }

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('ingreso_place', 'like', "%{$q}%")
                    ->orWhereHas('user', function ($u) use ($q) {
                        $u->where('user_name', 'like', "%{$q}%")
                          ->orWhere('user_lastname', 'like', "%{$q}%")
                          ->orWhere('user_email', 'like', "%{$q}%");
                    });
            });
        }

        $ingresos = $query->orderBy('ingreso_datetime', 'desc')->get();
        $filename = 'historial_ingresos_' . Carbon::now('America/Bogota')->format('Y-m-d_His') . '.csv';

        return response()->streamDownload(function () use ($ingresos) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Usuario', 'Email', 'Identificación', 'Tipo', 'Lugar', 'Fecha y Hora']);
            foreach ($ingresos as $i) {
                fputcsv($handle, [
                    trim(($i->user->user_name ?? '') . ' ' . ($i->user->user_lastname ?? '')),
                    $i->user->user_email ?? '',
                    $i->user->user_identification ?? '',
                    $i->ingreso_type,
                    $i->ingreso_place,
                    $i->ingreso_datetime,
                ]);
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function stats()
    {
        $hoy = Carbon::now('America/Bogota')->toDateString();

        $ingresos_hoy = Ingreso::whereDate('ingreso_datetime', $hoy)->count();

        // Ingresos de los ultimos 7 dias agrupados por fecha y tipo
        $desde = Carbon::now('America/Bogota')->subDays(6)->startOfDay();
        $ingresos_por_dia = Ingreso::where('ingreso_datetime', '>=', $desde)
            ->select(
                DB::raw('DATE(ingreso_datetime) as fecha'),
                DB::raw("SUM(CASE WHEN ingreso_type = 'Entrada' THEN 1 ELSE 0 END) as entradas"),
                DB::raw("SUM(CASE WHEN ingreso_type = 'Salida' THEN 1 ELSE 0 END) as salidas")
            )
            ->groupBy(DB::raw('DATE(ingreso_datetime)'))
            ->orderBy('fecha')
            ->get();

        $ingresos_semana = [];
        for ($i = 0; $i < 7; $i++) {
            $fecha = $desde->copy()->addDays($i)->toDateString();
            $registro = $ingresos_por_dia->firstWhere('fecha', $fecha);
            $ingresos_semana[] = [
                'fecha' => $fecha,
                'entradas' => $registro ? (int) $registro->entradas : 0,
                'salidas' => $registro ? (int) $registro->salidas : 0,
            ];
        }

        $distribucion_por_tipo = Ingreso::select('ingreso_type', DB::raw('count(*) as total'))
            ->groupBy('ingreso_type')
            ->pluck('total', 'ingreso_type')
            ->toArray();

        // Ingresos agrupados por rol del usuario
        $distribucion_por_rol = Ingreso::join('usuarios', 'ingresos.fk_id_user', '=', 'usuarios.id_usuario')
            ->join('roles', 'usuarios.fk_id_rol', '=', 'roles.id_rol')
            ->select('roles.rol_name as rol', DB::raw('count(*) as total'))
            ->groupBy('roles.rol_name')
            ->get();

        $usuarios_totales = User::count();
        $equipos_activos = IngresoEquipo::where('equipo_status', 'Prestado')->count();
        $novedades_totales = Novedad::count();

        $ultimos_accesos = Ingreso::with('user')
            ->orderBy('ingreso_datetime', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'ingresos_hoy' => $ingresos_hoy,
            'ingresos_semana' => $ingresos_semana,
            'distribucion_por_tipo' => [
                'Entrada' => $distribucion_por_tipo['Entrada'] ?? 0,
                'Salida' => $distribucion_por_tipo['Salida'] ?? 0,
            ],
            'distribucion_por_rol' => $distribucion_por_rol,
            'usuarios_totales' => $usuarios_totales,
            'equipos_activos' => $equipos_activos,
            'novedades_totales' => $novedades_totales,
            'ultimos_accesos' => $ultimos_accesos,
        ]);
    }

    public function createUser(Request $request)
    { //VALIDACIONES PARA EL REGISTRO DE USUARIOS
        // Solo el Aprendiz tiene ficha y programa obligatorios.
        $esAprendiz = strcasecmp(Role::find($request->fk_id_rol)?->rol_name ?? '', 'Aprendiz') === 0; //VERIFICA SI EL ROL ES APRENDIZ
        $request->validate([
            'user_identification' => 'required|string|max:20|unique:usuarios', //VALIDA QUE EL USUARIO EXISTA
            'user_name' => 'required', //VALIDA QUE EL NOMBRE EXISTA
            'user_lastname' => 'required', //VALIDA QUE EL APELLIDO EXISTA
            'user_email' => 'required|email|unique:usuarios', //VALIDA QUE EL CORREO EXISTA
            'user_password' => 'required', //VALIDA QUE LA CONTRASEÑA EXISTA
            'user_coursenumber' => $esAprendiz ? 'required' : 'nullable', //FICHA SOLO OBLIGATORIA PARA APRENDIZ
            'user_program' => $esAprendiz ? 'required' : 'nullable', //PROGRAMA SOLO OBLIGATORIO PARA APRENDIZ
            'fk_id_rol' => 'required|exists:roles,id_rol',
            'image' => 'nullable|image|max:5120',
        ]);

        $profile_photo_path = null; //VALIDA QUE LA IMAGEN NO SE REPITAN
        if ($request->hasFile('image')) { //VALIDA QUE LA IMAGEN EXISTA
            $profile_photo_path = $request->file('image')->storeOnCloudinary('avatars')->getSecurePath(); //VALIDA QUE LA IMAGEN NO SE REPITAN
        }

        $user = User::create([ //CREA EL USUARIO
            'user_identification' => $request->user_identification,
            'user_name' => $request->user_name,
            'user_lastname' => $request->user_lastname,
            'user_email' => $request->user_email,
            'user_password' => Hash::make($request->user_password),
            'user_coursenumber' => $esAprendiz ? $request->user_coursenumber : null, //NULL PARA ADMIN/INSTRUCTOR
            'user_program' => $esAprendiz ? $request->user_program : null, //NULL PARA ADMIN/INSTRUCTOR
            'fk_id_rol' => $request->fk_id_rol,
            'profile_photo_path' => $profile_photo_path,
        ]);

        return response()->json($user->load('role'), 201);
    }

    public function deleteUser($id) //FUNCION PARA ELIMINAR USUARIO POR ID
    {
        $user = User::findOrFail($id);
        $user->delete(); //ELIMINA EL USUARIO
        return response()->json(['message' => 'Usuario eliminado']); //RETORNA MENSAJE DE ELIMINACION
    }

    public function updateUser(Request $request, $id) //FUNCION PARA ACTUALIZAR USUARIO
    {
        $user = User::findOrFail($id); //BUSCA EL USUARIO POR ID
        // Solo el Aprendiz tiene ficha y programa obligatorios.
        $esAprendiz = strcasecmp(Role::find($request->fk_id_rol)?->rol_name ?? '', 'Aprendiz') === 0; //VERIFICA SI EL ROL ES APRENDIZ
        
        $request->validate([
            'user_identification' => 'required|string|max:20|unique:usuarios,user_identification,' . $id . ',id_usuario',
            'user_name' => 'required',
            'user_lastname' => 'required',
            'user_email' => 'required|email|unique:usuarios,user_email,' . $id . ',id_usuario',
            'user_password' => 'nullable|min:6',
            'user_coursenumber' => $esAprendiz ? 'required' : 'nullable', //FICHA SOLO OBLIGATORIA PARA APRENDIZ
            'user_program' => $esAprendiz ? 'required' : 'nullable', //PROGRAMA SOLO OBLIGATORIO PARA APRENDIZ
            'fk_id_rol' => 'required|exists:roles,id_rol',
            'image' => 'nullable|image|max:5120',
        ]);
        //ACTUALIZA LA IMAGEN DEL USUARIO
        if ($request->hasFile('image')) { //VALIDA QUE LA IMAGEN EXISTA
            $profile_photo_path = $request->file('image')->storeOnCloudinary('avatars')->getSecurePath();
            $user->profile_photo_path = $profile_photo_path; //ACTUALIZA LA IMAGEN DEL USUARIO
        }

        $user->user_identification = $request->user_identification; //ACTUALIZA LA IDENTIFICACION DEL USUARIO
        $user->user_name = $request->user_name; //ACTUALIZA EL NOMBRE DEL USUARIO
        $user->user_lastname = $request->user_lastname; //ACTUALIZA EL APELLIDO DEL USUARIO
        $user->user_email = $request->user_email; //ACTUALIZA EL CORREO DEL USUARIO
        $user->user_coursenumber = $request->filled('user_coursenumber') ? $request->user_coursenumber : null; //FICHA (NULL PARA ADMIN/INSTRUCTOR)
        $user->user_program = $request->filled('user_program') ? $request->user_program : null; //PROGRAMA (NULL PARA ADMIN/INSTRUCTOR)
        $user->fk_id_rol = $request->fk_id_rol; //ACTUALIZA EL ROL DEL USUARIO

        if ($request->filled('user_password')) { //VALIDA QUE LA CONTRASEÑA EXISTA
            $user->user_password = Hash::make($request->user_password); //ACTUALIZA LA CONTRASEÑA DEL USUARIO
        }

        $user->save(); //GUARDA LOS CAMBIOS EN LA BASE DE DATOS

        return response()->json($user->load('role')); //RETORNA EL USUARIO ACTUALIZADO
    }

    public function getRoles() //FUNCION PARA OBTENER TODOS LOS ROLES
    {
        return response()->json(Role::all()); //RETORNA TODOS LOS ROLES
    }

    public function getMyIngresos(Request $request) //FUNCION PARA OBTENER MIS INGRESOS
    {
        $ingresos = Ingreso::where('fk_id_user', $request->user()->id_usuario) //BUSCA LOS INGRESOS DEL USUARIO
            ->with('user') //RELACIONA CON EL USUARIO
            ->orderBy('ingreso_datetime', 'desc') //ORDENA POR FECHA DESCENDENTE
            ->get(); //OBTIENE TODOS LOS INGRESOS
        return response()->json($ingresos); //RETORNA LOS INGRESOS
    }

    public function updateMyProfile(Request $request) //FUNCION PARA ACTUALIZAR MI PERFIL
    {
        $user = $request->user(); //OBTIENE EL USUARIO ACTUAL
        $user->loadMissing('role'); //ASEGURA LA RELACION CON EL ROL
        // Solo el Aprendiz tiene ficha y programa; admin e instructor los dejan en null.
        $esAprendiz = strcasecmp($user->role->rol_name ?? '', 'Aprendiz') === 0; //VERIFICA SI ES APRENDIZ
        
        $request->validate([ //VALIDA QUE LA INFORMACION SEA CORRECTA
            'user_identification' => 'required|string|max:20|unique:usuarios,user_identification,' . $user->id_usuario . ',id_usuario', //VALIDA QUE LA IDENTIFICACION NO SE REPITA
            'user_name' => 'required', //VALIDA QUE EL NOMBRE EXISTA
            'user_lastname' => 'required', //VALIDA QUE EL APELLIDO EXISTA
            'user_email' => 'required|email|unique:usuarios,user_email,' . $user->id_usuario . ',id_usuario', //VALIDA QUE EL CORREO EXISTA
            'user_password' => 'nullable|min:6', //VALIDA QUE LA CONTRASEÑA EXISTA
            'user_coursenumber' => $esAprendiz ? 'required' : 'nullable', //FICHA SOLO OBLIGATORIA PARA APRENDIZ
            'user_program' => $esAprendiz ? 'required' : 'nullable', //PROGRAMA SOLO OBLIGATORIO PARA APRENDIZ
            'image' => 'nullable|image|max:5120', //VALIDA QUE LA IMAGEN EXISTA
        ]);

        if ($request->hasFile('image')) { //VALIDA QUE LA IMAGEN EXISTA
            $profile_photo_path = $request->file('image')->storeOnCloudinary('avatars')->getSecurePath(); //VALIDA QUE LA IMAGEN NO SE REPITAN
            $user->profile_photo_path = $profile_photo_path; //ACTUALIZA LA IMAGEN DEL USUARIO
        }

        $user->user_identification = $request->user_identification; //ACTUALIZA LA IDENTIFICACION DEL USUARIO
        $user->user_name = $request->user_name; //ACTUALIZA EL NOMBRE DEL USUARIO
        $user->user_lastname = $request->user_lastname; //ACTUALIZA EL APELLIDO DEL USUARIO
        $user->user_email = $request->user_email; //ACTUALIZA EL CORREO DEL USUARIO
        $user->user_coursenumber = $request->filled('user_coursenumber') ? $request->user_coursenumber : null; //FICHA (NULL PARA ADMIN/INSTRUCTOR)
        $user->user_program = $request->filled('user_program') ? $request->user_program : null; //PROGRAMA (NULL PARA ADMIN/INSTRUCTOR)

        if ($request->filled('user_password')) { //VALIDA QUE LA CONTRASEÑA EXISTA
            $user->user_password = Hash::make($request->user_password); //ACTUALIZA LA CONTRASEÑA DEL USUARIO
        }

        $user->save(); //GUARDA LOS CAMBIOS EN LA BASE DE DATOS

        return response()->json($user->load('role')); //RETORNA EL USUARIO ACTUALIZADO
    }

    public function myStats(Request $request) //ESTADÍSTICAS PERSONALES DEL USUARIO AUTENTICADO
    {
        $user = $request->user();
        $hoy = Carbon::now('America/Bogota')->toDateString();

        $ingresos_hoy = Ingreso::where('fk_id_user', $user->id_usuario)
            ->whereDate('ingreso_datetime', $hoy)
            ->count();

        // Ingresos del usuario en los ultimos 7 dias agrupados por fecha y tipo
        $desde = Carbon::now('America/Bogota')->subDays(6)->startOfDay();
        $ingresos_por_dia = Ingreso::where('fk_id_user', $user->id_usuario)
            ->where('ingreso_datetime', '>=', $desde)
            ->select(
                DB::raw('DATE(ingreso_datetime) as fecha'),
                DB::raw("SUM(CASE WHEN ingreso_type = 'Entrada' THEN 1 ELSE 0 END) as entradas"),
                DB::raw("SUM(CASE WHEN ingreso_type = 'Salida' THEN 1 ELSE 0 END) as salidas")
            )
            ->groupBy(DB::raw('DATE(ingreso_datetime)'))
            ->orderBy('fecha')
            ->get();

        $ingresos_semana = [];
        for ($i = 0; $i < 7; $i++) {
            $fecha = $desde->copy()->addDays($i)->toDateString();
            $registro = $ingresos_por_dia->firstWhere('fecha', $fecha);
            $ingresos_semana[] = [
                'fecha' => $fecha,
                'entradas' => $registro ? (int) $registro->entradas : 0,
                'salidas' => $registro ? (int) $registro->salidas : 0,
            ];
        }

        $distribucion_por_tipo = Ingreso::where('fk_id_user', $user->id_usuario)
            ->select('ingreso_type', DB::raw('count(*) as total'))
            ->groupBy('ingreso_type')
            ->pluck('total', 'ingreso_type')
            ->toArray();

        $novedades_totales = Novedad::where('fk_id_usuario', $user->id_usuario)->count();

        $ultimos_accesos = Ingreso::with('user')
            ->where('fk_id_user', $user->id_usuario)
            ->orderBy('ingreso_datetime', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'ingresos_hoy' => $ingresos_hoy,
            'ingresos_semana' => $ingresos_semana,
            'distribucion_por_tipo' => [
                'Entrada' => $distribucion_por_tipo['Entrada'] ?? 0,
                'Salida' => $distribucion_por_tipo['Salida'] ?? 0,
            ],
            'novedades_totales' => $novedades_totales,
            'ultimos_accesos' => $ultimos_accesos,
        ]);
    }
}
