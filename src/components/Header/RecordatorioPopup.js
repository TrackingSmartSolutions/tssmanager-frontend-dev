import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Clock, Video, Phone, MapPin, ExternalLink } from 'lucide-react';
import './RecordatorioPopup.css';

const RecordatorioPopup = ({ actividad, onClose, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(false);
    const navigate = useNavigate();
    const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { tratos: true };

    useEffect(() => {
        // Animación de entrada
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    const handleVerTrato = () => {
        if (actividad.tratoId) {
            navigate(`/detallestrato/${actividad.tratoId}`);
            handleClose();
        }
    };

    const handleDismissAndClose = () => {
        onDismiss(actividad.id);
        handleClose();
    };

    const getTipoIcono = () => {
        if (actividad.tipo === 'REUNION') {
            return actividad.modalidad === 'VIRTUAL' ? <Video size={20} /> : <MapPin size={20} />;
        }
        return <Phone size={20} />;
    };

    const getTipoTexto = () => {
        if (actividad.tipo === 'REUNION') {
            return actividad.modalidad === 'VIRTUAL' ? 'Reunión Virtual' : 'Reunión Presencial';
        }
        return 'Llamada';
    };

    return (
        <div className={`recordatorio-popup ${isVisible ? 'visible' : ''}`}>
            <div className="recordatorio-header">
                <div className="recordatorio-icono">
                    {getTipoIcono()}
                </div>
                <div className="recordatorio-titulo">
                    <h4>{getTipoTexto()}</h4>
                    <span className="recordatorio-tiempo">
                        <Clock size={14} />
                        {actividad.tipo === 'LLAMADA' && actividad.minutosRestantes === 0
                            ? '¡Es hora de la llamada!'
                            : `En ${actividad.minutosRestantes} minutos`}
                    </span>
                </div>
                <button className="recordatorio-close" onClick={handleClose}>
                    <X size={18} />
                </button>
            </div>

            <div className="recordatorio-body">
                <p className="recordatorio-trato">{actividad.tratoNombre}</p>
                {actividad.empresaNombre && (
                    <p className="recordatorio-empresa">{actividad.empresaNombre}</p>
                )}

                <div className="recordatorio-detalles">
                    <span className="recordatorio-hora">
                        <Clock size={14} />
                        {actividad.horaInicio}
                    </span>
                    {actividad.duracion && (
                        <span className="recordatorio-duracion">
                            Duración: {actividad.duracion}
                        </span>
                    )}
                </div>

                {actividad.modalidad === 'VIRTUAL' && actividad.enlaceReunion && (
                    <a
                        href={actividad.enlaceReunion}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="recordatorio-link"
                    >
                        Unirse ahora
                    </a>
                )}

                {actividad.modalidad === 'PRESENCIAL' && actividad.lugarReunion && (
                    <p className="recordatorio-lugar">
                        <MapPin size={14} />
                        {actividad.lugarReunion}
                    </p>
                )}

                {actividad.tratoId && modulosActivos.tratos && (
                    <button
                        onClick={handleVerTrato}
                        className="recordatorio-btn-accion"
                        style={{
                            marginTop: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500'
                        }}
                    >
                        <ExternalLink size={14} />
                        Ver detalles del trato
                    </button>
                )}
            </div>

            <button className="recordatorio-dismiss" onClick={handleDismissAndClose}>
                No volver a mostrar
            </button>
        </div>
    );
};

export default RecordatorioPopup;