<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Código de Verificación en dos pasos</title>
    <style>
        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            padding: 20px;
            text-align: center;
        }
        .header {
            background-color: #00875A;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            color: #ffffff;
            margin: -20px -20px 20px -20px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px;
        }
        .code-box {
            background-color: #f8f9fa;
            border: 2px dashed #00875A;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 4px;
            color: #00875A;
        }
        .btn {
            display: block;
            width: 100%;
            padding: 16px;
            margin: 10px 0;
            border-radius: 8px;
            font-size: 18px;
            font-weight: bold;
            color: #ffffff;
            text-decoration: none;
            text-align: center;
            box-sizing: border-box;
        }
        .btn-approve {
            background-color: #00875A;
        }
        .btn-deny {
            background-color: #BE0000;
        }
        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SENA Acces</h1>
        </div>
        <div class="content">
            <h2>Verificación en dos pasos</h2>
            <p>Hola,</p>
            <p><strong>Se detectó un intento de inicio de sesión en tu cuenta SENA Acces desde otro dispositivo.</strong> ¿Fuiste tú?</p>

            <a href="{{ $aprobarUrl }}" class="btn btn-approve">SÍ, soy yo — aprobar acceso</a>
            <a href="{{ $denegarUrl }}" class="btn btn-deny">NO, no fui yo — bloquear</a>

            <p>Si prefieres, escribe este código en la aplicación en lugar de usar los botones:</p>
            <div class="code-box">
                {{ $code }}
            </div>

            <p>Este enlace y código expiran en 10 minutos. No compartas este correo con nadie.</p>
        </div>
        <div class="footer">
            &copy; {{ date('Y') }} SENA Acces. Todos los derechos reservados.
        </div>
    </div>
</body>
</html>