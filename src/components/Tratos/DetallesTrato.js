import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import "./DetallesTrato.css"
import Header from "../Header/Header"
import Swal from "sweetalert2"
import phoneIcon from "../../assets/icons/llamada.png"
import whatsappIcon from "../../assets/icons/whatsapp.png"
import emailIcon from "../../assets/icons/correo.png"
import addIcon from "../../assets/icons/agregar.png"
import taskIcon from "../../assets/icons/tarea.png"
import callIcon from "../../assets/icons/llamada.png"
import meetingIcon from "../../assets/icons/reunion.png"
import deleteIcon from "../../assets/icons/eliminar.png"
import editIcon from "../../assets/icons/editar.png"
import checkIcon from "../../assets/icons/ganado.png"
import closeIcon from "../../assets/icons/perdido.png"
import attachIcon from "../../assets/icons/adjunto-archivo.png";
import deploy from "../../assets/icons/desplegar.png"
import send from "../../assets/icons/enviar.png"
import downloadIcon from "../../assets/icons/descarga.png";
import receivableIcon from "../../assets/icons/cuenta-cobrar.png"
import { API_BASE_URL } from "../Config/Config";
import EditorToolbar from '../EditorToolbar/EditorToolbar';
import '../EditorToolbar/EditorToolbar.css';
import { CotizacionModal, CrearCuentasModal, SubirArchivoModal, CompartirCotizacionModal } from '../Admin/Admin_Cotizaciones';
import { useEmailStatusWebSocket } from '../../hooks/useEmailStatusWebSocket';

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token");

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`);
  return response;
};

const fetchTrato = async (id) => {
  try {
    const response = await fetchWithToken(`${API_BASE_URL}/tratos/${id}`);
    if (!response.ok) throw new Error(`Error fetching trato: ${response.status} - ${response.statusText}`);
    const data = await response.json();
    if (!data || !data.id) {
      throw new Error('Datos del trato incompletos');
    }
    return data;
  } catch (error) {
    console.error('Error fetching trato:', error);
    throw error;
  }
};

// Modal Base para DetallesTrato
const DetallesTratoModal = ({ isOpen, onClose, title, children, size = "md", canClose = true, closeOnOverlayClick = true }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="detalles-trato-modal-overlay" onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div className={`modal-content modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {canClose && (
            <button onClick={onClose} className="modal-close">
              ✕
            </button>
          )}
        </div>

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}

const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, onDownload }) => {
  if (!isOpen) return null;

  return (
    <div className="pdf-preview-modal">
      <DetallesTratoModal
        isOpen={isOpen}
        onClose={onClose}
        title="Vista previa"
        size="xl"
        closeOnOverlayClick={false}
      >
        <div className="pdf-preview-content">
          <div className="pdf-preview-actions">
            <button
              type="button"
              onClick={onDownload}
              className="btn-download-pdf"
            >
              Descargar PDF
            </button>
          </div>

          <div className="pdf-preview-frame">
            <iframe
              src={`${pdfUrl}#view=FitH&navpanes=0&toolbar=0`}
              title="Vista Previa"
            />
          </div>
        </div>
      </DetallesTratoModal>
    </div>
  );
};

// Modal para seleccionar tipo de actividad
const SeleccionarActividadModal = ({ isOpen, onClose, onSelectActivity }) => {
  const handleSelectActivity = (tipo) => {
    onSelectActivity(tipo)
    onClose()
  }

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Selecciona el tipo de actividad" size="sm" closeOnOverlayClick={false}>
      <div className="actividad-selector">
        <button className="btn-actividad-tipo" onClick={() => handleSelectActivity("llamada")}>
          Llamada
        </button>
        <button className="btn-actividad-tipo" onClick={() => handleSelectActivity("reunion")}>
          Reunión
        </button>
        <button className="btn-actividad-tipo" onClick={() => handleSelectActivity("tarea")}>
          Tarea
        </button>
      </div>
    </DetallesTratoModal>
  )
}

const generateMeetingLink = (medio) => {
  switch (medio) {
    case "MEET":
      return `https://meet.google.com/cnh-rpsw-mqx`;
    case "ZOOM":
      return `https://us05web.zoom.us/j/83706437137?pwd=AmRiXhFHbvSDXFxgltRleNbbEtKowA.1`;
    case "TEAMS":
      return `https://teams.live.com/meet/9340324739042?p=G4J8oZ2D2Nu8aWTJx3`;
    default:
      return "";
  }
};

// Modal para programar llamada 
const ProgramarLlamadaModal = ({ isOpen, onClose, onSave, tratoId, users, creatorId, contactos: contactosProp }) => {
  const [formData, setFormData] = useState({
    asignadoAId: "",
    nombreContacto: "",
    fecha: "",
    horaInicio: "",
  });
  const [errors, setErrors] = useState({});
  const [contactos, setContactos] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [usuariosActivos, setUsuariosActivos] = useState([]);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      setCurrentUser({ id: userId });
    }
  }, []);

  useEffect(() => {
    if (contactosProp && contactosProp.length > 0) {
      console.log('📥 CONTACTOS RECIBIDOS POR PROP:', contactosProp);
      setContactos(contactosProp);
    }
  }, [contactosProp]);

  useEffect(() => {
    const cargarUsuariosActivos = async () => {
      if (isOpen) {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
          const data = await response.json();
          const activeUsers = data.map(user => ({
            id: user.id,
            nombre: user.nombreUsuario,
            nombreReal: user.nombre
          }));
          setUsuariosActivos(activeUsers);
        } catch (error) {
          console.error("Error cargando usuarios activos:", error);
          setUsuariosActivos([]);
        }
      }
    };
    cargarUsuariosActivos();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const fetchTrato = async () => {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}`);
          const trato = await response.json();
          setFormData({
            asignadoAId: localStorage.getItem('userId') || creatorId || (usuariosActivos.length > 0 ? usuariosActivos[0].id : ""),
            nombreContacto: trato.contacto?.id || "",
            fecha: "",
            horaInicio: "",
          });
          setErrors({});
          if (trato.empresaId && (!contactosProp || contactosProp.length === 0)) {
            fetchContactos(trato.empresaId);
          }
        } catch (error) {
          Swal.fire({ icon: "error", title: "Error", text: "No se pudo cargar el trato" });
        }
      };
      if (tratoId) fetchTrato();
    }
  }, [isOpen, creatorId, tratoId, usuariosActivos]);

  const fetchContactos = async (empresaId) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/empresas/${empresaId}/contactos`);
      const data = await response.json();
      setContactos(data);
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los contactos" });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    const currentDate = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (!formData.nombreContacto) newErrors.nombreContacto = "Este campo es obligatorio";
    if (!formData.fecha.trim()) newErrors.fecha = "Este campo es obligatorio";
    else if (formData.fecha < currentDate) newErrors.fecha = "La fecha no puede ser en el pasado";
    if (!formData.horaInicio.trim()) newErrors.horaInicio = "Este campo es obligatorio";
    else if (formData.fecha === currentDate && formData.horaInicio < currentTime) {
      newErrors.horaInicio = "La hora no puede ser en el pasado";
    }
    if (!formData.horaInicio.trim()) newErrors.horaInicio = "Este campo es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [conflictoHorario, setConflictoHorario] = useState("");

  const verificarConflictoHorario = async (fecha, hora, duracion = null) => {
    if (!fecha || !hora || !formData.asignadoAId) {
      setConflictoHorario("");
      return false;
    }

    try {
      const params = new URLSearchParams({
        asignadoAId: formData.asignadoAId,
        fecha: fecha,
        hora: hora + ":00"
      });

      if (duracion) {
        params.append('duracion', duracion);
      }

      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/verificar-conflicto-horario?${params}`
      );

      const data = await response.json();

      if (data.hayConflicto) {
        setConflictoHorario("Ya existe una actividad programada en este horario para el usuario asignado.");
        return true;
      } else {
        setConflictoHorario("");
        return false;
      }
    } catch (error) {
      console.error("Error verificando conflicto:", error);
      return false;
    }
  };

  useEffect(() => {
    if (formData.fecha && formData.horaInicio && formData.asignadoAId) {
      const timeoutId = setTimeout(() => {
        verificarConflictoHorario(formData.fecha, formData.horaInicio, formData.duracion);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [formData.fecha, formData.horaInicio, formData.asignadoAId, formData.duracion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Verificar conflicto antes de enviar
    const hayConflicto = await verificarConflictoHorario(
      formData.fecha,
      formData.horaInicio,
      formData.duracion
    );

    if (hayConflicto) {
      return;
    }

    const horaInicio = formData.horaInicio ? `${formData.horaInicio}:00` : '';
    const actividadDTO = {
      tratoId,
      tipo: "LLAMADA",
      asignadoAId: formData.asignadoAId,
      contactoId: parseInt(formData.nombreContacto, 10),
      fechaLimite: formData.fecha,
      horaInicio: horaInicio,
    };

    try {
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/actividades`, {
        method: "POST",
        body: JSON.stringify(actividadDTO),
      });
      const savedActividad = await response.json();
      onSave(savedActividad);
      Swal.fire({
        title: "¡Llamada programada!",
        text: "La llamada se ha programado exitosamente",
        icon: "success",
      });
      onClose();
    } catch (error) {
      console.error("Error al programar la llamada:", error);
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Programar llamada" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label htmlFor="asignadoAId">Asignado a: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="asignadoAId"
              value={formData.asignadoAId}
              onChange={(e) => handleInputChange("asignadoAId", e.target.value)}
              className="modal-form-control"
            >
              {usuariosActivos.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombreReal}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
        </div>
        <div className="modal-form-group">
          <label htmlFor="nombreContacto">Nombre contacto: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="nombreContacto"
              value={formData.nombreContacto}
              onChange={(e) => handleInputChange("nombreContacto", e.target.value)}
              className={`modal-form-control ${errors.nombreContacto ? "error" : ""}`}
            >
              <option value="">Ninguna seleccionada</option>
              {contactos.map((contacto) => (
                <option key={contacto.id} value={contacto.id}>
                  {contacto.nombre}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.nombreContacto && <span className="error-message">{errors.nombreContacto}</span>}
        </div>
        <div className="modal-form-group">
          <label htmlFor="fecha">Fecha: <span className="required">*</span></label>
          <input
            type="date"
            id="fecha"
            value={formData.fecha}
            onChange={(e) => handleInputChange("fecha", e.target.value)}
            className={`modal-form-control ${errors.fecha ? "error" : ""}`}
            min={new Date().toLocaleDateString('en-CA')} />
          {errors.fecha && <span className="error-message">{errors.fecha}</span>}
        </div>
        <div className="modal-form-group">
          <label htmlFor="horaInicio">Hora: <span className="required">*</span></label>
          <input
            type="time"
            id="horaInicio"
            value={formData.horaInicio}
            onChange={(e) => handleInputChange("horaInicio", e.target.value)}
            className={`modal-form-control ${errors.horaInicio ? "error" : ""}`}
            min={formData.fecha === new Date().toLocaleDateString('en-CA') ? (() => {
              const now = new Date();
              return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            })() : undefined}

          />
          {errors.horaInicio && <span className="error-message">{errors.horaInicio}</span>}
        </div>

        {conflictoHorario && (
          <div className="conflict-warning">
            <span className="error-message">{conflictoHorario}</span>
          </div>
        )}
        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button type="submit" className="btn btn-primary">Agregar llamada</button>
        </div>
      </form>
    </DetallesTratoModal>
  );
};

// Modal para programar reunión
const ProgramarReunionModal = ({ isOpen, onClose, onSave, tratoId, users, creatorId, initialModalidad, contactos: contactosProp }) => {
  const [formData, setFormData] = useState({
    asignadoAId: "",
    nombreContacto: "",
    fecha: "",
    horaInicio: "",
    duracion: "00:30",
    modalidad: "VIRTUAL",
    lugarReunion: "",
    medio: "",
    enlaceReunion: "",
  });
  const [errors, setErrors] = useState({});
  const [contactos, setContactos] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [actividadCreada, setActividadCreada] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [usuariosActivos, setUsuariosActivos] = useState([]);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      setCurrentUser({ id: userId });
    }
  }, []);

  useEffect(() => {
    if (contactosProp && contactosProp.length > 0) {
      console.log('📥 CONTACTOS RECIBIDOS POR PROP (Reunión):', contactosProp);
      setContactos(contactosProp);
    }
  }, [contactosProp]);

  useEffect(() => {
    const cargarUsuariosActivos = async () => {
      if (isOpen) {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
          const data = await response.json();
          const activeUsers = data.map(user => ({
            id: user.id,
            nombre: user.nombreUsuario,
            nombreReal: user.nombre
          }));
          setUsuariosActivos(activeUsers);
        } catch (error) {
          console.error("Error cargando usuarios activos:", error);
          setUsuariosActivos([]);
        }
      }
    };
    cargarUsuariosActivos();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const fetchTrato = async () => {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}`);
          const trato = await response.json();
          const defaultContactName = trato.contacto?.nombre || "";
          let lugarPorDefecto = "";
          let empresaData = null;

          if (trato.empresaId) {
            const empresaResponse = await fetchWithToken(`${API_BASE_URL}/empresas/${trato.empresaId}`);
            empresaData = await empresaResponse.json();
            setEmpresa(empresaData);
            if (!contactosProp || contactosProp.length === 0) {
              fetchContactos(trato.empresaId);
            }

            if (initialModalidad === "PRESENCIAL" && empresaData.domicilioFisico) {
              lugarPorDefecto = empresaData.domicilioFisico;
            } else if (defaultContactName === "" && empresaData.domicilioFisico) {
              lugarPorDefecto = empresaData.domicilioFisico;
            }
          }
          setFormData({
            asignadoAId: localStorage.getItem('userId') || creatorId || (usuariosActivos.length > 0 ? usuariosActivos[0].id : ""),
            nombreContacto: trato.contacto?.id || "",
            fecha: "",
            horaInicio: "",
            duracion: "00:30",
            modalidad: initialModalidad || "VIRTUAL",
            lugarReunion: lugarPorDefecto,
            medio: "",
            enlaceReunion: "",
          });
          setErrors({});
          setContactos([]);
          setEmpresa(null);
          if (trato.empresaId) {
            const empresaResponse = await fetchWithToken(`${API_BASE_URL}/empresas/${trato.empresaId}`);
            const empresaData = await empresaResponse.json();
            setEmpresa(empresaData);
            if (!contactosProp || contactosProp.length === 0) {
              fetchContactos(trato.empresaId);
            }
            if (defaultContactName === "" && empresaData.domicilioFisico) {
              setFormData((prev) => ({ ...prev, lugarReunion: empresaData.domicilioFisico }));
            }
          }
        } catch (error) {
          Swal.fire({ icon: "error", title: "Error", text: "No se pudo cargar la empresa del trato" });
        }
      };
      if (tratoId) fetchTrato();
    }
  }, [isOpen, creatorId, usuariosActivos, tratoId, initialModalidad]);

  const fetchEmpresaDetails = async (tratoId) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}`);
      const trato = await response.json();
      if (trato.empresaId) {
        const empresaResponse = await fetchWithToken(`${API_BASE_URL}/empresas/${trato.empresaId}`);
        const empresaData = await empresaResponse.json();
        setEmpresa(empresaData);
        fetchContactos(trato.empresaId);
        if (formData.modalidad === "PRESENCIAL" && empresaData.domicilioFisico) {
          setFormData((prev) => ({ ...prev, lugarReunion: empresaData.domicilioFisico }));
        }
      }
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo cargar la empresa del trato" });
    }
  };

  const fetchContactos = async (empresaId) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/empresas/${empresaId}/contactos`);
      const data = await response.json();
      setContactos(data);
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los contactos" });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "modalidad" && empresa && empresa.domicilioFisico) {
        if (value === "PRESENCIAL") {
          newData.lugarReunion = empresa.domicilioFisico;
        } else if (value === "VIRTUAL") {
          newData.lugarReunion = "";
          newData.medio = "";
          newData.enlaceReunion = generateMeetingLink(newData.medio);
        }
      }
      if (field === "medio" && value) {
        newData.enlaceReunion = generateMeetingLink(value);
      }
      return newData;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };
  const validateForm = () => {
    const newErrors = {};
    const currentDate = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (!formData.nombreContacto) newErrors.nombreContacto = "Este campo es obligatorio";
    if (!formData.fecha.trim()) newErrors.fecha = "Este campo es obligatorio";
    else if (formData.fecha < currentDate) newErrors.fecha = "La fecha no puede ser en el pasado";
    if (!formData.horaInicio.trim()) newErrors.horaInicio = "Este campo es obligatorio";
    else if (formData.fecha === currentDate && formData.horaInicio < currentTime) {
      newErrors.horaInicio = "La hora no puede ser en el pasado";
    }
    if (!formData.duracion || formData.duracion.trim() === "") newErrors.duracion = "Este campo es obligatorio";
    if (!formData.modalidad.trim()) newErrors.modalidad = "Este campo es obligatorio";
    if (formData.modalidad === "PRESENCIAL" && !formData.lugarReunion.trim())
      newErrors.lugarReunion = "Lugar es obligatorio para reuniones presenciales";
    if (formData.modalidad === "VIRTUAL" && !formData.medio.trim())
      newErrors.medio = "Medio es obligatorio para reuniones virtuales";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [conflictoHorario, setConflictoHorario] = useState("");

  const verificarConflictoHorario = async (fecha, hora, duracion = null) => {
    if (!fecha || !hora || !formData.asignadoAId) {
      setConflictoHorario("");
      return false;
    }

    try {
      const params = new URLSearchParams({
        asignadoAId: formData.asignadoAId,
        fecha: fecha,
        hora: hora + ":00"
      });

      if (duracion) {
        params.append('duracion', duracion);
      }

      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/verificar-conflicto-horario?${params}`
      );

      const data = await response.json();

      if (data.hayConflicto) {
        setConflictoHorario("Ya existe una actividad programada en este horario para el usuario asignado.");
        return true;
      } else {
        setConflictoHorario("");
        return false;
      }
    } catch (error) {
      console.error("Error verificando conflicto:", error);
      return false;
    }
  };

  useEffect(() => {
    if (formData.fecha && formData.horaInicio && formData.asignadoAId) {
      const timeoutId = setTimeout(() => {
        verificarConflictoHorario(formData.fecha, formData.horaInicio, formData.duracion);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [formData.fecha, formData.horaInicio, formData.asignadoAId, formData.duracion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Verificar conflicto antes de enviar
    const hayConflicto = await verificarConflictoHorario(
      formData.fecha,
      formData.horaInicio,
      formData.duracion
    );

    if (hayConflicto) {
      return;
    }

    setIsLoading(true);

    const duracionStr = formData.duracion;
    const horaInicio = formData.horaInicio ? `${formData.horaInicio}:00` : '';

    const actividadDTO = {
      tratoId,
      tipo: "REUNION",
      asignadoAId: formData.asignadoAId,
      contactoId: formData.nombreContacto,
      fechaLimite: formData.fecha,
      horaInicio: horaInicio,
      duracion: duracionStr,
      modalidad: formData.modalidad,
      lugarReunion: formData.modalidad === "PRESENCIAL" ? formData.lugarReunion : null,
      medio: formData.modalidad === "VIRTUAL" ? formData.medio : null,
      enlaceReunion: formData.modalidad === "VIRTUAL" ? formData.enlaceReunion : null
    };

    try {
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/actividades`, {
        method: "POST",
        body: JSON.stringify(actividadDTO),
      });
      const savedActividad = await response.json();

      // Guardar datos para el modal de confirmación
      setActividadCreada(savedActividad);
      setMostrarConfirmacion(true);

    } catch (error) {
      console.error("Error al programar la reunión:", error);
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Programar reunión" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label htmlFor="asignadoAId">Asignado a: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="asignadoAId"
              value={formData.asignadoAId}
              onChange={(e) => handleInputChange("asignadoAId", e.target.value)}
              className="modal-form-control"
            >
              {usuariosActivos.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombreReal}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
        </div>
        <div className="modal-form-group">
          <label htmlFor="nombreContacto">Nombre contacto: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="nombreContacto"
              value={formData.nombreContacto}
              onChange={(e) => handleInputChange("nombreContacto", e.target.value)}
              className={`modal-form-control ${errors.nombreContacto ? "error" : ""}`}
            >
              <option value="">Ninguna seleccionada</option>
              {contactos.map((contacto) => (
                <option key={contacto.id} value={contacto.id}>
                  {contacto.nombre}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.nombreContacto && <span className="error-message">{errors.nombreContacto}</span>}
        </div>
        <div className="modal-form-group">
          <label htmlFor="fecha">Fecha: <span className="required">*</span></label>
          <input
            type="date"
            id="fecha"
            value={formData.fecha}
            onChange={(e) => handleInputChange("fecha", e.target.value)}
            className={`modal-form-control ${errors.fecha ? "error" : ""}`}
            min={new Date().toLocaleDateString('en-CA')} />

          {errors.fecha && <span className="error-message">{errors.fecha}</span>}
        </div>
        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="horaInicio">Hora inicio: <span className="required">*</span></label>
            <input
              type="time"
              id="horaInicio"
              value={formData.horaInicio}
              onChange={(e) => handleInputChange("horaInicio", e.target.value)}
              className={`modal-form-control ${errors.horaInicio ? "error" : ""}`}
              min={formData.fecha === new Date().toLocaleDateString('en-CA') ? (() => {
                const now = new Date();
                return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
              })() : undefined}
            />
            {errors.horaInicio && <span className="error-message">{errors.horaInicio}</span>}
          </div>


          <div className="modal-form-group">
            <label>Duración: <span className="required">*</span></label>
            <div className="modal-select-wrapper">
              <select
                id="duracion"
                value={formData.duracion}
                onChange={(e) => handleInputChange("duracion", e.target.value)}
                className={`modal-form-control ${errors.duracion ? "error" : ""}`}
              >
                <option value="00:30">30 minutos</option>
                <option value="01:00">1 hora</option>
                <option value="01:30">1 hora 30 minutos</option>
                <option value="02:00">2 horas</option>
                <option value="02:30">2 horas 30 minutos</option>
                <option value="03:00">3 horas</option>
              </select>
              <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
            </div>
            {errors.duracion && <span className="error-message">{errors.duracion}</span>}
          </div>
        </div>

        {conflictoHorario && (
          <div className="conflict-warning">
            <span className="error-message">{conflictoHorario}</span>
          </div>
        )}

        <div className="modal-form-group">
          <label htmlFor="modalidad">Modalidad: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="modalidad"
              value={formData.modalidad}
              onChange={(e) => handleInputChange("modalidad", e.target.value)}
              className={`modal-form-control ${errors.modalidad ? "error" : ""}`}
            >
              <option value="VIRTUAL">Virtual</option>
              <option value="PRESENCIAL">Presencial</option>
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.modalidad && <span className="error-message">{errors.modalidad}</span>}
        </div>
        {formData.modalidad === "PRESENCIAL" && (
          <div className="modal-form-group">
            <label htmlFor="lugarReunion">Lugar reunión: <span className="required">*</span></label>
            <input
              type="text"
              id="lugarReunion"
              value={formData.lugarReunion}
              onChange={(e) => handleInputChange("lugarReunion", e.target.value)}
              className={`modal-form-control ${errors.lugarReunion ? "error" : ""}`}
              placeholder="Domicilio físico de la empresa (editable)"
            />
            {errors.lugarReunion && <span className="error-message">{errors.lugarReunion}</span>}
          </div>
        )}
        {formData.modalidad === "VIRTUAL" && (
          <>
            <div className="modal-form-group">
              <label htmlFor="medio">Medio: <span className="required">*</span></label>
              <div className="modal-select-wrapper">
                <select
                  id="medio"
                  value={formData.medio}
                  onChange={(e) => handleInputChange("medio", e.target.value)}
                  className={`modal-form-control ${errors.medio ? "error" : ""}`}
                >
                  <option value="">Ninguna seleccionada</option>
                  <option value="MEET">Google Meet</option>
                  <option value="ZOOM">Zoom</option>
                  <option value="TEAMS">Microsoft Teams</option>
                </select>
                <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
              </div>
              {errors.medio && <span className="error-message">{errors.medio}</span>}
            </div>
            {formData.medio && (
              <div className="modal-form-group">
                <label htmlFor="enlaceReunion">Enlace de la reunión:</label>
                <input
                  type="text"
                  id="enlaceReunion"
                  value={formData.enlaceReunion}
                  readOnly
                  className="modal-form-control"
                />
              </div>
            )}
          </>
        )}
        <div className="modal-form-actions">
          <div className="modal-form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isLoading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? "Programando..." : "Agregar reunión"}
            </button>
          </div>
        </div>
      </form>
      <ConfirmacionEnvioModal
        isOpen={mostrarConfirmacion}
        onClose={() => {
          setMostrarConfirmacion(false);
          setActividadCreada(null);
          onClose();
        }}
        onConfirm={() => {
          Swal.fire({
            title: "¡Reunión programada!",
            text: "La reunión se ha programado exitosamente",
            icon: "success",
          });

          onSave(actividadCreada, "REUNION");
          setMostrarConfirmacion(false);
          setActividadCreada(null);
        }}
        tratoId={tratoId}
        actividadId={actividadCreada?.id}
        esReprogramacion={false}
      />
    </DetallesTratoModal>
  );
};

// Modal para programar tarea
const ProgramarTareaModal = ({ isOpen, onClose, onSave, tratoId, users, creatorId, initialTipo, contactos: contactosProp }) => {
  const [formData, setFormData] = useState({
    aasignadoAId: "",
    nombreContacto: "",
    fechaLimite: "",
    tipo: "",
    notas: ""
  });
  const [errors, setErrors] = useState({});
  const [contactos, setContactos] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [usuariosActivos, setUsuariosActivos] = useState([]);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      setCurrentUser({ id: userId });
    }
  }, []);

  useEffect(() => {
    if (contactosProp && contactosProp.length > 0) {
      console.log('📥 CONTACTOS RECIBIDOS POR PROP (Tarea):', contactosProp);
      setContactos(contactosProp);
    }
  }, [contactosProp]);

  useEffect(() => {
    const cargarUsuariosActivos = async () => {
      if (isOpen) {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
          const data = await response.json();
          const activeUsers = data.map(user => ({
            id: user.id,
            nombre: user.nombreUsuario,
            nombreReal: user.nombre
          }));
          setUsuariosActivos(activeUsers);
        } catch (error) {
          console.error("Error cargando usuarios activos:", error);
          setUsuariosActivos([]);
        }
      }
    };
    cargarUsuariosActivos();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const fetchTrato = async () => {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}`);
          const trato = await response.json();
          setFormData({
            asignadoAId: localStorage.getItem('userId') || creatorId || (usuariosActivos.length > 0 ? usuariosActivos[0].id : ""),
            nombreContacto: trato.contacto?.id || "",
            fechaLimite: "",
            tipo: initialTipo || "",
            notas: ""
          });
          setErrors({});
          if (trato.empresaId && (!contactosProp || contactosProp.length === 0)) {
            fetchContactos(trato.empresaId);
          }
        } catch (error) {
          Swal.fire({ icon: "error", title: "Error", text: "No se pudo cargar el trato" });
        }
      };
      if (tratoId) fetchTrato();
    }
  }, [isOpen, creatorId, usuariosActivos, tratoId, initialTipo]);

  const fetchContactos = async (empresaId) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/empresas/${empresaId}/contactos`);
      const data = await response.json();
      setContactos(data);
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los contactos" });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    const currentDate = new Date().toLocaleDateString('en-CA');
    if (!formData.nombreContacto) newErrors.nombreContacto = "Este campo es obligatorio";
    if (!formData.fechaLimite.trim()) newErrors.fechaLimite = "Este campo es obligatorio";
    else if (formData.fechaLimite < currentDate) newErrors.fechaLimite = "La fecha no puede ser en el pasado";
    if (!formData.tipo.trim()) newErrors.tipo = "Este campo es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const actividadDTO = {
      tratoId,
      tipo: "TAREA",
      asignadoAId: formData.asignadoAId,
      contactoId: formData.nombreContacto,
      fechaLimite: formData.fechaLimite,
      subtipoTarea: formData.tipo.toUpperCase(),
      notas: formData.notas
    };

    try {
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/actividades`, {
        method: "POST",
        body: JSON.stringify(actividadDTO),
      });
      const savedActividad = await response.json();
      onSave(savedActividad);
      Swal.fire({
        title: "¡Tarea programada!",
        text: "La tarea se ha programado exitosamente",
        icon: "success",
      });
      onClose();
    } catch (error) {
      console.error("Error al programar la tarea:", error);
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Programar tarea" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label htmlFor="asignadoAId">Asignado a: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="asignadoAId"
              value={formData.asignadoAId}
              onChange={(e) => handleInputChange("asignadoAId", e.target.value)}
              className="modal-form-control"
            >
              {usuariosActivos.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombreReal}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
        </div>
        <div className="modal-form-group">
          <label htmlFor="nombreContacto">Nombre contacto: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="nombreContacto"
              value={formData.nombreContacto}
              onChange={(e) => handleInputChange("nombreContacto", e.target.value)}
              className={`modal-form-control ${errors.nombreContacto ? "error" : ""}`}
            >
              <option value="">Ninguna seleccionada</option>
              {contactos.map((contacto) => (
                <option key={contacto.id} value={contacto.id}>
                  {contacto.nombre}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.nombreContacto && <span className="error-message">{errors.nombreContacto}</span>}
        </div>
        <div className="modal-form-group">
          <label htmlFor="fechaLimite">Fecha límite: <span className="required">*</span></label>
          <input
            type="date"
            id="fechaLimite"
            value={formData.fechaLimite}
            onChange={(e) => handleInputChange("fechaLimite", e.target.value)}
            className={`modal-form-control ${errors.fechaLimite ? "error" : ""}`}
            min={new Date().toLocaleDateString('en-CA')} />
          {errors.fechaLimite && <span className="error-message">{errors.fechaLimite}</span>}
        </div>
        <div className="modal-form-group">
          <label>Tipo: <span className="required">*</span></label>
          <div className="tipo-buttons">
            <button
              type="button"
              className={`btn-tipo ${formData.tipo === "Correo" ? "active" : ""}`}
              onClick={() => handleInputChange("tipo", "Correo")}
            >
              Correo
            </button>
            <button
              type="button"
              className={`btn-tipo ${formData.tipo === "Mensaje" ? "active" : ""}`}
              onClick={() => handleInputChange("tipo", "Mensaje")}
            >
              Mensaje
            </button>
            <button
              type="button"
              className={`btn-tipo ${formData.tipo === "Actividad" ? "active" : ""}`}
              onClick={() => handleInputChange("tipo", "Actividad")}
            >
              Actividad
            </button>
          </div>
          {errors.tipo && <span className="error-message">{errors.tipo}</span>}
        </div>

        <div className="modal-form-group">
          <label htmlFor="notas">Notas:</label>
          <textarea
            id="notas"
            value={formData.notas}
            onChange={(e) => handleInputChange("notas", e.target.value)}
            className="modal-form-control"
            rows="3"
            placeholder="Notas adicionales (opcional)"
          />
        </div>
        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button type="submit" className="btn btn-primary">Agregar tarea</button>
        </div>
      </form>
    </DetallesTratoModal>
  );
};

// Modal para reprogramar llamada
const ReprogramarLlamadaModal = ({ isOpen, onClose, onSave, actividad }) => {
  const [formData, setFormData] = useState({
    asignadoAId: "",
    nombreContactoId: "",
    nuevaFecha: "",
    nuevaHora: "",
  });
  const [errors, setErrors] = useState({});
  const [contactos, setContactos] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (actividad && isOpen) {
        try {
          const usersResponse = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
          const usersData = await usersResponse.json();
          setUsers(usersData.map((user) => ({ id: user.id, nombre: user.nombre })));

          const tratoResponse = await fetchWithToken(`${API_BASE_URL}/tratos/${actividad.tratoId}`);
          const trato = await tratoResponse.json();
          if (trato.empresaId) {
            const contactosResponse = await fetchWithToken(
              `${API_BASE_URL}/empresas/${trato.empresaId}/contactos`
            );
            const contactosData = await contactosResponse.json();
            setContactos(contactosData);
          }

          // Parse fechaLimite to YYYY-MM-DD
          let nuevaFecha = "";
          if (actividad.fechaLimite) {
            try {
              const date = new Date(actividad.fechaLimite);
              if (!isNaN(date.getTime())) {
                nuevaFecha = date.toISOString().split("T")[0];
              }
            } catch (error) {
              console.error("Error parsing fechaLimite:", actividad.fechaLimite, error);
            }
          }

          // Parse horaInicio to HH:mm
          let nuevaHora = "";
          if (actividad.horaInicio) {
            try {
              const timeParts = actividad.horaInicio.split(":");
              if (timeParts.length >= 2) {
                nuevaHora = `${timeParts[0]}:${timeParts[1]}`;
              }
            } catch (error) {
              console.error("Error parsing horaInicio:", actividad.horaInicio, error);
            }
          }

          setFormData({
            asignadoAId: actividad.asignadoAId || "",
            nombreContactoId: actividad.contactoId || "",
            nuevaFecha: nuevaFecha,
            nuevaHora: nuevaHora,
          });
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudieron cargar los datos iniciales",
          });
        }
      }
    };
    fetchInitialData();
  }, [actividad, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));

    if (field === "nuevaFecha" || field === "nuevaHora" || field === "asignadoAId") {
      const updatedData = { ...formData, [field]: value };
      if (updatedData.asignadoAId && updatedData.nuevaFecha && updatedData.nuevaHora) {
        verificarConflictoHorario(updatedData.asignadoAId, updatedData.nuevaFecha, updatedData.nuevaHora);
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const currentDate = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (!formData.nuevaFecha.trim()) newErrors.nuevaFecha = "Este campo es obligatorio";
    else if (formData.nuevaFecha < currentDate) newErrors.nuevaFecha = "La fecha no puede ser en el pasado";
    if (!formData.nuevaHora.trim()) newErrors.nuevaHora = "Este campo es obligatorio";
    else if (formData.nuevaFecha === currentDate && formData.nuevaHora < currentTime) {
      newErrors.nuevaHora = "La hora no puede ser en el pasado";
    }
    if (!formData.asignadoAId) newErrors.asignadoAId = "Este campo es obligatorio";
    if (!formData.nombreContactoId) newErrors.nombreContactoId = "Este campo es obligatorio";
    if (conflictoHorario) {
      newErrors.conflicto = "Ya existe una actividad programada en este horario";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [conflictoHorario, setConflictoHorario] = useState(false);

  const verificarConflictoHorario = async (asignadoAId, fecha, hora) => {
    if (!asignadoAId || !fecha || !hora) {
      setConflictoHorario(false);
      return;
    }

    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/verificar-conflicto-horario?asignadoAId=${asignadoAId}&fecha=${fecha}&hora=${hora}:00&actividadIdExcluir=${actividad.id}`
      );
      const data = await response.json();
      setConflictoHorario(data.hayConflicto);
    } catch (error) {
      console.error("Error verificando conflicto:", error);
      setConflictoHorario(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const actividadDTO = {
      id: actividad.id,
      tratoId: actividad.tratoId,
      tipo: "LLAMADA",
      asignadoAId: parseInt(formData.asignadoAId, 10),
      contactoId: parseInt(formData.nombreContactoId, 10),
      fechaLimite: formData.nuevaFecha,
      horaInicio: `${formData.nuevaHora}:00`,
      estado: "Reprogramada",
    };

    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/${actividad.tratoId}/actividades/${actividad.id}`,
        {
          method: "PUT",
          body: JSON.stringify(actividadDTO),
        }
      );
      const updatedActividad = await response.json();
      onSave(updatedActividad);

      window.dispatchEvent(new CustomEvent('actividadCompletada', { detail: { id: actividad.id } }));

      Swal.fire({
        title: "¡Llamada reprogramada!",
        text: "La llamada se ha reprogramado exitosamente",
        icon: "success",
      });
      onClose();
    } catch (error) {
      console.error("Error al reprogramar la llamada:", error);
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Reprogramar llamada" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label htmlFor="asignadoAId">Asignado a: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="asignadoAId"
              value={formData.asignadoAId}
              onChange={(e) => handleInputChange("asignadoAId", e.target.value)}
              className="modal-form-control"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombre}
                </option>
              ))}
            </select>
            <img src={deploy} alt="Desplegar" className="deploy-icon" />
          </div>
        </div>
        <div className="modal-form-group">
          <label htmlFor="nombreContactoId">Nombre contacto: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="nombreContactoId"
              value={formData.nombreContactoId}
              onChange={(e) => handleInputChange("nombreContactoId", e.target.value)}
              className={`modal-form-control ${errors.nombreContactoId ? "error" : ""}`}
            >
              <option value="">Seleccione un contacto</option>
              {contactos.map((contacto) => (
                <option key={contacto.id} value={contacto.id}>
                  {contacto.nombre}
                </option>
              ))}
            </select>
            <img src={deploy} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.nombreContactoId && <span className="error-message">{errors.nombreContactoId}</span>}
        </div>
        <div className="modal-form-group">
          <label htmlFor="nuevaFecha">Nueva fecha: <span className="required">*</span></label>
          <input
            type="date"
            id="nuevaFecha"
            value={formData.nuevaFecha}
            onChange={(e) => handleInputChange("nuevaFecha", e.target.value)}
            className={`modal-form-control ${errors.nuevaFecha ? "error" : ""}`}
            min={new Date().toLocaleDateString('en-CA')} />

          {errors.nuevaFecha && <span className="error-message">{errors.nuevaFecha}</span>}
        </div>
        <div className="modal-form-group">
          <label htmlFor="nuevaHora">Nueva hora: <span className="required">*</span></label>
          <input
            type="time"
            id="nuevaHora"
            value={formData.nuevaHora}
            onChange={(e) => handleInputChange("nuevaHora", e.target.value)}
            className={`modal-form-control ${errors.nuevaHora ? "error" : ""}`}
            min={formData.nuevaFecha === new Date().toLocaleDateString('en-CA') ? (() => {
              const now = new Date();
              return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            })() : undefined}
          />
          {errors.nuevaHora && <span className="error-message">{errors.nuevaHora}</span>}
        </div>

        {conflictoHorario && (
          <div className="conflict-warning">
            <span className="error-message">Ya hay una actividad asignada en este horario</span>
          </div>
        )}

        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button type="submit" className="btn btn-primary">Confirmar cambios</button>
        </div>
      </form>
    </DetallesTratoModal>
  );
};

// Modal para reprogramar reunión 
const ReprogramarReunionModal = ({ isOpen, onClose, onSave, actividad }) => {
  const [formData, setFormData] = useState({
    asignadoAId: "",
    nombreContactoId: "",
    nuevaFecha: "",
    nuevaHoraInicio: "",
    duracion: "00:30",
    modalidad: "",
    medio: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [contactos, setContactos] = useState([]);
  const [users, setUsers] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [actividadActualizada, setActividadActualizada] = useState(null);


  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (actividad && isOpen) {
        try {
          setLoading(true);
          const usersResponse = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
          const usersData = await usersResponse.json();
          setUsers(usersData.map((user) => ({ id: user.id, nombre: user.nombre })));

          const tratoResponse = await fetchWithToken(`${API_BASE_URL}/tratos/${actividad.tratoId}`);
          const trato = await tratoResponse.json();

          if (trato.empresaId) {
            const empresaResponse = await fetchWithToken(`${API_BASE_URL}/empresas/${trato.empresaId}`);
            const empresaData = await empresaResponse.json();
            setEmpresa(empresaData);

            const contactosResponse = await fetchWithToken(`${API_BASE_URL}/empresas/${trato.empresaId}/contactos`);
            const contactosData = await contactosResponse.json();
            setContactos(contactosData);
          }

          const duracionCompleta = actividad.duracion || "00:30";
          const initialEnlace = actividad.medio ? generateMeetingLink(actividad.medio) : "";
          const initialLugarReunion = actividad.modalidad === "PRESENCIAL" ?
            (actividad.lugarReunion || empresa?.domicilioFisico || "") : "";

          setFormData({
            asignadoAId: actividad.asignadoAId || "",
            nombreContactoId: actividad.contactoId || "",
            nuevaFecha: actividad.fechaLimite ? actividad.fechaLimite.split("T")[0] : "",
            nuevaHoraInicio: actividad.horaInicio ? actividad.horaInicio.split(":")[0] + ":" + actividad.horaInicio.split(":")[1] : "",
            duracion: duracionCompleta,
            modalidad: actividad.modalidad || "",
            medio: actividad.medio || "",
            lugarReunion: initialLugarReunion,
            enlaceReunion: initialEnlace,
          });
        } catch (error) {
          Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los datos iniciales" });
        } finally {
          setLoading(false);
        }
      }
    };
    fetchInitialData();
  }, [actividad, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "medio" && value) {
        newData.enlaceReunion = generateMeetingLink(value);
      }
      if (field === "modalidad") {
        if (value === "VIRTUAL") {
          newData.lugarReunion = "";
          newData.medio = "";
          newData.enlaceReunion = generateMeetingLink(newData.medio);
        } else if (value === "PRESENCIAL" && empresa?.domicilioFisico) {
          newData.lugarReunion = empresa.domicilioFisico;
          newData.medio = "";
          newData.enlaceReunion = "";
        }
      }

      if (field === "nuevaFecha" || field === "nuevaHoraInicio" || field === "asignadoAId" || field === "duracion") {
        if (newData.asignadoAId && newData.nuevaFecha && newData.nuevaHoraInicio) {
          verificarConflictoHorario(newData.asignadoAId, newData.nuevaFecha, newData.nuevaHoraInicio, newData.duracion);
        }
      }
      return newData;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    const currentDate = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (!formData.nuevaFecha.trim()) newErrors.nuevaFecha = "Este campo es obligatorio";
    else if (formData.nuevaFecha < currentDate) newErrors.nuevaFecha = "La fecha no puede ser en el pasado";
    if (!formData.nuevaHoraInicio.trim()) newErrors.nuevaHoraInicio = "Este campo es obligatorio";
    else if (formData.nuevaFecha === currentDate && formData.nuevaHoraInicio < currentTime) {
      newErrors.nuevaHoraInicio = "La hora no puede ser en el pasado";
    }
    if (!formData.duracion || formData.duracion.trim() === "") newErrors.duracion = "Este campo es obligatorio";
    if (!formData.modalidad.trim()) newErrors.modalidad = "Este campo es obligatorio";
    if (formData.modalidad === "PRESENCIAL" && !formData.lugarReunion.trim())
      newErrors.lugarReunion = "Lugar es obligatorio para reuniones presenciales";
    if (formData.modalidad === "VIRTUAL" && !formData.medio.trim())
      newErrors.medio = "Medio es obligatorio para reuniones virtuales";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [conflictoHorario, setConflictoHorario] = useState(false);

  const verificarConflictoHorario = async (asignadoAId, fecha, hora, duracion) => {
    if (!asignadoAId || !fecha || !hora) {
      setConflictoHorario(false);
      return;
    }

    try {
      const duracionParam = duracion ? `&duracion=${duracion}` : '';
      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/verificar-conflicto-horario?asignadoAId=${asignadoAId}&fecha=${fecha}&hora=${hora}:00&actividadIdExcluir=${actividad.id}`
      );
      const data = await response.json();
      setConflictoHorario(data.hayConflicto);
    } catch (error) {
      console.error("Error verificando conflicto:", error);
      setConflictoHorario(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || isSubmittingRef.current || !validateForm()) {
      return;
    }

    setIsLoading(true);

    // Marcar como enviando
    isSubmittingRef.current = true;

    const duracionStr = formData.duracion;

    const actividadDTO = {
      id: actividad.id,
      tratoId: actividad.tratoId,
      tipo: "REUNION",
      asignadoAId: formData.asignadoAId,
      contactoId: parseInt(formData.nombreContactoId, 10),
      fechaLimite: formData.nuevaFecha,
      horaInicio: `${formData.nuevaHoraInicio}:00`,
      duracion: duracionStr,
      modalidad: formData.modalidad,
      medio: formData.modalidad === "VIRTUAL" ? formData.medio : null,
      lugarReunion: formData.modalidad === "PRESENCIAL" ? formData.lugarReunion : null,
      enlaceReunion: formData.modalidad === "VIRTUAL" ? formData.enlaceReunion : null,
      estado: "Reprogramada",
    };

    try {
      setLoading(true);

      const response = await fetchWithToken(`${API_BASE_URL}/tratos/${actividad.tratoId}/actividades/${actividad.id}`, {
        method: "PUT",
        body: JSON.stringify(actividadDTO),
      });

      const updatedActividad = await response.json();


      // Guardar datos para el modal de confirmación
      setActividadActualizada(updatedActividad);
      setMostrarConfirmacion(true);

    } catch (error) {
      console.error("Error al reprogramar la reunión:", error);
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    } finally {
      setIsLoading(false);
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Reprogramar reunión" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label htmlFor="asignadoAId">Asignado a: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="asignadoAId"
              value={formData.asignadoAId}
              onChange={(e) => handleInputChange("asignadoAId", e.target.value)}
              className="modal-form-control"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombre}
                </option>
              ))}
            </select>
            <img src={deploy} alt="Desplegar" className="deploy-icon" />
          </div>
        </div>
        <div className="modal-form-group">
          <label htmlFor="nombreContactoId">Nombre contacto: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="nombreContactoId"
              value={formData.nombreContactoId}
              onChange={(e) => handleInputChange("nombreContactoId", e.target.value)}
              className={`modal-form-control ${errors.nombreContactoId ? "error" : ""}`}
            >
              <option value="">Seleccione un contacto</option>
              {contactos.map((contacto) => (
                <option key={contacto.id} value={contacto.id}>
                  {contacto.nombre}
                </option>
              ))}
            </select>
            <img src={deploy} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.nombreContactoId && <span className="error-message">{errors.nombreContactoId}</span>}
        </div>
        <div className="modal-form-group">
          <label htmlFor="nuevaFecha">Nueva fecha: <span className="required">*</span></label>
          <input
            type="date"
            id="nuevaFecha"
            value={formData.nuevaFecha}
            onChange={(e) => handleInputChange("nuevaFecha", e.target.value)}
            className={`modal-form-control ${errors.nuevaFecha ? "error" : ""}`}
            min={new Date().toLocaleDateString('en-CA')} />

          {errors.nuevaFecha && <span className="error-message">{errors.nuevaFecha}</span>}
        </div>
        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="nuevaHoraInicio">Nueva hora inicio: <span className="required">*</span></label>
            <input
              type="time"
              id="nuevaHoraInicio"
              value={formData.nuevaHoraInicio}
              onChange={(e) => handleInputChange("nuevaHoraInicio", e.target.value)}
              className={`modal-form-control ${errors.nuevaHoraInicio ? "error" : ""}`}
              min={formData.nuevaFecha === new Date().toLocaleDateString('en-CA') ? (() => {
                const now = new Date();
                return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
              })() : undefined}
            />
            {errors.nuevaHoraInicio && <span className="error-message">{errors.nuevaHoraInicio}</span>}
          </div>
          <div className="modal-form-group">
            <label>Duración: <span className="required">*</span></label>
            <div className="modal-select-wrapper">
              <select
                id="duracion"
                value={formData.duracion}
                onChange={(e) => handleInputChange("duracion", e.target.value)}
                className={`modal-form-control ${errors.duracion ? "error" : ""}`}
              >
                <option value="00:30">30 minutos</option>
                <option value="01:00">1 hora</option>
                <option value="01:30">1 hora 30 minutos</option>
                <option value="02:00">2 horas</option>
                <option value="02:30">2 horas 30 minutos</option>
                <option value="03:00">3 horas</option>
              </select>
              <img src={deploy} alt="Desplegar" className="deploy-icon" />
            </div>
            {errors.duracion && <span className="error-message">{errors.duracion}</span>}
          </div>
        </div>

        {conflictoHorario && (
          <div className="conflict-warning">
            <span className="error-message">Ya hay una actividad asignada en este horario</span>
          </div>
        )}

        <div className="modal-form-group">
          <label htmlFor="modalidad">Modalidad: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="modalidad"
              value={formData.modalidad}
              onChange={(e) => handleInputChange("modalidad", e.target.value)}
              className={`modal-form-control ${errors.modalidad ? "error" : ""}`}
            >
              <option value="">Seleccionar modalidad</option>
              <option value="VIRTUAL">Virtual</option>
              <option value="PRESENCIAL">Presencial</option>
            </select>
            <img src={deploy} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.modalidad && <span className="error-message">{errors.modalidad}</span>}
        </div>
        {formData.modalidad === "PRESENCIAL" && (
          <div className="modal-form-group">
            <label htmlFor="lugarReunion">Lugar reunión: <span className="required">*</span></label>
            <input
              type="text"
              id="lugarReunion"
              value={formData.lugarReunion}
              onChange={(e) => handleInputChange("lugarReunion", e.target.value)}
              className={`modal-form-control ${errors.lugarReunion ? "error" : ""}`}
              placeholder="Domicilio físico de la empresa (editable)"
            />
            {errors.lugarReunion && <span className="error-message">{errors.lugarReunion}</span>}
          </div>
        )}
        {formData.modalidad === "VIRTUAL" && (
          <div className="modal-form-group">
            <label htmlFor="medio">Medio: <span className="required">*</span></label>
            <div className="modal-select-wrapper">
              <select
                id="medio"
                value={formData.medio}
                onChange={(e) => handleInputChange("medio", e.target.value)}
                className={`modal-form-control ${errors.medio ? "error" : ""}`}
              >
                <option value="">Seleccionar medio</option>
                <option value="MEET">Google Meet</option>
                <option value="ZOOM">Zoom</option>
                <option value="TEAMS">Microsoft Teams</option>
              </select>
              <img src={deploy} alt="Desplegar" className="deploy-icon" />
            </div>
            {errors.medio && <span className="error-message">{errors.medio}</span>}
          </div>
        )}
        {formData.modalidad === "VIRTUAL" && formData.medio && (
          <div className="modal-form-group">
            <label htmlFor="enlaceReunion">Enlace de la reunión:</label>
            <input
              type="text"
              id="enlaceReunion"
              value={formData.enlaceReunion}
              readOnly
              className="modal-form-control"
            />
          </div>
        )}
        <div className="modal-form-actions">
          <div className="modal-form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isLoading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? "Reprogramando..." : "Confirmar Cambios"}
            </button>
          </div>
        </div>
      </form>
      <ConfirmacionEnvioModal
        isOpen={mostrarConfirmacion}
        onClose={() => {
          setMostrarConfirmacion(false);
          setActividadActualizada(null);
          onClose();
        }}
        onConfirm={() => {
          Swal.fire({
            title: "¡Reunión reprogramada!",
            text: "La reunión se ha reprogramado exitosamente",
            icon: "success",
          });

          window.dispatchEvent(new CustomEvent('actividadCompletada', { detail: { id: actividad?.id } }));

          onSave(actividadActualizada);
          setMostrarConfirmacion(false);
          setActividadActualizada(null);
        }}
        tratoId={actividad?.tratoId}
        actividadId={actividadActualizada?.id}
        esReprogramacion={true}
      />
    </DetallesTratoModal>
  );
};

// Modal para reprogramar tarea
const ReprogramarTareaModal = ({ isOpen, onClose, onSave, actividad }) => {
  const [formData, setFormData] = useState({
    asignadoAId: "",
    nombreContactoId: "",
    nuevaFechaLimite: "",
    tipo: "",
    notas: ""
  });
  const [errors, setErrors] = useState({});
  const [contactos, setContactos] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (actividad && isOpen) {
        try {
          const usersResponse = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
          const usersData = await usersResponse.json();
          setUsers(usersData.map((user) => ({ id: user.id, nombre: user.nombre })));

          const tratoResponse = await fetchWithToken(`${API_BASE_URL}/tratos/${actividad.tratoId}`);
          const trato = await tratoResponse.json();
          if (trato.empresaId) {
            const contactosResponse = await fetchWithToken(
              `${API_BASE_URL}/empresas/${trato.empresaId}/contactos`
            );
            const contactosData = await contactosResponse.json();
            setContactos(contactosData);
          }

          // Parse fechaLimite to YYYY-MM-DD
          let nuevaFechaLimite = "";
          if (actividad.fechaLimite) {
            try {
              const date = new Date(actividad.fechaLimite);
              if (!isNaN(date.getTime())) {
                nuevaFechaLimite = date.toISOString().split("T")[0];
              }
            } catch (error) {
              console.error("Error parsing fechaLimite:", actividad.fechaLimite, error);
            }
          }

          setFormData({
            asignadoAId: actividad.asignadoAId || "",
            nombreContactoId: actividad.contactoId || "",
            nuevaFechaLimite: nuevaFechaLimite,
            tipo: actividad.subtipoTarea
              ? actividad.subtipoTarea.charAt(0).toUpperCase() +
              actividad.subtipoTarea.slice(1).toLowerCase()
              : "",
            notas: actividad.notas || ""
          });
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudieron cargar los datos iniciales",
          });
        }
      }
    };
    fetchInitialData();
  }, [actividad, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    const currentDate = new Date().toLocaleDateString('en-CA');
    if (!formData.nuevaFechaLimite.trim()) newErrors.nuevaFechaLimite = "Este campo es obligatorio";
    else if (formData.nuevaFechaLimite < currentDate) newErrors.nuevaFechaLimite = "La fecha no puede ser en el pasado";
    if (!formData.tipo.trim()) newErrors.tipo = "Este campo es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const actividadDTO = {
      id: actividad.id,
      tratoId: actividad.tratoId,
      tipo: "TAREA",
      asignadoAId: parseInt(formData.asignadoAId, 10),
      contactoId: parseInt(formData.nombreContactoId, 10),
      fechaLimite: formData.nuevaFechaLimite,
      subtipoTarea: formData.tipo.toUpperCase(),
      estado: "Reprogramada",
      notas: formData.notas
    };

    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/${actividad.tratoId}/actividades/${actividad.id}`,
        {
          method: "PUT",
          body: JSON.stringify(actividadDTO),
        }
      );
      const updatedActividad = await response.json();
      onSave(updatedActividad);
      Swal.fire({
        title: "¡Tarea reprogramada!",
        text: "La tarea se ha reprogramado exitosamente",
        icon: "success",
      });
      onClose();
    } catch (error) {
      console.error("Error al reprogramar la tarea:", error);
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Reprogramar tarea" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label htmlFor="asignadoAId">Asignado a: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="asignadoAId"
              value={formData.asignadoAId}
              onChange={(e) => handleInputChange("asignadoAId", e.target.value)}
              className="modal-form-control"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombre}
                </option>
              ))}
            </select>
            <img src={deploy} alt="Desplegar" className="deploy-icon" />
          </div>
        </div>
        <div className="modal-form-group">
          <label htmlFor="nombreContactoId">Nombre contacto: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              id="nombreContactoId"
              value={formData.nombreContactoId}
              onChange={(e) => handleInputChange("nombreContactoId", e.target.value)}
              className={`modal-form-control ${errors.nombreContactoId ? "error" : ""}`}
            >
              <option value="">Seleccione un contacto</option>
              {contactos.map((contacto) => (
                <option key={contacto.id} value={contacto.id}>
                  {contacto.nombre}
                </option>
              ))}
            </select>
            <img src={deploy} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.nombreContactoId && <span className="error-message">{errors.nombreContactoId}</span>}
        </div>
        <div className="modal-form-group">
          <label htmlFor="nuevaFechaLimite">Nueva fecha límite: <span className="required">*</span></label>
          <input
            type="date"
            id="nuevaFechaLimite"
            value={formData.nuevaFechaLimite}
            onChange={(e) => handleInputChange("nuevaFechaLimite", e.target.value)}
            className={`modal-form-control ${errors.nuevaFechaLimite ? "error" : ""}`}
            min={new Date().toLocaleDateString('en-CA')} />
          {errors.nuevaFechaLimite && <span className="error-message">{errors.nuevaFechaLimite}</span>}
        </div>

        <div className="modal-form-group">
          <label>Tipo: <span className="required">*</span></label>
          <div className="tipo-buttons">
            <button
              type="button"
              className={`btn-tipo ${formData.tipo === "Correo" ? "active" : ""}`}
              onClick={() => handleInputChange("tipo", "Correo")}
            >
              Correo
            </button>
            <button
              type="button"
              className={`btn-tipo ${formData.tipo === "Mensaje" ? "active" : ""}`}
              onClick={() => handleInputChange("tipo", "Mensaje")}
            >
              Mensaje
            </button>
            <button
              type="button"
              className={`btn-tipo ${formData.tipo === "Actividad" ? "active" : ""}`}
              onClick={() => handleInputChange("tipo", "Actividad")}
            >
              Actividad
            </button>
          </div>
          {errors.tipo && <span className="error-message">{errors.tipo}</span>}
        </div>

        <div className="modal-form-group">
          <label htmlFor="notas">Notas:</label>
          <textarea
            id="notas"
            value={formData.notas}
            onChange={(e) => handleInputChange("notas", e.target.value)}
            className="modal-form-control"
            rows="3"
            placeholder="Notas adicionales (opcional)"
          />
        </div>
        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button type="submit" className="btn btn-primary">Confirmar cambios</button>
        </div>
      </form>
    </DetallesTratoModal>
  );
};

// Modal para completar actividad/ editar interaccion
const CompletarActividadModal = ({ isOpen, onClose, onSave, actividad, tratoId, openModal, esEdicion, onNextAction }) => {
  const [formData, setFormData] = useState({
    respuesta: '',
    interes: '',
    informacion: '',
    siguienteAccion: '',
    notas: '',
    medio: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && actividad) {
      let medioInicial = actividad.medio || '';

      if (actividad.tipo?.toUpperCase() === 'LLAMADA') {
        medioInicial = 'TELEFONO';
      } else if (actividad.tipo?.toUpperCase() === 'TAREA' && actividad.subtipoTarea) {
        const subtipoUpper = actividad.subtipoTarea.toUpperCase();
        if (subtipoUpper === 'CORREO') {
          medioInicial = 'CORREO';
        } else if (subtipoUpper === 'MENSAJE') {
          medioInicial = 'WHATSAPP';
        } else if (subtipoUpper === 'ACTIVIDAD') {
          medioInicial = 'ACTIVIDAD';
        }
      }

      setFormData({
        respuesta: actividad.respuesta || '',
        interes: actividad.interes || '',
        informacion: actividad.informacion || '',
        siguienteAccion: actividad.siguienteAccion || '',
        notas: actividad.notas || '',
        medio: medioInicial,
      });
      setErrors({});

    } else if (isOpen && !actividad) {
      setFormData({
        respuesta: '',
        interes: '',
        informacion: '',
        siguienteAccion: '',
        notas: '',
        medio: '',
      });
      setErrors({});
    }
  }, [isOpen, actividad, esEdicion]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.respuesta) newErrors.respuesta = 'Este campo es obligatorio';
    if (!formData.interes) newErrors.interes = 'Este campo es obligatorio';
    if (!formData.informacion) newErrors.informacion = 'Este campo es obligatorio';
    if (!formData.siguienteAccion.trim()) newErrors.siguienteAccion = 'Este campo es obligatorio';
    if (actividad?.tipo && ['LLAMADA', 'TAREA'].includes(actividad.tipo.toUpperCase()) && !formData.medio) {
      newErrors.medio = 'Este campo es obligatorio';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!actividad) {
      Swal.fire({
        title: 'Error',
        text: 'No se encontró la actividad a completar',
        icon: 'error',
      });
      return;
    }

    try {
      const actividadDTO = {
        id: actividad.id,
        tratoId: tratoId,
        tipo: actividad.tipo.toUpperCase(),
        asignadoAId: actividad.asignadoAId,
        contactoId: actividad.contactoId,
        fechaLimite: actividad.fechaLimite,
        horaInicio: actividad.horaInicio || null,
        duracion: actividad.duracion || null,
        modalidad: actividad.modalidad || null,
        medio: formData.medio || null,
        enlaceReunion: actividad.enlaceReunion || null,
        subtipoTarea: actividad.subtipoTarea || null,
        estatus: esEdicion ? actividad.estatus : 'CERRADA',
        respuesta: formData.respuesta.toUpperCase(),
        interes: formData.interes.toUpperCase(),
        informacion: formData.informacion.toUpperCase(),
        siguienteAccion: formData.siguienteAccion,
        notas: formData.notas,
      };

      const endpoint = esEdicion ?
        `${API_BASE_URL}/tratos/actividades/${actividad.id}/editar` :
        `${API_BASE_URL}/tratos/actividades/${actividad.id}/completar`;

      const response = await fetchWithToken(endpoint, {
        method: 'PUT',
        body: JSON.stringify(actividadDTO),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const updatedActividad = await response.json();
      onSave(updatedActividad, actividad.tipo);

      window.dispatchEvent(new CustomEvent('actividadCompletada', {
        detail: { id: actividad.id }
      }));

      const tituloMensaje = esEdicion ? '¡Interacción editada!' : '¡Actividad completada!';
      const textoMensaje = esEdicion ?
        'Los cambios se han guardado exitosamente' :
        'El reporte de actividad se ha guardado exitosamente';

      Swal.fire({
        title: tituloMensaje,
        text: textoMensaje,
        icon: 'success',
        showCancelButton: !esEdicion,
        confirmButtonText: esEdicion ? 'Cerrar' : 'Crear nueva actividad',
        cancelButtonText: 'Cerrar',
      }).then((result) => {
        if (result.isConfirmed && !esEdicion) {
          if (onNextAction) {
            onNextAction(formData.siguienteAccion);
          } else {
            openModal('seleccionarActividad', { tratoId });
          }
        }
      });
      onClose();
    } catch (error) {
      console.error('Error al procesar la actividad:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message.includes('no encontrada')
          ? 'La actividad no fue encontrada'
          : esEdicion
            ? 'No se pudieron guardar los cambios'
            : 'No se pudo completar la actividad',
      });
    }
  };

  return (
    <DetallesTratoModal
      isOpen={isOpen}
      onClose={onClose}
      title={esEdicion ? 'Editar interacción' : `Completar ${actividad?.tipo?.toLowerCase() || 'actividad'}`}
      size="md"
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label>
            Respuesta: <span className="required">*</span>
          </label>
          <div className="response-buttons">
            <button
              type="button"
              className={`btn-response ${formData.respuesta === 'NO' ? 'active negative' : ''}`}
              onClick={() => handleInputChange('respuesta', 'NO')}
            >
              ✕
            </button>
            <button
              type="button"
              className={`btn-response ${formData.respuesta === 'SI' ? 'active positive' : ''}`}
              onClick={() => handleInputChange('respuesta', 'SI')}
            >
              ✓
            </button>
          </div>
          {errors.respuesta && <span className="error-message">{errors.respuesta}</span>}
        </div>

        <div className="modal-form-group">
          <label>
            Interés: <span className="required">*</span>
          </label>
          <div className="interest-container">
            <div className="interest-options">
              <div className="interest-option">
                <button
                  type="button"
                  className={`btn-interest ${formData.interes === 'BAJO' ? 'active low' : ''}`}
                  onClick={() => handleInputChange('interes', 'BAJO')}
                >
                  ●
                </button>
                <span>Bajo</span>
              </div>
              <div className="interest-option">
                <button
                  type="button"
                  className={`btn-interest ${formData.interes === 'MEDIO' ? 'active medium' : ''}`}
                  onClick={() => handleInputChange('interes', 'MEDIO')}
                >
                  ●
                </button>
                <span>Medio</span>
              </div>
              <div className="interest-option">
                <button
                  type="button"
                  className={`btn-interest ${formData.interes === 'ALTO' ? 'active high' : ''}`}
                  onClick={() => handleInputChange('interes', 'ALTO')}
                >
                  ●
                </button>
                <span>Alto</span>
              </div>
            </div>
          </div>
          {errors.interes && <span className="error-message">{errors.interes}</span>}
        </div>

        <div className="modal-form-group">
          <label>
            Información: <span className="required">*</span>
          </label>
          <div className="response-buttons">
            <button
              type="button"
              className={`btn-response ${formData.informacion === 'NO' ? 'active negative' : ''}`}
              onClick={() => handleInputChange('informacion', 'NO')}
            >
              ✕
            </button>
            <button
              type="button"
              className={`btn-response ${formData.informacion === 'SI' ? 'active positive' : ''}`}
              onClick={() => handleInputChange('informacion', 'SI')}
            >
              ✓
            </button>
          </div>
          {errors.informacion && <span className="error-message">{errors.informacion}</span>}
        </div>

        {(actividad?.tipo?.toUpperCase() === 'LLAMADA' || actividad?.tipo?.toUpperCase() === 'TAREA') && (
          <div className="modal-form-group">
            <label htmlFor="medio">
              Medio: <span className="required">*</span>
            </label>
            <div className="modal-select-wrapper">
              <select
                id="medio"
                value={formData.medio}
                onChange={(e) => handleInputChange('medio', e.target.value)}
                className={`modal-form-control ${errors.medio ? 'error' : ''}`}
              >
                <option value="">Seleccionar medio</option>
                {actividad?.tipo?.toUpperCase() === 'LLAMADA' && (
                  <option value="TELEFONO">Teléfono</option>
                )}
                {actividad?.tipo?.toUpperCase() === 'TAREA' && (
                  <>
                    <option value="CORREO">Correo</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="ACTIVIDAD">Actividad</option>
                  </>
                )}
              </select>
              <img src={deploy || '/placeholder.svg'} alt="Desplegar" className="deploy-icon" />
            </div>
            {errors.medio && <span className="error-message">{errors.medio}</span>}
          </div>
        )}

        <div className="modal-form-group">
          <label htmlFor="siguienteAccion">
            Siguiente acción: <span className="required">*</span>
          </label>
          <div className="modal-select-wrapper">
            <select
              id="siguienteAccion"
              value={formData.siguienteAccion}
              onChange={(e) => handleInputChange('siguienteAccion', e.target.value)}
              className={`modal-form-control ${errors.siguienteAccion ? 'error' : ''}`}
            >
              <option value="">Seleccionar acción</option>
              <option value="REGRESAR_LLAMADA">Regresar llamada</option>
              <option value="MANDAR_MENSAJE">Mandar mensaje</option>
              <option value="MANDAR_INFORMACION">Mandar información</option>
              <option value="_1ER_SEGUIMIENTO">Primer seguimiento</option>
              <option value="_2DO_SEGUIMIENTO">Segundo seguimiento</option>
              <option value="_3ER_SEGUIMIENTO">Tercer seguimiento</option>
              <option value="REUNION">Programar reunión</option>
              <option value="MANDAR_COTIZACION">Mandar cotización</option>
              <option value="POSIBLE_PERDIDO">Posible perdido</option>
              <option value="PERDIDO">Perdido</option>
              <option value="BUSCAR_OTRO_CONTACTO">Buscar otro contacto</option>
              <option value="REALIZAR_DEMO">Realizar demo</option>
              <option value="VENTA">Venta</option>
              <option value="COBRANZA">Cobranza</option>
              <option value="INSTALACION">Instalación</option>
              <option value="REVISION_TECNICA">Revisión tecnica</option>
              <option value="VISITAR_EN_FISICO">Visitar en fisico</option>
              <option value="CONTACTAR_DESPUES">Contactar despues</option>
            </select>
            <img src={deploy || '/placeholder.svg'} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.siguienteAccion && <span className="error-message">{errors.siguienteAccion}</span>}
        </div>

        <div className="modal-form-group">
          <label htmlFor="notas">Notas:</label>
          <textarea
            id="notas"
            value={formData.notas}
            onChange={(e) => handleInputChange('notas', e.target.value)}
            className="modal-form-control textarea"
            placeholder="Agregar notas adicionales..."
            rows="4"
          />
        </div>

        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {esEdicion ? 'Guardar cambios' : 'Completar actividad'}
          </button>
        </div>
      </form>
    </DetallesTratoModal>
  );
};

// Modal para crear interaccion
const AgregarInteraccionModal = ({ isOpen, onClose, onSave, tratoId, onCreateActivity }) => {
  const [formData, setFormData] = useState({
    tipo: '',
    medio: '',
    respuesta: '',
    interes: '',
    informacion: '',
    notas: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        tipo: '',
        medio: '',
        respuesta: '',
        interes: '',
        informacion: '',
        notas: '',
      });
      setErrors({});
    }
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === 'tipo') {
        newData.medio = '';
      }
      return newData;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.tipo) newErrors.tipo = 'Este campo es obligatorio';
    if (!formData.respuesta) newErrors.respuesta = 'Este campo es obligatorio';
    if (!formData.interes) newErrors.interes = 'Este campo es obligatorio';
    if (!formData.informacion) newErrors.informacion = 'Este campo es obligatorio';
    if (['LLAMADA', 'TAREA'].includes(formData.tipo) && !formData.medio) {
      newErrors.medio = 'Este campo es obligatorio';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/${tratoId}/interacciones`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...formData,
            tipo: formData.tipo.toUpperCase(),
            respuesta: formData.respuesta.toUpperCase(),
            interes: formData.interes.toUpperCase(),
            informacion: formData.informacion.toUpperCase(),
            medio: formData.medio || (formData.tipo === 'REUNION' ? 'PRESENCIAL' : null),
          }),
        }
      );

      await response.json();
      onSave(); // Recarga el historial en el padre

      Swal.fire({
        title: '¡Interacción registrada!',
        text: 'La interacción se ha guardado exitosamente',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Crear nueva actividad',
        cancelButtonText: 'Cerrar',
      }).then((result) => {
        if (result.isConfirmed) {
          if (onCreateActivity) {
            onCreateActivity(formData.siguienteAccion);
          }
        }
      });
      onClose();
    } catch (error) {
      console.error('Error al registrar interacción:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar la interacción',
      });
    }
  };

  const getMedioOptions = () => {
    switch (formData.tipo) {
      case 'LLAMADA':
        return [
          { value: 'TELEFONO', label: 'Teléfono' }
        ];
      case 'TAREA':
        return [
          { value: 'CORREO', label: 'Correo' },
          { value: 'WHATSAPP', label: 'WhatsApp' },
          { value: 'ACTIVIDAD', label: 'Actividad' }
        ];
      case 'REUNION':
        return [
          { value: 'PRESENCIAL', label: 'Presencial' },
          { value: 'VIRTUAL', label: 'Virtual' }
        ];
      default:
        return [];
    }
  };

  return (
    <DetallesTratoModal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar interacción"
      size="md"
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label>Tipo de interacción: <span className="required">*</span></label>
          <div className="modal-select-wrapper">
            <select
              value={formData.tipo}
              onChange={(e) => handleInputChange('tipo', e.target.value)}
              className={`modal-form-control ${errors.tipo ? 'error' : ''}`}
            >
              <option value="">Seleccionar tipo</option>
              <option value="LLAMADA">Llamada</option>
              <option value="REUNION">Reunión</option>
              <option value="TAREA">Tarea</option>
            </select>
            <img src={deploy || '/placeholder.svg'} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.tipo && <span className="error-message">{errors.tipo}</span>}
        </div>

        {formData.tipo && (
          <div className="modal-form-group">
            <label>Medio: <span className="required">*</span></label>
            <div className="modal-select-wrapper">
              <select
                value={formData.medio}
                onChange={(e) => handleInputChange('medio', e.target.value)}
                className={`modal-form-control ${errors.medio ? 'error' : ''}`}
              >
                <option value="">Seleccionar medio</option>
                {getMedioOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <img src={deploy || '/placeholder.svg'} alt="Desplegar" className="deploy-icon" />
            </div>
            {errors.medio && <span className="error-message">{errors.medio}</span>}
          </div>
        )}

        <div className="modal-form-group">
          <label>
            Respuesta: <span className="required">*</span>
          </label>
          <div className="response-buttons">
            <button
              type="button"
              className={`btn-response ${formData.respuesta === 'NO' ? 'active negative' : ''}`}
              onClick={() => handleInputChange('respuesta', 'NO')}
            >
              ✕
            </button>
            <button
              type="button"
              className={`btn-response ${formData.respuesta === 'SI' ? 'active positive' : ''}`}
              onClick={() => handleInputChange('respuesta', 'SI')}
            >
              ✓
            </button>
          </div>
          {errors.respuesta && <span className="error-message">{errors.respuesta}</span>}
        </div>

        <div className="modal-form-group">
          <label>
            Interés: <span className="required">*</span>
          </label>
          <div className="interest-container">
            <div className="interest-options">
              <div className="interest-option">
                <button
                  type="button"
                  className={`btn-interest ${formData.interes === 'BAJO' ? 'active low' : ''}`}
                  onClick={() => handleInputChange('interes', 'BAJO')}
                >
                  ●
                </button>
                <span>Bajo</span>
              </div>
              <div className="interest-option">
                <button
                  type="button"
                  className={`btn-interest ${formData.interes === 'MEDIO' ? 'active medium' : ''}`}
                  onClick={() => handleInputChange('interes', 'MEDIO')}
                >
                  ●
                </button>
                <span>Medio</span>
              </div>
              <div className="interest-option">
                <button
                  type="button"
                  className={`btn-interest ${formData.interes === 'ALTO' ? 'active high' : ''}`}
                  onClick={() => handleInputChange('interes', 'ALTO')}
                >
                  ●
                </button>
                <span>Alto</span>
              </div>
            </div>
          </div>
          {errors.interes && <span className="error-message">{errors.interes}</span>}
        </div>

        <div className="modal-form-group">
          <label>
            Información: <span className="required">*</span>
          </label>
          <div className="response-buttons">
            <button
              type="button"
              className={`btn-response ${formData.informacion === 'NO' ? 'active negative' : ''}`}
              onClick={() => handleInputChange('informacion', 'NO')}
            >
              ✕
            </button>
            <button
              type="button"
              className={`btn-response ${formData.informacion === 'SI' ? 'active positive' : ''}`}
              onClick={() => handleInputChange('informacion', 'SI')}
            >
              ✓
            </button>
          </div>
          {errors.informacion && <span className="error-message">{errors.informacion}</span>}
        </div>

        <div className="modal-form-group">
          <label htmlFor="siguienteAccion">
            Siguiente acción: <span className="required">*</span>
          </label>
          <div className="modal-select-wrapper">
            <select
              id="siguienteAccion"
              value={formData.siguienteAccion}
              onChange={(e) => handleInputChange('siguienteAccion', e.target.value)}
              className={`modal-form-control ${errors.siguienteAccion ? 'error' : ''}`}
            >
              <option value="">Seleccionar acción</option>
              <option value="REGRESAR_LLAMADA">Regresar llamada</option>
              <option value="MANDAR_MENSAJE">Mandar mensaje</option>
              <option value="MANDAR_INFORMACION">Mandar información</option>
              <option value="_1ER_SEGUIMIENTO">Primer seguimiento</option>
              <option value="_2DO_SEGUIMIENTO">Segundo seguimiento</option>
              <option value="_3ER_SEGUIMIENTO">Tercer seguimiento</option>
              <option value="REUNION">Programar reunión</option>
              <option value="MANDAR_COTIZACION">Mandar cotización</option>
              <option value="POSIBLE_PERDIDO">Posible perdido</option>
              <option value="PERDIDO">Perdido</option>
              <option value="BUSCAR_OTRO_CONTACTO">Buscar otro contacto</option>
              <option value="REALIZAR_DEMO">Realizar demo</option>
              <option value="VENTA">Venta</option>
              <option value="COBRANZA">Cobranza</option>
              <option value="INSTALACION">Instalación</option>
              <option value="REVISION_TECNICA">Revisión tecnica</option>
              <option value="VISITAR_EN_FISICO">Visitar en fisico</option>
              <option value="CONTACTAR_DESPUES">Contactar despues</option>
            </select>
            <img src={deploy || '/placeholder.svg'} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.siguienteAccion && <span className="error-message">{errors.siguienteAccion}</span>}
        </div>

        <div className="modal-form-group">
          <label htmlFor="notas">Notas:</label>
          <textarea
            id="notas"
            value={formData.notas}
            onChange={(e) => handleInputChange('notas', e.target.value)}
            className="modal-form-control textarea"
            placeholder="Agregar notas adicionales..."
            rows="4"
          />
        </div>

        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Registrar interacción
          </button>
        </div>
      </form>
    </DetallesTratoModal>
  );
};

// Modal para editar trato
const EditarTratoModal = ({ isOpen, onClose, onSave, trato, users, companies }) => {
  const [formData, setFormData] = useState({
    propietario: "",
    nombreTrato: "",
    nombreEmpresa: "",
    nombreContacto: "",
    ingresosEsperados: "",
    numeroUnidades: "",
    descripcion: "",
  });
  const [errors, setErrors] = useState({});
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    if (trato && isOpen && trato.id && companies.length > 0 && users.length > 0) {

      const propietarioExiste = users.find(
        u => u.nombreReal === trato.propietario || u.nombre === trato.propietario
      );

      const propietarioSeguro = propietarioExiste
        ? (propietarioExiste.nombreReal)
        : (users[0].nombreReal);

      setFormData({
        propietario: propietarioSeguro,
        nombreTrato: trato.nombre || "",
        nombreEmpresa: trato.nombreEmpresa || "",
        nombreContacto: trato.contacto?.nombre || "",
        ingresosEsperados: trato.ingresosEsperados ? trato.ingresosEsperados.toString().replace("$", "").replace(",", "") : "",
        numeroUnidades: trato.numeroUnidades?.toString() || "",
        descripcion: trato.descripcion || "",
      });
      loadContacts(trato.nombreEmpresa);
    }
    setErrors({});

  }, [trato, isOpen, companies, users]);

  const loadContacts = async (empresaNombre) => {
    try {
      const company = companies.find(c => c.nombre === empresaNombre);
      if (company) {
        const response = await fetchWithToken(`${API_BASE_URL}/empresas/${company.id}/contactos`);
        const contactsData = await response.json();
        setContacts(contactsData.map(c => ({ id: c.id, nombre: c.nombre })));
        const defaultContact = contactsData.find(c => c.nombre === trato.contacto?.nombre);
        if (defaultContact) {
          setFormData(prev => ({ ...prev, nombreContacto: defaultContact.nombre }));
        } else if (trato.contacto?.nombre) {
          setFormData(prev => ({ ...prev, nombreContacto: trato.contacto.nombre }));
        }
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (field === "nombreEmpresa") {
      loadContacts(value);
      setFormData((prev) => ({ ...prev, nombreContacto: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.nombreTrato.trim()) newErrors.nombreTrato = "El nombre del trato es obligatorio";
    if (!formData.nombreEmpresa.trim()) newErrors.nombreEmpresa = "El nombre de la empresa es obligatorio";
    if (!formData.nombreContacto.trim()) newErrors.nombreContacto = "El nombre del contacto es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const convertToISO = (dateValue) => {
    if (!dateValue) return null;

    // Si ya es una fecha ISO válida, devolverla como está
    if (typeof dateValue === 'string' && dateValue.includes('T') && dateValue.includes('Z')) {
      return dateValue;
    }

    // Si es un string con formato DD/MM/YYYY
    if (typeof dateValue === 'string' && dateValue.includes('/')) {
      const [day, month, year] = dateValue.split('/');
      const parsedMonth = parseInt(month, 10) - 1;

      if (isNaN(day) || isNaN(month) || isNaN(year) || parsedMonth < 0 || parsedMonth > 11) {
        console.error("Formato de fecha inválido:", dateValue);
        return null;
      }

      const now = new Date();
      const date = new Date(year, parsedMonth, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

      if (isNaN(date.getTime())) {
        console.error("Fecha inválida después de parsing:", dateValue);
        return null;
      }

      return date.toISOString();
    }

    // Si es una fecha válida, convertirla
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    console.error("Formato de fecha no reconocido:", dateValue);
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      const company = companies.find(c => c.nombre === formData.nombreEmpresa);
      const empresaId = company ? company.id : null;
      const propietario = users.find(u => u.nombreReal === formData.propietario || u.nombre === formData.propietario);
      const propietarioId = propietario ? propietario.id : null;
      const contacto = contacts.find(c => c.nombre === formData.nombreContacto);
      const contactoId = contacto ? contacto.id : null;

      const updatedTrato = {
        id: trato.id,
        nombre: formData.nombreTrato,
        empresaId: empresaId,
        propietarioId: propietarioId,
        contactoId: contactoId,
        ingresosEsperados: parseFloat(formData.ingresosEsperados) || 0,
        numeroUnidades: parseInt(formData.numeroUnidades, 10) || 0,
        descripcion: formData.descripcion,
        // Solo enviar fechas si están disponibles y en formato correcto
        fechaCreacion: convertToISO(trato.fechaCreacion),
        fechaCierre: convertToISO(trato.fechaCierre),
      };


      // Validar solo datos críticos
      if (!updatedTrato.empresaId) {
        Swal.fire({
          title: "Error",
          text: "La empresa seleccionada no es válida.",
          icon: "error",
        });
        return;
      }

      try {
        await onSave(updatedTrato);
        onClose();
      } catch (error) {
        console.error("Error al guardar el trato:", error);
        Swal.fire({
          title: "Error",
          text: "No se pudo actualizar el trato. Intente nuevamente.",
          icon: "error",
        });
      }
    }
  };

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Editar Trato" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-group">
          <label htmlFor="propietario">
            Propietario: <span className="required">*</span>
          </label>
          <div className="modal-select-wrapper">
            <select
              id="propietario"
              value={formData.propietario}
              onChange={(e) => handleInputChange("propietario", e.target.value)}
              className="modal-form-control"
            >
              {users.map((user) => (
                <option key={user.id} value={user.nombreReal}>
                  {user.nombreReal}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
        </div>

        <div className="modal-form-group">
          <label htmlFor="nombreTrato">
            Nombre trato: <span className="required">*</span>
          </label>
          <input
            type="text"
            id="nombreTrato"
            value={formData.nombreTrato}
            onChange={(e) => handleInputChange("nombreTrato", e.target.value)}
            className={`modal-form-control ${errors.nombreTrato ? "error" : ""}`}
            placeholder="Trato ejemplo"
          />
          {errors.nombreTrato && <span className="error-message">{errors.nombreTrato}</span>}
        </div>

        <div className="modal-form-group">
          <label htmlFor="nombreEmpresa">
            Nombre empresa: <span className="required">*</span>
          </label>
          <div className="modal-select-wrapper">
            <select
              id="nombreEmpresa"
              value={formData.nombreEmpresa}
              disabled
              className={`modal-form-control ${errors.nombreEmpresa ? "error" : ""}`}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.nombre}>
                  {company.nombre}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.nombreEmpresa && <span className="error-message">{errors.nombreEmpresa}</span>}
        </div>

        <div className="modal-form-group">
          <label htmlFor="nombreContacto">
            Nombre contacto: <span className="required">*</span>
          </label>
          <div className="modal-select-wrapper">
            <select
              id="nombreContacto"
              value={formData.nombreContacto}
              onChange={(e) => handleInputChange("nombreContacto", e.target.value)}
              className={`modal-form-control ${errors.nombreContacto ? "error" : ""}`}
            >
              <option value="">Seleccione un contacto</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.nombre}>
                  {contact.nombre}
                </option>
              ))}
            </select>
            <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
          </div>
          {errors.nombreContacto && <span className="error-message">{errors.nombreContacto}</span>}
        </div>

        <div className="modal-form-group">
          <label htmlFor="ingresosEsperados">Ingresos esperados:</label>
          <div className="input-with-prefix">
            <span className="input-prefix">$</span>
            <input
              type="number"
              id="ingresosEsperados"
              value={formData.ingresosEsperados}
              onChange={(e) => handleInputChange("ingresosEsperados", e.target.value)}
              className="modal-form-control"
              placeholder="5000"
            />
          </div>
        </div>

        <div className="modal-form-group">
          <label htmlFor="numeroUnidades">Número de unidades:</label>
          <input
            type="number"
            id="numeroUnidades"
            value={formData.numeroUnidades}
            onChange={(e) => handleInputChange("numeroUnidades", e.target.value)}
            className="modal-form-control"
            placeholder="10"
          />
        </div>

        <div className="modal-form-group">
          <label htmlFor="descripcion">Descripción:</label>
          <textarea
            id="descripcion"
            value={formData.descripcion}
            onChange={(e) => handleInputChange("descripcion", e.target.value)}
            className="modal-form-control textarea"
            placeholder="Pequeña descripción de ejemplo"
            rows="4"
          />
        </div>

        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar cambios
          </button>
        </div>
      </form>
    </DetallesTratoModal>
  );
};

// Modal para crear correo
const CrearCorreoModal = ({ isOpen, onClose, onSave, tratoId, openModal, closeModal, archivoPrecargado = null, asuntoPrecargado = null }) => {
  const [formData, setFormData] = useState({
    para: "",
    asunto: "",
    mensaje: "",
    adjuntos: [], // Archivos locales subidos
    adjuntosPlantilla: [], // URLs de archivos de plantilla
  });
  const [errors, setErrors] = useState({});
  const [plantillas, setPlantillas] = useState([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null);
  const editorRef = useRef(null);
  const [emailChips, setEmailChips] = useState([]);
  const [inputEmail, setInputEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      const loadContactoData = async () => {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}`);
          const trato = await response.json();
          let emailsToLoad = [];

          if (trato.contacto?.email) {
            emailsToLoad.push(trato.contacto.email.trim());
          }

          if (trato.empresaId) {
            const contactosResponse = await fetchWithToken(`${API_BASE_URL}/empresas/${trato.empresaId}/contactos`);

            if (contactosResponse.ok) {
              const contactos = await contactosResponse.json();

              contactos.forEach(contacto => {
                if (contacto.correos && Array.isArray(contacto.correos) && contacto.correos.length > 0) {
                  contacto.correos.forEach(correoObj => {
                    if (correoObj.correo && correoObj.correo.trim() && correoObj.correo !== 'N/A') {
                      const email = correoObj.correo.trim();
                      if (!emailsToLoad.includes(email)) {
                        emailsToLoad.push(email);
                      }
                    }
                  });
                }
              });
            } else {
              console.error('Error en response de contactos:', contactosResponse.status);
            }
          } else {
            console.log('No hay empresaId asociada al trato');
          }
          if (emailsToLoad.length > 0) {
            setEmailChips(emailsToLoad);
            setFormData(prev => ({
              ...prev,
              para: emailsToLoad.join(', '),
            }));
          } else {
            console.log('No se encontraron emails para precargar');
          }

        } catch (error) {
          console.error("Stack trace:", error.stack);
        }
      };
      loadContactoData();

      const loadPlantillas = async () => {
        setLoadingPlantillas(true);
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/plantillas`);
          const plantillasData = await response.json();
          setPlantillas(plantillasData);
        } catch (error) {
          console.error("Error loading plantillas:", error);
        } finally {
          setLoadingPlantillas(false);
        }
      };
      loadPlantillas();
    }
  }, [isOpen, tratoId]);

  useEffect(() => {
    if (isOpen && editorRef.current) {
      const editor = editorRef.current;
      if (!formData.mensaje) {
        editor.innerHTML = '';
      }
      editor.style.direction = 'ltr';
      editor.style.textAlign = 'left';
    }
  }, [isOpen]);

  useEffect(() => {
    if (editorRef.current && formData.mensaje) {
      if (editorRef.current.innerHTML !== formData.mensaje) {
        editorRef.current.innerHTML = formData.mensaje;
      }
    }
  }, [formData.mensaje]);

  useEffect(() => {
    if (isOpen && archivoPrecargado) {
      setFormData(prev => ({
        ...prev,
        adjuntos: [archivoPrecargado],
        asunto: asuntoPrecargado || prev.asunto
      }));
    }
  }, [isOpen, archivoPrecargado, asuntoPrecargado]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleFileUpload = (event) => {
    const maxFileSize = 1.5 * 1024 * 1024; // 1.5MB por archivo
    const maxFiles = 3; // Máximo 3 archivos
    const files = Array.from(event.target.files);

    if (formData.adjuntos.length + files.length > maxFiles) {
      Swal.fire({
        icon: "warning",
        title: "Límite de archivos excedido",
        text: `Solo puedes agregar un máximo de ${maxFiles} archivos. Actualmente tienes ${formData.adjuntos.length} archivo(s).`,
        confirmButtonText: "Aceptar",
      });
      return;
    }
    // Validar tamaño individual de archivos
    const oversizedFiles = files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "Archivo muy grande",
        text: `Uno o más archivos exceden el límite de 1.5MB por archivo. Por favor, selecciona archivos más pequeños.`,
        confirmButtonText: "Aceptar",
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      adjuntos: [...prev.adjuntos, ...files],
    }));
  };

  const handleRemoveAttachment = (index, isTemplate = false) => {
    if (isTemplate) {
      setFormData((prev) => ({
        ...prev,
        adjuntosPlantilla: prev.adjuntosPlantilla.filter((_, i) => i !== index),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        adjuntos: prev.adjuntos.filter((_, i) => i !== index),
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.para.trim()) {
      newErrors.para = "Debes especificar al menos un destinatario";
    } else {
      const emails = formData.para.split(',').map(email => email.trim()).filter(email => email.length > 0);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(email => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        newErrors.para = `Emails inválidos: ${invalidEmails.join(', ')}`;
      }
    }
    if (!formData.asunto.trim()) newErrors.asunto = "Este campo es obligatorio";
    if (!formData.mensaje.trim()) newErrors.mensaje = "Este campo es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormData = () => {
    setFormData({
      para: "",
      asunto: "",
      mensaje: "",
      adjuntos: [],
      adjuntosPlantilla: [],
    });

    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setEmailChips([]);
    setInputEmail('');
    setPlantillaSeleccionada(null);
    setErrors({});
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    try {
      const formDataToSend = new FormData();
      const destinatario = formData.para.trim() || "Sin destinatario";

      if (plantillaSeleccionada) {
        formDataToSend.append("destinatario", destinatario);
        formDataToSend.append("plantillaId", plantillaSeleccionada.id);
        formDataToSend.append("tratoId", tratoId);

        if (formData.mensaje !== plantillaSeleccionada.mensaje) {
          formDataToSend.append("cuerpoPersonalizado", formData.mensaje);
        }

        if (formData.adjuntos.length > 0) {
          for (const file of formData.adjuntos) {
            formDataToSend.append("archivosAdjuntosAdicionales", file);
          }
        }

        const response = await fetchWithToken(`${API_BASE_URL}/correos/plantilla`, {
          method: "POST",
          body: formDataToSend,
        });

        const emailRecord = await response.json();
        if (emailRecord.exito) {
          Swal.fire({
            title: "¡Correo enviado!",
            text: "El correo se ha enviado exitosamente usando la plantilla",
            icon: "success",
          });

          resetFormData();
          onSave();
          onClose();
        } else {
          throw new Error("Fallo al enviar el correo");
        }
      } else {
        formDataToSend.append("destinatario", destinatario);
        formDataToSend.append("asunto", formData.asunto);
        formDataToSend.append("cuerpo", formData.mensaje);
        formDataToSend.append("tratoId", tratoId);

        if (formData.adjuntos.length > 0) {
          for (const file of formData.adjuntos) {
            formDataToSend.append("archivosAdjuntos", file);
          }
        }

        const response = await fetchWithToken(`${API_BASE_URL}/correos`, {
          method: "POST",
          body: formDataToSend,
        });

        const emailRecord = await response.json();
        if (emailRecord.exito) {
          Swal.fire({
            title: "¡Correo enviado!",
            text: "El correo se ha enviado exitosamente",
            icon: "success",
          });

          resetFormData();
          onSave();
          onClose();
        } else {
          throw new Error("Fallo al enviar el correo");
        }
      }
    } catch (error) {
      console.error("Error al enviar correo:", error);
      setError(error.message || "No se pudo enviar el correo");
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo enviar el correo"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsarPlantilla = () => {
    if (loadingPlantillas || plantillas.length === 0) {
      return;
    }
    openModal("seleccionarPlantilla", {
      onSelectTemplate: (template) => {
        setPlantillaSeleccionada(template);
        setFormData(prev => ({
          ...prev,
          asunto: template.asunto,
          mensaje: template.mensaje,
          adjuntosPlantilla: template.adjuntos || [],
        }));

        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.innerHTML = template.mensaje || "";
          }
        }, 100);

        closeModal("seleccionarPlantilla");
      },
      plantillas: plantillas,
    });
  };

  const handleLimpiarPlantilla = () => {
    setPlantillaSeleccionada(null);
    setFormData(prev => ({
      ...prev,
      asunto: "",
      mensaje: "",
      adjuntosPlantilla: [],
    }));

    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }, 100);
  };

  // Función para obtener el nombre del archivo desde una URL
  const getFileNameFromUrl = (url) => {
    try {
      const parts = url.split('/');
      let fileName = parts[parts.length - 1];
      if (fileName.includes('?')) {
        fileName = fileName.split('?')[0];
      }
      return fileName || 'archivo_adjunto';
    } catch (error) {
      return 'archivo_adjunto';
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire({
        icon: 'warning',
        title: 'Archivo no válido',
        text: 'Por favor selecciona solo archivos de imagen',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Archivo muy grande',
        text: 'La imagen es muy grande. Máximo 1.5MB para imágenes embebidas',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    try {
      const editor = editorRef.current;
      if (editor) {
        const loadingTag = `<div class="image-loading">📷 Subiendo imagen...</div>`;
        const currentContent = editor.innerHTML;
        editor.innerHTML = currentContent + '<br>' + loadingTag + '<br>';
        handleInputChange("mensaje", editor.innerHTML);
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetchWithToken(`${API_BASE_URL}/upload/image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }

      const data = await response.json();
      const imageUrl = data.url;

      if (editor) {
        const imgTag = `<img src="${imageUrl}" style="max-width: 400px; width: auto; height: auto; display: block; margin: 10px 0; border-radius: 4px;" alt="Imagen insertada" />`;

        const newContent = editor.innerHTML.replace(
          '<div class="image-loading">📷 Subiendo imagen...</div>',
          imgTag
        );

        editor.innerHTML = newContent;
        handleInputChange("mensaje", editor.innerHTML);
        editor.scrollTop = editor.scrollHeight;
      }

      Swal.fire({
        icon: 'success',
        title: '¡Imagen insertada!',
        text: 'La imagen se ha subido e insertado correctamente',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

    } catch (error) {
      console.error("Error al procesar imagen:", error);

      Swal.fire({
        icon: 'error',
        title: 'Error al subir imagen',
        text: `No se pudo subir la imagen: ${error.message}`,
        confirmButtonText: 'Cerrar'
      });

      if (editorRef.current) {
        const content = editorRef.current.innerHTML.replace(
          '<div class="image-loading">📷 Subiendo imagen...</div>',
          ''
        );
        editorRef.current.innerHTML = content;
        handleInputChange("mensaje", editorRef.current.innerHTML);
      }
    }

    event.target.value = '';
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const normalizarEmail = (email) => {
    return email
      .trim()
      .toLowerCase()
      .normalize('NFD') // Descompone caracteres con acentos
      .replace(/[\u0300-\u036f]/g, '') // Elimina los diacríticos (acentos)
      .replace(/ñ/g, 'n') // Reemplaza ñ por n
      .replace(/[^a-z0-9@.\-_+]/g, ''); // Solo permite caracteres válidos
  };

  // Función para agregar email
  const addEmailChip = (email) => {
    const normalizedEmail = normalizarEmail(email);

    if (normalizedEmail && !emailChips.includes(normalizedEmail)) {
      if (isValidEmail(normalizedEmail)) {
        const newChips = [...emailChips, normalizedEmail];
        setEmailChips(newChips);
        setFormData(prev => ({ ...prev, para: newChips.join(', ') }));
        setInputEmail('');
        if (errors.para) setErrors(prev => ({ ...prev, para: '' }));
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Email inválido',
          text: `El email "${email}" no es válido o contiene caracteres no permitidos, intenta por outlook`,
          timer: 3000,
          toast: true,
          position: 'top-end'
        });
      }
    }
  };

  // Función para remover email
  const removeEmailChip = (emailToRemove) => {
    const newChips = emailChips.filter(email => email !== emailToRemove);
    setEmailChips(newChips);
    setFormData(prev => ({ ...prev, para: newChips.join(', ') }));
  };

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Mensaje nuevo" size="lg" canClose={true} closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="gmail-compose-form">
        <div className="gmail-compose-body">
          {/* Mostrar información de plantilla seleccionada */}
          {plantillaSeleccionada && (
            <div className="plantilla-info">
              <div className="plantilla-badge">
                <span>📝 Usando plantilla: {plantillaSeleccionada.nombre}</span>
                <button
                  type="button"
                  onClick={handleLimpiarPlantilla}
                  className="limpiar-plantilla-btn"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="gmail-field-group">
            <label className="gmail-field-label">Para</label>
            <div className={`email-chips-container ${errors.para ? 'error' : ''}`}>
              <div className="email-chips-wrapper">
                {emailChips.map((email, index) => (
                  <div key={index} className="email-chip">
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeEmailChip(email)}
                      className="email-chip-remove"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Input para nuevos emails */}
                <input
                  type="text"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      if (inputEmail.trim()) {
                        addEmailChip(inputEmail);
                      }
                    } else if (e.key === 'Backspace' && !inputEmail && emailChips.length > 0) {
                      removeEmailChip(emailChips[emailChips.length - 1]);
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text');
                    const emailList = pastedText.split(/[,;\s]+/).filter(email => email.trim());
                    emailList.forEach(email => addEmailChip(email));
                  }}
                  placeholder={emailChips.length === 0 ? "Ingresa emails..." : "Agregar más..."}
                  className="email-input-field"
                />
              </div>
            </div>
            <div className="email-info-row">
              <div className="email-instructions-col">
                <small>Presiona Enter o coma para agregar</small>

                <small style={{ color: '#666' }}>
                  ⚠️ Los acentos y ñ serán removidos automáticamente
                </small>
              </div>

              {emailChips.length > 0 && (
                <span className="email-counter">
                  {emailChips.length} destinatario{emailChips.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {errors.para && <span className="error-message">{errors.para}</span>}
          </div>

          <div className="gmail-field-group">
            <label className="gmail-field-label">Asunto</label>
            <input
              type="text"
              value={formData.asunto}
              onChange={(e) => handleInputChange("asunto", e.target.value)}
              className={`gmail-field-input ${errors.asunto ? "error" : ""}`}
              placeholder="Asunto"
            />
            {errors.asunto && <span className="error-message">{errors.asunto}</span>}
          </div>

          <div className="gmail-message-area">
            <EditorToolbar editorRef={editorRef} />
            <div
              ref={editorRef}
              contentEditable={true}
              className={`gmail-message-editor ${errors.mensaje ? "error" : ""}`}
              onInput={(e) => handleInputChange("mensaje", e.target.innerHTML)}
              onPaste={(e) => {
                e.preventDefault();
                const clipboardData = e.clipboardData;

                const htmlData = clipboardData.getData('text/html');

                if (htmlData) {
                  document.execCommand('insertHTML', false, htmlData);
                } else {
                  const text = clipboardData.getData('text/plain');
                  document.execCommand('insertText', false, text);
                }
              }}
              style={{
                minHeight: '200px',
                border: '1px solid #ccc',
                borderTop: 'none',
                padding: '10px',
                borderRadius: '0 0 4px 4px',
                backgroundColor: 'white',
                direction: 'ltr',
                textAlign: 'left',
                unicodeBidi: 'normal'
              }}
              suppressContentEditableWarning={true}
            />
            {errors.mensaje && <span className="error-message">{errors.mensaje}</span>}
          </div>

          {/* Mostrar archivos adjuntos de la plantilla */}
          {formData.adjuntosPlantilla.length > 0 && (
            <div className="gmail-attachments">
              <h4>Archivos de la plantilla:</h4>
              {formData.adjuntosPlantilla.map((adjunto, index) => (
                <div key={`template-${index}`} className="gmail-attachment-item template-attachment">
                  <img src={attachIcon || "/placeholder.svg"} alt="Adjunto" className="attachment-icon" />
                  <span>{getFileNameFromUrl(adjunto.adjuntoUrl)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(index, true)}
                    className="gmail-remove-attachment"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Mostrar archivos adjuntos adicionales */}
          {formData.adjuntos.length > 0 && (
            <div className="gmail-attachments">
              <h4>Archivos adicionales:</h4>
              {formData.adjuntos.map((archivo, index) => (
                <div key={`local-${index}`} className="gmail-attachment-item">
                  <img src={attachIcon || "/placeholder.svg"} alt="Adjunto" className="attachment-icon" />
                  <span>{archivo.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(index, false)}
                    className="gmail-remove-attachment"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="gmail-compose-footer">
          <div className="gmail-footer-left">
            <button type="submit" className="gmail-btn-send" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
            <button
              type="button"
              onClick={handleUsarPlantilla}
              className="gmail-btn-template"
              disabled={loadingPlantillas}
            >
              Usar plantilla
            </button>
          </div>
          <div className="gmail-footer-right">
            <label className="gmail-attach-btn">
              <img src={attachIcon || "/placeholder.svg"} alt="Adjuntar archivo" className="attach-icon" />
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>

            <label className="gmail-image-btn">
              📷
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </form>
      {loading && <div className="loading-overlay">Enviando...</div>}
      {error && <div className="error-message">{error}</div>}
    </DetallesTratoModal>
  );
};

// Modal para seleccionar plantillas
const SeleccionarPlantillaModal = ({ isOpen, onClose, onSelectTemplate, plantillas = [] }) => {

  const handleSelectTemplate = (template) => {
    onSelectTemplate(template);
    onClose();
  };

  const plantillasOrdenadas = [...plantillas].sort((a, b) => {
    return a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' });
  });

  return (
    <DetallesTratoModal isOpen={isOpen} onClose={onClose} title="Seleccionar plantilla" size="md" closeOnOverlayClick={false}>
      <div className="plantillas-list">
        {plantillasOrdenadas.map((plantilla) => (
          <div
            key={plantilla.id}
            className="plantilla-item"
            onClick={() => handleSelectTemplate(plantilla)}
          >
            <div className="plantilla-info">
              <h4>{plantilla.nombre}</h4>
              <p className="plantilla-asunto">{plantilla.asunto}</p>
              <p className="plantilla-preview">
                {(plantilla.mensaje || "").substring(0, 100)}...
              </p>
              {plantilla.adjuntos && plantilla.adjuntos.length > 0 && (
                <div className="plantilla-adjuntos">
                  📎 {plantilla.adjuntos.length} adjunto(s)
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </DetallesTratoModal>
  );
};

const ConfirmacionEnvioModal = ({ isOpen, onClose, onConfirm, tratoId, actividadId, esReprogramacion = false }) => {
  const [step, setStep] = useState(1);
  const [datosContacto, setDatosContacto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState(null);

  useEffect(() => {
    if (isOpen && tratoId) {
      verificarDatosContacto();
    }
  }, [isOpen, tratoId]);

  const verificarDatosContacto = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}/contacto/verificar-datos`);
      const datos = await response.json();
      setDatosContacto(datos);
    } catch (error) {
      console.error('Error al verificar datos del contacto:', error);
    }
  };

  const handleConfirmarEnvio = () => {
    if (!datosContacto.tieneCorreo && !datosContacto.tieneCelular) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos faltantes',
        text: 'El contacto necesita tener al menos un correo electrónico o un número de celular para enviar la confirmación.',
      });
      onClose();
      return;
    }
    setStep(2);
  };

  const handleMetodoEnvio = async (metodo) => {
    if (metodo === 'correo' && !datosContacto.tieneCorreo) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin correo electrónico',
        text: 'El contacto no tiene un correo electrónico registrado.',
      });
      return;
    }

    if (metodo === 'whatsapp' && !datosContacto.tieneCelular) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin número de celular',
        text: 'El contacto no tiene un número de celular registrado.',
      });
      return;
    }

    setLoading(true);
    setLoadingMethod(metodo);

    try {
      if (metodo === 'correo') {
        const endpoint = esReprogramacion
          ? `${API_BASE_URL}/tratos/${tratoId}/actividades/${actividadId}/enviar-notificacion-email-reprogramada`
          : `${API_BASE_URL}/tratos/${tratoId}/actividades/${actividadId}/enviar-notificacion-email`;

        await fetchWithToken(endpoint, { method: 'POST' });

        Swal.fire({
          icon: 'success',
          title: '¡Correo enviado!',
          text: `Se ha enviado la ${esReprogramacion ? 'notificación de reprogramación' : 'confirmación'} por correo electrónico.`,
        });
      } else if (metodo === 'whatsapp') {
        const response = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}/generar-mensaje-whatsapp`, {
          method: 'POST',
          body: JSON.stringify({
            actividadId: actividadId,
            esReprogramacion: esReprogramacion ? 1 : 0
          }),
        });

        const { urlWhatsApp } = await response.json();
        window.open(urlWhatsApp, '_blank');
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error al enviar la notificación: ${error.message}`,
      });
    } finally {
      setLoading(false);
      setLoadingMethod(null);
      onConfirm();
      onClose();
    }
  };

  const resetModal = () => {
    setStep(1);
    setDatosContacto(null);
    setLoading(false);
    setLoadingMethod(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (step === 1) {
    return (
      <DetallesTratoModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Confirmar envío"
        size="sm"
        className="confirmacion-envio-modal"
        closeOnOverlayClick={false}
      >
        <div className="modal-form">
          <div className="confirmacion-envio-step1">
            <div className="confirmation-icon"></div>
            <p className="confirmation-message">
              ¿Desea enviar el mensaje de {esReprogramacion ? 'reprogramación' : 'confirmación'} de la reunión?
            </p>
            <div className="modal-form-actions">
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="btn btn-secondary"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmarEnvio}
                className="btn btn-primary"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      </DetallesTratoModal>
    );
  }

  return (
    <DetallesTratoModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Método de envío"
      size="sm"
      className="confirmacion-envio-modal"
    >
      <div className="modal-form">
        <div className="confirmacion-envio-step2">
          <div className="method-selection-header">
            <h3 className="method-selection-title">¿Cómo desea enviar la notificación?</h3>
            {datosContacto && (
              <div className="contact-info">
                <span>{datosContacto.nombreContacto}</span>
              </div>
            )}
          </div>

          <div className="method-buttons">
            <button
              type="button"
              onClick={() => handleMetodoEnvio('correo')}
              className={`btn-method email ${!datosContacto?.tieneCorreo ? 'unavailable' : ''} ${loadingMethod === 'correo' ? 'loading' : ''}`}
              disabled={loading || !datosContacto?.tieneCorreo}
            >
              <div className="method-icon"></div>
              <span className="method-label">Correo</span>
              <span className="loading-text">Enviando...</span>
            </button>

            <button
              type="button"
              onClick={() => handleMetodoEnvio('whatsapp')}
              className={`btn-method whatsapp ${!datosContacto?.tieneCelular ? 'unavailable' : ''} ${loadingMethod === 'whatsapp' ? 'loading' : ''}`}
              disabled={loading || !datosContacto?.tieneCelular}
            >
              <div className="method-icon"></div>
              <span className="method-label">WhatsApp</span>
              <span className="loading-text">Generando...</span>
            </button>
          </div>
        </div>
      </div>
    </DetallesTratoModal>
  );
};

const SeleccionarProcesoModal = ({ isOpen, onClose, onConfirm }) => {
  const [procesos, setProcesos] = useState([]);
  const [procesoId, setProcesoId] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchWithToken(`${API_BASE_URL}/procesos-automaticos`)
        .then(r => r.json()).then(setProcesos);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="detalles-trato-modal-overlay" onClick={onClose}>
      <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Seleccionar proceso de seguimiento</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-form-group">
            <label>Proceso automático:</label>
            <div className="modal-select-wrapper">
              <select
                value={procesoId}
                onChange={e => setProcesoId(e.target.value)}
                className="modal-form-control"
              >
                <option value="">Seleccionar proceso</option>
                {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <svg className="deploy-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>
        <div className="modal-form-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={!procesoId}
            onClick={() => onConfirm(parseInt(procesoId))}
          >
            Activar
          </button>
        </div>
      </div>
    </div>
  );
};

const DetallesTrato = () => {
  const params = useParams()
  const navigate = useNavigate()
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { empresas: true, cotizaciones: true, cxc: true };
  const [trato, setTrato] = useState({
    nombre: "",
    contacto: {
      nombre: "",
      telefonos: [],
      correos: [],
      whatsapp: ""
    },
    propietario: "",
    numeroTrato: "",
    nombreEmpresa: "",
    empresaId: "",
    descripcion: "",
    domicilio: "",
    ingresosEsperados: "",
    sitioWeb: "",
    sector: "",
    fechaCreacion: "",
    fechaCierre: "",
    fases: [],
    actividadesAbiertas: { tareas: [], llamadas: [], reuniones: [] },
    historialInteracciones: [],
    notas: [],
  });
  const [loading, setLoading] = useState(true)
  const [emailRecords, setEmailRecords] = useState([]);
  const [nuevaNota, setNuevaNota] = useState("")
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteText, setEditingNoteText] = useState("")
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [correosSeguimientoActivo, setCorreosSeguimientoActivo] = useState(false);
  const [cargandoCorreos, setCargandoCorreos] = useState(false);
  const [mostrarTodasLasNotas, setMostrarTodasLasNotas] = useState(false);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cotizacionesVinculadas, setCotizacionesVinculadas] = useState(new Set());
  const [showCotizacionesSection, setShowCotizacionesSection] = useState(false);
  const [showSeleccionarProceso, setShowSeleccionarProceso] = useState(false);
  const [pdfPreview, setPdfPreview] = useState({
    isOpen: false,
    url: null,
    filename: ""
  });

  const getCurrentUserId = () => {
    const userId = localStorage.getItem('userId');
    return userId ? parseInt(userId) : null;
  };

  // Estados para modales
  const [modals, setModals] = useState({
    seleccionarActividad: { isOpen: false },
    programarLlamada: { isOpen: false, loading: false },
    programarReunion: { isOpen: false, loading: false },
    programarTarea: { isOpen: false, loading: false },
    reprogramarLlamada: { isOpen: false, actividad: null, loading: false },
    reprogramarReunion: { isOpen: false, actividad: null, loading: false },
    reprogramarTarea: { isOpen: false, actividad: null, loading: false },
    completarActividad: { isOpen: false, actividad: null, loading: false },
    editarTrato: { isOpen: false },
    crearNuevaActividad: { isOpen: false },
    crearCorreo: { isOpen: false },
    seleccionarPlantilla: { isOpen: false },
    agregarInteraccion: { isOpen: false, props: {} },
    subirArchivo: { isOpen: false, cotizacion: null },
    compartirCotizacion: { isOpen: false, cotizacion: null },
  })

  const openModal = async (modalType, data = {}) => {
    const contactosPrecargados = data.contactos || [];

    setModals((prev) => ({
      ...prev,
      [modalType]: {
        isOpen: true,
        loading: contactosPrecargados.length === 0,
        tratoId: params.id,
        contactos: contactosPrecargados,
        ...data
      },
    }));

    if (contactosPrecargados.length === 0 && [
      'reprogramarLlamada',
      'reprogramarReunion',
      'reprogramarTarea',
      'programarLlamada',
      'programarReunion',
      'programarTarea',
    ].includes(modalType)) {
      try {
        const tratoResponse = await fetchWithToken(`${API_BASE_URL}/tratos/${params.id}`);
        const trato = await tratoResponse.json();

        let contactos = [];
        if (trato.empresaId) {
          const contactosResponse = await fetchWithToken(
            `${API_BASE_URL}/empresas/${trato.empresaId}/contactos`
          );
          contactos = await contactosResponse.json() || [];
        }

        setModals((prev) => ({
          ...prev,
          [modalType]: {
            ...prev[modalType],
            contactos,
            loading: false
          },
        }));

      } catch (error) {
        console.error('Error fetching contactos:', error);
        setModals((prev) => ({
          ...prev,
          [modalType]: { ...prev[modalType], contactos: [], loading: false },
        }));
      }
    } else {
      setModals((prev) => ({
        ...prev,
        [modalType]: { ...prev[modalType], loading: false },
      }));
    }
  };

  const closeModal = (modalType) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: {
        isOpen: false,
        loading: false,
        actividad: null,
        esEdicion: false
      },
    }))
  }

  // Función para obtener el estado actual de los correos de seguimiento
  const obtenerEstadoCorreosSeguimiento = async (tratoId) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/correos-seguimiento/estado/${tratoId}`);
      const activo = await response.json();
      setCorreosSeguimientoActivo(activo);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo obtener el estado de los correos de seguimiento'
      });
    }
  };

  const checkVinculaciones = async (cotizacionesList) => {
    try {
      const vinculacionPromises = cotizacionesList.map(async (cotizacion) => {
        const response = await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cotizacion.id}/check-vinculada`);
        const { vinculada } = await response.json();
        return { id: cotizacion.id, vinculada };
      });

      const resultados = await Promise.all(vinculacionPromises);
      const vinculadas = new Set(
        resultados.filter(r => r.vinculada).map(r => r.id)
      );
      setCotizacionesVinculadas(vinculadas);
    } catch (error) {
      console.error("Error verificando vinculaciones:", error);
    }
  };

  // Función para activar/desactivar correos de seguimiento
  const toggleCorreosSeguimiento = async (tratoId, activar, procesoId) => {
    if (activar) {
      if (!trato.contacto?.correos || trato.contacto.correos.length === 0 ||
        !trato.contacto.correos.some(c => c.correo && c.correo.trim() !== '')) {

        setCorreosSeguimientoActivo(false);

        Swal.fire({
          icon: 'warning',
          title: 'Email requerido',
          text: 'Para activar los correos de seguimiento, primero debe agregar un email al contacto del trato.',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#3085d6'
        });
        return;
      }
    }

    setCargandoCorreos(true);

    try {
      const endpoint = activar ? `activar/${tratoId}?procesoId=${procesoId}` : `desactivar/${tratoId}`;
      const response = await fetchWithToken(
        `${API_BASE_URL}/correos-seguimiento/${endpoint}`,
        { method: 'POST' }
      );

      const mensaje = await response.text();
      setCorreosSeguimientoActivo(activar);

      Swal.fire({
        icon: 'success',
        title: activar ? 'Correos de seguimiento activados' : 'Correos de seguimiento desactivados',
        text: mensaje,
        showConfirmButton: false,
        timer: 2000
      });

    } catch (error) {
      setCorreosSeguimientoActivo(!activar);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Error al cambiar el estado de los correos de seguimiento'
      });
    } finally {
      setCargandoCorreos(false);
    }
  };

  // Función para manejar el cambio del checkbox
  const handleCorreosSeguimientoChange = (e) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      setShowSeleccionarProceso(true); // Abre modal de selección
    } else {
      toggleCorreosSeguimiento(trato.id, false, null);
    }
  };

  // Callback para actualizar estado de emails en tiempo real
  const handleEmailStatusUpdate = useCallback((data) => {
    console.log('Actualizando estado de email:', data);
    setEmailRecords(prevRecords =>
      prevRecords.map(email =>
        email.id === data.emailId
          ? { ...email, status: data.status }
          : email
      )
    );
  }, []);

  // useEffect para cargar el estado inicial cuando se carga el trato
  useEffect(() => {
    if (trato && trato.id && ['ENVIO_DE_INFORMACION', 'RESPUESTA_POR_CORREO'].includes(trato.fase)) {
      obtenerEstadoCorreosSeguimiento(trato.id);
    }
  }, [trato]);


  const handleSelectActivity = (tipo) => {
    const modalMap = {
      llamada: "programarLlamada",
      reunion: "programarReunion",
      tarea: "programarTarea",
    }
    openModal(modalMap[tipo])
  }

  const handleSaveActividad = async (data, tipo) => {
    let nombreContacto = "Sin contacto";
    const modalType = tipo.toLowerCase();
    const modalState = modals[`programar${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`];

    if (data.contactoId && modalState && modalState.isOpen) {
      let contactos = modalState.contactos || [];
      if (contactos.length === 0 && modalState.tratoId) {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/tratos/${modalState.tratoId}`);
          const trato = await response.json();
          if (trato.empresaId) {
            const contactosResponse = await fetchWithToken(`${API_BASE_URL}/empresas/${trato.empresaId}/contactos`);
            contactos = await contactosResponse.json();
            setModals((prev) => ({
              ...prev,
              [modalType]: { ...prev[modalType], contactos },
            }));
          }
        } catch (error) {
          console.error("Error fetching contactos:", error);
        }
      }
      const contacto = contactos.find((c) => c.id === data.contactoId);
      nombreContacto = contacto ? contacto.nombre : "Sin contacto";
    } else if (data.contactoId && trato.contacto?.nombre) {
      nombreContacto = trato.contacto.nombre;
    }

    const actividad = {
      ...data,
      id: data.id,
      tipo: tipo.toUpperCase(),
      estado: "Programada",
      fecha: data.fechaLimite || "Sin fecha",
      hora: data.horaInicio || "Sin hora",
      nombreContacto: nombreContacto,
      asignadoA: users.find((user) => user.id === data.asignadoAId)?.nombreReal || "Sin asignado",
      modalidad: data.modalidad,
      lugarReunion: data.lugarReunion || null,
      enlaceReunion: data.enlaceReunion || null,
      duracion: data.duracion || null,
      subtipoTarea: data.subtipoTarea || null,
    };

    const normalizedTipo = tipo.toLowerCase().replace(/ñ/g, 'n');
    setTrato((prev) => ({
      ...prev,
      actividadesAbiertas: {
        ...prev.actividadesAbiertas,
        [normalizedTipo === "llamada" ? "llamadas" : normalizedTipo === "reunion" ? "reuniones" : "tareas"]: [
          ...prev.actividadesAbiertas[
          normalizedTipo === "llamada" ? "llamadas" : normalizedTipo === "reunion" ? "reuniones" : "tareas"
          ],
          actividad,
        ],
      },
    }));
    Swal.fire({
      title: `¡${tipo.charAt(0).toUpperCase() + tipo.slice(1)} programada!`,
      text: `La ${tipo} se ha programada exitosamente`,
      icon: "success",
    });
  };


  const handleSaveReprogramar = async (data, tipo, contactos) => {
    const normalizedTipo = tipo.toLowerCase().replace(/ñ/g, "n");
    const actividadReprogramada = {
      ...data,
      id: data.id,
      tipo: tipo.toUpperCase(),
      estado: "Reprogramada",
      nombreContacto: contactos.find((c) => c.id === data.contactoId)?.nombre || "Sin contacto",
      asignadoA: users.find((u) => u.id === data.asignadoAId)?.nombreReal || "Sin asignado",
      fecha: data.fechaLimite || "Sin fecha",
      hora: data.horaInicio || "Sin hora",
      subtipoTarea: data.subtipoTarea || null,
    };

    setTrato((prev) => {
      const updatedActividades = prev.actividadesAbiertas[
        normalizedTipo === "llamada" ? "llamadas" : normalizedTipo === "reunion" ? "reuniones" : "tareas"
      ].map((a) => (a.id === actividadReprogramada.id ? actividadReprogramada : a));
      return {
        ...prev,
        actividadesAbiertas: {
          ...prev.actividadesAbiertas,
          [normalizedTipo === "llamada" ? "llamadas" : normalizedTipo === "reunion" ? "reuniones" : "tareas"]:
            updatedActividades,
        },
      };
    });

    try {
      await fetchWithToken(`${API_BASE_URL}/tratos/${data.tratoId}/actividades/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      Swal.fire({
        title: "¡Actividad reprogramada!",
        text: `La ${tipo} se ha reprogramado exitosamente`,
        icon: "success",
      });
    } catch (error) {
      console.error(`Error al reprogramar la ${tipo}:`, error);
      Swal.fire({
        title: "Error",
        text: `No se pudo reprogramar la ${tipo}`,
        icon: "error",
      });
    }
  };

  const handleSaveCompletarActividad = async (updatedActividad, tipo) => {
    const normalizedTipo = tipo.toLowerCase().replace(/ñ/g, 'n');
    const actividad = modals.completarActividad.actividad;
    if (!actividad) {
      Swal.fire({
        title: 'Error',
        text: 'No se encontró la actividad a completar',
        icon: 'error',
      });
      return;
    }

    try {
      setTrato((prev) => {
        const updatedActividades = prev.actividadesAbiertas[
          normalizedTipo === 'llamada' ? 'llamadas' : normalizedTipo === 'reunion' ? 'reuniones' : 'tareas'
        ].filter((a) => a.id !== actividad.id);

        const newInteraccion = {
          id: updatedActividad.id,
          fecha: updatedActividad.fechaCompletado ? new Date(updatedActividad.fechaCompletado).toLocaleDateString('en-CA') : new Date().toLocaleDateString('en-CA'),
          hora: updatedActividad.horaCompletado || new Date().toLocaleTimeString(),
          responsable: users.find((u) => u.id === updatedActividad.asignadoAId)?.nombreReal || 'Sin asignado',
          tipo: updatedActividad.tipo,
          medio: !updatedActividad.medio && updatedActividad.tipo.toUpperCase() === 'REUNION'
            ? 'PRESENCIAL'
            : updatedActividad.medio || null,
          resultado: updatedActividad.respuesta === 'SI' ? 'POSITIVO' : updatedActividad.respuesta === 'NO' ? 'NEGATIVO' : 'Sin resultado',
          interes: updatedActividad.interes || 'Sin interés',
          informacion: updatedActividad.informacion || 'Sin información',
          notas: updatedActividad.notas || '',
          siguienteAccion: updatedActividad.siguienteAccion || '',
        };

        // Crear nueva nota si hay contenido en las notas
        let updatedNotas = [...prev.notas]; // Crear copia del array
        if (updatedActividad.notas && updatedActividad.notas.trim()) {
          if (modals.completarActividad.esEdicion) {
            const interaccionId = updatedActividad.id;
            const notaExistente = prev.notas.find(n =>
              n.id === interaccionId ||
              (n.autor === (users.find(u => u.id === getCurrentUserId())?.nombreReal || 'Usuario actual') &&
                prev.historialInteracciones.some(h => h.id === interaccionId && h.notas === n.texto))
            );

            if (notaExistente) {
              updatedNotas = prev.notas.map(n =>
                n.id === notaExistente.id
                  ? { ...n, texto: updatedActividad.notas.trim(), fechaEdicion: new Date().toLocaleDateString() }
                  : n
              );
            } else {
              const nuevaNota = {
                id: interaccionId,
                texto: updatedActividad.notas.trim(),
                autor: users.find(u => u.id === getCurrentUserId())?.nombreReal || 'Usuario actual',
                fecha: new Date().toLocaleDateString(),
                editadoPor: null,
                fechaEdicion: null,
              };
              updatedNotas = [nuevaNota, ...prev.notas];
            }
          } else {
            const nuevaNota = {
              id: Date.now(),
              texto: updatedActividad.notas.trim(),
              autor: users.find(u => u.id === getCurrentUserId())?.nombreReal || 'Usuario actual',
              fecha: new Date().toLocaleDateString(),
              editadoPor: null,
              fechaEdicion: null,
            };
            updatedNotas = [nuevaNota, ...prev.notas];
          }
        }

        return {
          ...prev, // Mantener toda la estructura existente
          actividadesAbiertas: {
            ...prev.actividadesAbiertas,
            [normalizedTipo === 'llamada' ? 'llamadas' : normalizedTipo === 'reunion' ? 'reuniones' : 'tareas']:
              updatedActividades,
          },
          historialInteracciones: modals.completarActividad.esEdicion
            ? prev.historialInteracciones.map(interaccion =>
              interaccion.id === updatedActividad.id ? newInteraccion : interaccion
            )
            : [...prev.historialInteracciones, newInteraccion],
          notas: updatedNotas,
          fechaCreacion: prev.fechaCreacion,
          fechaCierre: prev.fechaCierre,
        };
      });

    } catch (error) {
      console.error('Error al completar la actividad:', error);
      Swal.fire({
        title: 'Error',
        text: error.message.includes('no encontrada')
          ? 'La actividad no fue encontrada'
          : 'No se pudo completar la actividad',
        icon: 'error',
      });
    }
  };


  const handleSaveEditarTrato = async (data) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Recargar completamente el trato desde el servidor
      const loadTrato = async () => {
        const updatedData = await fetchTrato(params.id);
        const usersResponse = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
        const usersData = await usersResponse.json();
        const allUsersResponse = await fetchWithToken(`${API_BASE_URL}/auth/users`);
        const allUsersData = await allUsersResponse.json();
        const users = usersData.map((user) => ({
          id: user.id,
          nombre: user.nombreUsuario,
          nombreReal: user.nombre
        }));

        const propietarioUser = users.find((user) => user.id === updatedData.propietarioId);
        const propietarioNombre = propietarioUser ? propietarioUser.nombreReal : updatedData.propietarioNombre || "";

        // Mantener la estructura existente pero con datos frescos del servidor
        setTrato(prev => ({
          ...updatedData,
          propietario: propietarioNombre,
          contacto: {
            nombre: updatedData.contacto?.nombre || "",
            telefonos: updatedData.contacto?.telefonos || [],
            correos: updatedData.contacto?.correos || [],
            whatsapp: updatedData.contacto?.whatsapp || ""
          },
          ingresosEsperados: updatedData.ingresosEsperados ? `$${updatedData.ingresosEsperados.toFixed(2)}` : "",
          fechaCreacion: updatedData.fechaCreacion ? new Date(updatedData.fechaCreacion).toLocaleDateString() : "",
          fechaCierre: updatedData.fechaCierre ? new Date(updatedData.fechaCierre).toLocaleDateString() : "",
          notas: (updatedData.notas || []).map((n) => ({
            id: n.id,
            texto: n.nota.replace(/\\"/g, '"').replace(/^"|"$/g, ''),
            autor: n.autorNombre,
            fecha: n.fechaCreacion ? new Date(n.fechaCreacion).toLocaleDateString() : "",
            editadoPor: n.editadoPorName || null,
            fechaEdicion: n.fechaEdicion ? new Date(n.fechaEdicion).toLocaleDateString() : null,
          })),
          nombreEmpresa: updatedData.empresaNombre,
          numeroTrato: updatedData.noTrato,
          actividadesAbiertas: prev.actividadesAbiertas,
          historialInteracciones: prev.historialInteracciones,
        }));
      };

      await loadTrato();

      Swal.fire({
        title: "¡Trato actualizado!",
        text: "Los cambios se han guardado exitosamente",
        icon: "success",
      });
    } catch (error) {
      console.error("Error al guardar el trato:", error);
      Swal.fire({
        title: 'Error',
        text: 'No se pudo actualizar el trato. Verifique los datos e intente nuevamente.',
        icon: 'error',
      });
    }
  };

  useEffect(() => {
    const loadTrato = async () => {
      setLoading(true);
      try {
        // Cargar datos básicos primero
        const tratoData = await fetchTrato(params.id);
        const usersResponse = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
        const usersData = await usersResponse.json();
        const allUsersResponse = await fetchWithToken(`${API_BASE_URL}/auth/users`);
        const allUsersData = await allUsersResponse.json();
        const companiesResponse = await fetchWithToken(`${API_BASE_URL}/empresas`);
        const companiesData = await companiesResponse.json();


        const users = usersData.map((user) => ({
          id: user.id,
          nombre: user.nombreUsuario,
          nombreReal: user.nombre
        }));
        setUsers(users);
        const todosLosUsuarios = allUsersData.map((user) => ({
          id: user.id,
          nombre: user.nombreUsuario,
          nombreReal: user.nombre
        }));
        setAllUsers(todosLosUsuarios);
        setCompanies(companiesData || []);
        const propietarioUser = users.find((user) => user.id === tratoData.propietarioId);
        const propietarioNombre = propietarioUser ? propietarioUser.nombreReal : tratoData.propietarioNombre || "";

        setTrato({
          id: tratoData.id || "",
          nombre: tratoData.nombre || "",
          contacto: {
            nombre: tratoData.contacto?.nombre || "",
            telefonos: tratoData.contacto?.telefonos || [],
            correos: tratoData.contacto?.correos || [],
            whatsapp: tratoData.contacto?.whatsapp || ""
          },
          propietario: propietarioNombre,
          numeroTrato: tratoData.noTrato || "",
          nombreEmpresa: tratoData.empresaNombre || "",
          empresaId: tratoData.empresaId || "",
          descripcion: tratoData.descripcion || "",
          domicilio: tratoData.domicilio || "",
          ingresosEsperados: tratoData.ingresosEsperados ? `$${tratoData.ingresosEsperados.toFixed(2)}` : "",
          numeroUnidades: tratoData.numeroUnidades || "",
          sitioWeb: tratoData.sitioWeb || "",
          sector: tratoData.sectorNombre || tratoData.sector || "",
          sectorNombre: tratoData.sectorNombre || "",
          fechaCreacion: tratoData.fechaCreacion ? new Date(tratoData.fechaCreacion).toLocaleDateString() : "",
          fechaCierre: tratoData.fechaCierre ? new Date(tratoData.fechaCierre).toLocaleDateString() : "",
          fase: tratoData.fase || "",
          fases: tratoData.fases || [],
          actividadesAbiertas: { tareas: [], llamadas: [], reuniones: [] },
          historialInteracciones: [],
          notas: [],
        });

        setLoading(false);

        // Cargar datos secundarios de forma asíncrona
        loadSecondaryData(tratoData, users, todosLosUsuarios);

      } catch (error) {
        console.error("Error fetching trato:", error);
        setLoading(false);
        Swal.fire({
          title: "Error",
          text: "No se pudo cargar el trato",
          icon: "error",
        });
      }
    };

    const loadSecondaryData = async (tratoData, users, allUsers) => {
      try {
        // Solo cargar emails del trato
        const emailData = await fetchWithToken(`${API_BASE_URL}/correos/trato/${params.id}`)
          .then(res => res.status === 204 ? [] : res.json())
          .catch(() => []);

        const correosOrdenados = Array.isArray(emailData)
          ? emailData.sort((a, b) => new Date(b.fechaEnvio) - new Date(a.fechaEnvio))
          : [];

        setEmailRecords(correosOrdenados);

        // Solo cargar contactos si hay actividades que los necesiten
        const allActividades = [
          ...(tratoData.actividadesAbiertas?.tareas || []),
          ...(tratoData.actividadesAbiertas?.llamadas || []),
          ...(tratoData.actividadesAbiertas?.reuniones || [])
        ];

        // Obtener IDs únicos de contactos necesarios
        const contactosNeeded = new Set();
        allActividades.forEach(actividad => {
          if (actividad.contactoId) {
            contactosNeeded.add(actividad.contactoId);
          }
        });

        // Solo cargar los contactos específicos que necesitamos
        const contactosMap = new Map();
        if (contactosNeeded.size > 0) {
          for (const contactoId of contactosNeeded) {
            try {
              const contactoResponse = await fetchWithToken(`${API_BASE_URL}/contactos/${contactoId}`);
              const contactoData = await contactoResponse.json();
              contactosMap.set(contactoId, contactoData);
            } catch (error) {
              console.warn(`No se pudo cargar contacto ${contactoId}`);
            }
          }
        }

        // Función optimizada para mapear actividades
        const mapActividad = (actividad) => {
          let nombreContacto = "Sin contacto";
          if (actividad.contactoId && contactosMap.has(actividad.contactoId)) {
            nombreContacto = contactosMap.get(actividad.contactoId).nombre;
          } else if (tratoData.contacto?.nombre) {
            nombreContacto = tratoData.contacto.nombre;
          }

          return {
            ...actividad,
            nombreContacto: nombreContacto,
            asignadoA: users.find((user) => user.id === actividad.asignadoAId)?.nombreReal || "Sin asignado",
            fecha: actividad.fechaLimite || "Sin fecha",
            hora: actividad.horaInicio || "Sin hora",
            modalidad: actividad.modalidad,
            lugarReunion: actividad.lugarReunion || null,
            enlaceReunion: actividad.enlaceReunion || null,
            tipo: actividad.tipo === "TAREA" ? "TAREA" : actividad.tipo || "Sin tipo",
            subtipoTarea: actividad.subtipoTarea || null,
          };
        };

        // Actualizar el trato con los datos procesados
        setTrato(prev => ({
          ...prev,
          actividadesAbiertas: {
            tareas: (tratoData.actividadesAbiertas?.tareas || [])
              .filter(a => a.estatus !== "CERRADA")
              .map(mapActividad),
            llamadas: (tratoData.actividadesAbiertas?.llamadas || [])
              .filter(a => a.estatus !== "CERRADA")
              .map(mapActividad),
            reuniones: (tratoData.actividadesAbiertas?.reuniones || [])
              .filter(a => a.estatus !== "CERRADA")
              .map(mapActividad),
          },
          historialInteracciones: (tratoData.historialInteracciones || []).map(interaccion => ({
            id: interaccion.id,
            fecha: interaccion.fechaCompletado ? new Date(interaccion.fechaCompletado).toLocaleDateString('en-CA') : "Sin fecha",
            hora: interaccion.fechaCompletado ? new Date(interaccion.fechaCompletado).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : "Sin hora",
            responsable: allUsers.find(u => u.id === interaccion.usuarioCompletadoId)?.nombreReal || "Sin asignado",
            tipo: interaccion.tipo,
            medio: interaccion.medio || (interaccion.modalidad === "PRESENCIAL" ? "PRESENCIAL" : interaccion.medio),
            resultado: interaccion.respuesta ? (interaccion.respuesta === "SI" ? "POSITIVO" : "NEGATIVO") : "Sin resultado",
            interes: interaccion.interes || "Sin interés",
            informacion: interaccion.informacion || "Sin información",
            notas: interaccion.notas || "",
            siguienteAccion: interaccion.siguienteAccion || "",
          })),
          notas: (tratoData.notas || []).map((n) => ({
            id: n.id,
            texto: n.nota.replace(/\\"/g, '"').replace(/^"|"$/g, ''),
            autor: n.autorNombre,
            fecha: n.fechaCreacion ? new Date(n.fechaCreacion).toLocaleDateString() : "",
            editadoPor: n.editadoPorName || null,
            fechaEdicion: n.fechaEdicion ? new Date(n.fechaEdicion).toLocaleDateString() : null,
          })),
        }));

      } catch (error) {
        console.error("Error loading secondary data:", error);
      }
    };

    loadTrato();
  }, [params.id]);

  useEffect(() => {
    // Verificar si debe mostrar la sección de cotizaciones
    const fasesPermitidas = [
      'COTIZACION_PROPUESTA_PRACTICA',
      'NEGOCIACION_REVISION',
      'CERRADO_GANADO',
      'CERRADO_PERDIDO'
    ];

    const debeMostrarCotizaciones = fasesPermitidas.includes(trato.fase) && modulosActivos.cotizaciones;
    setShowCotizacionesSection(debeMostrarCotizaciones);

    // Cargar cotizaciones solo si está en fase permitida Y el módulo está activo
    if (debeMostrarCotizaciones) {
      cargarCotizaciones();
    }
  }, [trato.fase]);

  const cargarCotizaciones = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/cotizaciones/trato/${params.id}`);
      const data = await response.json();
      setCotizaciones(data);

      if (data.length > 0) {
        await checkVinculaciones(data);
      }
    } catch (error) {
      console.error('Error cargando cotizaciones:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las cotizaciones'
      });
    }
  };

  const handleVolver = () => {
    navigate("/tratos")
  }

  const handleVerEmpresa = () => {
    if (trato.empresaId) {
      navigate(`/empresas/${trato.empresaId}`, {
        replace: true,
        state: { fromTrato: true, empresaId: trato.empresaId }
      });
    } else {
      Swal.fire({
        title: 'Sin empresa asociada',
        text: 'Este trato no tiene una empresa asociada',
        icon: 'info',
      });
    }
  };

  const handleEditarTrato = () => {
    openModal("editarTrato");
  };

  const handleAgregarNota = async () => {
    if (nuevaNota.trim()) {
      try {
        const cleanedText = nuevaNota.replace(/\\"/g, '"').replace(/^"|"$/g, '');
        const response = await fetchWithToken(`${API_BASE_URL}/tratos/${params.id}/notas`, {
          method: 'POST',
          body: JSON.stringify(cleanedText),
        });
        const savedNota = await response.json();
        const newNota = {
          id: savedNota.id,
          texto: savedNota.nota.replace(/\\"/g, '"').replace(/^"|"$/g, ''),
          autor: savedNota.autorNombre || "Usuario Desconocido",
          fecha: new Date(savedNota.fechaCreacion).toLocaleDateString(),
          editadoPor: savedNota.editadoPorNombre || null,
          fechaEdicion: savedNota.fechaEdicion ? new Date(savedNota.fechaEdicion).toLocaleDateString() : null,
        };
        setTrato((prev) => ({
          ...prev,
          notas: [...prev.notas, newNota],
        }));
        setNuevaNota("");
        Swal.fire({
          title: "¡Éxito!",
          text: "Nota agregada correctamente",
          icon: "success",
        });
      } catch (error) {
        Swal.fire({
          title: 'Error',
          text: 'No se pudo agregar la nota',
          icon: 'error',
        });
        console.error(error);
      }
    }
  };

  const handleEliminarNota = (notaId) => {
    Swal.fire({
      title: "¿Estás seguro?",
      text: "No podrás revertir esta acción",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await fetchWithToken(`${API_BASE_URL}/tratos/${params.id}/notas/${notaId}`, {
            method: 'DELETE',
          });
          setTrato((prev) => ({
            ...prev,
            notas: prev.notas.filter((nota) => nota.id !== notaId),
          }));
          Swal.fire({
            title: "¡Éxito!",
            text: "Nota eliminada correctamente",
            icon: "success",
          });
        } catch (error) {
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar la nota',
            icon: 'error',
          });
        }
      }
    });
  };


  const handleAgregarActividad = (tipo) => {
    openModal("seleccionarActividad")
  }

  const handleAgregarCorreo = (archivoPrecargado = null, asuntoPrecargado = null) => {
    openModal("crearCorreo", {
      archivoPrecargado,
      asuntoPrecargado
    });
  }

  const handleCambiarFase = async (nuevaFase) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/${params.id}/mover-fase?nuevaFase=${nuevaFase}`, {
        method: 'PUT',
      });
      const updatedTrato = await response.json();

      setTrato((prev) => ({
        ...prev,
        fase: updatedTrato.fase,
        fases: updatedTrato.fases,
        propietarioId: updatedTrato.propietarioId,
        propietarioNombre: updatedTrato.propietarioNombre
      }));

      // Verificar si el trato fue escalado
      if (updatedTrato.escalado) {
        Swal.fire({
          title: "¡Trato Escalado!",
          html: `
          <div style="text-align: left;">
            <p><strong>Fase cambiada a:</strong> ${nuevaFase.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</p>
            <p><strong>Trato transferido a:</strong> ${updatedTrato.nuevoAdministradorNombre}</p>
            <p style="margin-top: 15px; color: #666;">
              <i class="fas fa-info-circle"></i> Su trato ha sido automáticamente asignado a un administrador para su seguimiento en esta fase crítica.
            </p>
          </div>
        `,
          icon: "info",
          iconColor: "#3085d6",
          confirmButtonText: "Entendido",
          confirmButtonColor: "#3085d6",
          allowOutsideClick: false,
          allowEscapeKey: false,
          customClass: {
            popup: 'swal-escalamiento-popup'
          }
        });
      } else {
        Swal.fire({
          title: "¡Éxito!",
          text: `Fase cambiada a ${nuevaFase.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}`,
          icon: "success",
        });
      }
    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: 'No se pudo cambiar la fase',
        icon: 'error',
      });
      console.error(error);
    }
  };
  // Funciones para editar notas inline
  const handleEditarNota = (notaId) => {
    const nota = trato.notas.find((n) => n.id === notaId);
    if (nota) {
      setEditingNoteId(notaId);
      setEditingNoteText(nota.texto);
    }
  };

  const handleSaveEditNota = async (notaId) => {
    if (editingNoteText.trim()) {
      try {
        const cleanedText = editingNoteText.replace(/\\"/g, '"').replace(/^"|"$/g, '');
        const response = await fetchWithToken(`${API_BASE_URL}/tratos/${params.id}/notas/${notaId}`, {
          method: 'PUT',
          body: JSON.stringify(cleanedText),
        });
        const updatedNota = await response.json();
        const newNota = {
          ...trato.notas.find((n) => n.id === notaId),
          texto: updatedNota.nota,
          editadoPor: updatedNota.editadoPorNombre || null,
          fechaEdicion: updatedNota.fechaEdicion ? new Date(updatedNota.fechaEdicion).toLocaleDateString() : null,
        };
        setTrato((prev) => ({
          ...prev,
          notas: prev.notas.map((n) => (n.id === notaId ? newNota : n)),
        }));
        setEditingNoteId(null);
        setEditingNoteText("");
        Swal.fire({
          title: "¡Éxito!",
          text: "Nota editada correctamente",
          icon: "success",
        });
      } catch (error) {
        Swal.fire({
          title: 'Error',
          text: 'No se pudo editar la nota',
          icon: 'error',
        });
        console.error(error);
      }
    }
  };

  const handleCancelEditNota = () => {
    setEditingNoteId(null)
    setEditingNoteText("")
  }

  const handleLlamarContacto = (telefono) => {
    Swal.fire({
      title: "Realizar Llamada",
      text: `¿Deseas llamar al número ${telefono}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2196f3",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, llamar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        window.open(`tel:${telefono}`, "_self")
        Swal.fire("Llamada iniciada", `Llamando a ${telefono}`, "success")
      }
    })
  }

  const handleWhatsAppContacto = (whatsapp) => {
    Swal.fire({
      title: "Abrir WhatsApp",
      text: `¿Deseas enviar un mensaje de WhatsApp al número ${whatsapp}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#25d366",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, abrir WhatsApp",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        // Limpiar el número de WhatsApp (quitar espacios y caracteres especiales)
        const cleanNumber = whatsapp.replace(/\s+/g, "").replace(/[^\d]/g, "")
        const whatsappUrl = `https://wa.me/52${cleanNumber}`
        window.open(whatsappUrl, "_blank")
        Swal.fire("WhatsApp abierto", `Mensaje enviado a ${whatsapp}`, "success")
      }
    })
  }

  const handleCompletarActividad = (actividadId, tipo) => {
    const actividad = trato.actividadesAbiertas[
      tipo === "llamada" ? "llamadas" : tipo === "reunion" ? "reuniones" : "tareas"
    ].find((a) => a.id === actividadId);

    if (!actividad || !actividad.tratoId) {
      Swal.fire({
        title: 'Error',
        text: 'No se encontró la actividad o el trato asociado.',
        icon: 'error',
      });
      return;
    }

    openModal("completarActividad", {
      actividad: {
        ...actividad,
        subtipoTarea: actividad.subtipoTarea || null,
      },
      tratoId: actividad.tratoId
    });
  };

  const handleEliminarActividad = async (actividadId, tipo) => {
    const actividad = trato.actividadesAbiertas[
      tipo === "llamada" ? "llamadas" : tipo === "reunion" ? "reuniones" : "tareas"
    ].find((a) => a.id === actividadId);

    if (!actividad || !actividad.tratoId) {
      Swal.fire({
        title: 'Error',
        text: 'No se encontró la actividad o el trato asociado.',
        icon: 'error',
      });
      return;
    }

    // Mostrar confirmación con SweetAlert
    const result = await Swal.fire({
      title: '¿Está seguro?',
      text: `¿Desea eliminar esta ${tipo}? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      Swal.fire({
        title: 'Eliminando...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading();
        }
      });

      const response = await fetchWithToken(`${API_BASE_URL}/tratos/actividades/${actividadId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Eliminar la actividad del estado local
        const normalizedTipo = tipo.toLowerCase().replace(/ñ/g, 'n');
        const actividadKey = normalizedTipo === "llamada" ? "llamadas" : normalizedTipo === "reunion" ? "reuniones" : "tareas";

        setTrato((prev) => ({
          ...prev,
          actividadesAbiertas: {
            ...prev.actividadesAbiertas,
            [actividadKey]: prev.actividadesAbiertas[actividadKey].filter(a => a.id !== actividadId)
          }
        }));

        await Swal.fire({
          title: 'Eliminado',
          text: 'La actividad ha sido eliminada exitosamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error al eliminar actividad:', error);
      Swal.fire({
        title: 'Error',
        text: `No se pudo eliminar la actividad: ${error.message}`,
        icon: 'error'
      });
    }
  };

  const handleEditarInteraccion = (interaccion) => {
    closeModal('completarActividad');
    setModals(prev => ({
      ...prev,
      completarActividad: {
        isOpen: true,
        loading: false,
        actividad: {
          ...interaccion,
          id: interaccion.id,
          tipo: interaccion.tipo,
          tratoId: trato.id,
          medio: interaccion.medio,
          respuesta: interaccion.resultado === 'POSITIVO' ? 'SI' : interaccion.resultado === 'NEGATIVO' ? 'NO' : '',
          interes: interaccion.interes !== 'Sin interés' ? interaccion.interes : '',
          informacion: interaccion.informacion === 'SI' || interaccion.informacion === 'NO'
            ? interaccion.informacion
            : '',
          siguienteAccion: interaccion.siguienteAccion || '',
          notas: interaccion.notas || '',
        },
        tratoId: trato.id,
        esEdicion: true,
        contactos: []
      }
    }));
  };

  const handleReprogramarActividad = (actividadId, tipo) => {
    const actividad = trato.actividadesAbiertas[
      tipo === "llamada" ? "llamadas" : tipo === "reunion" ? "reuniones" : "tareas"
    ].find((a) => a.id === actividadId);
    if (actividad && actividad.tratoId) {
      if (tipo === "llamada") {
        openModal("reprogramarLlamada", { actividad });
      } else if (tipo === "reunion") {
        openModal("reprogramarReunion", { actividad });
      } else if (tipo === "tarea") {
        openModal("reprogramarTarea", { actividad });
      }
    } else {
      console.error("Actividad or tratoId not found for reprogramming:", actividadId, tipo);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo encontrar la actividad o el trato asociado.",
      });
    }
  };

  // Función para determinar y abrir el modal siguiente automáticamente
  const handleSiguienteAccionAutomatica = (siguienteAccion, tratoId) => {
    if (!siguienteAccion) {
      openModal('seleccionarActividad', { tratoId });
      return;
    }

    const accion = siguienteAccion;

    const accionesLlamada = [
      'REGRESAR_LLAMADA',
      'BUSCAR_OTRO_CONTACTO',
      'CONTACTAR_DESPUES'
    ];

    if (accionesLlamada.includes(accion)) {
      openModal('programarLlamada', { tratoId });
      return;
    }

    const accionesReunion = [
      'REUNION',
      'REALIZAR_DEMO',
      'INSTALACION',
      'REVISION_TECNICA',
      'VISITAR_EN_FISICO'
    ];

    if (accionesReunion.includes(accion)) {
      let modalidadSugerida = 'VIRTUAL';
      if (['VISITAR_EN_FISICO', 'INSTALACION', 'REVISION_TECNICA'].includes(accion)) {
        modalidadSugerida = 'PRESENCIAL';
      }

      openModal('programarReunion', {
        tratoId,
        modalidad: modalidadSugerida
      });
      return;
    }

    if (['MANDAR_COTIZACION', 'MANDAR_INFORMACION'].includes(accion)) {
      openModal('programarTarea', { tratoId, tipo: 'Correo' });
      return;
    }
    if (accion === 'MANDAR_MENSAJE') {
      openModal('programarTarea', { tratoId, tipo: 'Mensaje' });
      return;
    }

    if (['_1ER_SEGUIMIENTO', '_2DO_SEGUIMIENTO', '_3ER_SEGUIMIENTO'].includes(accion)) {
      openModal('programarTarea', { tratoId, tipo: 'Actividad' });
      return;
    }
    openModal('seleccionarActividad', { tratoId });
  };

  const handleSaveAgregarInteraccion = async () => {
    try {
      const tratoResponse = await fetchWithToken(`${API_BASE_URL}/tratos/${params.id}`);
      const tratoActualizado = await tratoResponse.json();

      setTrato(prev => ({
        ...prev,
        fechaCreacion: tratoActualizado.fechaCreacion ? new Date(tratoActualizado.fechaCreacion).toLocaleDateString() : prev.fechaCreacion,
        fechaCierre: tratoActualizado.fechaCierre ? new Date(tratoActualizado.fechaCierre).toLocaleDateString() : prev.fechaCierre,
        notas: (tratoActualizado.notas || []).map((n) => ({
          id: n.id,
          texto: n.nota.replace(/\\"/g, '"').replace(/^"|"$/g, ''),
          autor: n.autorNombre,
          fecha: n.fechaCreacion ? new Date(n.fechaCreacion).toLocaleDateString() : "",
          editadoPor: n.editadoPorName || null,
          fechaEdicion: n.fechaEdicion ? new Date(n.fechaEdicion).toLocaleDateString() : null,
        })),
        historialInteracciones: (tratoActualizado.historialInteracciones || []).map(interaccion => ({
          id: interaccion.id,
          fecha: interaccion.fechaCompletado ? new Date(interaccion.fechaCompletado).toLocaleDateString('en-CA') : "Sin fecha",
          hora: interaccion.fechaCompletado ? new Date(interaccion.fechaCompletado).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : "Sin hora",
          responsable: users.find(u => u.id === interaccion.usuarioCompletadoId)?.nombreReal || "Sin asignado",
          tipo: interaccion.tipo,
          medio: interaccion.medio || (interaccion.modalidad === "PRESENCIAL" ? "PRESENCIAL" : interaccion.medio),
          resultado: interaccion.respuesta ? (interaccion.respuesta === "SI" ? "POSITIVO" : "NEGATIVO") : "Sin resultado",
          interes: interaccion.interes || "Sin interés",
          informacion: interaccion.informacion || "Sin información",
          notas: interaccion.notas || "",
          siguienteAccion: interaccion.siguienteAccion || "",
        }))
      }));

      closeModal('agregarInteraccion');
    } catch (error) {
      console.error('Error al recargar historial:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo actualizar el historial de interacciones'
      });
    }
  };

  const handleEditarCotizacion = (cotizacion) => {
    openModal('editarCotizacion', { cotizacion });
  };

  const handleDescargarCotizacion = (cotizacionId) => {
    const cotizacion = cotizaciones.find(c => c.id === cotizacionId);
    if (cotizacion) {
      openModal("subirArchivo", { cotizacion });
    }
  };

  const fetchCotizacionBlob = async (cotizacionId, incluirArchivos, showLoading = false) => {
    if (showLoading) {
      Swal.fire({
        title: 'Preparando archivo...',
        text: 'Generando PDF',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
    }

    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/cotizaciones/${cotizacionId}/download-pdf?incluirArchivos=${incluirArchivos}`,
        { method: 'GET', headers: { 'Accept': 'application/pdf' } }
      );

      if (!response.ok) throw new Error('Error al descargar el PDF');

      const blob = await response.blob();
      if (blob.size === 0) throw new Error('El PDF generado está vacío');

      if (showLoading) Swal.close();
      return blob;
    } catch (error) {
      if (showLoading) Swal.close();
      throw error;
    }
  };

  const executeDownload = async (cotizacionId, incluirArchivos) => {
    try {
      const blob = await fetchCotizacionBlob(cotizacionId, incluirArchivos, true);

      const url = window.URL.createObjectURL(blob);
      const filename = `COTIZACION_${cotizacionId}_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}.pdf`;

      setPdfPreview({
        isOpen: true,
        url: url,
        filename: filename
      });

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar la vista previa: ' + error.message,
      });
    }
  };

  const forceDirectDownload = async (cotizacionId, incluirArchivos = false) => {
    try {
      const blob = await fetchCotizacionBlob(cotizacionId, incluirArchivos, true);

      const filename = `COTIZACION_${cotizacionId}_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Descargado",
        text: "El PDF se ha descargado exitosamente para adjuntarlo en WhatsApp.",
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error("Error en descarga directa:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo descargar el PDF: ' + error.message
      });
    }
  };

  const handleDownloadFromPreview = () => {
    if (pdfPreview.url) {
      const a = document.createElement('a');
      a.href = pdfPreview.url;
      a.download = pdfPreview.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      Swal.fire({
        icon: "success",
        title: "Descarga iniciada",
        timer: 2000,
        showConfirmButton: false,
      });
    }
  };

  const handleClosePreview = () => {
    if (pdfPreview.url) {
      window.URL.revokeObjectURL(pdfPreview.url);
    }
    setPdfPreview({ isOpen: false, url: null, filename: "" });
  };

  const handleCompartirCotizacion = async (cotizacion) => {
    openModal('compartirCotizacion', { cotizacion });
  };

  const handleOpcionCompartir = async (incluirArchivos, cotizacion) => {
    const limpiarNombreArchivo = (texto) => {
      return texto
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();
    };

    const obtenerArchivoPDF = async (incluirArchivos) => {
      try {
        Swal.fire({
          title: 'Preparando archivo...',
          text: 'Generando PDF para adjuntar',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const response = await fetchWithToken(
          `${API_BASE_URL}/cotizaciones/${cotizacion.id}/download-pdf?incluirArchivos=${incluirArchivos}`,
          { method: 'GET', headers: { 'Accept': 'application/pdf' } }
        );

        if (!response.ok) throw new Error('Error al descargar PDF');

        const blob = await response.blob();

        if (blob.size === 0) throw new Error('El PDF generado está vacío');

        const nombreSeguro = limpiarNombreArchivo(trato.nombre || 'trato');
        const fileName = `cotizacion_${cotizacion.id}_${nombreSeguro}.pdf`;

        const file = new File([blob], fileName, {
          type: 'application/pdf',
          lastModified: new Date().getTime()
        });

        Swal.close();
        return file;
      } catch (error) {
        Swal.close();
        console.error(error);
        Swal.fire('Error', 'No se pudo generar el archivo PDF para adjuntar', 'error');
        return null;
      }
    };

    const marcarComoEnviada = async () => {
      if (cotizacion.estatus === 'PENDIENTE') {
        try {
          await fetchWithToken(
            `${API_BASE_URL}/cotizaciones/${cotizacion.id}/marcar-enviada`,
            { method: 'PUT' }
          );
          cargarCotizaciones();
        } catch (error) {
          console.error("No se pudo actualizar el estatus", error);
        }
      }
    };

    // Mostrar opciones de WhatsApp o Email
    await Swal.fire({
      title: 'Compartir Cotización',
      text: 'Selecciona el medio de envío',
      showConfirmButton: false,
      showCloseButton: true,
      html: `
      <div class="swal-share-container">
        <button id="btn-share-whatsapp" class="btn-share-option btn-share-whatsapp">
          <img src="${whatsappIcon}" class="share-icon-img" alt="" />
          WhatsApp
        </button>
        <button id="btn-share-email" class="btn-share-option btn-share-email">
          <img src="${emailIcon}" class="share-icon-img" alt="" />
          Correo
        </button>
      </div>
    `,
      didOpen: () => {
        document.getElementById('btn-share-whatsapp').addEventListener('click', async () => {
          Swal.close();

          await forceDirectDownload(cotizacion.id, incluirArchivos);

          const contacto = trato.contacto;
          let numero = contacto?.whatsapp || contacto?.celular;
          if (!numero && contacto?.telefonos?.length > 0) {
            numero = contacto.telefonos[0].telefono;
          }
          if (!numero) {
            Swal.fire('Atención', 'El contacto no tiene número celular registrado', 'warning');
            return;
          }
          const cleanNumber = numero.replace(/\D/g, '');
          const mensaje = `Hola ${contacto.nombre || ''}, te comparto la cotización #${cotizacion.id} del trato ${trato.nombre}. Acabo de descargar el PDF automáticamente para que lo adjuntes fácilmente.`;

          window.open(`https://wa.me/52${cleanNumber}?text=${encodeURIComponent(mensaje)}`, '_blank');

          marcarComoEnviada();
        });

        document.getElementById('btn-share-email').addEventListener('click', async () => {
          Swal.close();

          try {
            const blob = await fetchCotizacionBlob(cotizacion.id, incluirArchivos, true);

            const limpiarNombreArchivo = (texto) => texto.replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_').toLowerCase();
            const nombreSeguro = limpiarNombreArchivo(trato.nombre || 'trato');
            const fileName = `cotizacion_${cotizacion.id}_${nombreSeguro}.pdf`;

            const file = new File([blob], fileName, {
              type: 'application/pdf',
              lastModified: new Date().getTime()
            });

            openModal('crearCorreo', {
              archivoPrecargado: file,
              asuntoPrecargado: `Cotización #${cotizacion.id} - ${trato.nombre}`
            });
            marcarComoEnviada();

          } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo generar el archivo PDF para adjuntar', 'error');
          }
        });
      }
    });
  };

  const handleCrearCuentaCobrar = (cotizacion) => {
    if (cotizacion.estatus === 'ACEPTADA') {
      Swal.fire({
        icon: 'warning',
        title: 'Alerta',
        text: 'Ya se generaron las cuentas por cobrar para esta cotización'
      });
      return;
    }
    openModal('crearCuentas', { cotizacion });
  };

  const handleEliminarCotizacion = async (cotizacionId) => {
    const result = await Swal.fire({
      title: '¿Está seguro?',
      text: '¿Desea eliminar esta cotización de forma permanente?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cotizacionId}`, { method: 'DELETE' });
        cargarCotizaciones();
        Swal.fire({
          icon: 'success',
          title: 'Eliminada',
          text: 'La cotización ha sido eliminada correctamente'
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo eliminar la cotización'
        });
      }
    }
  };

  const handleSaveCotizacion = async (cotizacionData) => {
    try {
      const url = cotizacionData.id
        ? `${API_BASE_URL}/cotizaciones/${cotizacionData.id}`
        : `${API_BASE_URL}/cotizaciones`;
      const method = cotizacionData.id ? "PUT" : "POST";

      const payload = {
        ...cotizacionData,
        tratoId: cotizacionData.tratoId || parseInt(params.id),

        clienteNombre: cotizacionData.cliente,
        unidades: cotizacionData.conceptos.map((c) => ({
          cantidad: c.cantidad,
          unidad: c.unidad,
          concepto: c.concepto,
          precioUnitario: c.precioUnitario,
          descuento: c.descuento ?? 0,
          importeTotal: c.importeTotal,
        })),
        empresaData: cotizacionData.empresaData,
      };

      const response = await fetchWithToken(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Error al guardar");

      const savedCotizacion = await response.json();

      if (cotizacionData.id) {
        const currentTratoId = parseInt(params.id);


        if (savedCotizacion.tratoId !== currentTratoId) {
          setCotizaciones((prev) => prev.filter((c) => c.id !== savedCotizacion.id));
        } else {

          setCotizaciones((prev) =>
            prev.map((c) => (c.id === savedCotizacion.id ? { ...c, ...savedCotizacion } : c))
          );
        }
      } else {
        setCotizaciones((prev) => [savedCotizacion, ...prev]);
      }

      Swal.fire({
        icon: "success",
        title: "Éxito",
        text: "Cotización guardada correctamente",
      });

      if (modals.crearCotizacion?.isOpen) closeModal("crearCotizacion");
      if (modals.editarCotizacion?.isOpen) closeModal("editarCotizacion");

    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo guardar la cotización",
      });
    }
  };

  // WebSocket para actualizaciones en tiempo real de emails
  useEmailStatusWebSocket(params.id, handleEmailStatusUpdate);

  if (loading) {
    return (
      <>
        <Header />
        <div className="loading-container">
          <p>Cargando detalles del trato...</p>
        </div>
      </>
    )
  }

  if (!trato) {
    return (
      <>
        <Header />
        <div className="error-container">
          <p>No se pudo cargar el trato</p>
          <button onClick={handleVolver} className="btn-volver">
            Volver a Tratos
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-with-header">
        <Header />
        <main className="main-content">
          <div className="detalles-trato-container">
            {/* Header con navegación */}
            <div className="detalles-header">
              <div className="header-navigation">
                <button onClick={handleVolver} className="btn-volver">
                  ←
                </button>
                <h1 className="trato-titulo">{trato.nombre}</h1>
              </div>
              <button onClick={handleEditarTrato} className="btn-editar-trato">
                Editar trato
              </button>
            </div>

            {/* Breadcrumb de fases */}
            <div className="fases-breadcrumb">
              <div className="fecha-inicio">
                <span>INICIO</span>
                <span className="fecha">{trato.fechaCreacion}</span>
              </div>
              <div className="fases-container">
                {trato.fases.map((fase, index) => (
                  <button
                    key={index}
                    className={`fase-item ${trato.fase === fase.nombre ? 'actual' : ''}`}
                    onClick={() => handleCambiarFase(fase.nombre)}
                  >
                    <span>{fase.nombre.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </button>
                ))}
              </div>
              <div className="fecha-final">
                <span>FINAL</span>
                <span className="fecha">{trato.fechaCierre}</span>
                <div className="iconos-estado">
                  <button
                    className={`btn-estado ganado ${trato.fase === 'CERRADO_GANADO' ? 'activo' : ''}`}
                    onClick={() => handleCambiarFase('CERRADO_GANADO')}
                  >
                    <img src={checkIcon || "/placeholder.svg"} alt="Marcar como ganado" />
                  </button>
                  <button
                    className={`btn-estado perdido ${trato.fase === 'CERRADO_PERDIDO' ? 'activo' : ''}`}
                    onClick={() => handleCambiarFase('CERRADO_PERDIDO')}
                  >
                    <img src={closeIcon || "/placeholder.svg"} alt="Marcar como perdido" />
                  </button>
                </div>
              </div>
            </div>

            {/* Persona de contacto */}
            {trato.contacto && (
              <div className="seccion persona-contacto">
                <div className="seccion-header">
                  <h2>Persona de contacto</h2>
                  {['ENVIO_DE_INFORMACION', 'RESPUESTA_POR_CORREO'].includes(trato.fase) && (
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={correosSeguimientoActivo}
                        onChange={handleCorreosSeguimientoChange}
                        disabled={cargandoCorreos}
                      />
                      <span>
                        {cargandoCorreos ? 'Procesando...' : 'Mandar emails de seguimiento'}
                      </span>
                    </label>
                  )}
                </div>
                <div className="contacto-info">
                  <div className="contacto-avatar">
                    <div className="avatar-circle">
                      <span>{(trato.contacto.nombre || "").charAt(0) || "C"}</span>
                    </div>
                    <span className="contacto-nombre">{trato.contacto.nombre || "Sin contacto"}</span>
                  </div>
                  <div className="contacto-detalles">
                    {/* Teléfonos */}
                    {trato.contacto.telefonos && trato.contacto.telefonos.length > 0 ? (
                      trato.contacto.telefonos.map((tel, index) => (
                        <div key={`tel-${index}`} className="contacto-item">
                          <button
                            className="btn-contacto telefono"
                            onClick={() => handleLlamarContacto(tel.telefono)}
                            title="Llamar"
                          >
                            <img src={phoneIcon || "/placeholder.svg"} alt="Teléfono" className="contacto-icon" />
                          </button>
                          <span>{tel.telefono}</span>
                        </div>
                      ))
                    ) : (
                      <div className="contacto-item">
                        <img src={phoneIcon || "/placeholder.svg"} alt="Teléfono" className="contacto-icon" />
                        <span>N/A</span>
                      </div>
                    )}

                    {trato.contacto.whatsapp && (
                      <div className="contacto-item">
                        <button
                          className="btn-contacto whatsapp"
                          onClick={() => handleWhatsAppContacto(trato.contacto.whatsapp)}
                          title="Enviar WhatsApp"
                        >
                          <img src={whatsappIcon || "/placeholder.svg"} alt="WhatsApp" className="contacto-icon" />
                        </button>
                        <span>{trato.contacto.whatsapp}</span>
                      </div>
                    )}

                    {/* Correos */}
                    {trato.contacto.correos && trato.contacto.correos.length > 0 ? (
                      trato.contacto.correos.map((correo, index) => (
                        <div key={`correo-${index}`} className="contacto-item">
                          <img src={emailIcon || "/placeholder.svg"} alt="Email" className="contacto-icon" />
                          <span>{correo.correo}</span>
                        </div>
                      ))
                    ) : (
                      <div className="contacto-item">
                        <img src={emailIcon || "/placeholder.svg"} alt="Email" className="contacto-icon" />
                        <span>N/A</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Detalles del trato */}
            <div className="seccion detalles-trato">
              <h2>Detalles del trato</h2>
              <div className="detalles-grid">
                <div className="detalle-item">
                  <label>Propietario trato</label>
                  <span>{trato.propietario}</span>
                </div>
                <div className="detalle-item">
                  <label>Número de trato</label>
                  <span>{trato.numeroTrato}</span>
                </div>
                <div className="detalle-item">
                  <label>Nombre Empresa</label>
                  <button
                    onClick={handleVerEmpresa}
                    className="empresa-link"
                    disabled={!trato.empresaId || !modulosActivos.empresas}
                    style={{
                      textDecoration: (!trato.empresaId || !modulosActivos.empresas) ? 'none' : 'underline',
                      cursor: (!trato.empresaId || !modulosActivos.empresas) ? 'default' : 'pointer',
                      color: (!trato.empresaId || !modulosActivos.empresas) ? 'inherit' : ''
                    }}
                  >
                    {trato.nombreEmpresa}
                  </button>
                </div>
                <div className="detalle-item">
                  <label>Descripción</label>
                  <span>{trato.descripcion}</span>
                </div>
                <div className="detalle-item">
                  <label>Domicilio de la empresa</label>
                  <span>{trato.domicilio}</span>
                </div>
                <div className="detalle-item">
                  <label>Ingresos esperados</label>
                  <span>{trato.ingresosEsperados}</span>
                </div>
                <div className="detalle-item">
                  <label>Sitio web</label>
                  <a href={trato.sitioWeb} target="_blank" rel="noopener noreferrer">
                    {trato.sitioWeb}
                  </a>
                </div>
                <div className="detalle-item">
                  <label>Sector</label>
                  <span>{trato.sectorNombre || trato.sector || "Sin sector"}</span>
                </div>
              </div>
            </div>

            {/* Notas */}
            <div className="seccion notas">
              <div className="seccion-header">
                <h2>Notas</h2>
              </div>
              <div className="agregar-nota">
                <textarea
                  placeholder="Agregar una nota (Alt + Enter para nueva línea, Enter para guardar)"
                  value={nuevaNota}
                  onChange={(e) => setNuevaNota(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.altKey) {
                      // Alt + Enter: insertar salto de línea
                      const textarea = e.target;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const newValue = nuevaNota.substring(0, start) + '\n' + nuevaNota.substring(end);
                      setNuevaNota(newValue);

                      // Mantener la posición del cursor después del salto de línea
                      setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = start + 1;
                      }, 0);

                      e.preventDefault();
                    } else if (e.key === "Enter" && !e.altKey) {
                      // Solo Enter: guardar nota
                      e.preventDefault();
                      handleAgregarNota();
                    }
                  }}
                  className="input-nota"
                  rows={3}
                />
              </div>
              <div className="notas-lista">
                {(() => {
                  const LIMITE_NOTAS = 5;
                  const notasAMostrar = mostrarTodasLasNotas
                    ? trato.notas
                    : trato.notas.slice(0, LIMITE_NOTAS);
                  const notasOcultas = trato.notas.length - LIMITE_NOTAS;

                  return (
                    <>
                      {notasAMostrar.map((nota) => (
                        <div key={nota.id} className="nota-item">
                          <div className="nota-avatar">
                            <span>{(nota.autor || "U").charAt(0)}</span>
                          </div>
                          <div className="nota-contenido">
                            {editingNoteId === nota.id ? (
                              <div className="edit-nota-container">
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="input-nota-edit"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.altKey) {
                                      // Alt + Enter: insertar salto de línea
                                      const textarea = e.target;
                                      const start = textarea.selectionStart;
                                      const end = textarea.selectionEnd;
                                      const newValue = editingNoteText.substring(0, start) + '\n' + editingNoteText.substring(end);
                                      setEditingNoteText(newValue);

                                      // Mantener la posición del cursor después del salto de línea
                                      setTimeout(() => {
                                        textarea.selectionStart = textarea.selectionEnd = start + 1;
                                      }, 0);

                                      e.preventDefault();
                                    } else if (e.key === "Enter" && !e.altKey) {
                                      // Solo Enter: guardar nota
                                      e.preventDefault();
                                      handleSaveEditNota(nota.id);
                                    } else if (e.key === "Escape") {
                                      handleCancelEditNota();
                                    }
                                  }}
                                  autoFocus
                                  rows={3}
                                />
                                <div className="edit-nota-actions">
                                  <button onClick={() => handleSaveEditNota(nota.id)} className="btn-save-nota">
                                    Guardar
                                  </button>
                                  <button onClick={handleCancelEditNota} className="btn-cancel-nota">
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>
                                  {(nota.texto || '')
                                    .replace(/\\n/g, '\n')
                                    .split('\n')
                                    .map((linea, index) => (
                                      <p key={index} style={{ margin: '0', lineHeight: '1.4' }}>
                                        {linea || '\u00A0'}
                                      </p>
                                    ))}
                                </div>
                                <span className="nota-fecha">Creado por {nota.autor} el {nota.fecha}</span>
                                {nota.editadoPor && (
                                  <span className="nota-editado">
                                    Editado por {nota.editadoPor} el {nota.fechaEdicion}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          {editingNoteId !== nota.id && (
                            <div className="nota-acciones">
                              <button onClick={() => handleEditarNota(nota.id)} className="btn-editar-nota">
                                <img src={editIcon || "/placeholder.svg"} alt="Editar" />
                              </button>
                              <button onClick={() => handleEliminarNota(nota.id)} className="btn-eliminar-nota">
                                <img src={deleteIcon || "/placeholder.svg"} alt="Eliminar" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Botón para mostrar/ocultar notas adicionales */}
                      {trato.notas.length > LIMITE_NOTAS && (
                        <div className="ver-mas-notas-container">
                          <button
                            onClick={() => setMostrarTodasLasNotas(!mostrarTodasLasNotas)}
                            className="btn-ver-mas-notas"
                          >
                            {mostrarTodasLasNotas
                              ? "Mostrar menos notas"
                              : `Ver todas las notas (${notasOcultas} más)`}
                          </button>
                        </div>
                      )}

                      {/* Mensaje cuando no hay notas */}
                      {trato.notas.length === 0 && (
                        <div className="no-notas">
                          <p>No hay notas agregadas aún.</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Actividades abiertas */}
            <div className="seccion actividades-abiertas">
              <div className="seccion-header">
                <h2>Actividades abiertas</h2>
                <button onClick={() => handleAgregarActividad("actividad")} className="btn-agregar">
                  <img src={addIcon || "/placeholder.svg"} alt="Agregar" />
                </button>
              </div>
              <div className="actividades-grid">
                <div className="actividad-columna">
                  <div className="columna-header">
                    <img src={taskIcon || "/placeholder.svg"} alt="Tareas" />
                    <span>Tareas abiertas</span>
                  </div>
                  <div className="actividades-lista">
                    {trato.actividadesAbiertas.tareas.length === 0 ? (
                      <p className="no-actividades">No se encontraron registros</p>
                    ) : (
                      trato.actividadesAbiertas.tareas.map((tarea) => (
                        <div key={tarea.id} className="actividad-item tarea">
                          <h4>{`Tarea con ${tarea.nombreContacto}`}</h4>
                          <div className="actividad-detalles">
                            <span>Tipo: {tarea.subtipoTarea || "Sin tipo"}</span>
                            <span>Fecha límite: {tarea.fecha || "Sin fecha"}</span>
                            <span>Notas: {tarea.notas || "Sin notas"}</span>
                            <span>Asignado a: {tarea.asignadoA || "Sin asignado"}</span>
                          </div>
                          <div className="actividad-badges">
                            <button
                              className="badge completada clickeable"
                              onClick={() => handleCompletarActividad(tarea.id, "tarea")}
                            >
                              Completar
                            </button>
                            <button
                              className="badge reprogramar clickeable"
                              onClick={() => handleReprogramarActividad(tarea.id, "tarea")}
                            >
                              Reprogramar
                            </button>
                            <button
                              className="badge eliminar clickeable"
                              onClick={() => handleEliminarActividad(tarea.id, "tarea")}
                              title="Eliminar tarea"
                            >
                              <img src={deleteIcon || "/placeholder.svg"} alt="Eliminar" />
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="actividad-columna">
                  <div className="columna-header">
                    <img src={callIcon || "/placeholder.svg"} alt="Llamadas" />
                    <span>Llamadas abiertas</span>
                  </div>
                  <div className="actividades-lista">
                    {trato.actividadesAbiertas.llamadas.length === 0 ? (
                      <p className="no-actividades">No se encontraron registros</p>
                    ) : (
                      trato.actividadesAbiertas.llamadas.map((llamada) => (
                        <div key={llamada.id} className="actividad-item llamada">
                          <h4>{`Llamada con ${llamada.nombreContacto}`}</h4>
                          <div className="actividad-detalles">
                            <span>Fecha: {llamada.fecha || "Sin fecha"}</span>
                            <span>Hora: {llamada.hora || "Sin hora"}</span>
                            <span>Asignado a: {llamada.asignadoA || "Sin asignado"}</span>
                          </div>
                          <div className="actividad-badges">
                            <button
                              className="badge completada clickeable"
                              onClick={() => handleCompletarActividad(llamada.id, "llamada")}
                            >
                              Completar
                            </button>
                            <button
                              className="badge reprogramar clickeable"
                              onClick={() => handleReprogramarActividad(llamada.id, "llamada")}
                            >
                              Reprogramar
                            </button>
                            <button
                              className="badge eliminar clickeable"
                              onClick={() => handleEliminarActividad(llamada.id, "llamada")}
                              title="Eliminar llamada"
                            >
                              <img src={deleteIcon || "/placeholder.svg"} alt="Eliminar" />
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="actividad-columna">
                  <div className="columna-header">
                    <img src={meetingIcon || "/placeholder.svg"} alt="Reuniones" />
                    <span>Reuniones abiertas</span>
                  </div>
                  <div className="actividades-lista">
                    {trato.actividadesAbiertas.reuniones.length === 0 ? (
                      <p className="no-actividades">No se encontraron registros</p>
                    ) : (
                      trato.actividadesAbiertas.reuniones.map((reunion) => (
                        <div key={reunion.id} className="actividad-item reunion">
                          <h4>{`Reunión con ${reunion.nombreContacto}`}</h4>
                          <div className="actividad-detalles">
                            <span>Fecha: {reunion.fecha || "Sin fecha"}</span>
                            <span>Hora inicio: {reunion.hora || "Sin hora"}</span>
                            <span>
                              Modalidad: {reunion.modalidad}
                              {reunion.modalidad === "PRESENCIAL" && reunion.lugarReunion && ` - Lugar: ${reunion.lugarReunion}`}
                              {reunion.modalidad === "VIRTUAL" && reunion.enlaceReunion && ` - Enlace: ${reunion.enlaceReunion}`}
                            </span>
                            <span>Asignado a: {reunion.asignadoA || "Sin asignado"}</span>
                          </div>
                          <div className="actividad-badges">
                            <button
                              className="badge completada clickeable"
                              onClick={() => handleCompletarActividad(reunion.id, "reunion")}
                            >
                              Completar
                            </button>
                            <button
                              className="badge reprogramar clickeable"
                              onClick={() => handleReprogramarActividad(reunion.id, "reunion")}
                            >
                              Reprogramar
                            </button>
                            <button
                              className="badge eliminar clickeable"
                              onClick={() => handleEliminarActividad(reunion.id, "reunion")}
                              title="Eliminar reunión"
                            >
                              <img src={deleteIcon || "/placeholder.svg"} alt="Eliminar" />
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Historial de interacciones */}
            <div className="seccion historial-interacciones">
              <div className="seccion-header">
                <h2>Historial de interacciones</h2>
                <button onClick={() => openModal('agregarInteraccion', { tratoId: trato.id })} className="btn-agregar">
                  <img src={addIcon || "/placeholder.svg"} alt="Agregar" />
                </button>
              </div>
              <div className="historial-tabla">
                <div className="tabla-header">
                  <div className="header-cell">Fecha</div>
                  <div className="header-cell">Responsable</div>
                  <div className="header-cell">Tipo</div>
                  <div className="header-cell">Medio</div>
                  <div className="header-cell">Resultado</div>
                  <div className="header-cell">Interés</div>
                  <div className="header-cell">Notas</div>
                  <div className="header-cell">Acciones</div>
                </div>
                <div className="tabla-body">
                  {trato.historialInteracciones && trato.historialInteracciones.length > 0 ? (
                    trato.historialInteracciones.map((interaccion) => {
                      // Mapeo para los íconos de Resultado
                      const resultadoIcono = {
                        POSITIVO: '✅',
                        NEGATIVO: '❌',
                        'Sin resultado': '—',
                      }[interaccion.resultado] || '—';

                      // Mapeo para los íconos de Interés
                      const interesIcono = {
                        ALTO: '🟢',
                        MEDIO: '🟡',
                        BAJO: '🔴',
                        'Sin interés': '—',
                      }[interaccion.interes] || '—';

                      return (
                        <div key={interaccion.id} className="tabla-row">
                          <div className="cell">
                            <div className="fecha-hora">
                              <span className="fecha">{interaccion.fecha}</span>
                              <span className="hora">{interaccion.hora}</span>
                            </div>
                          </div>
                          <div className="cell">{interaccion.responsable}</div>
                          <div className="cell">
                            <span className={`tipo-badge ${interaccion.tipo.toLowerCase()}`}>
                              {interaccion.tipo}
                            </span>
                          </div>
                          <div className="cell">{interaccion.medio}</div>
                          <div className="cell">
                            <span className={`resultado-badge ${interaccion.resultado ? interaccion.resultado.toLowerCase() : 'sin-resultado'}`}>
                              {resultadoIcono}
                            </span>
                          </div>
                          <div className="cell">
                            <span className={`interes-badge ${interaccion.interes}`}>
                              {interesIcono}
                            </span>
                          </div>
                          <div className="cell notas-cell">{interaccion.notas}</div>
                          <div className="cell">
                            <button
                              onClick={() => handleEditarInteraccion(interaccion)}
                              className="btn-editar-interaccion"
                              title="Editar interacción"
                            >
                              <img src={editIcon} alt="Editar" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="tabla-row">
                      <div className="cell-empty" colSpan="7">
                        <p className="no-actividades">No se encontraron registros</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sección de Cotizaciones - SOLO visible en fases específicas */}
            {showCotizacionesSection && (
              <div className="seccion cotizaciones-trato">
                <div className="seccion-header">
                  <h2>Cotizaciones</h2>
                  <button
                    onClick={() => openModal('crearCotizacion', { tratoId: trato.id, empresaId: trato.empresaId })}
                    className="btn-agregar"
                  >
                    <img src={addIcon || "/placeholder.svg"} alt="Agregar" />
                  </button>
                </div>

                <div className="cotizaciones-tabla">
                  <div className="tabla-header">
                    <div className="header-cell">Folio</div>
                    <div className="header-cell">Fecha</div>
                    <div className="header-cell">Importe</div>
                    <div className="header-cell">Estatus</div>
                    <div className="header-cell">Creada por</div>
                    <div className="header-cell">Acciones</div>
                  </div>

                  <div className="tabla-body">
                    {cotizaciones.length > 0 ? (
                      cotizaciones.map((cotizacion) => (
                        <div key={cotizacion.id} className="tabla-row">
                          <div className="cell">#{cotizacion.id}</div>
                          <div className="cell">{cotizacion.fecha}</div>
                          <div className="cell">${cotizacion.total.toFixed(2)}</div>
                          <div className="cell">
                            <span className={`estatus-badge ${cotizacion.estatus.toLowerCase()}`}>
                              {cotizacion.estatus}
                            </span>
                          </div>
                          <div className="cell">{cotizacion.usuarioCreadorNombre || 'N/A'}</div>
                          <div className="cell acciones-cell">
                            <button
                              onClick={() => handleEditarCotizacion(cotizacion)}
                              className="btn-accion-cotizacion"
                              title="Editar"
                            >
                              <img src={editIcon} alt="Editar" />
                            </button>
                            <button
                              onClick={() => handleDescargarCotizacion(cotizacion.id)}
                              className="btn-accion-cotizacion"
                              title="Descargar"
                            >
                              <img src={downloadIcon} alt="Descargar" />
                            </button>
                            <button
                              onClick={() => handleCompartirCotizacion(cotizacion)}
                              className="btn-accion-cotizacion"
                              title="Compartir"
                            >
                              <img src={send} alt="Enviar" />
                            </button>
                            {modulosActivos.cxc && (
                              <button
                                onClick={async () => {
                                  const response = await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cotizacion.id}/check-vinculada`);
                                  const { vinculada } = await response.json();

                                  if (vinculada) {
                                    Swal.fire({
                                      icon: "warning",
                                      title: "Alerta",
                                      text: "Ya se generaron las cuentas por cobrar para esta cotización",
                                    });
                                    setCotizacionesVinculadas(prev => new Set([...prev, cotizacion.id]));
                                  } else {
                                    openModal("crearCuentas", { cotizacion: cotizacion });
                                  }
                                }}
                                className={`btn-accion-cotizacion ${cotizacionesVinculadas.has(cotizacion.id)
                                  ? 'cotizaciones-receivable-btn-vinculada'
                                  : 'cotizaciones-receivable-btn-disponible'
                                  }`}
                                title={
                                  cotizacionesVinculadas.has(cotizacion.id)
                                    ? "Cuentas por cobrar ya generadas"
                                    : "Generar Cuenta por Cobrar"
                                }
                              >
                                <img
                                  src={receivableIcon}
                                  alt="Cuenta"
                                  className="cotizaciones-action-icon"
                                />
                              </button>
                            )}
                            <button
                              onClick={() => handleEliminarCotizacion(cotizacion.id)}
                              className="btn-accion-cotizacion"
                              title="Eliminar"
                            >
                              <img src={deleteIcon} alt="Eliminar" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="tabla-row">
                        <div className="cell-empty">
                          <p className="no-actividades">No hay cotizaciones registradas</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Correos electrónicos */}
            <div className="seccion correos-electronicos">
              <div className="seccion-header">
                <h2>Correos electrónicos</h2>
                <button onClick={() => handleAgregarCorreo()} className="btn-agregar">
                  <img src={addIcon || "/placeholder.svg"} alt="Agregar" />
                </button>
              </div>
              <div className="correos-contenido">
                {emailRecords.length > 0 ? (
                  emailRecords.map((email) => (
                    <div key={email.id} className="email-item">
                      <div className="email-header">
                        <div className="email-destinatario">
                          {email.destinatario.includes(',')
                            ? `${email.destinatario.split(',').length} destinatarios: ${email.destinatario}`
                            : email.destinatario
                          }
                        </div>
                        <div className="email-fecha">
                          {new Date(email.fechaEnvio).toLocaleString()}
                        </div>
                      </div>

                      <div className="email-asunto">
                        <span className="email-asunto-label">Asunto</span>
                        <div className="email-asunto-texto">{email.asunto}</div>
                      </div>

                      <div className="email-cuerpo">
                        <span className="email-cuerpo-label">Mensaje</span>
                        <div
                          className="email-cuerpo-texto"
                          dangerouslySetInnerHTML={{ __html: email.cuerpo }}
                        />
                      </div>

                      {email.archivosAdjuntos && (
                        <div className="email-adjuntos">
                          <span className="email-adjuntos-label">Archivos adjuntos</span>
                          <div className="email-adjuntos-lista">
                            {email.archivosAdjuntos.split(",").join(", ")}
                          </div>
                        </div>
                      )}

                      <div className="email-footer">
                        <div className="email-destinatarios-estados">
                          {email.estadosDestinatarios && email.estadosDestinatarios.length > 0 ? (
                            email.estadosDestinatarios.map((estado, index) => {
                              let statusColor = '#666';
                              let statusText = 'Enviado';

                              if (estado.status === 'delivered') {
                                statusColor = '#10B981';
                                statusText = 'Entregado';
                              } else if (estado.status === 'bounced') {
                                statusColor = '#EF4444';
                                statusText = 'Rebotado';
                              } else if (estado.status === 'sent') {
                                statusColor = '#3B82F6';
                                statusText = 'Enviado';
                              }

                              return (
                                <div
                                  key={index}
                                  className="email-status-individual"
                                  style={{
                                    color: statusColor,
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    backgroundColor: `${statusColor}15`,
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    marginRight: '5px'
                                  }}
                                >
                                  <span>{estado.email}</span>
                                  <span>•</span>
                                  <span>{statusText}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="email-status">Estado desconocido</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-actividades">No se encontraron registros</p>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Modales */}
        <EditarTratoModal
          isOpen={modals.editarTrato.isOpen}
          onClose={() => closeModal("editarTrato")}
          onSave={handleSaveEditarTrato}
          trato={trato}
          users={users}
          companies={companies}
        />

        <SeleccionarActividadModal
          isOpen={modals.seleccionarActividad.isOpen}
          onClose={() => closeModal("seleccionarActividad")}
          onSelectActivity={handleSelectActivity}
        />

        <SeleccionarActividadModal
          isOpen={modals.crearNuevaActividad.isOpen}
          onClose={() => closeModal("crearNuevaActividad")}
          onSelectActivity={handleSelectActivity}
        />

        <ProgramarLlamadaModal
          isOpen={modals.programarLlamada.isOpen}
          loading={modals.programarLlamada.loading}
          onClose={() => closeModal("programarLlamada")}
          onSave={(data) => handleSaveActividad(data, "llamada")}
          tratoId={modals.programarLlamada.tratoId}
          users={users}
          creatorId={modals.programarLlamada.creatorId}
        />

        <ProgramarReunionModal
          isOpen={modals.programarReunion.isOpen}
          loading={modals.programarReunion.loading}
          onClose={() => closeModal("programarReunion")}
          onSave={(data) => handleSaveActividad(data, "reunion")}
          tratoId={modals.programarReunion.tratoId}
          users={users}
          creatorId={modals.programarReunion.creatorId}
          initialModalidad={modals.programarReunion.modalidad}
        />

        <ProgramarTareaModal
          isOpen={modals.programarTarea.isOpen}
          loading={modals.programarTarea.loading}
          onClose={() => closeModal("programarTarea")}
          onSave={(data) => handleSaveActividad(data, "tarea")}
          tratoId={modals.programarTarea.tratoId}
          users={users}
          creatorId={modals.programarTarea.creatorId}
          initialTipo={modals.programarTarea.tipo}
        />

        <ReprogramarLlamadaModal
          isOpen={modals.reprogramarLlamada.isOpen}
          onClose={() => closeModal("reprogramarLlamada")}
          onSave={(data) => handleSaveReprogramar(data, "llamada", modals.reprogramarLlamada.contactos || [])}
          actividad={modals.reprogramarLlamada.actividad}
        />

        <ReprogramarReunionModal
          isOpen={modals.reprogramarReunion.isOpen}
          onClose={() => closeModal("reprogramarReunion")}
          onSave={(data) => handleSaveReprogramar(data, "reunion", modals.reprogramarReunion.contactos || [])}
          actividad={modals.reprogramarReunion.actividad}
        />

        <ReprogramarTareaModal
          isOpen={modals.reprogramarTarea.isOpen}
          onClose={() => closeModal("reprogramarTarea")}
          onSave={(data) => handleSaveReprogramar(data, "tarea", modals.reprogramarTarea.contactos || [])}
          actividad={modals.reprogramarTarea.actividad}
        />

        <CompletarActividadModal
          isOpen={modals.completarActividad.isOpen}
          loading={modals.completarActividad.loading}
          onClose={() => closeModal("completarActividad")}
          onSave={(data, tipo) => handleSaveCompletarActividad(data, tipo)}
          actividad={modals.completarActividad.actividad}
          tratoId={params.id}
          contactos={modals.completarActividad.contactos || []}
          openModal={openModal}
          esEdicion={modals.completarActividad.esEdicion}
          onNextAction={(siguienteAccion) => {
            handleSiguienteAccionAutomatica(siguienteAccion, params.id);
          }}
        />

        <AgregarInteraccionModal
          {...modals.agregarInteraccion.props}
          isOpen={modals.agregarInteraccion.isOpen}
          onClose={() => closeModal('agregarInteraccion')}
          onSave={handleSaveAgregarInteraccion}
          tratoId={params.id}
          onCreateActivity={(siguienteAccion) => {
            closeModal('agregarInteraccion');
            handleSiguienteAccionAutomatica(siguienteAccion, params.id);
          }}
        />

        <CrearCorreoModal
          isOpen={modals.crearCorreo.isOpen}
          onClose={() => closeModal("crearCorreo")}
          onSave={() => {
            const loadEmails = async () => {
              const emailResponse = await fetchWithToken(`${API_BASE_URL}/correos/trato/${params.id}`);
              const emailData = await emailResponse.json();

              const correosOrdenados = Array.isArray(emailData)
                ? emailData.sort((a, b) => new Date(b.fechaEnvio) - new Date(a.fechaEnvio))
                : [];

              setEmailRecords(correosOrdenados);
            };
            loadEmails();
          }}
          tratoId={params.id}
          openModal={openModal}
          closeModal={closeModal}
          archivoPrecargado={modals.crearCorreo.archivoPrecargado}
          asuntoPrecargado={modals.crearCorreo.asuntoPrecargado}
        />

        <SeleccionarPlantillaModal
          isOpen={modals.seleccionarPlantilla.isOpen}
          onClose={() => closeModal("seleccionarPlantilla")}
          onSelectTemplate={modals.seleccionarPlantilla.onSelectTemplate}
          plantillas={modals.seleccionarPlantilla.plantillas || []}
        />
        {(modals.crearCotizacion?.isOpen || modals.editarCotizacion?.isOpen) && (
          <CotizacionModal
            isOpen={modals.crearCotizacion?.isOpen || modals.editarCotizacion?.isOpen}
            onClose={() => {
              if (modals.crearCotizacion?.isOpen) closeModal("crearCotizacion");
              if (modals.editarCotizacion?.isOpen) closeModal("editarCotizacion");
            }}
            onSave={handleSaveCotizacion}
            cotizacion={
              modals.editarCotizacion?.isOpen
                ? modals.editarCotizacion.cotizacion
                : {
                  clienteNombre: trato.nombreEmpresa,
                  empresaData: { id: trato.empresaId, nombre: trato.nombreEmpresa, ...trato.empresaData },
                  tratoId: parseInt(params.id),
                  unidades: []
                }
            }
            clientes={companies}
            modals={modals}
            setModals={setModals}
            users={users}
          />
        )}
        {modals.crearCuentas?.isOpen && (
          <CrearCuentasModal
            isOpen={modals.crearCuentas?.isOpen}
            onClose={() => closeModal("crearCuentas")}
            cotizacion={modals.crearCuentas?.cotizacion}
            onSave={(savedCuentas) => {
              setCotizacionesVinculadas(prev => new Set([...prev, modals.crearCuentas?.cotizacion?.id]));

              Swal.fire({
                icon: "success",
                title: "Éxito",
                text: "Cuenta/s por cobrar creada correctamente",
              });
              closeModal("crearCuentas");
            }}
          />
        )}
        <SubirArchivoModal
          isOpen={modals.subirArchivo.isOpen}
          onClose={() => closeModal("subirArchivo")}
          onDownload={executeDownload}
          cotizacion={modals.subirArchivo.cotizacion}
        />
        <CompartirCotizacionModal
          isOpen={modals.compartirCotizacion.isOpen}
          onClose={() => closeModal("compartirCotizacion")}
          onCompartir={(incluirArchivos) => {
            const cotizacion = modals.compartirCotizacion.cotizacion;
            closeModal("compartirCotizacion");
            handleOpcionCompartir(incluirArchivos, cotizacion);
          }}
          cotizacion={modals.compartirCotizacion.cotizacion}
        />
        <PdfPreviewModal
          isOpen={pdfPreview.isOpen}
          onClose={handleClosePreview}
          pdfUrl={pdfPreview.url}
          onDownload={handleDownloadFromPreview}
        />
        <SeleccionarProcesoModal
          isOpen={showSeleccionarProceso}
          onClose={() => { setShowSeleccionarProceso(false); setCorreosSeguimientoActivo(false); }}
          onConfirm={(procesoId) => {
            setShowSeleccionarProceso(false);
            toggleCorreosSeguimiento(trato.id, true, procesoId);
          }}
        />
      </div>
    </>
  )
}

export { CompletarActividadModal };
export { SeleccionarActividadModal };
export { ProgramarLlamadaModal };
export { ProgramarReunionModal };
export { ProgramarTareaModal };
export default DetallesTrato