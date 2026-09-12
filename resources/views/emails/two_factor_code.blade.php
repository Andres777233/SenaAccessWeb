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
            color: #FFFFFF;
        }
        .preheader {
            display: none;
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            color: transparent;
        }
        .page {
            padding: 40px 12px;
        }
        .container {
            max-width: 560px;
            margin: 0 auto;
            background-color: #13161C;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 28px;
            overflow: hidden;
            text-align: center;
        }
        .glow {
            background: radial-gradient(circle at 15% 0%, rgba(2, 217, 20, 0.22), transparent 55%),
                        radial-gradient(circle at 85% 10%, rgba(0, 191, 165, 0.14), transparent 50%),
                        #13161C;
            padding: 32px 28px 8px 28px;
        }
        .logo-badge {
            display: inline-block;
            background-color: #FFFFFF;
            border-radius: 16px;
            padding: 10px 18px;
            margin-bottom: 16px;
        }
        .logo-badge img {
            display: block;
            width: 132px;
            height: auto;
        }
        .brand {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 4px;
            color: #02D914;
        }
        .brand-sub {
            margin: 8px 0 0 0;
            font-size: 12px;
            letter-spacing: 3px;
            color: #A0A0A0;
        }
        .content {
            padding: 20px 28px 8px 28px;
        }
        .content h2 {
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: bold;
            color: #FFFFFF;
        }
        .content p {
            font-size: 14px;
            line-height: 1.6;
            color: #A0A0A0;
        }
        .content p strong {
            color: #FFFFFF;
        }
        .code-box {
            background-color: #07090D;
            border: 2px dashed #00E676;
            border-radius: 12px;
            padding: 20px 12px;
            margin: 20px 0;
            font-size: 38px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #00E676;
        }
        .btn {
            display: block;
            width: 100%;
            padding: 14px;
            margin: 10px 0;
            border-radius: 12px;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 2px;
            text-decoration: none;
            text-align: center;
            box-sizing: border-box;
        }
        .btn-app {
            background-color: #02D914;
            color: #000000;
        }
        .btn-approve {
            background-color: transparent;
            border: 2px solid #02D914;
            color: #02D914;
        }
        .btn-deny {
            background-color: transparent;
            border: 2px solid #FF6B6B;
            color: #FF6B6B;
        }
        .footer {
            padding: 0 28px 28px 28px;
            margin-top: 16px;
            font-size: 12px;
            color: #8A94A3;
        }
    </style>
</head>
<body>
    <div class="preheader">Tu código SENA Access es {{ $code }} — vence en 10 minutos. Escríbelo en la app sin abrir este correo.</div>
    <div class="page">
        <div class="container">
            <div class="glow">
                <div class="logo-badge">
                    <img src="{{ url('email/SenaAccessLogo.jpeg') }}" alt="SENA Access">
                </div>
                <p class="brand">SENA ACCESS</p>
                <p class="brand-sub">CONTROL DE ACCESO CCyS</p>
            </div>
            <div class="content">
                <h2>Verificación en dos pasos</h2>
                <p>Hola,</p>
                <p><strong>Tu código es {{ $code }}.</strong> Escríbelo en la app SENA Access: vence en 10 minutos y no lo compartas con nadie.</p>

                <div class="code-box">
                    {{ $code }}
                </div>

                @if(!empty($challengeId))
                    <a href="senaaccess://2fa?challenge_id={{ $challengeId }}" class="btn btn-app">ABRIR LA APP Y VERIFICAR</a>
                @endif

                @if(!empty($aprobarUrl) && $aprobarUrl !== '#')
                    <p>¿Intentaste entrar tú? Responde sin escribir el código:</p>
                    <a href="{{ $aprobarUrl }}" class="btn btn-approve">SÍ, SOY YO — APROBAR ACCESO</a>
                    <a href="{{ $denegarUrl }}" class="btn btn-deny">NO, NO FUI YO — BLOQUEAR</a>
                @else
                    <p>Si no pediste este código, ignora este correo y revisa tu cuenta.</p>
                @endif

                <p>Este código expira en 10 minutos. No compartas este correo con nadie.</p>
            </div>
            <div class="footer">
                &copy; {{ date('Y') }} SENA Access. Todos los derechos reservados.
            </div>
        </div>
    </div>
</body>
</html>
