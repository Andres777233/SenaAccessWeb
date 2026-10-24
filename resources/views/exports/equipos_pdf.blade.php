<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>{{ $titulo }}</title>
    <style>
        body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 8px; color: #1c1c1c; margin: 0; }
        .cabecera { border-bottom: 3px solid #02D914; padding-bottom: 8px; margin-bottom: 10px; }
        .cabecera h1 { margin: 0; font-size: 16px; letter-spacing: 1px; color: #02D914; }
        .cabecera p { margin: 2px 0 0; font-size: 9px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #02D914; color: #04140a; text-align: left; padding: 5px 4px; font-size: 7.5px; text-transform: uppercase; }
        td { padding: 4px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        tr:nth-child(even) td { background: #f7fbf7; }
        .pie { margin-top: 10px; font-size: 7px; color: #6b7280; text-align: right; }
        .estado { font-weight: bold; }
    </style>
</head>
<body>
    <div class="cabecera">
        <h1>{{ $titulo }}</h1>
        <p>Generado el {{ \Carbon\Carbon::now('America/Bogota')->format('d/m/Y H:i') }} · SENA Access</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Equipo</th>
                <th>Marca / modelo</th>
                <th>Serial</th>
                <th>Propiedad</th>
                <th>Estado</th>
                <th>Dueño</th>
                <th>Documento</th>
                <th>Accesorios</th>
                <th>Ingreso</th>
                <th>Devolución</th>
            </tr>
        </thead>
        <tbody>
            @forelse($filas as $f)
                <tr>
                    <td>{{ $f['equipo'] }}</td>
                    <td>{{ $f['marca'] }}</td>
                    <td>{{ $f['serial'] }}</td>
                    <td>{{ $f['propiedad'] }}</td>
                    <td class="estado">{{ $f['estado'] }}</td>
                    <td>{{ $f['dueno'] }}</td>
                    <td>{{ $f['documento'] }}</td>
                    <td>{{ $f['accesorios'] }}</td>
                    <td>{{ $f['ingreso'] }}</td>
                    <td>{{ $f['devolucion'] }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="10" style="text-align:center;padding:20px;color:#6b7280;">No hay equipos con esos filtros.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <p class="pie">{{ count($filas) }} registro(s)</p>
</body>
</html>
