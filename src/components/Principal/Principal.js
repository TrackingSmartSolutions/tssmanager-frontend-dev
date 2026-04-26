import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement } from "chart.js";
import "./Principal.css";
import Header from "../Header/Header";
import welcomeIcon from "../../assets/icons/empresa.png";
import phoneIcon from "../../assets/icons/llamada.png";
import meetingIcon from "../../assets/icons/reunion.png";
import emailIcon from "../../assets/icons/correo.png";
import deploy from "../../assets/icons/desplegar.png";
import { API_BASE_URL } from "../Config/Config";
import { CompletarActividadModal, ProgramarLlamadaModal, ProgramarReunionModal, ProgramarTareaModal, SeleccionarActividadModal } from '../Tratos/DetallesTrato';
import Swal from "sweetalert2";

// Registra componentes de Chart.js
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`Error: ${response.status} - ${response.statusText}`);
  return response;
};

// Modal Base Component para Principal
const PrincipalModal = ({ isOpen, onClose, title, children, size = "md", canClose = true, closeOnOverlayClick = true }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "modal-sm",
    md: "modal-md",
    lg: "modal-lg",
    xl: "modal-xl",
  };

  return (
    <div className="detalles-trato-modal-overlay" onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div className={`modal-content ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {canClose && (
            <button className="modal-close" onClick={onClose}>✕</button>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

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
  };

  const validateForm = () => {
    const newErrors = {};
    const currentDate = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (!formData.nuevaFecha.trim()) newErrors.nuevaFecha = "Este campo es obligatorio";
    else if (formData.nuevaFecha < currentDate) newErrors.nuevaFecha = "La fecha no puede ser en el pasado";
    else if (formData.nuevaFecha === currentDate && formData.nuevaHora && formData.nuevaHora < currentTime)
      newErrors.nuevaHora = "La hora no puede ser en el pasado";
    if (!formData.nuevaHora.trim()) newErrors.nuevaHora = "Este campo es obligatorio";
    if (!formData.asignadoAId) newErrors.asignadoAId = "Este campo es obligatorio";
    if (!formData.nombreContactoId) newErrors.nombreContactoId = "Este campo es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    <PrincipalModal isOpen={isOpen} onClose={onClose} title="Reprogramar llamada" size="md" closeOnOverlayClick={false}>
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
            min={new Date().toLocaleDateString('en-CA')}
          />
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
            min={formData.nuevaFecha === new Date().toISOString().split('T')[0] ? (() => {
              const now = new Date();
              return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            })() : undefined}
          />
          {errors.nuevaHora && <span className="error-message">{errors.nuevaHora}</span>}
        </div>
        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button type="submit" className="btn btn-primary">Confirmar cambios</button>
        </div>
      </form>
    </PrincipalModal>
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

          const [hours, minutes, seconds] = actividad.duracion ? actividad.duracion.split(":") : ["", "", ""];
          const initialEnlace = actividad.medio ? generateMeetingLink(actividad.medio) : "";
          const initialLugarReunion = actividad.modalidad === "PRESENCIAL" && empresa?.domicilioFisico ? empresa.domicilioFisico : "";

          setFormData({
            asignadoAId: actividad.asignadoAId || "",
            nombreContactoId: actividad.contactoId || "",
            nuevaFecha: actividad.fechaLimite ? actividad.fechaLimite.split("T")[0] : "",
            nuevaHoraInicio: actividad.horaInicio ? actividad.horaInicio.split(":")[0] + ":" + actividad.horaInicio.split(":")[1] : "",
            duracionHoras: hours || "",
            duracionMinutos: minutes || "",
            duracionSegundos: seconds || "",
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
    else if (formData.nuevaFecha === currentDate && formData.nuevaHoraInicio && formData.nuevaHoraInicio < currentTime)
      newErrors.nuevaHoraInicio = "La hora no puede ser en el pasado";
    if (!formData.nuevaHoraInicio.trim()) newErrors.nuevaHoraInicio = "Este campo es obligatorio";
    if (!formData.duracion) newErrors.duracion = "Este campo es obligatorio";
    if (!formData.modalidad.trim()) newErrors.modalidad = "Este campo es obligatorio";
    if (formData.modalidad === "PRESENCIAL" && !formData.lugarReunion.trim())
      newErrors.lugarReunion = "Lugar es obligatorio para reuniones presenciales";
    if (formData.modalidad === "VIRTUAL" && !formData.medio.trim())
      newErrors.medio = "Medio es obligatorio para reuniones virtuales";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

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
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/${actividad.tratoId}/actividades/${actividad.id}`, {
        method: "PUT",
        body: JSON.stringify(actividadDTO),
      });
      const updatedActividad = await response.json();

      setActividadActualizada(updatedActividad);
      setMostrarConfirmacion(true);

    } catch (error) {
      console.error("Error al reprogramar la reunión:", error);
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PrincipalModal isOpen={isOpen} onClose={onClose} title="Reprogramar reunión" size="md" closeOnOverlayClick={false}>
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
            min={new Date().toLocaleDateString('en-CA')}
          />
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
              min={formData.nuevaFecha === new Date().toISOString().split('T')[0] ? (() => {
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
          // Mostrar Sweet Alert aquí
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
    </PrincipalModal>
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
    <PrincipalModal isOpen={isOpen} onClose={onClose} title="Reprogramar tarea" size="md" closeOnOverlayClick={false}>
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
            min={new Date().toLocaleDateString('en-CA')}
          />
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
    </PrincipalModal>
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
      <PrincipalModal
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
      </PrincipalModal>
    );
  }

  return (
    <PrincipalModal
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
    </PrincipalModal>
  );
};

const Principal = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "Usuario";
  const userRol = localStorage.getItem("userRol") || "EMPLEADO";
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { crm: true, tratos: true, empresas: true, metricas: true };
  const [selectedUser, setSelectedUser] = useState("Todos");
  const [isLoadingTratos, setIsLoadingTratos] = useState(true);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(true);

  const [usuarios, setUsuarios] = useState([]);
  const [tratosPorFase, setTratosPorFase] = useState([]);
  const [empresasPorUsuario, setEmpresasPorUsuario] = useState({
    labels: [],
    datasets: [
      {
        label: "Empresas creadas",
        data: [],
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)",
          "rgba(139, 92, 246, 0.8)",
          "rgba(6, 182, 212, 0.8)",
          "rgba(16, 185, 129, 0.8)",
        ],
        borderColor: ["rgb(99, 102, 241)", "rgb(139, 92, 246)", "rgb(6, 182, 212)", "rgb(16, 185, 129)"],
        borderWidth: 2,
        hoverBackgroundColor: [
          "rgba(99, 102, 241, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(6, 182, 212, 1)",
          "rgba(16, 185, 129, 1)",
        ],
        hoverBorderWidth: 3,
      },
    ],
  });

  const [tareasPendientes, setTareasPendientes] = useState([]);
  const [contactos, setContactos] = useState({});


  const faseMapping = {
    'CLASIFICACION': 'Clasificación',
    'PRIMER_CONTACTO': 'Primer Contacto',
    'ENVIO_DE_INFORMACION': 'Envío de Información',
    'REUNION': 'Reunión',
    'COTIZACION_PROPUESTA_PRACTICA': 'Cotización Propuesta/Precio',
    'NEGOCIACION_REVISION': 'Negociación/revisión',
    'CERRADO_GANADO': 'Cerrado Ganado',
    'RESPUESTA_POR_CORREO': 'Respuesta por Correo',
    'INTERES_FUTURO': 'Interés Futuro',
    'CERRADO_PERDIDO': 'Cerrado Perdido',
  };

  const normalizarTratosPorFase = (datosBackend) => {
    return datosBackend.map(item => ({
      ...item,
      fase: faseMapping[item.fase] || item.fase
    }));
  };

  // Función auxiliar para obtener el ID del usuario por nombre
  const obtenerIdUsuarioPorNombre = async (nombreUsuario) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
      const usuarios = await response.json();
      const usuario = usuarios.find(u => u.nombre === nombreUsuario);
      return usuario ? usuario.id : null;
    } catch (error) {
      console.error("Error obteniendo usuario:", error);
      return null;
    }
  };

  const fetchTratosPorFase = async () => {
    try {
      setIsLoadingTratos(true);
      let url = `${API_BASE_URL}/tratos/contar-por-fase`;

      // Solo para empleados, filtrar por su propio ID
      if (userRol === "EMPLEADO") {
        const userId = localStorage.getItem("userId");
        if (userId) {
          url += `?propietarioId=${userId}`;
        }
      } else {
        // Para administradores, permitir filtro por usuario
        if (selectedUser !== "Todos") {
          const usuarioSeleccionado = await obtenerIdUsuarioPorNombre(selectedUser);
          if (usuarioSeleccionado) {
            url += `?propietarioId=${usuarioSeleccionado}`;
          }
        }
      }

      const response = await fetchWithToken(url);
      const data = await response.json();

      const datosNormalizados = normalizarTratosPorFase(data);

      setTratosPorFase(datosNormalizados);
    } catch (error) {
      console.error("Error fetching tratos por fase:", error);
    }
    finally {
      setIsLoadingTratos(false);
    }
  };

  const fetchTareasPendientes = async () => {
    try {
      const userId = localStorage.getItem("userId");
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/actividades/pendientes?asignadoAId=${userId}&timezone=${timezone}`
      );
      const data = await response.json();

      const datosOrdenados = data.sort((a, b) => {
        if (!a.horaInicio && !b.horaInicio) return 0;
        if (!a.horaInicio) return 1;
        if (!b.horaInicio) return -1;
        return a.horaInicio.toString().substring(0, 5).localeCompare(
          b.horaInicio.toString().substring(0, 5)
        );
      });

      setTareasPendientes(datosOrdenados);
    } catch (error) {
      console.error("Error fetching tareas pendientes:", error);
    }
  };

  const openModal = async (modalType, data = {}) => {
    const tratoId = data.tratoId;

    setModals((prev) => ({
      ...prev,
      [modalType]: { isOpen: true, loading: true, tratoId, ...data },
    }));

    if (
      [
        'programarLlamada',
        'programarReunion',
        'programarTarea',
      ].includes(modalType) && tratoId
    ) {
      try {
        const tratoResponse = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}`);
        const trato = await tratoResponse.json();

        let contactos = [];
        if (trato.empresaId) {
          const contactosResponse = await fetchWithToken(
            `${API_BASE_URL}/empresas/${trato.empresaId}/contactos`
          );
          const contactosData = await contactosResponse.json();
          contactos = contactosData || [];
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
        console.error('Error fetching contactos for modal:', error);

        setModals((prev) => ({
          ...prev,
          [modalType]: {
            ...prev[modalType],
            contactos: [],
            loading: false
          },
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
    setModals((prev) => ({ ...prev, [modalType]: { isOpen: false } }));
  };

  const handleSelectActivity = (tipo) => {
    const modalMap = {
      llamada: "programarLlamada",
      reunion: "programarReunion",
      tarea: "programarTarea",
    };

    const tratoId = modals.seleccionarActividad.tratoId;

    closeModal('seleccionarActividad');
    openModal(modalMap[tipo], { tratoId });
  };

  const handleSaveReprogramar = (data, tipo) => {
    setTareasPendientes((prev) =>
      prev.map((task) =>
        task.id === data.id ? { ...task, ...data } : task
      )
    );
    fetchTareasPendientes();
  };

  const handleSaveCompletarActividad = async (updatedActividad, tipo) => {
    try {
      window.dispatchEvent(new CustomEvent('actividadCompletada', {
        detail: { id: updatedActividad.id }
      }));
      setTareasPendientes((prev) =>
        prev.filter((task) => task.id !== updatedActividad.id)
      );

      await fetchTareasPendientes();

    } catch (error) {
      console.error('Error al actualizar tareas:', error);
    }
  };

  const handleSiguienteAccionAutomatica = (siguienteAccion, tratoId) => {
    closeModal('completarActividad');
    openModal('seleccionarActividad', { tratoId });
  }

  const handleSaveNewActividad = async (data, tipo) => {
    const modalType = `programar${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;
    closeModal(modalType);

    Swal.fire({
      title: `¡${tipo.charAt(0).toUpperCase() + tipo.slice(1)} programada!`,
      text: `La ${tipo} se ha programado exitosamente`,
      icon: "success",
      timer: 2000,
      showConfirmButton: false
    });

    await fetchTareasPendientes();
  };

  const handleEmpresaClick = (tratoId) => {
    navigate(`/detallestrato/${tratoId}`);
  };

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        setIsLoadingUsuarios(true);
        const response = await fetchWithToken(`${API_BASE_URL}/auth/users/active`);
        const data = await response.json();
        setUsuarios(["Todos", ...data.map((u) => u.nombre)]);
      } catch (error) {
        console.error("Error fetching usuarios:", error);
      } finally {
        setIsLoadingUsuarios(false);
      }
    };

    const fetchEmpresas = async () => {
      try {
        const url = `${API_BASE_URL}/empresas/contar-por-propietario`;
        const response = await fetchWithToken(url);
        const data = await response.json();
        setEmpresasPorUsuario((prev) => ({
          ...prev,
          labels: data.map((e) => e.propietarioNombre),
          datasets: [{ ...prev.datasets[0], data: data.map((e) => e.numeroUnidades) }],
        }));
      } catch (error) {
        console.error("Error fetching empresas:", error);
      }
    };

    const loadInitialData = async () => {
      const promesas = [fetchUsuarios()];

      if (modulosActivos.tratos) {
        promesas.push(fetchTratosPorFase());
        promesas.push(fetchTareasPendientes());
      }

      if (modulosActivos.empresas) {
        promesas.push(fetchEmpresas());
      }

      await Promise.all(promesas);
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!isLoadingUsuarios) {
      fetchTratosPorFase();
    }
  }, [selectedUser]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
    }
  }, [navigate]);

  const etapas = [
    "Clasificación",
    "Primer Contacto",
    "Envío de Información",
    "Reunión",
    "Cotización Propuesta/Precio",
    "Negociación/revisión",
    "Cerrado Ganado",
    "Respuesta por Correo",
    "Interés Futuro",
    "Cerrado Perdido",
  ];

  const colores = [
    "#e180f4",
    "#c680f4",
    "#ab80f4",
    "#9280f4",
    "#8098f4",
    "#80c0f4",
    "#69ed95",
    "#efd47b",
    "#ffbc79",
    "#fa8585",
  ];

  const data = {
    labels: etapas,
    datasets: [
      {
        label: "Cantidad de prospectos por etapa",
        data: etapas.map((etapa) =>
          tratosPorFase.find((t) => t.fase === etapa)?.count || 0
        ),
        backgroundColor: colores.map((color) => color + "CC"),
        borderColor: colores,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: colores,
        hoverBorderWidth: 3,
      },
    ],
  };

  const [modals, setModals] = useState({
    reprogramarLlamada: { isOpen: false, actividad: null },
    reprogramarReunion: { isOpen: false, actividad: null },
    reprogramarTarea: { isOpen: false, actividad: null },
    completarActividad: {
      isOpen: false,
      actividad: null,
      loading: false,
      esEdicion: false,
      contactos: []
    },
    seleccionarActividad: { isOpen: false },
    programarLlamada: { isOpen: false, loading: false },
    programarReunion: { isOpen: false, loading: false },
    programarTarea: { isOpen: false, loading: false },
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: "easeInOutQuart" },
    scales: {
      y: {
        beginAtZero: true,
        max: Math.max(...(tratosPorFase.map(t => t.count) || [0])) + 5,
        grid: { color: "rgba(0, 0, 0, 0.05)", lineWidth: 1 },
        ticks: {
          precision: 0,
          font: { size: 11, weight: "500", family: "'Inter', sans-serif" },
          stepSize: Math.max(1, Math.ceil((Math.max(...(tratosPorFase.map(t => t.count) || [0])) + 5) / 10)),
          color: "#64748b",
        },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: false,
          maxRotation: 90,
          minRotation: 90,
          font: { size: 9, weight: "500", family: "'Inter', sans-serif" },
          color: "#475569",
          padding: 4,
          callback: function (value, index, values) {
            const label = this.getLabelForValue(index);
            if (window.innerWidth <= 768) {
              if (label.length > 10) {
                const words = label.split(" ");
                if (words.length > 1) {
                  return words;
                }
              }
            }
            return label;
          },
        },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "#ffffff",
        bodyColor: "#e2e8f0",
        titleFont: { size: 13, weight: "600" },
        bodyFont: { size: 12, weight: "400" },
        padding: 12,
        displayColors: false,
        cornerRadius: 8,
        caretPadding: 8,
        borderColor: "rgba(148, 163, 184, 0.2)",
        borderWidth: 1,
      },
    },
    layout: { padding: { top: 10, bottom: 10, left: 5, right: 5 } },
  };

  const usuariosOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: "easeInOutQuart" },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          font: { size: 11, weight: "500", family: "'Inter', sans-serif" },
          boxWidth: 12,
          boxHeight: 12,
          padding: 15,
          color: "#475569",
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "#ffffff",
        bodyColor: "#e2e8f0",
        titleFont: { size: 13, weight: "600" },
        bodyFont: { size: 12, weight: "400" },
        padding: 12,
        cornerRadius: 8,
        caretPadding: 8,
        borderColor: "rgba(148, 163, 184, 0.2)",
        borderWidth: 1,
      },
    },
    cutout: "60%",
    elements: { arc: { borderWidth: 0 } },
  };

  const abrirModalCompletar = async (task) => {
    // Abrir el modal de inmediato con lo que tenemos
    setModals((prev) => ({
      ...prev,
      completarActividad: {
        isOpen: true,
        loading: true,
        actividad: task,
        tratoId: task.tratoId,
      },
    }));

    try {
      // Obtener los datos completos de la actividad desde el backend
      const response = await fetchWithToken(
        `${API_BASE_URL}/tratos/${task.tratoId}/actividades/${task.id}`
      );
      const actividadCompleta = await response.json();

      setModals((prev) => ({
        ...prev,
        completarActividad: {
          ...prev.completarActividad,
          loading: false,
          actividad: {
            ...task,
            ...actividadCompleta, // sobreescribe con datos completos, incluyendo notas
          },
        },
      }));
    } catch (error) {
      console.error("Error al cargar actividad completa:", error);
      // Si falla, igual abrimos con lo que tenemos
      setModals((prev) => ({
        ...prev,
        completarActividad: {
          ...prev.completarActividad,
          loading: false,
        },
      }));
    }
  };


  return (
    <>
      <div className="page-with-header">
        <Header />
        <main className="main-content page-with-header">
          <h1 className="welcome-message">
            Bienvenido/a {userName}!
            <img src={welcomeIcon || "/placeholder.svg"} alt="Icono de Bienvenida" className="welcome-icon" />
          </h1>

          <div className="dashboard-container">
            {modulosActivos.tratos && (
              <section className="tasks-panel">
                <h2>Mis tareas pendientes del día de hoy</h2>
                <div className="task-list">
                  {tareasPendientes.length > 0 ? (
                    tareasPendientes.map((task) => (
                      <div key={task.id} className="task-item">
                        <div className="task-info">
                          <div className="task-header">
                            {task.empresaNombre && (
                              <div
                                className="task-empresa clickable"
                                onClick={() => handleEmpresaClick(task.tratoId)}
                                style={{ cursor: 'pointer' }}
                              >
                                {task.empresaNombre}
                              </div>
                            )}
                            <h3>
                              {task.tipo === "LLAMADA" && <img src={phoneIcon || "/placeholder.svg"} alt="Icono de Teléfono" className="task-icon" />}
                              {task.tipo === "REUNION" && <img src={meetingIcon || "/placeholder.svg"} alt="Icono de Reunión" className="task-icon" />}
                              {task.tipo === "TAREA" && <img src={emailIcon || "/placeholder.svg"} alt="Icono de Correo" className="task-icon" />}
                              {task.contactoNombre ?
                                `${task.contactoNombre} - ${task.tipo}${task.subtipoTarea ? ` - ${task.subtipoTarea}` : ""}`
                                : task.tipo
                              }
                            </h3>
                          </div>
                          <div className="task-time">
                            {task.horaInicio ? task.horaInicio.toString() : "Sin hora"}
                          </div>
                        </div>
                        <div className="task-actions">
                          <button
                            className="btn btn-primary"
                            onClick={() => abrirModalCompletar(task)}
                          >
                            Completar
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              const modalType = task.tipo === "LLAMADA" ? "reprogramarLlamada" :
                                task.tipo === "REUNION" ? "reprogramarReunion" :
                                  "reprogramarTarea";
                              openModal(modalType, { actividad: task });
                            }}
                          >
                            Reprogramar
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No hay tareas pendientes para hoy.</p>
                  )}
                </div>
              </section>
            )}

            {(modulosActivos.tratos || modulosActivos.empresas) && (
              <section className="stats-panel">
                <div className="stats-header">
                  <h2>Estadísticas</h2>
                  {userRol !== "EMPLEADO" && (
                    <div className="user-filter">
                      <label htmlFor="userSelect">Filtrar por usuario:</label>
                      <div className="modal-select-wrapper">
                        <select
                          id="userSelect"
                          value={selectedUser}
                          onChange={(e) => setSelectedUser(e.target.value)}
                          className="modal-form-control"
                        >
                          {usuarios.map((usuario) => (
                            <option key={usuario} value={usuario}>
                              {usuario}
                            </option>
                          ))}
                        </select>
                        <img src={deploy || "/placeholder.svg"} alt="Desplegar" className="deploy-icon" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="charts-grid">
                  {modulosActivos.tratos && (
                    <div className="chart-section">
                      <h3>Prospectos por Etapa</h3>
                      <div className="chart-container">
                        {isLoadingTratos ? (
                          <div className="loading-spinner">
                            <div className="spinner"></div>
                            <p>Cargando datos...</p>
                          </div>
                        ) : (
                          <Bar data={data} options={options} id="prospectsChart" />
                        )}
                      </div>
                    </div>
                  )}

                  {userRol !== "EMPLEADO" && modulosActivos.empresas && (
                    <div className="chart-section">
                      <h3>Empresas Creadas por Usuario</h3>
                      <div className="chart-container">
                        {isLoadingUsuarios ? (
                          <div className="loading-spinner">
                            <div className="spinner"></div>
                            <p>Cargando datos...</p>
                          </div>
                        ) : (
                          <Doughnut data={empresasPorUsuario} options={usuariosOptions} id="usersChart" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </main>

        <ReprogramarLlamadaModal
          isOpen={modals.reprogramarLlamada.isOpen}
          onClose={() => closeModal("reprogramarLlamada")}
          onSave={(data) => handleSaveReprogramar(data, "llamada")}
          actividad={modals.reprogramarLlamada.actividad}
        />

        <ReprogramarReunionModal
          isOpen={modals.reprogramarReunion.isOpen}
          onClose={() => closeModal("reprogramarReunion")}
          onSave={(data) => handleSaveReprogramar(data, "reunion")}
          actividad={modals.reprogramarReunion.actividad}
        />

        <ReprogramarTareaModal
          isOpen={modals.reprogramarTarea.isOpen}
          onClose={() => closeModal("reprogramarTarea")}
          onSave={(data) => handleSaveReprogramar(data, "tarea")}
          actividad={modals.reprogramarTarea.actividad}
        />

        <CompletarActividadModal
          isOpen={modals.completarActividad.isOpen}
          loading={modals.completarActividad.loading}
          onClose={() => closeModal("completarActividad")}
          onSave={(data, tipo) => handleSaveCompletarActividad(data, tipo)}
          actividad={modals.completarActividad.actividad}
          tratoId={modals.completarActividad.actividad?.tratoId}
          openModal={openModal}
          esEdicion={false}
          onNextAction={(siguienteAccion) =>
            handleSiguienteAccionAutomatica(siguienteAccion, modals.completarActividad.actividad?.tratoId)
          }
        />

        <SeleccionarActividadModal
          isOpen={modals.seleccionarActividad.isOpen}
          onClose={() => closeModal("seleccionarActividad")}
          onSelectActivity={handleSelectActivity}
        />

        <ProgramarLlamadaModal
          isOpen={modals.programarLlamada.isOpen}
          loading={modals.programarLlamada.loading}
          onClose={() => closeModal("programarLlamada")}
          onSave={(data) => handleSaveNewActividad(data, "llamada")}
          tratoId={modals.programarLlamada.tratoId}
          users={[]}
          creatorId={localStorage.getItem('userId')}
          contactos={modals.programarLlamada.contactos || []}
        />
        <ProgramarReunionModal
          isOpen={modals.programarReunion.isOpen}
          loading={modals.programarReunion.loading}
          onClose={() => closeModal("programarReunion")}
          onSave={(data) => handleSaveNewActividad(data, "reunion")}
          tratoId={modals.programarReunion.tratoId}
          users={[]}
          creatorId={localStorage.getItem('userId')}
          initialModalidad={modals.programarReunion.modalidad}
          contactos={modals.programarReunion.contactos || []}
        />

        <ProgramarTareaModal
          isOpen={modals.programarTarea.isOpen}
          loading={modals.programarTarea.loading}
          onClose={() => closeModal("programarTarea")}
          onSave={(data) => handleSaveNewActividad(data, "tarea")}
          tratoId={modals.programarTarea.tratoId}
          users={[]}
          creatorId={localStorage.getItem('userId')}
          initialTipo={modals.programarTarea.tipo}
          contactos={modals.programarTarea.contactos || []}
        />
      </div>
    </>
  );
};

export default Principal