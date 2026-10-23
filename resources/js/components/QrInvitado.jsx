import React from 'react';
import { useTema } from '../utils/tema';
import QrInvitadoClasico from './clasico/QrInvitadoClasico';
import QrInvitadoV2 from './v2/QrInvitadoV2';

const QrInvitado = (props) => {
    const { esV2 } = useTema();
    return esV2 ? <QrInvitadoV2 {...props} /> : <QrInvitadoClasico {...props} />;
};

export default QrInvitado;
