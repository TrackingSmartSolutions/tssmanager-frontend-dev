import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import "./Admin_CuentasPagar.css"
import Header from "../Header/Header"
import Swal from "sweetalert2"
import deleteIcon from "../../assets/icons/eliminar.png"
import editIcon from "../../assets/icons/editar.png"
import checkIcon from "../../assets/icons/check.png"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { API_BASE_URL } from "../Config/Config";

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token")
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const response = await fetch(url, { ...options, headers })
  if (!response.ok) throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`)
  return response
}

// Componente Modal Base
const Modal = ({ isOpen, onClose, title, children, size = "md", canClose = true, closeOnOverlayClick = true }) => {
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

  const sizeClasses = {
    sm: "cuentaspagar-modal-sm",
    md: "cuentaspagar-modal-md",
    lg: "cuentaspagar-modal-lg",
    xl: "cuentaspagar-modal-xl",
  }

  return (
    <div className="cuentaspagar-modal-overlay" onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div className={`cuentaspagar-modal-content ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
        <div className="cuentaspagar-modal-header">
          <h2 className="cuentaspagar-modal-title">{title}</h2>
          {canClose && (
            <button className="cuentaspagar-modal-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        <div className="cuentaspagar-modal-body">{children}</div>
      </div>
    </div>
  )
}

// Modal para Marcar como Pagada
const MarcarPagadaModal = ({ isOpen, onClose, onSave, cuenta, formasPago }) => {
  const [formData, setFormData] = useState({
    montoPago: "",
    formaPago: "",
    cantidadCreditos: "",
  });
  const [errors, setErrors] = useState({});

  // Verificar si es una cuenta de créditos plataforma o licencias
  const esCuentaCreditos = cuenta?.transaccion?.categoria?.descripcion?.toLowerCase().includes("créditos plataforma");

  // Determinar si es una plataforma de licencias
  const esLicencia = cuenta?.transaccion?.cuenta?.nombre?.toLowerCase().includes("fulltrack") ||
    cuenta?.transaccion?.cuenta?.nombre?.toLowerCase().includes("f/basic") ||
    cuenta?.transaccion?.cuenta?.nombre?.toLowerCase().includes("fbasic");

  useEffect(() => {
    if (isOpen && cuenta) {
      const saldoPendiente = cuenta.saldoPendiente || cuenta.monto;
      setFormData({
        montoPago: saldoPendiente.toString(),
        formaPago: cuenta.formaPago || "",
        cantidadCreditos: "",
      });
      setErrors({});
    }
  }, [isOpen, cuenta]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const saldoPendiente = cuenta.saldoPendiente || cuenta.monto;
    const montoPago = parseFloat(formData.montoPago);

    if (!formData.montoPago || montoPago <= 0) {
      newErrors.montoPago = "El monto debe ser mayor a 0";
    } else if (montoPago > saldoPendiente) {
      newErrors.montoPago = `El monto no puede ser mayor al saldo pendiente ($${saldoPendiente})`;
    }

    if (!formData.formaPago) {
      newErrors.formaPago = "La forma de pago es obligatoria";
    }

    if (esCuentaCreditos) {
      const cantidadCreditos = parseFloat(formData.cantidadCreditos);
      if (!formData.cantidadCreditos || cantidadCreditos <= 0) {
        newErrors.cantidadCreditos = "La cantidad de créditos debe ser mayor a 0";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      const cuentaActualizada = {
        ...cuenta,
        montoPago: parseFloat(formData.montoPago),
        formaPago: formData.formaPago,
        cantidadCreditos: esCuentaCreditos ? parseFloat(formData.cantidadCreditos) : null,
        fechaPago: cuenta.fechaPago,
      };
      await onSave(cuentaActualizada);
      onClose();
    }
  };

  const saldoPendiente = cuenta ? (cuenta.saldoPendiente || cuenta.monto) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Pago" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="cuentaspagar-form">
        {/* Mostrar información de la cuenta */}
        <div className="cuentaspagar-info-section">
          <div className="cuentaspagar-info-item">
            <label>Monto Total:</label>
            <span>${cuenta?.monto || 0}</span>
          </div>
          {cuenta?.montoPagado > 0 && (
            <div className="cuentaspagar-info-item">
              <label>Monto Pagado:</label>
              <span>${cuenta.montoPagado}</span>
            </div>
          )}
          <div className="cuentaspagar-info-item">
            <label>Saldo Pendiente:</label>
            <span>${saldoPendiente}</span>
          </div>
          {esCuentaCreditos && (
            <div className="cuentaspagar-info-item">
              <label>Cuenta:</label>
              <span>{cuenta.transaccion?.cuenta?.nombre}</span>
            </div>
          )}
          <div className="cuentaspagar-info-item">
            <label>Fecha de Pago:</label>
            <span>{cuenta?.fechaPago || "-"}</span>
          </div>
        </div>

        <div className="cuentaspagar-form-group">
          <label htmlFor="montoPago">Monto a Pagar <span className="required"> *</span></label>
          <div className="cuentaspagar-input-with-prefix">
            <span className="cuentaspagar-prefix">$</span>
            <input
              type="number"
              id="montoPago"
              step="0.01"
              max={saldoPendiente}
              value={formData.montoPago}
              onChange={(e) => handleInputChange("montoPago", e.target.value)}
              className={`cuentaspagar-form-control ${errors.montoPago ? "error" : ""}`}
            />
          </div>
          {errors.montoPago && <span className="cuentaspagar-error-message">{errors.montoPago}</span>}
        </div>

        {esCuentaCreditos && (
          <div className="cuentaspagar-form-group">
            <label htmlFor="cantidadCreditos">
              {esLicencia ? "Cantidad de Licencias Compradas" : "Cantidad de Créditos Comprados"}
              <span className="required"> *</span>
            </label>
            <input
              type="number"
              id="cantidadCreditos"
              step="1"
              min="1"
              value={formData.cantidadCreditos}
              onChange={(e) => handleInputChange("cantidadCreditos", e.target.value)}
              className={`cuentaspagar-form-control ${errors.cantidadCreditos ? "error" : ""}`}
              placeholder={esLicencia ? "Ej: 10 licencias" : "Ej: 100 créditos"}
            />
            {errors.cantidadCreditos && <span className="cuentaspagar-error-message">{errors.cantidadCreditos}</span>}
            <small className="cuentaspagar-help-text">
              {esLicencia
                ? "Especifica cuántas licencias se compraron con este pago"
                : "Especifica cuántos créditos se compraron con este pago"
              }
            </small>
          </div>
        )}

        <div className="cuentaspagar-form-group">
          <label htmlFor="formaPago">Forma de Pago <span className="required"> *</span></label>
          <select
            id="formaPago"
            value={formData.formaPago}
            onChange={(e) => handleInputChange("formaPago", e.target.value)}
            className={`cuentaspagar-form-control ${errors.formaPago ? "error" : ""}`}
          >
            <option value="">Seleccionar forma de pago</option>
            {Object.entries(formasPago).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
          {errors.formaPago && <span className="cuentaspagar-error-message">{errors.formaPago}</span>}
        </div>

        <div className="cuentaspagar-form-actions">
          <button type="button" onClick={onClose} className="cuentaspagar-btn cuentaspagar-btn-cancel">
            Cancelar
          </button>
          <button type="submit" className="cuentaspagar-btn cuentaspagar-btn-primary">
            Registrar Pago
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Modal para Editar Cuenta Por Pagar
const EditarCuentaModal = ({ isOpen, onClose, onSave, cuenta, formasPago }) => {
  const [formData, setFormData] = useState({
    fechaPago: "",
    monto: "",
    formaPago: "",
    nota: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && cuenta) {
      setFormData({
        fechaPago: cuenta.fechaPago || "",
        monto: cuenta.monto.toString(),
        formaPago: cuenta.formaPago || "",
        nota: cuenta.nota || "",
      });
      setErrors({});
    }
  }, [isOpen, cuenta]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fechaPago) newErrors.fechaPago = "La fecha de pago es obligatoria";
    if (!formData.monto || Number.parseFloat(formData.monto) <= 0) {
      newErrors.monto = "El monto debe ser mayor a 0";
    }
    if (!formData.formaPago) newErrors.formaPago = "La forma de pago es obligatoria";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);

      try {
        const response = await fetchWithToken(`${API_BASE_URL}/cuentas-por-pagar/${cuenta.id}`, {
          method: "PUT",
          body: JSON.stringify({
            fechaPago: formData.fechaPago,
            monto: Number.parseFloat(formData.monto),
            formaPago: formData.formaPago,
            nota: formData.nota,
          }),
        });

        if (response.ok) {
          const updatedCuenta = await response.json();
          onSave(updatedCuenta);
          onClose();
          Swal.fire({
            icon: "success",
            title: "Éxito",
            text: "Cuenta por pagar actualizada correctamente",
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Cuenta por Pagar" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="cuentaspagar-form">
        <div className="cuentaspagar-form-group">
          <label htmlFor="fechaPago">Fecha de Pago <span className="required"> *</span></label>
          <input
            type="date"
            id="fechaPago"
            value={formData.fechaPago}
            onChange={(e) => handleInputChange("fechaPago", e.target.value)}
            className={`cuentaspagar-form-control ${errors.fechaPago ? "error" : ""}`}
          />
          {errors.fechaPago && <span className="cuentaspagar-error-message">{errors.fechaPago}</span>}
        </div>

        <div className="cuentaspagar-form-group">
          <label htmlFor="monto">Monto <span className="required"> *</span></label>
          <div className="cuentaspagar-input-with-prefix">
            <span className="cuentaspagar-prefix">$</span>
            <input
              type="number"
              id="monto"
              step="0.01"
              value={formData.monto}
              onChange={(e) => handleInputChange("monto", e.target.value)}
              className={`cuentaspagar-form-control ${errors.monto ? "error" : ""}`}
            />
          </div>
          {errors.monto && <span className="cuentaspagar-error-message">{errors.monto}</span>}
        </div>

        <div className="cuentaspagar-form-group">
          <label htmlFor="formaPago">Forma de Pago <span className="required"> *</span></label>
          <select
            id="formaPago"
            value={formData.formaPago}
            onChange={(e) => handleInputChange("formaPago", e.target.value)}
            className={`cuentaspagar-form-control ${errors.formaPago ? "error" : ""}`}
          >
            <option value="">Seleccionar forma de pago</option>
            {Object.entries(formasPago).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
          {errors.formaPago && <span className="cuentaspagar-error-message">{errors.formaPago}</span>}
        </div>

        <div className="cuentaspagar-form-group">
          <label htmlFor="nota">Nota</label>
          <textarea
            id="nota"
            value={formData.nota}
            onChange={(e) => handleInputChange("nota", e.target.value)}
            className="cuentaspagar-form-control"
            rows="3"
            placeholder="Agregar una nota opcional..."
          />
        </div>

        <div className="cuentaspagar-form-actions">
          <button type="button" onClick={onClose} className="cuentaspagar-btn cuentaspagar-btn-cancel">
            Cancelar
          </button>
          <button type="submit" className="cuentaspagar-btn cuentaspagar-btn-primary" disabled={isLoading}>
            {isLoading ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Modal de Confirmación de Eliminación
const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm, cuenta }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar eliminación" size="sm" closeOnOverlayClick={false}>
      <div className="cuentaspagar-confirmar-eliminacion">
        <div className="cuentaspagar-confirmation-content">
          <p className="cuentaspagar-confirmation-message">
            ¿Seguro que quieres eliminar esta cuenta por pagar de forma permanente?
          </p>
          <div className="cuentaspagar-modal-form-actions">
            <button type="button" onClick={onClose} className="cuentaspagar-btn cuentaspagar-btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} className="cuentaspagar-btn cuentaspagar-btn-confirm">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Modal de Confirmación de Regeneración
const RegenerarModal = ({ isOpen, onClose, onConfirm, cuenta }) => {
  const [nuevoMonto, setNuevoMonto] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && cuenta) {
      setNuevoMonto(cuenta.monto.toString());
      setErrors({});
    }
  }, [isOpen, cuenta]);

  const handleMontoChange = (value) => {
    setNuevoMonto(value);
    if (errors.monto) {
      setErrors(prev => ({ ...prev, monto: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!nuevoMonto || Number.parseFloat(nuevoMonto) <= 0) {
      newErrors.monto = "El monto debe ser mayor a 0";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (validateForm()) {
      onConfirm(true, cuenta, Number.parseFloat(nuevoMonto));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generar nueva/s cuenta por pagar" size="md" closeOnOverlayClick={false}>
      <div className="cuentaspagar-confirmar-regeneracion">
        <div className="cuentaspagar-confirmation-content">
          <p className="cuentaspagar-confirmation-message">
            ¿Quiere volver a generar las cuentas por pagar para esta cuenta?
          </p>

          <div className="cuentaspagar-form-group" style={{ marginTop: "20px" }}>
            <label htmlFor="nuevoMonto">Monto para las nuevas cuentas <span className="required"> *</span></label>
            <div className="cuentaspagar-input-with-prefix">
              <span className="cuentaspagar-prefix">$</span>
              <input
                type="number"
                id="nuevoMonto"
                step="0.01"
                value={nuevoMonto}
                onChange={(e) => handleMontoChange(e.target.value)}
                className={`cuentaspagar-form-control ${errors.monto ? "error" : ""}`}
              />
            </div>
            {errors.monto && <span className="cuentaspagar-error-message">{errors.monto}</span>}
          </div>

          <div className="cuentaspagar-modal-form-actions" style={{ marginTop: "20px" }}>
            <button type="button" onClick={() => onConfirm(false)} className="cuentaspagar-btn cuentaspagar-btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} className="cuentaspagar-btn cuentaspagar-btn-confirm">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Modal de Vista Previa del PDF
const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, onDownload, filename }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vista previa" size="xl" closeOnOverlayClick={false}>
      <div className="cuentaspagar-preview-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
          <button
            type="button"
            onClick={onDownload}
            className="cuentaspagar-btn"
            style={{ backgroundColor: '#dc3545', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            Descargar PDF
          </button>
        </div>

        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden', minHeight: '600px' }}>
          <iframe
            src={`${pdfUrl}#view=FitH&navpanes=0&toolbar=0`}
            title="Vista Previa del Reporte"
            width="100%"
            height="100%"
            style={{ border: 'none', height: '75vh' }}
          />
        </div>
      </div>
    </Modal>
  );
};

const CustomDatePickerInput = ({ value, onClick, placeholder }) => (
  <div className="cuentaspagar-date-picker-wrapper">
    <input
      type="text"
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      readOnly
      className="cuentaspagar-date-picker"
    />
    <div className="cuentaspagar-date-picker-icons">
      <svg
        className="cuentaspagar-calendar-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    </div>
  </div>
);

// Componente Principal
const AdminCuentasPagar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userRol = localStorage.getItem("userRol")
  const [cuentasPagar, setCuentasPagar] = useState([]);
  const [filtroFolio, setFiltroFolio] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filtroEstatus, setFiltroEstatus] = useState("Pendiente");
  const [ordenFecha, setOrdenFecha] = useState('asc');
  const [modals, setModals] = useState({
    marcarPagada: { isOpen: false, cuenta: null },
    editarCuenta: { isOpen: false, cuenta: null },
    confirmarEliminacion: { isOpen: false, cuenta: null },
    regenerar: { isOpen: false, cuenta: null },
  });
  const [rangoFechas, setRangoFechas] = useState([null, null]);
  const [fechaInicio, fechaFin] = rangoFechas;
  const [filtroCuenta, setFiltroCuenta] = useState("");
  const [pdfPreview, setPdfPreview] = useState({
    isOpen: false,
    url: null,
    filename: ""
  });
  const [pdfPreviewResumido, setPdfPreviewResumido] = useState({
    isOpen: false,
    url: null,
    filename: ""
  });

  useEffect(() => {
    const fetchCuentasPagar = async () => {
      setIsLoading(true);
      try {
        const response = await fetchWithToken(`${API_BASE_URL}/cuentas-por-pagar`);
        const data = await response.json();
        setCuentasPagar(data);
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudieron cargar las cuentas por pagar",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCuentasPagar();
  }, []);

  useEffect(() => {
    if (location.state && location.state.filtroFolio) {
      setFiltroFolio(location.state.filtroFolio);
      setFiltroEstatus("Todas");

      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const formasPago = {
    "01": "Efectivo",
    "03": "Transferencia electrónica de fondos",
    "04": "Tarjeta de crédito",
    "07": "Con Saldo Acumulado",
    "28": "Tarjeta de débito",
    "30": "Aplicación de anticipos",
    "99": "Por definir",
    "02": "Tarjeta Spin"
  };

  const openModal = (modalType, data = {}) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: { isOpen: true, ...data },
    }));
  };

  const closeModal = (modalType) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: { isOpen: false },
    }));
  };

  const handleMenuNavigation = (menuItem) => {
    switch (menuItem) {
      case "balance":
        navigate("/admin_balance");
        break;
      case "transacciones":
        navigate("/admin_transacciones");
        break;
      case "cotizaciones":
        navigate("/admin_cotizaciones");
        break;
      case "facturacion":
        navigate("/admin_facturacion");
        break;
      case "cuentas-cobrar":
        navigate("/admin_cuentas_cobrar");
        break;
      case "cuentas-pagar":
        navigate("/admin_cuentas_pagar");
        break;
      case "caja-chica":
        navigate("/admin_caja_chica");
        break;
      case "comisiones":
        navigate("/admin_comisiones");
        break;
      default:
        break;
    }
  };

  const handleMarcarPagada = async (cuentaActualizada) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/cuentas-por-pagar/marcar-como-pagada`, {
        method: "POST",
        body: JSON.stringify({
          id: cuentaActualizada.id,
          montoPago: cuentaActualizada.montoPago,
          monto: cuentaActualizada.monto,
          formaPago: cuentaActualizada.formaPago,
          usuarioId: 1,
          cantidadCreditos: cuentaActualizada.cantidadCreditos,
        }),
      });

      if (response.status === 204) {
        const cuentaActualizadaResponse = await fetchWithToken(`${API_BASE_URL}/cuentas-por-pagar`);
        const cuentasActualizadas = await cuentaActualizadaResponse.json();
        setCuentasPagar(cuentasActualizadas);

        const cuentaRecienActualizada = cuentasActualizadas.find(c => c.id === cuentaActualizada.id);

        const esCompletamentePagada = cuentaRecienActualizada?.estatus === "Pagado";
        const esUltimaCuenta = cuentaRecienActualizada?.numeroPago === cuentaRecienActualizada?.totalPagos;
        const noEsUnica = cuentaRecienActualizada?.transaccion?.esquema !== "UNICA";

        const esSim = cuentaRecienActualizada?.sim;

        if (esCompletamentePagada && esUltimaCuenta && noEsUnica) {
          if (esSim) {
            await handleRegenerar(true, cuentaRecienActualizada);
          } else {
            openModal("regenerar", { cuenta: cuentaRecienActualizada });
          }
        } else {
          Swal.fire({
            icon: "success",
            title: "Éxito",
            text: esCompletamentePagada ? "Cuenta marcada como pagada" : "Pago parcial registrado correctamente",
          });
        }
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo marcar como pagada",
      });
    }
  };

  const handleDeleteCuenta = (cuenta) => {
    openModal("confirmarEliminacion", { cuenta });
  };

  const handleConfirmDelete = async () => {
    const cuentaId = modals.confirmarEliminacion.cuenta?.id;
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/cuentas-por-pagar/${cuentaId}?usuarioId=1`, {
        method: "DELETE",
      });
      if (response.status === 204) {
        setCuentasPagar((prev) => prev.filter((c) => c.id !== cuentaId));
        closeModal("confirmarEliminacion");
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: "Cuenta por pagar eliminada",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar la cuenta",
      });
    }
  };

  const handleRegenerar = async (confirmar, cuenta, nuevoMonto = null) => {
    closeModal("regenerar");

    if (confirmar) {
      try {
        const response = await fetchWithToken(`${API_BASE_URL}/cuentas-por-pagar/regenerar`, {
          method: "POST",
          body: JSON.stringify({
            transaccionId: cuenta.transaccion.id,
            fechaUltimoPago: cuenta.fechaPago,
            nuevoMonto: nuevoMonto,
            formaPago: cuenta.formaPago
          }),
        });

        if (response.ok) {
          const cuentasResponse = await fetchWithToken(`${API_BASE_URL}/cuentas-por-pagar`);
          const updatedCuentas = await cuentasResponse.json();
          setCuentasPagar(updatedCuentas);

          Swal.fire({
            icon: "success",
            title: "Éxito",
            text: "Nuevas cuentas por pagar generadas correctamente",
          });
        }
      } catch (error) {
        console.error("Error al regenerar cuentas:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudieron regenerar las cuentas por pagar",
        });
      }
    } else {
      // Si cancela, solo mostrar mensaje de éxito del pago
      Swal.fire({
        icon: "success",
        title: "Éxito",
        text: "Cuenta marcada como pagada",
      });
    }
  };

  const handleEditarCuenta = (updatedCuenta) => {
    setCuentasPagar((prev) =>
      prev.map((c) => (c.id === updatedCuenta.id ? updatedCuenta : c))
    );
    closeModal("editarCuenta");
  };

  const getEstatusClass = (estatus) => {
    switch (estatus) {
      case "Pagado":
        return "cuentaspagar-estatus-pagado";
      case "En proceso":
        return "cuentaspagar-estatus-en-proceso";
      case "Vencida":
        return "cuentaspagar-estatus-vencida";
      case "Pendiente":
      default:
        return "cuentaspagar-estatus-pendiente";
    }
  };

  const handleGenerarReporte = async () => {
    try {
      const params = new URLSearchParams();

      if (fechaInicio && fechaFin) {
        const formatFecha = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        params.append('fechaInicio', formatFecha(fechaInicio));
        params.append('fechaFin', formatFecha(fechaFin));
      } else {
        const fechaInicio = new Date();
        fechaInicio.setFullYear(fechaInicio.getFullYear() - 1);
        const fechaFin = new Date();
        fechaFin.setFullYear(fechaFin.getFullYear() + 1);

        params.append('fechaInicio', fechaInicio.toISOString().split('T')[0]);
        params.append('fechaFin', fechaFin.toISOString().split('T')[0]);
      }

      params.append('filtroEstatus', filtroEstatus);
      if (filtroCuenta) {
        params.append('filtroCuenta', filtroCuenta);
      }

      const response = await fetchWithToken(
        `${API_BASE_URL}/cuentas-por-pagar/reporte/pdf?${params.toString()}`
      );

      if (response.ok) {
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);

        const now = new Date();
        const timestamp = now.toISOString().split('T')[0];
        const estatusSuffix = filtroEstatus !== 'Todas' ? `_${filtroEstatus}` : '';
        const filename = `reporte_cuentas_por_pagar_${timestamp}${estatusSuffix}.pdf`;

        setPdfPreview({
          isOpen: true,
          url: url,
          filename: filename
        });

      }
    } catch (error) {
      console.error("Error al generar reporte:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo generar la vista previa del reporte.",
      });
    }
  };

  const handleDownloadFromPreview = () => {
    if (pdfPreview.url) {
      const link = document.createElement('a');
      link.href = pdfPreview.url;
      link.download = pdfPreview.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.fire({
        icon: "success",
        title: "Éxito",
        text: "Reporte descargado correctamente",
        timer: 2000,
        showConfirmButton: false
      });

    }
  };

  const handleClosePreview = () => {
    if (pdfPreview.url) {
      window.URL.revokeObjectURL(pdfPreview.url); // Liberar memoria
    }
    setPdfPreview({ isOpen: false, url: null, filename: "" });
  };

  const handleGenerarReporteResumido = async () => {
    try {
      const params = new URLSearchParams();

      if (fechaInicio && fechaFin) {
        const formatFecha = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        params.append('fechaInicio', formatFecha(fechaInicio));
        params.append('fechaFin', formatFecha(fechaFin));
      } else {
        const fechaInicio = new Date();
        fechaInicio.setFullYear(fechaInicio.getFullYear() - 1);
        const fechaFin = new Date();
        fechaFin.setFullYear(fechaFin.getFullYear() + 1);

        params.append('fechaInicio', fechaInicio.toISOString().split('T')[0]);
        params.append('fechaFin', fechaFin.toISOString().split('T')[0]);
      }

      params.append('filtroEstatus', filtroEstatus);
      if (filtroCuenta) {
        params.append('filtroCuenta', filtroCuenta);
      }

      const response = await fetchWithToken(
        `${API_BASE_URL}/cuentas-por-pagar/reporte/pdf-resumido?${params.toString()}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const now = new Date();
        const timestamp = now.toISOString().split('T')[0];
        const estatusSuffix = filtroEstatus !== 'Todas' ? `_${filtroEstatus}` : '';
        const filename = `reporte_resumido_cuentas_por_pagar_${timestamp}${estatusSuffix}.pdf`;

        setPdfPreviewResumido({
          isOpen: true,
          url: url,
          filename: filename
        });
      }
    } catch (error) {
      console.error("Error al generar reporte resumido:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo generar la vista previa del reporte resumido.",
      });
    }
  };

  const handleDownloadFromPreviewResumido = () => {
    if (pdfPreviewResumido.url) {
      const link = document.createElement('a');
      link.href = pdfPreviewResumido.url;
      link.download = pdfPreviewResumido.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.fire({
        icon: "success",
        title: "Éxito",
        text: "Reporte resumido descargado correctamente",
        timer: 2000,
        showConfirmButton: false
      });
    }
  };

  const handleClosePreviewResumido = () => {
    if (pdfPreviewResumido.url) {
      window.URL.revokeObjectURL(pdfPreviewResumido.url);
    }
    setPdfPreviewResumido({ isOpen: false, url: null, filename: "" });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-MX");
  };

  // Función auxiliar para determinar el estatus real al momento
  const getEstatusReal = (cuenta) => {
    if (cuenta.estatus === "Pagado") return "Pagado";
    if (cuenta.estatus === "Vencida") return "Vencida";
    if (!cuenta.fechaPago) return cuenta.estatus;

    const [year, month, day] = cuenta.fechaPago.split('-').map(Number);

    const fechaVencimiento = new Date(year, month - 1, day);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    fechaVencimiento.setHours(0, 0, 0, 0);
    if (hoy > fechaVencimiento && cuenta.estatus !== "Pagado") {
      return "Vencida";
    }

    return cuenta.estatus;
  };

  const cuentasUnicas = [...new Set(cuentasPagar.map(c => c.cuenta?.nombre))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const cuentasFiltradas = cuentasPagar.filter((cuenta) => {
    if (filtroFolio) {
      return cuenta.folio === filtroFolio;
    }
    const estatusReal = getEstatusReal(cuenta);
    const pasaFiltroEstatus = filtroEstatus === "Todas" || estatusReal === filtroEstatus;
    const pasaFiltroCuenta = filtroCuenta === "" || cuenta.cuenta?.nombre === filtroCuenta;

    let pasaFiltroFechas = true;
    if (fechaInicio || fechaFin) {
      const [year, month, day] = cuenta.fechaPago.split('-').map(Number);
      const fechaCuenta = new Date(year, month - 1, day);

      let inicio = fechaInicio ? new Date(fechaInicio) : null;
      let fin = fechaFin ? new Date(fechaFin) : null;

      if (inicio) {
        inicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
      }
      if (fin) {
        fin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59);
      }

      pasaFiltroFechas = (!inicio || fechaCuenta >= inicio) && (!fin || fechaCuenta <= fin);
    }

    return pasaFiltroEstatus && pasaFiltroFechas && pasaFiltroCuenta;
  });

  const cuentasOrdenadas = cuentasFiltradas.sort((a, b) => {
    // Primer nivel: ordenamiento por fecha
    const fechaA = new Date(a.fechaPago);
    const fechaB = new Date(b.fechaPago);

    let comparacionFecha;
    if (ordenFecha === 'asc') {
      comparacionFecha = fechaA - fechaB;
    } else {
      comparacionFecha = fechaB - fechaA;
    }

    if (comparacionFecha !== 0) {
      return comparacionFecha;
    }

    const nombreA = a.cuenta.nombre.toLowerCase();
    const nombreB = b.cuenta.nombre.toLowerCase();

    return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
  });

  const toggleOrdenFecha = () => {
    setOrdenFecha(prevOrden => prevOrden === 'asc' ? 'desc' : 'asc');
  };

  const getDiasRenovacion = (esquema) => {
    const diasPorEsquema = {
      "UNICA": 0,
      "SEMANAL": 7,
      "QUINCENAL": 14,
      "MENSUAL": 30,
      "BIMESTRAL": 60,
      "TRIMESTRAL": 90,
      "SEMESTRAL": 180,
      "ANUAL": 365
    };

    return diasPorEsquema[esquema] || 0;
  };

  const limpiarFiltroFechas = () => {
    setRangoFechas([null, null]);
  };

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="cuentaspagar-loading">
            <div className="spinner"></div>
            <p>Cargando datos de cuentas por pagar...</p>
          </div>
        )}
        <main className="cuentaspagar-main-content">
          <div className="cuentaspagar-container">
            <section className="cuentaspagar-sidebar">
              <div className="cuentaspagar-sidebar-header">
                <h3 className="cuentaspagar-sidebar-title">Administración</h3>
              </div>
              <div className="cuentaspagar-sidebar-menu">
                {userRol === "ADMINISTRADOR" && (
                  <div className="cuentaspagar-menu-item" onClick={() => handleMenuNavigation("balance")}>
                    Balance
                  </div>
                )}
                <div className="cuentaspagar-menu-item" onClick={() => handleMenuNavigation("transacciones")}>
                  Transacciones
                </div>
                <div className="cuentaspagar-menu-item" onClick={() => handleMenuNavigation("cotizaciones")}>
                  Cotizaciones
                </div>
                <div className="cuentaspagar-menu-item" onClick={() => handleMenuNavigation("facturacion")}>
                  Facturas/Notas
                </div>
                <div className="cuentaspagar-menu-item" onClick={() => handleMenuNavigation("cuentas-cobrar")}>
                  Cuentas por Cobrar
                </div>
                <div
                  className="cuentaspagar-menu-item cuentaspagar-menu-item-active"
                  onClick={() => handleMenuNavigation("cuentas-pagar")}
                >
                  Cuentas por Pagar
                </div>
                <div className="cuentaspagar-menu-item" onClick={() => handleMenuNavigation("caja-chica")}>
                  Caja chica
                </div>
                <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("comisiones")}>
                  Comisiones
                </div>
              </div>
            </section>

            <section className="cuentaspagar-content-panel">
              <div className="cuentaspagar-header">
                <div className="cuentaspagar-header-info">
                  <h3 className="cuentaspagar-page-title">Cuentas por Pagar</h3>
                  <p className="cuentaspagar-subtitle">Gestión de pagos pendientes</p>
                </div>
                <div className="cuentaspagar-btn-reporte-container">
                  <button
                    className="cuentaspagar-btn-reporte"
                    onClick={handleGenerarReporte}
                  >
                    Visualizar Reporte Detallado
                  </button>
                  <button
                    className="cuentaspagar-btn-reporte"
                    onClick={handleGenerarReporteResumido}
                    style={{ marginLeft: '10px' }}
                  >
                    Visualizar Reporte Resumido
                  </button>
                </div>
              </div>

              <div className="cuentaspagar-table-card">
                <div className="cuentaspagar-table-header">
                  <h4 className="cuentaspagar-table-title">Cuentas por pagar</h4>
                  <div className="cuentaspagar-filters-container">
                    {filtroFolio && (
                      <div className="cuentaspagar-filter-container">
                        <div style={{ height: '21px' }}></div>
                        <button
                          className="cuentaspagar-btn cuentaspagar-btn-cancel"
                          onClick={() => { setFiltroFolio(""); setFiltroEstatus("Pendiente"); }}
                          style={{ backgroundColor: '#6c757d', color: 'white' }}
                        >
                          Ver lista completa (Filtro: {filtroFolio}) ✕
                        </button>
                      </div>
                    )}
                    <div className="cuentaspagar-filter-container">
                      <div style={{ height: '21px' }}></div>
                      <button
                        className="cuentaspagar-btn-orden"
                        onClick={toggleOrdenFecha}
                        title={`Cambiar a orden ${ordenFecha === 'asc' ? 'descendente' : 'ascendente'}`}
                      >
                        {ordenFecha === 'asc' ? '📅 ↑ Antiguas primero' : '📅 ↓ Recientes primero'}
                      </button>
                    </div>

                    <div className="cuentaspagar-filter-container">
                      <label htmlFor="filtroCuenta">Filtrar por cuenta:</label>
                      <select
                        id="filtroCuenta"
                        value={filtroCuenta}
                        onChange={(e) => setFiltroCuenta(e.target.value)}
                        className="cuentaspagar-filter-select"
                      >
                        <option value="">Todas las cuentas</option>
                        {cuentasUnicas.map((nombre, index) => (
                          <option key={index} value={nombre}>
                            {nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="cuentaspagar-filter-container">
                      <label htmlFor="filtroEstatus">Filtrar por estatus:</label>
                      <select
                        id="filtroEstatus"
                        value={filtroEstatus}
                        onChange={(e) => setFiltroEstatus(e.target.value)}
                        className="cuentaspagar-filter-select"
                      >
                        <option value="Todas">Todas</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En proceso">En proceso</option>
                        <option value="Vencida">Vencida</option>
                        <option value="Pagado">Pagado</option>
                      </select>
                    </div>

                    <div className="cuentaspagar-filter-container cuentaspagar-date-filter">
                      <label>Filtrar por fecha de pago:</label>
                      <div className="cuentaspagar-date-picker-container">
                        <DatePicker
                          selectsRange={true}
                          startDate={fechaInicio}
                          endDate={fechaFin}
                          onChange={(update) => {
                            setRangoFechas(update);
                          }}
                          isClearable={true}
                          placeholderText="Seleccione fecha o rango"
                          dateFormat="dd/MM/yyyy"
                          customInput={<CustomDatePickerInput />}
                          locale="es"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="cuentaspagar-table-container">
                  <table className="cuentaspagar-table">
                    <thead className="cuentaspagar-table-header-fixed">
                      <tr>
                        <th>Folio</th>
                        <th>Fecha de Pago</th>
                        <th>Cuenta</th>
                        <th>Monto</th>
                        <th>Forma de Pago</th>
                        <th>Categoría</th>
                        <th>Renovación (días)</th>
                        <th>Estatus</th>
                        <th>Nota</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentasOrdenadas.length > 0 ? (
                        cuentasOrdenadas.map((cuenta) => {
                          // 1. Calculamos el estatus REAL en este momento para mostrarlo correctamente
                          const estatusParaMostrar = getEstatusReal(cuenta);

                          return (
                            <tr key={cuenta.id}>
                              <td>
                                {cuenta.folio}
                                {cuenta.sim && <span className="cuentaspagar-sim-id"> -{cuenta.sim.id}</span>}
                              </td>
                              <td>{cuenta.fechaPago}</td>
                              <td>{cuenta.cuenta.nombre}</td>
                              <td>
                                <div className="cuentaspagar-monto-info">
                                  <div>{formatCurrency(cuenta.monto)}</div>
                                  {cuenta.montoPagado > 0 && (
                                    <div className="cuentaspagar-monto-detalle">
                                      <small>Pagado: {formatCurrency(cuenta.montoPagado)}</small>
                                      <small>Pendiente: {formatCurrency(cuenta.saldoPendiente)}</small>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>{formasPago[cuenta.formaPago]}</td>
                              <td>{cuenta.transaccion?.categoria?.descripcion || "-"}</td>
                              <td>{getDiasRenovacion(cuenta.transaccion?.esquema)}</td>
                              <td>
                                {/* 2. Usamos el estatus calculado para la clase (color) y el texto */}
                                <span className={`cuentaspagar-estatus-badge ${getEstatusClass(estatusParaMostrar)}`}>
                                  {estatusParaMostrar}
                                </span>
                              </td>
                              <td>{cuenta.nota || "-"}</td>
                              <td>
                                <div className="cuentaspagar-actions">
                                  {cuenta.estatus !== "Pagado" && !cuenta.sim && (
                                    <button
                                      className="cuentaspagar-action-btn cuentaspagar-edit-btn"
                                      onClick={() => openModal("editarCuenta", { cuenta })}
                                      title="Editar cuenta"
                                    >
                                      <img src={editIcon} alt="Editar" className="cuentaspagar-action-icon" />
                                    </button>
                                  )}
                                  {cuenta.estatus !== "Pagado" && (
                                    <button
                                      className="cuentaspagar-action-btn cuentaspagar-check-btn"
                                      onClick={() => openModal("marcarPagada", { cuenta })}
                                      title="Marcar como pagada"
                                    >
                                      <img src={checkIcon || "/placeholder.svg"} alt="Marcar como pagada" className="cuentaspagar-action-icon" />
                                    </button>
                                  )}
                                  {cuenta.estatus !== "Pagado" && !cuenta.sim && (
                                    <button
                                      className="cuentaspagar-action-btn cuentaspagar-delete-btn"
                                      onClick={() => handleDeleteCuenta(cuenta)}
                                      title="Eliminar"
                                    >
                                      <img src={deleteIcon || "/placeholder.svg"} alt="Eliminar" className="cuentaspagar-action-icon" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="10" className="cuentaspagar-no-data">
                            {(() => {
                              if (filtroEstatus === "Todas" && !fechaInicio && !fechaFin) {
                                return "No hay cuentas por pagar registradas";
                              }
                              let mensaje = "No hay cuentas por pagar";
                              if (filtroEstatus !== "Todas") {
                                mensaje += ` con estatus "${filtroEstatus}"`;
                              }
                              if (fechaInicio && fechaFin) {
                                const formatFecha = (date) => {
                                  return new Date(date).toLocaleDateString("es-MX");
                                };
                                mensaje += ` entre ${formatFecha(fechaInicio)} y ${formatFecha(fechaFin)}`;
                              }
                              return mensaje;
                            })()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <MarcarPagadaModal
            isOpen={modals.marcarPagada.isOpen}
            onClose={() => closeModal("marcarPagada")}
            onSave={handleMarcarPagada}
            cuenta={modals.marcarPagada.cuenta}
            formasPago={formasPago}
          />

          <ConfirmarEliminacionModal
            isOpen={modals.confirmarEliminacion.isOpen}
            onClose={() => closeModal("confirmarEliminacion")}
            onConfirm={handleConfirmDelete}
            cuenta={modals.confirmarEliminacion.cuenta}
          />

          <EditarCuentaModal
            isOpen={modals.editarCuenta.isOpen}
            onClose={() => closeModal("editarCuenta")}
            onSave={handleEditarCuenta}
            cuenta={modals.editarCuenta.cuenta}
            formasPago={formasPago}
          />

          <RegenerarModal
            isOpen={modals.regenerar.isOpen}
            onClose={() => closeModal("regenerar")}
            onConfirm={handleRegenerar}
            cuenta={modals.regenerar.cuenta}
          />

          <PdfPreviewModal
            isOpen={pdfPreview.isOpen}
            onClose={handleClosePreview}
            pdfUrl={pdfPreview.url}
            onDownload={handleDownloadFromPreview}
            filename={pdfPreview.filename}
          />

          <PdfPreviewModal
            isOpen={pdfPreviewResumido.isOpen}
            onClose={handleClosePreviewResumido}
            pdfUrl={pdfPreviewResumido.url}
            onDownload={handleDownloadFromPreviewResumido}
            filename={pdfPreviewResumido.filename}
          />
        </main>
      </div>
    </>
  );
};

export default AdminCuentasPagar;
export { MarcarPagadaModal };
