import React from 'react';
import { useTema } from '../utils/tema';
import CodigoAccesoClasico from './clasico/CodigoAccesoClasico';
import CodigoAccesoV2 from './v2/CodigoAccesoV2';

const CodigoAcceso = (props) => {
    const { esV2 } = useTema();
    return esV2 ? <CodigoAccesoV2 {...props} /> : <CodigoAccesoClasico {...props} />;
};

export default CodigoAcceso;
