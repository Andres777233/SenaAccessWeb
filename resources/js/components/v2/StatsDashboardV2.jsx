import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { diaCorto, esHoyBogota, etiquetaDia, fechaCortaBogota, horaBogota, inicialesDe } from '../../utils/formato';

// Dashboard del tema nuevo: responde primero "¿cómo va mi día?" y completa con
// los últimos accesos y la semana. Usa solo datos reales de /api/my-stats o
// /api/admin/stats (no hay cifras inventadas).
const StatsDashboardV2 = ({ currentUser = null, onNavegar }) => {
    const [stats, setStats] = useState(null);
    const [estadoDia, setEstadoDia] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const rolKey = (currentUser?.role?.rol_name || '').toLowerCase();
    const esAdmin = ['superadmin', 'admin', 'portero'].includes(rolKey);
    const firstName = currentUser?.user_name || 'Usuario';
    const foto = currentUser?.profile_photo_path;

    const cargar = useCallback(async () => {
        if (!currentUser) return;
        setCargando(true);
        try {
            const { data } = await axios.get(esAdmin ? '/api/admin/stats' : '/api/my-stats');
            setStats(data);
            setError('');
        } catch (e) {
            setError('No pudimos cargar los datos del panel. Revisa tu conexión e intenta de nuevo.');
        } finally {
            setCargando(false);
        }
    }, [currentUser, esAdmin]);

    // El estado del día (entrada/salida) sale de /acceso/estado para todos:
    // es una consulta barata y funciona igual para cualquier rol.
    const cargarEstado = useCallback(async () => {
        if (!currentUser) return;
        try {
            const { data } = await axios.get('/api/acceso/estado');
            setEstadoDia(data);
        } catch (_) {
            /* la tarjeta muestra el estado neutro */
        }
    }, [currentUser]);

    useEffect(() => {
        cargar();
        cargarEstado();
    }, [cargar, cargarEstado]);

    useEffect(() => {
        const alVolver = () => {
            if (document.visibilityState === 'visible') {
                cargar();
                cargarEstado();
            }
        };
        window.addEventListener('focus', alVolver);
        document.addEventListener('visibilitychange', alVolver);
        return () => {
            window.removeEventListener('focus', alVolver);
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [cargar, cargarEstado]);

    const semana = useMemo(() => {
        const lista = stats?.ingresos_semana || [];
        const max = Math.max(1, ...lista.flatMap((d) => [d.entradas || 0, d.salidas || 0]));
        return { lista, max };
    }, [stats]);

    const ultimos = stats?.ultimos_accesos || [];
    const entradaHoy = estadoDia?.entrada_hoy;
    const ultimoMovimiento = estadoDia?.ultimo;

    const kpis = esAdmin
        ? [
            { label: 'Ingresos hoy', value: stats?.ingresos_hoy ?? 0, foot: 'Entradas y salidas de hoy', acento: true },
            { label: 'Usuarios', value: stats?.usuarios_totales ?? 0, foot: 'Cuentas registradas' },
            { label: 'Equipos activos', value: stats?.equipos_activos ?? 0, foot: 'Prestados sin devolver' },
            { label: 'Novedades', value: stats?.novedades_totales ?? 0, foot: 'Reportadas en total' },
        ]
        : [
            { label: 'Ingresos hoy', value: stats?.ingresos_hoy ?? 0, foot: 'Tus movimientos de hoy', acento: true },
            { label: 'Entradas', value: stats?.distribucion_por_tipo?.Entrada ?? 0, foot: 'Histórico' },
            { label: 'Salidas', value: stats?.distribucion_por_tipo?.Salida ?? 0, foot: 'Histórico' },
            { label: 'Novedades', value: stats?.novedades_totales ?? 0, foot: 'Reportadas por ti' },
        ];

    const irA = (view) => {
        if (onNavegar && view) onNavegar(view);
    };

    return (
        <div className="v2-canvas">
            <div className="v2-pagehead">
                <div>
                    <h1>Hola, {firstName}</h1>
                    <p>{etiquetaDia()} · {currentUser?.role?.rol_name || 'Usuario'}</p>
                </div>
                <div className="v2-pagehead-actions">
                    <button type="button" className="v2-btn v2-btn--ghost" onClick={() => { cargar(); cargarEstado(); }}>
                        <span className="material-symbols-outlined">refresh</span>
                        Actualizar
                    </button>
                </div>
            </div>

            {error && (
                <div className="v2-alert v2-alert--err">
                    <span className="material-symbols-outlined">cloud_off</span>
                    <div>
                        <strong>Sin datos</strong>
                        {error}
                    </div>
                </div>
            )}

            <section className="v2-kpis" aria-label="Resumen">
                {kpis.map((kpi) => (
                    <div className={`v2-kpi ${kpi.acento && Number(kpi.value) > 0 ? 'v2-kpi--accent' : ''}`} key={kpi.label}>
                        <span className="v2-kpi-label">{kpi.label}</span>
                        <span className="v2-kpi-value">{cargando ? '—' : kpi.value}</span>
                        <span className="v2-kpi-foot">{kpi.foot}</span>
                    </div>
                ))}
            </section>

            <div className="v2-grid-2">
                <section className="v2-panel">
                    <div className="v2-panel-head">
                        <div>
                            <h2 className="v2-panel-title">{esAdmin ? 'Hoy en el centro' : 'Tu día'}</h2>
                            <p className="v2-panel-sub">{etiquetaDia()}</p>
                        </div>
                        {!esAdmin && (
                            <span className={`v2-tag ${entradaHoy ? 'v2-tag--in' : ''}`}>
                                {entradaHoy ? 'Dentro' : 'Sin entrada'}
                            </span>
                        )}
                    </div>

                    {esAdmin ? (
                        <>
                            <div className="v2-day-status is-in">
                                <span className="material-symbols-outlined">groups</span>
                                <div>
                                    <strong>{stats?.ingresos_hoy ?? 0} movimientos registrados hoy</strong>
                                    <span>Entradas y salidas del centro procesadas por portería.</span>
                                </div>
                            </div>

                            <div className="v2-day-meta">
                                <div className="v2-meta">
                                    <span className="v2-meta-label">Equipos activos</span>
                                    <span className="v2-meta-value">{stats?.equipos_activos ?? 0} prestados</span>
                                </div>
                                <div className="v2-meta">
                                    <span className="v2-meta-label">Novedades abiertas</span>
                                    <span className="v2-meta-value">{stats?.novedades_totales ?? 0} en total</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={`v2-day-status ${entradaHoy ? 'is-in' : 'is-out'}`}>
                                <span className="material-symbols-outlined">{entradaHoy ? 'login' : 'schedule'}</span>
                                <div>
                                    <strong>
                                        {entradaHoy
                                            ? `Entrada registrada a las ${horaBogota(estadoDia?.entrada?.fecha)}`
                                            : 'Aún no registras entrada hoy'}
                                    </strong>
                                    <span>
                                        {entradaHoy
                                            ? 'Tu jornada está abierta. La salida se marca con el QR de salida.'
                                            : 'Escanea el QR de portería para abrir tu jornada.'}
                                    </span>
                                </div>
                            </div>

                            <div className="v2-day-meta">
                                <div className="v2-meta">
                                    <span className="v2-meta-label">Último movimiento</span>
                                    <span className="v2-meta-value">
                                        {ultimoMovimiento ? `${ultimoMovimiento.tipo} · ${horaBogota(ultimoMovimiento.fecha)}` : '—'}
                                    </span>
                                </div>
                                <div className="v2-meta">
                                    <span className="v2-meta-label">Sede</span>
                                    <span className="v2-meta-value">{ultimoMovimiento?.lugar || 'CCyS'}</span>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="v2-actions-row">
                        {!esAdmin && (
                            <button type="button" className="v2-btn v2-btn--primary" onClick={() => irA('escanear_acceso')} disabled={!onNavegar}>
                                <span className="material-symbols-outlined">qr_code_scanner</span>
                                Marcar acceso
                            </button>
                        )}
                        {esAdmin && (
                            <button type="button" className="v2-btn v2-btn--primary" onClick={() => irA('validar_qr')} disabled={!onNavegar}>
                                <span className="material-symbols-outlined">qr_code_scanner</span>
                                Validar acceso
                            </button>
                        )}
                        <button type="button" className="v2-btn v2-btn--ghost" onClick={() => irA('historial')} disabled={!onNavegar}>
                            <span className="material-symbols-outlined">history</span>
                            Ver historial
                        </button>
                    </div>
                </section>

                <section className="v2-panel">
                    <div className="v2-panel-head">
                        <div>
                            <h2 className="v2-panel-title">Actividad de la semana</h2>
                            <p className="v2-panel-sub">Últimos 7 días</p>
                        </div>
                        <div className="v2-legend">
                            <span className="is-in"><i />Entradas</span>
                            <span><i />Salidas</span>
                        </div>
                    </div>

                    {semana.lista.length === 0 ? (
                        <div className="v2-empty">
                            <span className="material-symbols-outlined">bar_chart</span>
                            Todavía no hay movimientos esta semana
                        </div>
                    ) : (
                        <div className="v2-chart" role="img" aria-label="Entradas y salidas de los últimos siete días">
                            {semana.lista.map((dia) => {
                                const hoy = esHoyBogota(dia.fecha);
                                return (
                                    <div className="v2-chart-col" key={dia.fecha}>
                                        <div className="v2-chart-bars">
                                            <div
                                                className="v2-chart-bar is-in"
                                                style={{ height: `${((dia.entradas || 0) / semana.max) * 100}%` }}
                                                title={`${dia.entradas || 0} entradas`}
                                            />
                                            <div
                                                className="v2-chart-bar"
                                                style={{ height: `${((dia.salidas || 0) / semana.max) * 100}%` }}
                                                title={`${dia.salidas || 0} salidas`}
                                            />
                                        </div>
                                        <span className={`v2-chart-x ${hoy ? 'is-today' : ''}`}>{diaCorto(dia.fecha)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <p className="v2-muted" style={{ fontSize: '0.74rem', margin: 0 }}>
                        Semana con {semana.lista.reduce((acc, d) => acc + (d.entradas || 0) + (d.salidas || 0), 0)} movimientos registrados.
                    </p>
                </section>
            </div>

            <section className="v2-panel">
                <div className="v2-panel-head">
                    <div>
                        <h2 className="v2-panel-title">Últimos accesos</h2>
                        <p className="v2-panel-sub">{esAdmin ? 'De todo el centro' : 'Tuyos, del más reciente al más antiguo'}</p>
                    </div>
                    <button type="button" className="v2-btn v2-btn--quiet v2-btn--sm" onClick={() => irA('historial')} disabled={!onNavegar}>
                        Ver todo
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>

                {ultimos.length === 0 ? (
                    <div className="v2-empty">
                        <span className="material-symbols-outlined">history</span>
                        Sin accesos registrados todavía
                    </div>
                ) : (
                    <div className="v2-list">
                        {ultimos.map((m) => {
                            const nombre = m.user
                                ? `${m.user.user_name || ''} ${m.user.user_lastname || ''}`.trim()
                                : 'Movimiento';
                            const esEntrada = m.ingreso_type === 'Entrada';
                            return (
                                <div className="v2-row" key={m.id_ingreso}>
                                    <div className="v2-avatar">
                                        {m.user?.profile_photo_path
                                            ? <img src={m.user.profile_photo_path} alt="" loading="lazy" />
                                            : inicialesDe(m.user?.user_name, m.user?.user_lastname)}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div className="v2-row-name">{esAdmin ? nombre : (esEntrada ? 'Entrada' : m.ingreso_type || 'Movimiento')}</div>
                                        <div className="v2-row-sub">
                                            {esAdmin ? (m.ingreso_type || 'Movimiento') : (m.ingreso_place || 'CCyS')}
                                            {esAdmin && m.user?.user_identification ? ` · ${m.user.user_identification}` : ''}
                                        </div>
                                    </div>
                                    <div className="v2-row-right">
                                        <div className="v2-row-time">{horaBogota(m.ingreso_datetime)}</div>
                                        <div className="v2-row-day">{fechaCortaBogota(m.ingreso_datetime)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

export default StatsDashboardV2;
