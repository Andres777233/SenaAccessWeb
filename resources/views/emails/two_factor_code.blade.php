<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu código SENA Access es {{ $code }}</title>
    <style>
        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: #07090D;
            margin: 0;
            padding: 0;
            color: #F0F2F5;
        }
        .preheader {
            display: none;
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            color: transparent;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #10141B;
            border: 1px solid rgba(0, 135, 90, 0.35);
            border-radius: 16px;
            overflow: hidden;
            padding: 0 0 20px 0;
            text-align: center;
        }
        .header {
            background: linear-gradient(135deg, #00875A, #00B377);
            padding: 24px 20px;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            letter-spacing: 2px;
        }
        .header p {
            margin: 6px 0 0 0;
            font-size: 12px;
            letter-spacing: 3px;
            opacity: 0.9;
        }
        .content {
            padding: 24px 28px 8px 28px;
        }
        .content h2 {
            margin: 0 0 8px 0;
            font-size: 20px;
            color: #ffffff;
        }
        .content p {
            font-size: 14px;
            line-height: 1.6;
            color: #C6CDD6;
        }
        .code-box {
            background-color: #07090D;
            border: 2px dashed #00B377;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            font-size: 38px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #00E68A;
        }
        .btn {
            display: block;
            width: 100%;
            padding: 16px;
            margin: 10px 0;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            color: #ffffff;
            text-decoration: none;
            text-align: center;
            box-sizing: border-box;
        }
        .btn-app {
            background-color: #00875A;
        }
        .btn-approve {
            background-color: transparent;
            border: 1px solid #00875A;
            color: #00E68A;
        }
        .btn-deny {
            background-color: transparent;
            border: 1px solid #BE0000;
            color: #FF6B6B;
        }
        .footer {
            margin-top: 24px;
            font-size: 12px;
            color: #8A94A3;
        }
    </style>
</head>
<body>
    <div class="preheader">Tu código SENA Access es {{ $code }} — vence en 10 minutos. Escríbelo en la app sin abrir este correo.</div>
    <div class="container">
        <div class="header">
            <h1>SENA ACCESS</h1>
            <p>CONTROL DE ACCESO CCyS</p>
        </div>
        <div class="content">
            <h2>Verificación en dos pasos</h2>
            <p>Hola,</p>
            <p><strong style="color: #ffffff;">Tu código es {{ $code }}.</strong> Escríbelo en la app SENA Access: vence en 10 minutos y no lo compartas con nadie.</p>

            <div class="code-box">
                {{ $code }}
            </div>

            @if(!empty($challengeId))
                <a href="senaaccess://2fa?challenge_id={{ $challengeId }}" class="btn btn-app">ABRIR LA APP Y VERIFICAR</a>
            @endif

            @if(!empty($aprobarUrl) && $aprobarUrl !== '#')
                <p>¿Intentaste entrar tú? Responde sin escribir el código:</p>
                <a href="{{ $aprobarUrl }}" class="btn btn-approve">SÍ, soy yo — aprobar acceso</a>
                <a href="{{ $denegarUrl }}" class="btn btn-deny">NO, no fui yo — bloquear</a>
            @else
                <p>Si no pediste este código, ignora este correo y revisa tu cuenta.</p>
            @endif

            <p>Este código expira en 10 minutos. No compartas este correo con nadie.</p>
        </div>
        <div class="footer">
            &copy; {{ date('Y') }} SENA Access. Todos los derechos reservados.
        </div>
    </div>
</body>
</html>
