<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="utf-8">
    <title>{{ $titulo }}</title>
    <!--[if gte mso 9]>
    <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
    <![endif]-->
    <style>
        @page { size: A4 landscape; margin: 1.4cm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1c1c1c; }
        h1 { font-size: 18pt; color: #02D914; margin: 0 0 2pt 0; }
        .meta { font-size: 8pt; color: #6b7280; margin: 0 0 12pt 0; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #02D914; color: #04140a; font-size: 8pt; text-align: left; padding: 5pt; border: 1px solid #02D914; }
        td { font-size: 8pt; padding: 4pt; border: 1px solid #d1d5db; vertical-align: top; }
        .pie { font-size: 7.5pt; color: #6b7280; margin-top: 10pt; }
    </style>
</head>
<body>
    <h1>{{ $titulo }}</h1>
    <p class="meta">Generado el {{ \Carbon\Carbon::now('America/Bogota')->format('d/m/Y H:i') }} · SENA Access</p>

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
                    <td>{{ $f['estado'] }}</td>
                    <td>{{ $f['dueno'] }}</td>
                    <td>{{ $f['documento'] }}</td>
                    <td>{{ $f['accesorios'] }}</td>
                    <td>{{ $f['ingreso'] }}</td>
                    <td>{{ $f['devolucion'] }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="10" style="text-align:center;padding:18pt;color:#6b7280;">No hay equipos con esos filtros.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <p class="pie">{{ count($filas) }} registro(s)</p>
</body>
</html>
