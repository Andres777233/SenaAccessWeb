<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Código de Recuperación de Contraseña</title>
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
            background-color: #ffffff;
            padding: 24px 20px 12px;
            border-radius: 8px 8px 0 0;
            border-bottom: 4px solid #00875A;
            margin: -20px -20px 20px -20px;
        }
        .header img {
            max-width: 260px;
            height: auto;
            display: block;
            margin: 0 auto;
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
        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #777;
        }
    </style>
</head>
<body>
    <?php $logoData = base64_encode((string) file_get_contents(public_path('email/SenaAccessLogo.jpeg'))); ?>
    <div class="container">
        <div class="header">
            <img src="data:image/jpeg;base64,{{ $logoData }}" alt="SENA Acces">
        </div>
        <div class="content">
            <h2>Recuperación de Contraseña</h2>
            <p>Hola,</p>
            <p>Has solicitado restablecer tu contraseña. Utiliza el siguiente código de recuperación para continuar:</p>
            
            <div class="code-box">
                {{ $code }}
            </div>
            
            <p>Si no fuiste tú quien solicitó este cambio, por favor ignora este correo.</p>
        </div>
        <div class="footer">
            &copy; {{ date('Y') }} SENA Acces. Todos los derechos reservados.
        </div>
    </div>
</body>
</html>
