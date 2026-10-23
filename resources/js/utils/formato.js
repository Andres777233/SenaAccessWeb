// Utilidades de fecha/hora para la interfaz del tema nuevo.
// Todo se muestra en la zona horaria del centro (America/Bogota), sin depender
// de la hora del equipo del usuario.

const ZONA = 'America/Bogota';

export const horaBogota = (valor) => {
    if (!valor) return '—';
    try {
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: ZONA,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date(valor));
    } catch (_) {
        return '—';
    }
};

export const fechaBogota = (valor) => {
    if (!valor) return '—';
    try {
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: ZONA,
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }).format(new Date(valor));
    } catch (_) {
        return '—';
    }
};

export const fechaCortaBogota = (valor) => {
    if (!valor) return '—';
    try {
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: ZONA,
            day: '2-digit',
            month: '2-digit',
        }).format(new Date(valor));
    } catch (_) {
        return '—';
    }
};

// "jueves, 22 de octubre" — con mayúscula inicial.
export const etiquetaDia = (valor = new Date()) => {
    try {
        const texto = new Intl.DateTimeFormat('es-CO', {
            timeZone: ZONA,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        }).format(new Date(valor));
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    } catch (_) {
        return '';
    }
};

// Día de la semana corto para el eje del gráfico: "lun", "mar"…
export const diaCorto = (valor) => {
    try {
        return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, weekday: 'short' })
            .format(new Date(valor))
            .replace('.', '')
            .slice(0, 3);
    } catch (_) {
        return '';
    }
};

// ¿La fecha ISO cae hoy en Bogotá?
export const esHoyBogota = (valor) => {
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
        });
        return fmt.format(new Date(valor)) === fmt.format(new Date());
    } catch (_) {
        return false;
    }
};

export const inicialesDe = (nombre = '', apellido = '') =>
    `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase() || 'U';
