import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

// Pregunta al servidor si ya hay Entrada de hoy. La usa la puerta para entrar
// sola cuando portería escanea el código del usuario (sin el botón "ya marqué").
export const useEsperarEntrada = ({ activo = true, cada = 3000, onEntrada } = {}) => {
    const [estado, setEstado] = useState(null);
    const [error, setError] = useState('');
    const [detectada, setDetectada] = useState(false);
    const avisado = useRef(false);
    const callback = useRef(onEntrada);
    callback.current = onEntrada;

    const revisar = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/acceso/estado');
            setEstado(data);
            setError('');
            // Entrada de hoy Y último movimiento Entrada: tras una Salida la
            // puerta debe seguir esperando un nuevo registro.
            if (data?.entrada_hoy && data?.dentro && !avisado.current) {
                avisado.current = true;
                setDetectada(true);
                if (callback.current) callback.current(data);
            }
            return data;
        } catch (e) {
            setError(e.response?.data?.message || 'No pudimos verificar tu entrada. Sigue intentando.');
            return null;
        }
    }, []);

    useEffect(() => {
        if (!activo) return undefined;
        let timer = null;
        let vigente = true;

        const ciclo = async () => {
            if (!vigente) return;
            if (document.visibilityState !== 'hidden') await revisar();
            if (vigente) timer = setTimeout(ciclo, cada);
        };

        ciclo();

        // Al volver a la pestaña se consulta de inmediato (el escaneo pudo
        // ocurrir mientras estaba en segundo plano).
        const alVolver = () => {
            if (document.visibilityState === 'visible') revisar();
        };
        document.addEventListener('visibilitychange', alVolver);

        return () => {
            vigente = false;
            if (timer) clearTimeout(timer);
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [activo, cada, revisar]);

    return { estado, error, detectada, revisar };
};
