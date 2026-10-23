import React, { useEffect, useState } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { showAlert } from './CustomAlert';

// Código de un solo uso para que portería registre la entrada del usuario.
// La puerta escucha el estado y pasa sola al panel cuando se usa.
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
            <section className="acc-card">
                <div className="acc-head">
                    <div>
                        <h3 className="acc-title">Muestra tu código</h3>
                        <p className="acc-sub">Genera un QR y un PIN de un solo uso. Portería lo escanea o lo digita.</p>
                    </div>
                </div>

                <div className="acc-code">
                    <div className="acc-qr acc-qr--vacio" aria-hidden="true">
                        <span className="material-symbols-outlined" style={{ fontSize: 46 }}>qr_code_2</span>
                        <span>Tu QR aparecerá aquí</span>
                    </div>
                    <p className="acc-time">El código dura 5 minutos y se invalida al usarse una vez.</p>
                </div>

                <button type="button" className="btn btn-outline-success py-2" onClick={generar} disabled={cargando}>
                    <span className="material-symbols-outlined small me-1">bolt</span>
                    {cargando ? 'Generando…' : 'Generar mi código'}
                </button>
            </section>
        );
    }

    return (
        <section className="acc-card">
            <div className="acc-head">
                <div>
                    <h3 className="acc-title">Muestra tu código</h3>
                    <p className="acc-sub">QR o PIN en portería. Se renueva solo cuando vence.</p>
                </div>
            </div>

            <div className="acc-code">
                <div className="acc-qr">
                    <img src={codigo.qr} alt={`Código QR de acceso, PIN ${codigo.pin}`} />
                </div>

                <div className="acc-pin" aria-label={`PIN ${codigo.pin}`}>
                    {String(codigo.pin).split('').map((d, i) => <b key={i}>{d}</b>)}
                </div>

                <div className={`acc-bar ${porcentaje <= 25 ? 'is-low' : ''}`} aria-hidden="true">
                    <i style={{ width: `${porcentaje}%` }} />
                </div>

                <p className={`acc-time ${expirado ? 'text-danger' : ''}`}>
                    {expirado
                        ? 'Código vencido. Genera uno nuevo.'
                        : `Vence en ${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`}
                </p>
            </div>

            <div className="acc-actions">
                <button type="button" className="btn btn-outline-success" onClick={copiarPin}>
                    <span className="material-symbols-outlined small me-1">content_copy</span>
                    Copiar PIN
                </button>
                <button type="button" className="btn btn-glow" onClick={generar} disabled={cargando}>
                    <span className="material-symbols-outlined small me-1">refresh</span>
                    {cargando ? 'Generando…' : 'Generar otro'}
                </button>
            </div>

            {contexto === 'puerta' && (
                <div className="acc-status">
                    <span className="acc-dot" aria-hidden="true" />
                    <span className="small">Esta pantalla pasa sola a tu panel cuando portería lo escanee.</span>
                </div>
            )}
        </section>
    );
};

export default CodigoAcceso;
