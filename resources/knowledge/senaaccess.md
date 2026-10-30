# SenaAccess — qué es y cómo funciona

SenaAccess es el sistema de control de acceso del SENA (Servicio Nacional de Aprendizaje, Colombia). Registra entradas y salidas, gestiona equipos, ambientes de formación, permisos de salida con PIN y notificaciones. Tiene dos clientes: una aplicación Android (Kotlin + Jetpack Compose) y una aplicación web (React + Laravel).

## Roles
- **Aprendiz**: consulta su historial, su estado dentro/fuera, sus equipos, sus excusas (permisos de salida), novedades y notificaciones. Marca entrada/salida escaneando el QR de portería o validando un PIN de excusa.
- **Instructor**: además de lo anterior, administra sus ambientes (agrega o quita aprendices), crea excusas con PIN para sus aprendices, reporta novedades y consulta el historial de sus equipos.
- **Funcionario**: personal administrativo del centro. No tiene ficha de formación ni excusas: marca su entrada/salida con el QR de portería (o PIN), consulta su historial, tiene carnet digital y equipos corporativos asignados. Su área/dependencia se guarda en el campo del programa.
- **Admin**: rol operativo de portería. Valida QR de entrada/salida, valida PIN de excusas, registra y devuelve equipos y consulta historial. No gestiona usuarios ni ambientes.
- **Superadmin**: superusuario. Gestiona usuarios (crear, editar, aprobar, rechazar, eliminar), roles y ambientes, y ve el resumen del centro y el acceso QR.
- **Invitado**: cuenta temporal creada con un QR de un solo uso. La visita dura 6 horas: portería escanea el QR de entrada y el sistema genera un segundo QR de salida que el visitante muestra al irse. El invitado solo ve sus códigos (no tiene panel) y, si no registra salida, la visita se cierra automáticamente al vencer el plazo.

## Flujos principales
0. **Actualización de la app**: al abrir, la app consulta `GET /api/app/version`; si su `versionCode` es menor al `min_version_code` publicado, muestra un aviso obligatorio con el enlace del APK nuevo.
1. **Registro de aprendiz**: desde la pantalla de acceso, botón "Registrarse aquí". Correo permitido: `@gmail.com`, `@hotmail.com`, `@outlook.com` o `@soy.sena.edu.co`. El aprendiz queda pendiente de aprobación del superadmin; los instructores y administradores los crea un superadmin. En la misma pantalla, "Tipo de Vinculación" permite registrarse como **Funcionario** (correo institucional `@sena.edu.co`, sin ficha y con Área/Dependencia); su cuenta también queda pendiente de aprobación.
2. **Inicio de sesión**: correo y contraseña. Puede exigir verificación en dos pasos (código de 6 dígitos al correo o aprobación "¿Eres tú?" desde un dispositivo confiable). En Android también se puede entrar con huella digital.
3. **Entrada y salida**: el QR de portería rota cada 30 segundos y está firmado; el servidor decide si registra Entrada o Salida. La salida también puede registrarse con el PIN de una excusa. La app Android tiene una pantalla "Salida" para escanear el QR o escribir el PIN.
4. **Equipos**: se registran con tipo, marca, modelo, color, serial y accesorios; quedan asociados al dueño y se pueden devolver.
5. **Ambientes**: salones o talleres con sede, jornada, horario, capacidad e instructores. El instructor agrega aprendices a sus ambientes.
6. **Excusas (permisos de salida)**: el instructor elige aprendiz, ambiente y motivo; el sistema genera un PIN de 4 dígitos y un QR válido 15 minutos; portería lo valida y registra la salida. El aprendiz ve el PIN y el QR en su app y puede borrar del historial las excusas ya usadas o vencidas.
7. **Novedades**: reportes de incidentes con ambiente, categoría y descripción. El aprendiz puede consultar las suyas; el instructor reporta; el superadmin gestiona todas.
8. **Notificaciones**: avisos internos con campana y contador de no leídas.
9. **Presencia**: lista de personas que están dentro del centro, con su ambiente y hora de entrada.
10. **Carnet digital**: credencial con QR descargable.
11. **Asistente virtual (chatbot)**: responde dudas del sistema y también preguntas generales. Sabe con quién habla (la sesión autenticada le indica nombre y rol) y consulta datos reales con herramientas de solo lectura: sus propios datos, su actividad, sus equipos, sus excusas y sus ambientes. Solo el Superadmin puede consultar a otras personas (por documento CC/CE/TI/PAS, nombre, correo o ficha) y el historial de accesos del centro. Nunca revela contraseñas, hashes, tokens ni cookies.

## Reglas de negocio
- No se puede registrar una salida sin una entrada previa.
- Un PIN de excusa es de un solo uso y vence a los 15 minutos.
- Un QR de portería vencido o reutilizado se rechaza.
- La salida solo se marca con QR de portería o PIN de excusa; cerrar la app no genera salida.
- Un permiso de excusa pendiente no se puede borrar; primero debe usarse, vencer o anularse.
- Los invitados no aparecen en los listados de usuarios.
