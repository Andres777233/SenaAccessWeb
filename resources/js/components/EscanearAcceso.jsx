import React from 'react';
import { useTema } from '../utils/tema';
import EscanearAccesoClasico from './clasico/EscanearAccesoClasico';
import EscanearAccesoV2 from './v2/EscanearAccesoV2';

// Elegimos implementación según el sistema visual activo (Tema nuevo / viejo).
const EscanearAcceso = (props) => {
    const { esV2 } = useTema();
    return esV2 ? <EscanearAccesoV2 {...props} /> : <EscanearAccesoClasico {...props} />;
};

export default EscanearAcceso;
