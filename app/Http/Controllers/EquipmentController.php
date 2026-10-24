<?php

namespace App\Http\Controllers;

use App\Models\IngresoEquipo;
use App\Models\Notificacion;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class EquipmentController extends Controller
{
    public function store(Request $request)
    {
        // Admin o portero pueden registrar equipos (comparación insensible a mayúsculas).
        if (!in_array(strtolower(Auth::user()->role->rol_name ?? ''), ['superadmin', 'admin'])) {
            return response()->json(['message' => 'No tienes permiso para registrar equipos'], 403);
        }

        $request->validate([ //VALIDACIONES PARA EL REGISTRO DE EQUIPOS
            'equipo_type' => 'required|string', //VALIDA QUE EL TIPO DE EQUIPO EXISTA
            'equipo_brand' => 'required|string',//VALIDA QUE LA MARCA DEL EQUIPO EXISTA
            'equipo_model' => 'nullable|string',//VALIDA QUE EL MODELO DEL EQUIPO EXISTA
            'equipo_color' => 'required|string',//VALIDA QUE EL COLOR DEL EQUIPO EXISTA
            'equipo_serial' => 'required|string|max:100', //EL SERIAL PUEDE REPETIRSE EN PRESTAMOS POSTERIORES
            'equipo_observations' => 'nullable|string',//VALIDA QUE LAS OBSERVACIONES NO SE REPITAN
            'equipo_propiedad' => 'nullable|in:Prestado,Propio',
            'fk_id_usuario' => 'nullable|integer|exists:usuarios,id_usuario',
            'equipo_accesorios' => 'nullable|array',
            'equipo_accesorios.*.tipo' => 'required_with:equipo_accesorios|string',
            'equipo_accesorios.*.marca' => 'nullable|string',
            'equipo_accesorios.*.color' => 'nullable|string',
            'equipo_accesorios.*.inalambrico' => 'nullable|boolean',
        ]);

        $dueno = $request->fk_id_usuario ?: $request->user()->id_usuario;
        $duenoModel = User::find($dueno);

        $ingreso = IngresoEquipo::create([
            'fk_id_usuario' => $dueno,
            'equipo_type' => $request->equipo_type,
            'equipo_brand' => $request->equipo_brand,
            'equipo_model' => $request->equipo_model,
            'equipo_color' => $request->equipo_color,
            'equipo_serial' => $request->equipo_serial,
            'equipo_observations' => $request->equipo_observations,
            'equipo_propiedad' => $request->equipo_propiedad ?? 'Prestado',
            'equipo_accesorios' => $request->equipo_accesorios,
        ]);

        // Notificar a los admins sobre el nuevo equipo registrado
        Notificacion::notifyAdmins(
            'Nuevo equipo registrado',
            ($duenoModel ? $duenoModel->user_name . ' ' . $duenoModel->user_lastname : 'Un usuario') . ' registró un(a) ' . $request->equipo_type . ' ' . $request->equipo_brand . ' (Serial: ' . $request->equipo_serial . ')',
            'equipo'
        );

        return response()->json([ //RESPUESTA DE LA CREACION DEL REGISTRO
            'message' => 'Comprobante de ingreso de equipo creado con éxito',
            'data' => $ingreso->load('user')
        ], 201);
    }

    public function index()
    {
        $ingresos = IngresoEquipo::with('user.role')->orderBy('entry_datetime', 'desc')->get();
        return response()->json($ingresos); //RESPUESTA DE LA CONSULTA DE LOS REGISTROS
    }

    public function getMyEquipment(Request $request)
    {
        $ingresos = IngresoEquipo::where('fk_id_usuario', $request->user()->id_usuario) //CONSULTA DE LOS REGISTROS DEL USUARIO
            ->with('user') //CONSULTA DE LOS REGISTROS DEL USUARIO
            ->orderBy('entry_datetime', 'desc') //CONSULTA DE LOS REGISTROS DEL USUARIO
            ->get(); //CONSULTA DE LOS REGISTROS DEL USUARIO
        return response()->json($ingresos); //RESPUESTA DE LA CONSULTA DE LOS REGISTROS
    }

    // Exporta el inventario completo (portería/admin) en PDF o Word.
    public function exportIndex(Request $request)
    {
        return $this->exportarEquipos($request);
    }

    // Exporta solo los equipos del usuario autenticado (instructor/aprendiz).
    public function exportMyEquipment(Request $request)
    {
        return $this->exportarEquipos($request, $request->user()->id_usuario);
    }

    private function exportarEquipos(Request $request, ?int $soloUsuario = null)
    {
        $request->validate([
            'estado' => 'nullable|in:Disponible,Prestado',
        ]);

        $query = IngresoEquipo::with('user')->orderBy('entry_datetime', 'desc');

        if ($soloUsuario) {
            $query->where('fk_id_usuario', $soloUsuario);
        }

        if ($request->filled('estado')) {
            $query->where('equipo_status', $request->estado);
        }

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('equipo_type', 'like', "%{$q}%")
                    ->orWhere('equipo_brand', 'like', "%{$q}%")
                    ->orWhere('equipo_model', 'like', "%{$q}%")
                    ->orWhere('equipo_serial', 'like', "%{$q}%")
                    ->orWhereHas('user', function ($u) use ($q) {
                        $u->where('user_name', 'like', "%{$q}%")
                            ->orWhere('user_lastname', 'like', "%{$q}%")
                            ->orWhere('user_email', 'like', "%{$q}%")
                            ->orWhere('user_identification', 'like', "%{$q}%");
                    });
            });
        }

        $equipos = $query->limit(5000)->get();

        $filas = $equipos->map(function ($e) {
            $accesorios = collect($e->equipo_accesorios ?? [])
                ->map(fn ($a) => is_array($a) ? ($a['tipo'] ?? null) : ($a->tipo ?? null))
                ->filter()
                ->implode(', ');

            return [
                'equipo' => $e->equipo_type,
                'marca' => trim(($e->equipo_brand ?? '') . ' ' . ($e->equipo_model ?? '')),
                'serial' => $e->equipo_serial,
                'propiedad' => $e->equipo_propiedad === 'Propio' ? 'Propio' : 'Prestado',
                'estado' => $e->equipo_status === 'Disponible' ? 'Devuelto' : 'En uso',
                'dueno' => trim(($e->user->user_name ?? '') . ' ' . ($e->user->user_lastname ?? '')),
                'documento' => $e->user->user_identification ?? '',
                'accesorios' => $accesorios !== '' ? $accesorios : '—',
                'ingreso' => $e->entry_datetime ? Carbon::parse($e->entry_datetime)->format('Y-m-d H:i') : '—',
                'devolucion' => $e->equipo_return_datetime ? Carbon::parse($e->equipo_return_datetime)->format('Y-m-d H:i') : '—',
            ];
        })->all();

        $base = 'inventario_equipos_' . Carbon::now('America/Bogota')->format('Y-m-d_His');
        $titulo = $soloUsuario ? 'Mis equipos' : 'Inventario de equipos';

        $formato = strtolower($request->input('formato', 'pdf'));
        if ($formato === 'docx' || $formato === 'doc') {
            return response()
                ->view('exports.equipos_word', compact('filas', 'titulo'))
                ->header('Content-Type', 'application/msword; charset=UTF-8')
                ->header('Content-Disposition', 'attachment; filename="' . $base . '.doc"');
        }

        $pdf = Pdf::loadView('exports.equipos_pdf', compact('filas', 'titulo'))
            ->setPaper('a4', 'landscape');

        return $pdf->download($base . '.pdf');
    }

    public function comprobante($id)
    {
        $ingreso = IngresoEquipo::with('user.role')->findOrFail($id);

        $esDueno = $ingreso->fk_id_usuario === Auth::id();
        $esAdmin = in_array(strtolower(Auth::user()->role->rol_name ?? ''), ['superadmin', 'admin']);
        if (!$esDueno && !$esAdmin) {
            return response()->json(['message' => 'No tienes permiso para descargar este comprobante'], 403);
        }

        $dueno = $ingreso->user;
        $accesorios = collect($ingreso->equipo_accesorios ?? [])
            ->map(fn ($a) => trim(collect([
                $a['tipo'] ?? null,
                isset($a['marca']) && $a['marca'] !== '' ? $a['marca'] : null,
                isset($a['color']) && $a['color'] !== '' ? $a['color'] : null,
                !empty($a['inalambrico']) ? 'Inalámbrico' : null,
            ])->filter()->implode(' ')))
            ->filter()
            ->values();

        $pdf = Pdf::loadView('comprobantes.equipo', [
            'ingreso' => $ingreso,
            'dueno' => $dueno,
            'accesorios' => $accesorios,
            'generado_en' => Carbon::now('America/Bogota'),
        ]);

        $serial = preg_replace('/[^A-Za-z0-9\-_]/', '', $ingreso->equipo_serial) ?: 'equipo';

        return $pdf->download("comprobante-{$serial}.pdf");
    }

    public function deleteEquipment($id)
    {
        $ingreso = IngresoEquipo::findOrFail($id);
        $ingreso->delete();
        return response()->json([ //RESPUESTA DE LA CONSULTA DE LOS REGISTROS
            'message' => 'Comprobante de ingreso de equipo eliminado con éxito',
        ], 200);
    }

    public function markReturn($id)
    {
        $ingreso = IngresoEquipo::findOrFail($id);

        if ($ingreso->equipo_status === 'Disponible') {
            return response()->json([
                'message' => 'El equipo ya fue devuelto',
            ], 422);
        }

        $ingreso->update([
            'equipo_status' => 'Disponible',
            'equipo_return_datetime' => Carbon::now('America/Bogota'),
        ]);

        return response()->json([
            'message' => 'Equipo devuelto con éxito',
            'data' => $ingreso->load('user')
        ], 200);
    }
}
