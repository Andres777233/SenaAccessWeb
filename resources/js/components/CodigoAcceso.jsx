import React, { useEffect, useState } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { showAlert } from './CustomAlert';

// Código de un solo uso para que portería registre la entrada del usuario.
// Misma estética que el resto de la app: tarjeta de vidrio, QR sobre blanco y
// el PIN con el badge que ya usa portería.
const CodigoAcceso = ({ contexto = 'puerta' }) => {
    const [codigo, setCodigo] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [restante, setRestante] = useState(300);
    const [porcentaje, setPorcentaje] = useState(100);
    const [expirado, setExpirado] = useState(false);

    const generar = async () => {
        setCargando(true);
        try {
            const { data } = await axios.post('/api/acceso/generar');
            const qr = await QRCode.toDataURL(data.qr_payload, {
                margin: 1,
                width: 420,
                errorCorrectionLevel: 'M',
                color: { dark: '#04140a', light: '#ffffff' },
            });
            setCodigo({ pin: data.pin, qr, expira: data.expira_en });
        } catch (error) {
            showAlert(error.response?.data?.message || 'No se pudo generar el código.', 'error');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        if (!codigo) return undefined;
        const tick = () => {
            const ms = new Date(codigo.expira).getTime() - Date.now();
            const segundos = Math.max(0, Math.floor(ms / 1000));
            setRestante(segundos);
            setPorcentaje(Math.max(0, Math.min(100, (segundos / 300) * 100)));
            setExpirado(ms <= 0);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [codigo]);

    const copiarPin = async () => {
        try {
            await navigator.clipboard.writeText(String(codigo.pin));
            showAlert('PIN copiado');
        } catch (_) {
            showAlert(`El PIN es ${codigo.pin}`, 'info');
        }
    };

    if (!codigo) {
        return (
            <div className="glass-box p-4 h-100">
                <h4 className="fw-bold mb-1">Muestra tu código</h4>
                <p className="small opacity-75 mb-3">Genera un QR y un PIN de un solo uso. Portería lo escanea o lo digita.</p>

                <div className="acc-qr-box acc-qr-box--vacio mb-3" aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ fontSize: 44 }}>qr_code_2</span>
                </div>

                <p className="text-center small opacity-50 mb-3">El código dura 5 minutos y se invalida al usarse una vez.</p>

                <button type="button" className="btn btn-glow w-100" onClick={generar} disabled={cargando}>
                    {cargando ? 'GENERANDO…' : 'GENERAR MI CÓDIGO'}
                </button>
            </div>
        );
    }

    return (
        <div className="glass-box p-4 h-100">
            <h4 className="fw-bold mb-1">Muestra tu código</h4>
            <p className="small opacity-75 mb-3">QR o PIN en portería. Se renueva solo cuando vence.</p>

            <div className="acc-qr-box mb-3">
                <img src={codigo.qr} alt={`Código QR de acceso, PIN ${codigo.pin}`} />
            </div>

            <div className="text-center mb-3">
                <span className="badge px-4 py-3 fs-4 text-warning border border-warning bg-opacity-10" style={{ letterSpacing: '7px' }}>
                    {codigo.pin}
                </span>
            </div>

            <div className="progress mb-2" style={{ height: '6px' }} role="progressbar" aria-valuenow={porcentaje} aria-valuemin="0" aria-valuemax="100">
                <div className={`progress-bar ${porcentaje <= 25 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${porcentaje}%` }} />
            </div>

            <p className={`text-center small mb-3 ${expirado ? 'text-danger' : 'opacity-75'}`}>
                {expirado
                    ? 'Código vencido. Genera uno nuevo.'
                    : `Vence en ${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`}
            </p>

            <div className="d-grid gap-2">
                <button type="button" className="btn btn-outline-success" onClick={copiarPin}>
                    <span className="material-symbols-outlined small align-middle me-1">content_copy</span>
                    Copiar PIN
                </button>
                <button type="button" className="btn btn-glow" onClick={generar} disabled={cargando}>
                    {cargando ? 'GENERANDO…' : 'GENERAR OTRO'}
                </button>
            </div>

            {contexto === 'puerta' && (
                <p className="text-center small opacity-50 mt-3 mb-0">
                    Esta pantalla pasa sola a tu panel cuando portería lo escanee.
                </p>
            )}
        </div>
    );
};

export default CodigoAcceso;
