import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { showAlert } from './CustomAlert';

// Entrada asistida: el usuario genera un QR + PIN de un solo uso (5 min) y
// porteria lo escanea o digita desde el movil para registrar su Entrada.
const CodigoAcceso = () => {
    const [codigo, setCodigo] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [restante, setRestante] = useState('');
    const [expirado, setExpirado] = useState(false);

    useEffect(() => {
        if (!codigo) return undefined;

        const tick = () => {
            const ms = new Date(codigo.expira).getTime() - Date.now();
            if (ms <= 0) {
                setRestante('00:00');
                setExpirado(true);
                return;
            }
            setExpirado(false);
            const m = Math.floor(ms / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setRestante(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [codigo]);

    const generar = async () => {
        setCargando(true);
        try {
            const { data } = await axios.post('/api/acceso/generar');
            const qr = await QRCode.toDataURL(data.qr_payload, { margin: 1, width: 280 });
            setCodigo({ pin: data.pin, qr, expira: data.expira_en });
        } catch (error) {
            showAlert(error.response?.data?.message || 'No se pudo generar el código.', 'error');
        } finally {
            setCargando(false);
        }
    };

    if (!codigo) {
        return (
            <div className="codigo-acceso text-center">
                <p className="small opacity-75 mb-2">
                    ¿No puedes escanear? Genera un código para que portería te dé la entrada.
                </p>
                <button type="button" className="btn btn-glow w-100 fw-bold py-3" onClick={generar} disabled={cargando}>
                    {cargando ? 'GENERANDO...' : 'GENERAR CÓDIGO PARA PORTERÍA'}
                </button>
            </div>
        );
    }

    return (
        <div className="codigo-acceso text-center">
            <p className="small opacity-75 mb-2">Muestra este QR o dicta el PIN en portería</p>
            <img src={codigo.qr} alt="QR de entrada para portería" className="codigo-qr" />
            <div className="codigo-pin" aria-label={`PIN ${codigo.pin}`}>{codigo.pin}</div>
            <p className={`small mb-2 ${expirado ? 'text-danger' : 'opacity-75'}`}>
                {expirado ? 'Código vencido. Genera uno nuevo.' : `Vence en ${restante}`}
            </p>
            <button type="button" className="btn btn-glow w-100" onClick={generar} disabled={cargando}>
                {cargando ? 'GENERANDO...' : 'GENERAR OTRO'}
            </button>
        </div>
    );
};

export default CodigoAcceso;
