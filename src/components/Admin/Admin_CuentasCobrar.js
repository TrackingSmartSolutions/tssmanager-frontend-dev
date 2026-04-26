import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import "./Admin_CuentasCobrar.css"
import Header from "../Header/Header"
import Swal from "sweetalert2"
import deleteIcon from "../../assets/icons/eliminar.png"
import downloadIcon from "../../assets/icons/descarga.png"
import editIcon from "../../assets/icons/editar.png"
import requestIcon from "../../assets/icons/cotizacion.png"
import detailsIcon from "../../assets/icons/lupa.png"
import checkIcon from "../../assets/icons/check.png"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { NuevoConceptoModal } from '../Admin/Admin_Cotizaciones';
import { API_BASE_URL } from "../Config/Config";

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = new Headers();
  if (token) {
    headers.append("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData)) {
    headers.append("Content-Type", "application/json");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`);
    if (response.status === 204) return response;
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('La operación tardó demasiado tiempo. Verifique su conexión.');
    }
    throw error;
  }
};

const fetchFileWithToken = async (url, options = {}) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  const config = {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  };

  return fetch(url, config);
};

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
    sm: "cuentascobrar-modal-sm",
    md: "cuentascobrar-modal-md",
    lg: "cuentascobrar-modal-lg",
    xl: "cuentascobrar-modal-xl",
  }

  return (
    <div className="cuentascobrar-modal-overlay" onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div className={`cuentascobrar-modal-content ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
        <div className="cuentascobrar-modal-header">
          <h2 className="cuentascobrar-modal-title">{title}</h2>
          {canClose && (
            <button className="cuentascobrar-modal-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        <div className="cuentascobrar-modal-body">{children}</div>
      </div>
    </div>
  )
}

// Función para convertir números a letras
const numeroALetras = (numero) => {
  const unidades = [
    "",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
  ]

  const decenas = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]

  const centenas = [
    "",
    "ciento",
    "doscientos",
    "trescientos",
    "cuatrocientos",
    "quinientos",
    "seiscientos",
    "setecientos",
    "ochocientos",
    "novecientos",
  ]

  if (numero === 0) return "cero pesos 00/100 M.N."
  if (numero === 1) return "un peso 00/100 M.N."

  let entero = Math.floor(numero)
  const centavos = Math.round((numero - entero) * 100)

  const convertirGrupo = (num) => {
    if (num === 0) return ""
    if (num < 20) return unidades[num]
    if (num < 100) {
      const dec = Math.floor(num / 10)
      const uni = num % 10
      if (uni === 0) return decenas[dec]
      if (dec === 2) return "veinti" + unidades[uni]
      return decenas[dec] + (uni > 0 ? " y " + unidades[uni] : "")
    }

    const cen = Math.floor(num / 100)
    const resto = num % 100
    let resultado = ""

    if (cen === 1 && resto === 0) resultado = "cien"
    else resultado = centenas[cen]

    if (resto > 0) resultado += " " + convertirGrupo(resto)
    return resultado
  }

  let resultado = ""

  if (entero >= 1000000) {
    const millones = Math.floor(entero / 1000000)
    if (millones === 1) resultado += "un millón "
    else resultado += convertirGrupo(millones) + " millones "
    entero %= 1000000
  }

  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000)
    if (miles === 1) resultado += "mil "
    else resultado += convertirGrupo(miles) + " mil "
    entero %= 1000
  }

  if (entero > 0) {
    resultado += convertirGrupo(entero)
  }

  resultado = resultado.trim()
  if (Math.floor(numero) === 1) {
    resultado += " peso"
  } else {
    resultado += " pesos"
  }

  resultado += ` ${centavos.toString().padStart(2, "0")}/100 M.N.`

  return resultado.charAt(0).toUpperCase() + resultado.slice(1)
}

const getEstatusClass = (estatus) => {
  switch (estatus) {
    case "PAGADO":
      return "cuentascobrar-estatus-pagado";
    case "EN_PROCESO":
      return "cuentascobrar-estatus-en-proceso";
    case "VENCIDA":
      return "cuentascobrar-estatus-vencida";
    case "PENDIENTE":
    default:
      return "cuentascobrar-estatus-pendiente";
  }
};

// Modal para Agregar Comprobante de Pago
const ComprobanteModal = ({ isOpen, onClose, onSave, cuenta }) => {
  const [formData, setFormData] = useState({
    montoPago: "",
    fechaPago: "",
    comprobantePago: null,
    categoriaId: "",
  });
  const [errors, setErrors] = useState({});
  const saldoPendiente = cuenta?.saldoPendiente || cuenta?.cantidadCobrar || 0;
  const [isLoading, setIsLoading] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");

  const categoriasPermitidas = [
    { id: 1, descripcion: "Ventas" },
    { id: 2, descripcion: "Renta Mensual" },
    { id: 25, descripcion: "Renta Anual" },
    { id: 3, descripcion: "Revisiones" }
  ];

  useEffect(() => {
    if (isOpen) {
      setFormData({
        montoPago: saldoPendiente.toString(),
        fechaPago: new Date().toISOString().split("T")[0],
        comprobantePago: null,
        categoriaId: "",
      });
      setCategoriaSeleccionada("");
      setErrors({});
    }
  }, [isOpen, cuenta]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleCategoriaChange = (categoriaId) => {
    setCategoriaSeleccionada(categoriaId);
    setFormData((prev) => ({ ...prev, categoriaId: categoriaId }));
    if (errors.categoriaId) {
      setErrors((prev) => ({ ...prev, categoriaId: "" }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validación de tipo de archivo (solo PDF)
      const validTypes = ["application/pdf"];
      if (!validTypes.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          comprobantePago: "El archivo debe ser un PDF.",
        }));
        return;
      }

      // Validación de tamaño (máximo 5 MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          comprobantePago: "El archivo no debe exceder 5MB.",
        }));
        return;
      }

      // Si pasa las validaciones, asignar el archivo
      setFormData((prev) => ({ ...prev, comprobantePago: file }));
      setErrors((prev) => ({ ...prev, comprobantePago: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const montoPago = parseFloat(formData.montoPago);

    if (!formData.montoPago || montoPago <= 0) {
      newErrors.montoPago = "El monto debe ser mayor a 0";
    } else if (montoPago > saldoPendiente) {
      newErrors.montoPago = `El monto no puede ser mayor al saldo pendiente ($${saldoPendiente})`;
    }

    if (!formData.fechaPago) newErrors.fechaPago = "La fecha de pago es obligatoria";
    if (!formData.comprobantePago) newErrors.comprobantePago = "El comprobante de pago es obligatorio";
    if (!categoriaSeleccionada) newErrors.categoriaId = "Debe seleccionar una categoría";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    if (validateForm()) {
      const formDataToSend = new FormData();
      formDataToSend.append("montoPago", formData.montoPago)
      formDataToSend.append("fechaPago", formData.fechaPago);
      formDataToSend.append("categoriaId", formData.categoriaId);
      formDataToSend.append("comprobante", formData.comprobantePago);

      try {
        Swal.fire({
          title: 'Procesando...',
          text: 'Marcando como pagado y subiendo comprobante',
          allowOutsideClick: false,
          showConfirmButton: false,
          willOpen: () => {
            Swal.showLoading();
          }
        });

        const response = await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar/${cuenta.id}/marcar-pagada`, {
          method: "POST",
          body: formDataToSend,
        });

        Swal.close();

        const responseData = {
          cuenta: response,
          mostrarModalComision: response.mostrarModalComision || false
        };

        onSave(responseData, formData.montoPago, cuenta.id);
        onClose();

        if (response.comprobantePagoUrl === "ERROR_UPLOAD") {
          Swal.fire({
            icon: "warning",
            title: "Parcialmente completado",
            text: "La cuenta se marcó como pagada, pero hubo un error al subir el comprobante. Puede intentar subirlo nuevamente más tarde."
          });
        } else if (!response.mostrarModalComision) {
          Swal.fire({
            icon: "success",
            title: "Éxito",
            text: "Cuenta marcada como pagada correctamente"
          });
        }
      } catch (error) {
        Swal.close();
        Swal.fire({ icon: "error", title: "Error", text: error.message });
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar Comprobante de Cobro" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="cuentascobrar-form">
        <div className="cuentascobrar-info-section">
          <div className="cuentascobrar-info-item">
            <label>Monto Total:</label>
            <span>${cuenta?.cantidadCobrar || 0}</span>
          </div>
          {cuenta?.montoPagado > 0 && (
            <div className="cuentascobrar-info-item">
              <label>Monto Pagado:</label>
              <span>${cuenta.montoPagado}</span>
            </div>
          )}
          <div className="cuentascobrar-info-item">
            <label>Saldo Pendiente:</label>
            <span>${saldoPendiente}</span>
          </div>
        </div>
        <div className="cuentascobrar-form-group">
          <label htmlFor="montoPago">Monto a Cobrar <span className="required"> *</span></label>
          <div className="cuentascobrar-input-with-prefix">
            <span className="cuentascobrar-prefix">$</span>
            <input
              type="number"
              id="montoPago"
              step="0.01"
              max={cuenta?.saldoPendiente || cuenta?.cantidadCobrar}
              value={formData.montoPago}
              onChange={(e) => handleInputChange("montoPago", e.target.value)}
              className={`cuentascobrar-form-control ${errors.montoPago ? "error" : ""}`}
            />
          </div>
          {errors.montoPago && <span className="cuentascobrar-error-message">{errors.montoPago}</span>}
          <label htmlFor="fechaPago">Fecha Pago <span className="required"> *</span></label>
          <input
            type="date"
            id="fechaPago"
            value={formData.fechaPago}
            onChange={(e) => handleInputChange("fechaPago", e.target.value)}
            className={`cuentascobrar-form-control ${errors.fechaPago ? "error" : ""}`}
          />
          {errors.fechaPago && <span className="cuentascobrar-error-message">{errors.fechaPago}</span>}
        </div>

        <div className="cuentascobrar-form-group">
          <label>Categoría <span className="required"> *</span></label>
          <div className="cuentascobrar-checkbox-group">
            {categoriasPermitidas.map((categoria) => (
              <div key={categoria.id} className="cuentascobrar-checkbox-item">
                <input
                  type="radio"
                  id={`categoria-${categoria.id}`}
                  name="categoria"
                  value={categoria.id}
                  checked={categoriaSeleccionada === categoria.id.toString()}
                  onChange={() => handleCategoriaChange(categoria.id.toString())}
                  className="cuentascobrar-radio-input"
                />
                <label htmlFor={`categoria-${categoria.id}`} className="cuentascobrar-radio-label">
                  {categoria.descripcion}
                </label>
              </div>
            ))}
          </div>
          {errors.categoriaId && <span className="cuentascobrar-error-message">{errors.categoriaId}</span>}
        </div>

        <div className="cuentascobrar-form-group">
          <label htmlFor="comprobantePago">Comprobante de pago <span className="required"> *</span></label>
          <div className="cuentascobrar-file-upload">
            <input type="file" id="comprobantePago" onChange={handleFileChange} accept="application/pdf" className="cuentascobrar-file-input" />
            <div className="cuentascobrar-file-upload-area">
              <div className="cuentascobrar-file-upload-icon">📁</div>
              <div className="cuentascobrar-file-upload-text">
                {formData.comprobantePago ? formData.comprobantePago.name : "Arrastra y suelta tu archivo aquí"}
              </div>
              <div className="cuentascobrar-file-upload-subtext">PDF máx. 5MB</div>
            </div>
          </div>
          {errors.comprobantePago && <span className="cuentascobrar-error-message">{errors.comprobantePago}</span>}
        </div>

        <div className="cuentascobrar-form-actions">
          <button type="button" onClick={onClose} className="cuentascobrar-btn cuentascobrar-btn-cancel">
            Cancelar
          </button>
          <button
            type="submit"
            className="cuentascobrar-btn cuentascobrar-btn-primary"
            disabled={isLoading}
          >
            {isLoading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Modal de Confirmación de Eliminación
const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm, cuenta }) => {
  const handleConfirmDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/cuentas-por-cobrar/${cuenta.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.status === 204) {
        onConfirm(cuenta.id);
        onClose();
        Swal.fire({ icon: "success", title: "Éxito", text: "Cuenta eliminada correctamente" });
      } else if (response.status === 409) {
        const data = await response.json();
        onClose();
        Swal.fire({ icon: "error", title: "No se puede eliminar", text: data.error });
      } else {
        throw new Error("Error inesperado");
      }
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar eliminación" size="sm" closeOnOverlayClick={false}>
      <div className="cuentascobrar-confirmar-eliminacion">
        <div className="cuentascobrar-confirmation-content">
          <p className="cuentascobrar-confirmation-message">
            ¿Seguro que quieres eliminar la cuenta por cobrar de forma permanente?
          </p>
          <div className="cuentascobrar-modal-form-actions">
            <button type="button" onClick={onClose} className="cuentascobrar-btn cuentascobrar-btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirmDelete} className="cuentascobrar-btn cuentascobrar-btn-confirm">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const SolicitudModal = ({ isOpen, onClose, onSave, cotizaciones, cuentasPorCobrar, emisores, preloadedCotizacion, preloadedCuenta }) => {
  const [formData, setFormData] = useState({
    id: null,
    cotizacion: "",
    fechaEmision: new Date().toISOString().split('T')[0],
    metodoPago: "",
    formaPago: "",
    tipo: "",
    claveProductoServicio: "20121910",
    claveUnidad: "E48",
    emisor: "",
    cuentaPorCobrar: "",
    subtotal: "",
    iva: "",
    total: "",
    importeLetra: "",
    usoCfdi: "",
  });
  const [errors, setErrors] = useState({});

  const isEditing = !!preloadedCotizacion?.id;

  const usosCfdi = [
    { value: "G01", label: "G01 - Adquisición de mercancías" },
    { value: "G02", label: "G02 - Devoluciones, descuentos o bonificaciones" },
    { value: "G03", label: "G03 - Gastos en General" },
    { value: "I01", label: "I01 - Construcciones" },
    { value: "I02", label: "I02 - Mobiliario y Equipo de Oficina por inversiones" },
    { value: "I03", label: "I03 - Equipo de transporte" },
    { value: "I04", label: "I04 - Equipo de cómputo y accesorios" },
    { value: "I05", label: "I05 - Dados, troqueles, moldes, matrices y herramientas" },
    { value: "I06", label: "I06 - Comunicaciones telefónicas" },
    { value: "I07", label: "I07 - Comunicaciones satelitales" },
    { value: "I08", label: "I08 - Otra maquinaria y equipo" },
    { value: "D01", label: "D01 - Honorarios médicos, dentales y hospitalarios" },
    { value: "D02", label: "D02 - Gastos médicos por incapacidad o discapacidad" },
    { value: "D03", label: "D03 - Gastos funerales" },
    { value: "D04", label: "D04 - Donativos" },
    { value: "D05", label: "D05 - Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)" },
    { value: "D06", label: "D06 - Aportaciones voluntarias al SAR" },
    { value: "D07", label: "D07 - Primas por seguros de gastos médicos" },
    { value: "D08", label: "D08 - Gastos por transportación escolar obligatoria" },
    { value: "D09", label: "D09 - Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones" },
    { value: "D10", label: "D10 - Pagos por servicios educativos (colegiaturas)" },
    { value: "P01", label: "P01 - Por definir" },
  ];

  const metodosPago = [
    { value: "PUE", label: "Pago en una sola exhibición (PUE)" },
    { value: "PPD", label: "Pago en parcialidades o diferido (PPD)" },
  ];

  const formasPago = [
    { value: "01", label: "01: Efectivo" },
    { value: "07", label: "07: Con Saldo Acumulado" },
    { value: "03", label: "03: Transferencia electrónica de fondos" },
    { value: "04", label: "04: Tarjeta de crédito" },
    { value: "28", label: "28: Tarjeta de débito" },
    { value: "30", label: "30: Aplicación de anticipos" },
    { value: "99", label: "99: Por definir" },
    { value: "02", label: "02: Tarjeta spin" },
  ];

  const tipos = [
    { value: "SOLICITUD_DE_FACTURA", label: "Solicitud de Factura" },
    { value: "NOTA", label: "Nota" },
  ];

  const clavesProductoServicio = [
    { value: "25173108", label: "25173108 - Sistemas de navegación vehicular (Sistema GPS)" },
    { value: "25173107", label: "25173107 - Sistemas de posicionamiento global de vehículos" },
    { value: "43211710", label: "43211710 - Dispositivos de identificación de radio frecuencia" },
    { value: "43212116", label: "43212116 - Impresoras de etiquetas de identificación de radio frecuencia rfid" },
    { value: "81111810", label: "81111810 - Servicios de codificación de software" },
    { value: "81111501", label: "81111501 - Diseño de aplicaciones de software de la unidad central" },
    { value: "81111510", label: "81111510 - Servicios de desarrollo de aplicaciones para servidores" },
    { value: "81112106", label: "81112106 - Proveedores de servicios de aplicación" },
    { value: "81112105", label: "81112105 - Servicios de hospedaje de operación de sitios web" },
    { value: "20121910", label: "20121910 - Sistemas de telemetría" },
  ];

  const clavesUnidad = [
    { value: "H87", label: "H87 - Pieza" },
    { value: "E48", label: "E48 - Unidad de servicio" },
    { value: "ACT", label: "ACT - Actividad" },
    { value: "MON", label: "MON - Mes" },
    { value: "LOT", label: "LOT - Lote" },
  ];

  useEffect(() => {
    if (isOpen) {
      if (preloadedCotizacion) {
        setFormData({
          id: null,
          cotizacion: preloadedCotizacion.id,
          fechaEmision: new Date().toISOString().split('T')[0],
          metodoPago: "",
          formaPago: "",
          tipo: "",
          claveProductoServicio: "20121910",
          claveUnidad: "E48",
          emisor: emisores.length > 0 ? emisores[0].id : "",
          cuentaPorCobrar: preloadedCuenta ? preloadedCuenta.id : "",
          subtotal: preloadedCotizacion.subtotal !== undefined ? String(preloadedCotizacion.subtotal) : "",
          iva: preloadedCotizacion.iva !== undefined ? String(preloadedCotizacion.iva) : "",
          total: preloadedCotizacion.total !== undefined ? String(preloadedCotizacion.total) : "",
          importeLetra: preloadedCotizacion.importeConLetra || "",
          usoCfdi: "",
        });
        const empresaData = preloadedCotizacion.empresaData || {};
        const requiredFields = ["domicilioFiscal", "rfc", "razonSocial", "regimenFiscal"];
        const hasAllFiscalData = requiredFields.every((field) => !!empresaData[field]);
        if (!hasAllFiscalData) {
          setFormData((prev) => ({
            ...prev,
            tipo: "NOTA",
          }));
        }
      } else {
        setFormData({
          id: null,
          cotizacion: "",
          fechaEmision: new Date().toISOString().split('T')[0],
          metodoPago: "",
          formaPago: "",
          tipo: "",
          claveProductoServicio: "20121910",
          claveUnidad: "E48",
          emisor: emisores.length > 0 ? emisores[0].id : "",
          cuentaPorCobrar: "",
          subtotal: "",
          iva: "",
          total: "",
          importeLetra: "",
          usoCfdi: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, preloadedCotizacion, preloadedCuenta, emisores]);

  useEffect(() => {
    if (formData.cotizacion && cotizaciones) {
      const cotizacionSeleccionada = cotizaciones.find((c) => c.id === parseInt(formData.cotizacion));
      if (cotizacionSeleccionada) {
        setFormData((prev) => ({
          ...prev,
          subtotal: cotizacionSeleccionada.subtotal !== undefined ? String(cotizacionSeleccionada.subtotal) : "",
          iva: cotizacionSeleccionada.iva !== undefined ? String(cotizacionSeleccionada.iva) : "",
          total: cotizacionSeleccionada.total !== undefined ? String(cotizacionSeleccionada.total) : "",
          importeLetra: cotizacionSeleccionada.importeConLetra || "",
        }));
      }
    }
  }, [formData.cotizacion, cotizaciones]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.metodoPago) newErrors.metodoPago = "El método de pago es obligatorio";
    if (!formData.formaPago) newErrors.formaPago = "La forma de pago es obligatoria";
    if (!formData.tipo) newErrors.tipo = "El tipo es obligatorio";
    if (!formData.claveProductoServicio) newErrors.claveProductoServicio = "La clave producto/servicio es obligatoria";
    if (!formData.claveUnidad) newErrors.claveUnidad = "La clave unidad es obligatoria";
    if (!formData.emisor) newErrors.emisor = "El emisor es obligatorio";
    if (!formData.cuentaPorCobrar) newErrors.cuentaPorCobrar = "La cuenta por cobrar es obligatoria";
    if (formData.tipo === "SOLICITUD_DE_FACTURA" && (!formData.usoCfdi || formData.usoCfdi === "")) {
      newErrors.usoCfdi = "El uso de CFDI es obligatorio para solicitudes de factura";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateEmpresaFiscal = () => {
    if (formData.tipo === "SOLICITUD_DE_FACTURA") {
      if (preloadedCotizacion && preloadedCotizacion.empresaData) {
        const requiredFields = ["domicilioFiscal", "rfc", "razonSocial", "regimenFiscal"];
        const hasAllFiscalData = requiredFields.every((field) => !!preloadedCotizacion.empresaData[field]);
        return hasAllFiscalData;
      }
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      if (!validateEmpresaFiscal()) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se puede generar la Solicitud de Factura porque la empresa no tiene completos los datos fiscales requeridos.",
        });
        return;
      }

      const cotizacionSeleccionada = cotizaciones.find((c) => c.id === parseInt(formData.cotizacion));
      let isrEstatal = 0;
      let isrFederal = 0;
      let total = parseFloat(formData.total) || 0;
      let subtotal = parseFloat(formData.subtotal) || 0;

      if (formData.tipo === "SOLICITUD_DE_FACTURA" &&
        (cotizacionSeleccionada?.empresaData?.regimenFiscal === "601" ||
          cotizacionSeleccionada?.empresaData?.regimenFiscal === "627")) {
        const domicilioFiscal = (cotizacionSeleccionada.empresaData.domicilioFiscal || "").toLowerCase();
        const hasGuanajuato = domicilioFiscal.includes("gto") || domicilioFiscal.includes("guanajuato") || domicilioFiscal.includes("Gto") || domicilioFiscal.includes("Guanajuato");
        const cpMatch = domicilioFiscal.match(/\b(36|37|38)\d{4}\b/);

        if (cpMatch || hasGuanajuato) {
          isrEstatal = subtotal * 0.02;
          isrFederal = subtotal * 0.0125;
        } else if (!cpMatch && !hasGuanajuato) {
          isrFederal = subtotal * 0.0125;
        }
        total = subtotal + parseFloat(formData.iva) - isrEstatal - isrFederal;
      }

      const cuentaPorCobrarData = cuentasPorCobrar.find((c) => c.id === formData.cuentaPorCobrar);
      const clienteId = cuentaPorCobrarData?.cliente?.id || null;

      const solicitudData = {
        cotizacion: { id: formData.cotizacion },
        fechaEmision: formData.fechaEmision,
        metodoPago: formData.metodoPago,
        formaPago: formData.formaPago,
        tipo: formData.tipo,
        claveProductoServicio: formData.claveProductoServicio,
        claveUnidad: formData.claveUnidad,
        emisor: { id: formData.emisor },
        cuentaPorCobrar: { id: formData.cuentaPorCobrar },
        cliente: { id: clienteId },
        subtotal: formData.subtotal,
        iva: formData.iva,
        isrEstatal: isrEstatal.toFixed(2),
        isrFederal: isrFederal.toFixed(2),
        total: total.toFixed(2),
        importeLetra: numeroALetras(total),
        usoCfdi: formData.usoCfdi,
      };

      try {
        const savedSolicitud = await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota`, {
          method: "POST",
          body: JSON.stringify(solicitudData),
          headers: { "Content-Type": "application/json" },
        });

        onSave(savedSolicitud);
        onClose();
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: "Solicitud creada correctamente",
        });
      } catch (error) {
        Swal.fire({ icon: "error", title: "Error", text: error.message });
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar Solicitud de Factura/Nota" : "Nueva Solicitud de Factura/Nota"}
      size="md"
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className="facturacion-form">
        <div className="facturacion-form-group">
          <label htmlFor="cotizacion">Cotización <span className="required"> *</span></label>
          <select
            id="cotizacion"
            value={formData.cotizacion}
            onChange={(e) => handleInputChange("cotizacion", e.target.value)}
            className="facturacion-form-control"
            disabled={!!preloadedCotizacion}
          >
            <option value="">Ninguna seleccionada</option>
            {cotizaciones.map((cotizacion) => (
              <option key={cotizacion.id} value={cotizacion.id}>{cotizacion.clienteNombre} - {cotizacion.id}</option>
            ))}
          </select>
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="metodoPago">Método de pago <span className="required"> *</span></label>
          <select
            id="metodoPago"
            value={formData.metodoPago}
            onChange={(e) => handleInputChange("metodoPago", e.target.value)}
            className={`facturacion-form-control ${errors.metodoPago ? "error" : ""}`}
          >
            <option value="">Seleccione un método</option>
            {metodosPago.map((metodo) => (
              <option key={metodo.value} value={metodo.value}>{metodo.label}</option>
            ))}
          </select>
          {errors.metodoPago && <span className="facturacion-error-message">{errors.metodoPago}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="formaPago">Forma de pago <span className="required"> *</span></label>
          <select
            id="formaPago"
            value={formData.formaPago}
            onChange={(e) => handleInputChange("formaPago", e.target.value)}
            className={`facturacion-form-control ${errors.formaPago ? "error" : ""}`}
          >
            <option value="">Seleccione una forma</option>
            {formasPago.map((forma) => (
              <option key={forma.value} value={forma.value}>{forma.label}</option>
            ))}
          </select>
          {errors.formaPago && <span className="facturacion-error-message">{errors.formaPago}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="tipo">Tipo <span className="required"> *</span></label>
          <select
            id="tipo"
            value={formData.tipo}
            onChange={(e) => handleInputChange("tipo", e.target.value)}
            className={`facturacion-form-control ${errors.tipo ? "error" : ""}`}
          >
            <option value="">Seleccione un tipo</option>
            {tipos.map((tipo) => {
              const empresaData = preloadedCotizacion?.empresaData || {};
              const requiredFields = ["domicilioFiscal", "rfc", "razonSocial", "regimenFiscal"];
              const hasAllFiscalData = requiredFields.every((field) => !!empresaData[field]);
              return (
                <option
                  key={tipo.value}
                  value={tipo.value}
                  disabled={!hasAllFiscalData && tipo.value === "SOLICITUD_DE_FACTURA"}
                >
                  {tipo.label}
                </option>
              );
            })}
          </select>
          {!preloadedCotizacion?.empresaData?.domicilioFiscal && (
            <small className="help-text">
              Debe completar los datos fiscales (domicilio fiscal, RFC, razón social, régimen fiscal) de la empresa para poder generar una solicitud de factura.
            </small>
          )}
          {errors.tipo && <span className="facturacion-error-message">{errors.tipo}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="claveProductoServicio">Clave Producto/Servicio <span className="required"> *</span></label>
          <select
            id="claveProductoServicio"
            value={formData.claveProductoServicio}
            onChange={(e) => handleInputChange("claveProductoServicio", e.target.value)}
            className={`facturacion-form-control ${errors.claveProductoServicio ? "error" : ""}`}
          >
            {clavesProductoServicio.map((clave) => (
              <option key={clave.value} value={clave.value}>{clave.label}</option>
            ))}
          </select>
          {errors.claveProductoServicio && <span className="facturacion-error-message">{errors.claveProductoServicio}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="claveUnidad">Clave Unidad <span className="required"> *</span></label>
          <select
            id="claveUnidad"
            value={formData.claveUnidad}
            onChange={(e) => handleInputChange("claveUnidad", e.target.value)}
            className={`facturacion-form-control ${errors.claveUnidad ? "error" : ""}`}
          >
            {clavesUnidad.map((clave) => (
              <option key={clave.value} value={clave.value}>{clave.label}</option>
            ))}
          </select>
          {errors.claveUnidad && <span className="facturacion-error-message">{errors.claveUnidad}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="emisor">Emisor <span className="required"> *</span></label>
          <select
            id="emisor"
            value={formData.emisor}
            onChange={(e) => handleInputChange("emisor", e.target.value)}
            className={`facturacion-form-control ${errors.emisor ? "error" : ""}`}
          >
            <option value="">Seleccione un emisor</option>
            {emisores.map((emisor) => (
              <option key={emisor.id} value={emisor.id}>{emisor.nombre}</option>
            ))}
          </select>
          {errors.emisor && <span className="facturacion-error-message">{errors.emisor}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="cuentaPorCobrar">Cuenta por Cobrar <span className="required"> *</span></label>
          <select
            id="cuentaPorCobrar"
            value={formData.cuentaPorCobrar}
            onChange={(e) => handleInputChange("cuentaPorCobrar", e.target.value)}
            className={`facturacion-form-control ${errors.cuentaPorCobrar ? "error" : ""}`}
            disabled={!!preloadedCuenta}
          >
            <option value="">Ninguna seleccionada</option>
            {cuentasPorCobrar.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>{cuenta.folio}</option>
            ))}
          </select>
          {errors.cuentaPorCobrar && <span className="facturacion-error-message">{errors.cuentaPorCobrar}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="usoCfdi">Uso de CFDI <span className="required"> *</span></label>
          <select
            id="usoCfdi"
            value={formData.usoCfdi}
            onChange={(e) => handleInputChange("usoCfdi", e.target.value)}
            className={`facturacion-form-control ${errors.usoCfdi ? "error" : ""}`}
            disabled={formData.tipo !== "SOLICITUD_DE_FACTURA"}
          >
            <option value="">Seleccione un uso</option>
            {usosCfdi.map((uso) => (
              <option key={uso.value} value={uso.value}>{uso.label}</option>
            ))}
          </select>
          {errors.usoCfdi && <span className="facturacion-error-message">{errors.usoCfdi}</span>}
        </div>
        <div className="facturacion-form-actions">
          <button type="button" onClick={onClose} className="facturacion-btn facturacion-btn-cancel">Cancelar</button>
          <button type="submit" className="facturacion-btn facturacion-btn-primary">
            {isEditing ? "Guardar cambios" : "Crear"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Modal para Editar Cuenta Por Cobrar
const EditarCuentaModal = ({ isOpen, onClose, onSave, cuenta }) => {
  const [formData, setFormData] = useState({
    fechaPago: "",
    cantidadCobrar: 0,
    conceptos: [],
  });
  const [showConceptoModal, setShowConceptoModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  useEffect(() => {
    if (isOpen && cuenta) {
      setFormData({
        fechaPago: cuenta.fechaPago || "",
        conceptos: Array.isArray(cuenta.conceptos) ? cuenta.conceptos : [],
        cantidadCobrar: cuenta.cantidadCobrar || 0,
      });
    }
  }, [isOpen, cuenta]);

  const handleRemoveConcepto = (index) => {
    const filtrados = formData.conceptos.filter((_, i) => i !== index);
    const nuevoTotal = filtrados.reduce((sum, c) => sum + (parseFloat(c.importeTotal) || 0), 0);
    setFormData({
      ...formData,
      conceptos: filtrados,
      cantidadCobrar: nuevoTotal
    });
  };

  const handleSaveConcepto = (conceptoData) => {
    const nuevosConceptos = [...formData.conceptos];
    if (editingIndex !== null) {
      nuevosConceptos[editingIndex] = conceptoData;
    } else {
      nuevosConceptos.push(conceptoData);
    }

    const nuevoTotal = nuevosConceptos.reduce((sum, c) => sum + (parseFloat(c.importeTotal) || 0), 0);

    setFormData({
      ...formData,
      conceptos: nuevosConceptos,
      cantidadCobrar: nuevoTotal
    });
    setShowConceptoModal(false);
    setEditingIndex(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.conceptos.length === 0) {
      Swal.fire("Error", "Debe tener al menos un concepto", "error");
      return;
    }
    onSave(formData);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Editar Conceptos de Cuenta" size="lg">
        <form onSubmit={handleSubmit} className="cuentascobrar-form">
          <div className="cuentascobrar-form-group">
            <label>Fecha de Vencimiento</label>
            <input
              type="date"
              value={formData.fechaPago}
              onChange={(e) => setFormData({ ...formData, fechaPago: e.target.value })}
              className="cuentascobrar-form-control"
            />
          </div>

          <div className="cuentascobrar-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Conceptos Facturables</label>
              <button
                type="button"
                onClick={() => { setEditingIndex(null); setShowConceptoModal(true); }}
                className="cotizaciones-btn cotizaciones-btn-primary"
                style={{ minWidth: 'auto', padding: '5px 15px', borderRadius: '4px' }}
              >
                + Agregar Concepto
              </button>
            </div>

            <div className="cotizaciones-conceptos-list" style={{ marginTop: '10px', border: 'none' }}>
              {formData.conceptos.map((c, index) => (
                <div key={index} className="cotizaciones-concepto-item" style={{ marginBottom: '10px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                  <div className="cotizaciones-concepto-info">
                    <div className="cotizaciones-concepto-row">
                      <span className="cotizaciones-concepto-label">Cantidad:</span>
                      <span>{c.cantidad}</span>
                    </div>
                    <div className="cotizaciones-concepto-row">
                      <span className="cotizaciones-concepto-label">Unidad:</span>
                      <span>{c.unidad}</span>
                    </div>
                    <div className="cotizaciones-concepto-row">
                      <span className="cotizaciones-concepto-label">Concepto:</span>
                      <span className="cotizaciones-concepto-text" title={c.concepto}>{c.concepto}</span>
                    </div>
                    <div className="cotizaciones-concepto-row">
                      <span className="cotizaciones-concepto-label">Precio:</span>
                      <span>${parseFloat(c.precioUnitario || 0).toFixed(2)}</span>
                    </div>
                    <div className="cotizaciones-concepto-row">
                      <span className="cotizaciones-concepto-label">Descuento:</span>
                      <span>{c.descuento || 0}%</span>
                    </div>
                    <div className="cotizaciones-concepto-row">
                      <span className="cotizaciones-concepto-label">Total:</span>
                      <span className="cotizaciones-concepto-total">${parseFloat(c.importeTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="cotizaciones-concepto-actions">
                    <button type="button" onClick={() => { setEditingIndex(index); setShowConceptoModal(true); }} className="cotizaciones-action-btn cotizaciones-edit-btn">
                      <img src={editIcon} alt="Editar" className="cotizaciones-action-icon" />
                    </button>
                    <button type="button" onClick={() => handleRemoveConcepto(index)} className="cotizaciones-action-btn cotizaciones-delete-btn">
                      <img src={deleteIcon} alt="Eliminar" className="cotizaciones-action-icon" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="cuentascobrar-form-group">
            <label>Total de la cuenta: <strong>${parseFloat(formData.cantidadCobrar).toFixed(2)}</strong></label>
          </div>

          <div className="cotizaciones-form-actions">
            <button
              type="button"
              onClick={onClose}
              className="cotizaciones-btn cotizaciones-btn-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="cotizaciones-btn cotizaciones-btn-primary"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </Modal>

      {showConceptoModal && (
        <NuevoConceptoModal
          isOpen={showConceptoModal}
          onClose={() => {
            setShowConceptoModal(false);
            setEditingIndex(null);
          }}
          onSave={handleSaveConcepto}
          concepto={editingIndex !== null ? formData.conceptos[editingIndex] : null}
        />
      )}
    </>
  );
};

// Modal para Ver Detalles de Cuenta Por Cobrar
const DetallesCuentaModal = ({ isOpen, onClose, cuenta, tratoNombre }) => {
  if (!cuenta) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles de la Cuenta por Cobrar" size="lg">
      <div className="cuentascobrar-detalles-container">

        <div className="detalle-header-grid">
          <div><strong>Folio:</strong> <span className="detalle-folio-text">{cuenta.folio}</span></div>
          <div><strong>ID Cotización:</strong> {cuenta.cotizacionId || "N/A"}</div>
          <div><strong>Cliente:</strong> {cuenta.clienteNombre}</div>
          <div>
            <strong>Estatus:</strong>
            <span className={`cuentascobrar-estatus-badge ${getEstatusClass(cuenta.estatus)}`}>
              {cuenta.estatus}
            </span>
          </div>
          <div><strong>Esquema:</strong> {cuenta.esquema}</div>
        </div>

        <h4 className="detalle-seccion-titulo">Conceptos de esta cuenta</h4>

        <div className="detalle-conceptos-lista">
          {cuenta.conceptos && cuenta.conceptos.map((c, index) => (
            <div key={index} className="detalle-concepto-card">
              <div className="detalle-concepto-main">
                <span className="detalle-concepto-badge">{c.cantidad} {c.unidad}</span>
                <span className="detalle-concepto-separador">|</span>
                {/* CORRECCIÓN: Usar c.concepto que es el nombre del campo en el objeto */}
                <span>{c.concepto}</span>
              </div>
              <div className="detalle-concepto-importe">
                {formatCurrency(c.importeTotal)}
              </div>
            </div>
          ))}
        </div>

        <div className="detalle-footer-total">
          <span className="detalle-total-label">Total a Cobrar:</span>
          <span className="detalle-total-monto">
            {formatCurrency(cuenta.cantidadCobrar)}
          </span>
        </div>
      </div>
    </Modal>
  );
};

const CustomDatePickerInput = ({ value, onClick, placeholder }) => (
  <div className="cuentascobrar-date-picker-wrapper">
    <input
      type="text"
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      readOnly
      className="cuentascobrar-date-picker"
    />
    <div className="cuentascobrar-date-picker-icons">
      <svg
        className="cuentascobrar-calendar-icon"
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

const CrearComisionDesdeCuentaModal = ({ isOpen, onClose, onSave, cuentaId, montoPagado }) => {
  const [formData, setFormData] = useState({
    vendedorCuentaId: "",
    vendedorNuevoNombre: "",
    porcentajeVenta: "",
    porcentajeProyecto: "",
    notas: ""
  });
  const [errors, setErrors] = useState({});
  const [cuentasComisiones, setCuentasComisiones] = useState([]);
  const [isCreatingNewVendedor, setIsCreatingNewVendedor] = useState(false);
  const [montoVentaCalculado, setMontoVentaCalculado] = useState(0);
  const [montoProyectoCalculado, setMontoProyectoCalculado] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchCuentasComisiones().then((cuentas) => {
        if (cuentas && Array.isArray(cuentas)) {
          const cuentaDagoberto = cuentas.find(c => c.nombre.includes("Dagoberto"));

          setFormData({
            vendedorCuentaId: "",
            vendedorNuevoNombre: "",
            porcentajeVenta: "",
            proyectoCuentaId: cuentaDagoberto ? cuentaDagoberto.id : "",
            porcentajeProyecto: "",
            notas: ""
          });
        }
      });
      setIsCreatingNewVendedor(false);
      setErrors({});
    }
  }, [isOpen]);

  const fetchCuentasComisiones = async () => {
    try {
      const data = await fetchWithToken(`${API_BASE_URL}/comisiones/cuentas-comisiones`);
      setCuentasComisiones(data);
      return data;
    } catch (error) {
      console.error("Error al cargar cuentas de comisiones:", error);
      return [];
    }
  };

  useEffect(() => {
    if (formData.porcentajeVenta && montoPagado) {
      const monto = (parseFloat(montoPagado) * parseFloat(formData.porcentajeVenta)) / 100;
      setMontoVentaCalculado(monto);
    } else {
      setMontoVentaCalculado(0);
    }
  }, [formData.porcentajeVenta, montoPagado]);

  useEffect(() => {
    if (formData.porcentajeProyecto && montoPagado) {
      const monto = (parseFloat(montoPagado) * parseFloat(formData.porcentajeProyecto)) / 100;
      setMontoProyectoCalculado(monto);
    } else {
      setMontoProyectoCalculado(0);
    }
  }, [formData.porcentajeProyecto, montoPagado]);

  const handleInputChange = (field, value) => {
    if (field === "porcentajeVenta" || field === "porcentajeProyecto") {
      if (parseFloat(value) > 100) {
        return;
      }
    }

    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!isCreatingNewVendedor && !formData.vendedorCuentaId) {
      newErrors.vendedorCuentaId = "Seleccione vendedor";
    }

    if (isCreatingNewVendedor && !formData.vendedorNuevoNombre.trim()) {
      newErrors.vendedorNuevoNombre = "Ingrese nombre";
    }

    if (!formData.porcentajeVenta || parseFloat(formData.porcentajeVenta) < 0 || parseFloat(formData.porcentajeVenta) > 100) {
      newErrors.porcentajeVenta = "Inválido";
    }

    if (!formData.porcentajeProyecto || parseFloat(formData.porcentajeProyecto) < 0 || parseFloat(formData.porcentajeProyecto) > 100) {
      newErrors.porcentajeProyecto = "Inválido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const dataToSend = {
        vendedorCuentaId: isCreatingNewVendedor ? null : parseInt(formData.vendedorCuentaId),
        vendedorNuevoNombre: isCreatingNewVendedor ? formData.vendedorNuevoNombre : null,
        porcentajeVenta: parseFloat(formData.porcentajeVenta),
        porcentajeProyecto: parseFloat(formData.porcentajeProyecto),
        notas: formData.notas
      };
      if (!cuentaId) {
        Swal.fire({ icon: "error", title: "Error", text: "No se identificó la cuenta" });
        return;
      }
      onSave(dataToSend);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear Comisión"
      size="md"
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className="cuentascobrar-form" style={{ gap: '15px' }}>

        <div className="cuentascobrar-info-section cuentascobrar-info-compact">
          <div className="cuentascobrar-info-item" style={{ marginBottom: 0, alignItems: 'center' }}>
            <label style={{ marginBottom: 0 }}>Monto Base (Pagado):</label>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#00133b' }}>
              ${parseFloat(montoPagado).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="cuentascobrar-form-group" style={{ gap: '5px' }}>
          <label>
            <input
              type="checkbox"
              checked={isCreatingNewVendedor}
              onChange={(e) => {
                setIsCreatingNewVendedor(e.target.checked);
                setFormData(prev => ({ ...prev, vendedorCuentaId: "", vendedorNuevoNombre: "" }));
              }}
            />
            {' '}Crear nuevo vendedor
          </label>
        </div>

        {!isCreatingNewVendedor ? (
          <div className="cuentascobrar-form-group">
            <label htmlFor="vendedorCuentaId">Vendedor <span className="required">*</span></label>
            <select
              id="vendedorCuentaId"
              value={formData.vendedorCuentaId}
              onChange={(e) => handleInputChange("vendedorCuentaId", e.target.value)}
              className={`cuentascobrar-form-control ${errors.vendedorCuentaId ? "error" : ""}`}
            >
              <option value="">Seleccione un vendedor</option>
              {cuentasComisiones.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
              ))}
            </select>
            {errors.vendedorCuentaId && <span className="cuentascobrar-error-message">{errors.vendedorCuentaId}</span>}
          </div>
        ) : (
          <div className="cuentascobrar-form-group">
            <label htmlFor="vendedorNuevoNombre">Nombre del vendedor <span className="required">*</span></label>
            <input
              type="text"
              id="vendedorNuevoNombre"
              value={formData.vendedorNuevoNombre}
              onChange={(e) => handleInputChange("vendedorNuevoNombre", e.target.value)}
              className={`cuentascobrar-form-control ${errors.vendedorNuevoNombre ? "error" : ""}`}
              placeholder="Ingrese el nombre"
            />
            {errors.vendedorNuevoNombre && <span className="cuentascobrar-error-message">{errors.vendedorNuevoNombre}</span>}
          </div>
        )}

        <div className="cuentascobrar-form-row">
          <div className="cuentascobrar-form-group" style={{ flex: 1 }}>
            <label htmlFor="porcentajeVenta">Comisión Venta (%) <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                id="porcentajeVenta"
                step="0.01"
                min="0"
                max="100"
                value={formData.porcentajeVenta}
                onChange={(e) => handleInputChange("porcentajeVenta", e.target.value)}
                className={`cuentascobrar-form-control ${errors.porcentajeVenta ? "error" : ""}`}
                placeholder="0"
              />
              <span style={{ position: 'absolute', right: '10px', top: '8px', color: '#999' }}>%</span>
            </div>
            {errors.porcentajeVenta && <span className="cuentascobrar-error-message">{errors.porcentajeVenta}</span>}
          </div>

          <div className="cuentascobrar-form-group" style={{ flex: 1 }}>
            <label>Monto Calculado</label>
            <div className="cuentascobrar-input-with-prefix">
              <span className="cuentascobrar-prefix">$</span>
              <input
                type="text"
                value={montoVentaCalculado.toFixed(2)}
                className="cuentascobrar-form-control"
                disabled
                style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}
              />
            </div>
          </div>
        </div>

        <div className="cuentascobrar-form-group">
          <label>Comisión de Proyecto (Automático)</label>
          <input
            type="text"
            value="Dagoberto Emmanuel Nieto González"
            disabled
            className="cuentascobrar-form-control"
            style={{ backgroundColor: '#f0f0f0', color: '#666', fontSize: '0.85rem' }}
          />
        </div>

        <div className="cuentascobrar-form-row">
          <div className="cuentascobrar-form-group" style={{ flex: 1 }}>
            <label htmlFor="porcentajeProyecto">Comisión Proy. (%) <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                id="porcentajeProyecto"
                step="0.01"
                min="0"
                max="100"
                value={formData.porcentajeProyecto}
                onChange={(e) => handleInputChange("porcentajeProyecto", e.target.value)}
                className={`cuentascobrar-form-control ${errors.porcentajeProyecto ? "error" : ""}`}
                placeholder="0"
              />
              <span style={{ position: 'absolute', right: '10px', top: '8px', color: '#999' }}>%</span>
            </div>
            {errors.porcentajeProyecto && <span className="cuentascobrar-error-message">{errors.porcentajeProyecto}</span>}
          </div>

          <div className="cuentascobrar-form-group" style={{ flex: 1 }}>
            <label>Monto Calculado</label>
            <div className="cuentascobrar-input-with-prefix">
              <span className="cuentascobrar-prefix">$</span>
              <input
                type="text"
                value={montoProyectoCalculado.toFixed(2)}
                className="cuentascobrar-form-control"
                disabled
                style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}
              />
            </div>
          </div>
        </div>

        <div className="cuentascobrar-form-group">
          <label htmlFor="notas">Notas</label>
          <textarea
            id="notas"
            value={formData.notas}
            onChange={(e) => handleInputChange("notas", e.target.value)}
            className="cuentascobrar-form-control"
            rows="2"
            placeholder="Opcional"
          ></textarea>
        </div>

        <div className="cuentascobrar-form-actions" style={{ marginTop: '10px' }}>
          <button type="button" onClick={onClose} className="cuentascobrar-btn cuentascobrar-btn-cancel">
            Cancelar
          </button>
          <button type="submit" className="cuentascobrar-btn cuentascobrar-btn-primary">
            Crear Comisión
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Componente Principal
const AdminCuentasCobrar = () => {
  const navigate = useNavigate();
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { balance: true, transacciones: true, cotizaciones: true, facturacion: true, cxc: true, cxp: true, comisiones: true };
  const location = useLocation();
  const userRol = localStorage.getItem("userRol")
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
  const [filtroFolio, setFiltroFolio] = useState("");
  const [clientes, setClientes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [emisores, setEmisores] = useState([]);
  const [cuentasVinculadas, setCuentasVinculadas] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [filtroEstatus, setFiltroEstatus] = useState("PENDIENTE");
  const [categoriasIngreso, setCategoriasIngreso] = useState([]);
  const [ordenFecha, setOrdenFecha] = useState('asc');
  const [rangoFechas, setRangoFechas] = useState([null, null]);
  const [fechaInicio, fechaFin] = rangoFechas;
  const [filtroCliente, setFiltroCliente] = useState("");

  const [modals, setModals] = useState({
    crearCuentas: { isOpen: false },
    editarCuenta: { isOpen: false, cuenta: null },
    comprobante: { isOpen: false, cuenta: null },
    confirmarEliminacion: { isOpen: false, cuenta: null },
    crearSolicitud: { isOpen: false, cotizacion: null, cuenta: null },
    detalles: { isOpen: false, cuenta: null },
  });
  const [modalComision, setModalComision] = useState({
    isOpen: false,
    cuentaId: null,
    montoPagado: 0,
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = filtroEstatus !== "Todas" ? `?estatus=${filtroEstatus}` : "";

        const [clientesData, cuentasData, categoriasIngresoData] = await Promise.all([
          fetchWithToken(`${API_BASE_URL}/empresas?estatus=CLIENTE`),
          fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar${params}`),
          fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar/categorias-ingreso`),
        ]);

        let emisoresData = [];
        if (modulosActivos.facturacion) {
          try {
            emisoresData = await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/emisores`);
          } catch (e) {
            console.warn("Módulo de facturación inactivo o sin emisores");
          }
        }

        setClientes(clientesData);
        setCuentasPorCobrar(cuentasData);
        setEmisores(emisoresData);
        setCategoriasIngreso(categoriasIngresoData);

        const vinculacionesData = await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar/vinculaciones`);
        const cuentasVinculadasIds = new Set(vinculacionesData.idsVinculadas);
        setCuentasVinculadas(cuentasVinculadasIds);

      } catch (error) {
        Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los datos" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [filtroEstatus]);

  useEffect(() => {
    if (location.state && location.state.filtroFolio) {
      setFiltroFolio(location.state.filtroFolio);
      setFiltroEstatus("Todas");
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  /* 
  useEffect(() => {
    const actualizarEstatus = () => {
      const hoy = new Date();
      setCuentasPorCobrar((prev) =>
        prev.map((cuenta) => {
          if (cuenta.estatus === "PAGADO") return cuenta;

          const fechaPago = new Date(cuenta.fechaPago);
          const diasDiferencia = Math.floor((hoy - fechaPago) / (1000 * 60 * 60 * 24));

          let nuevoEstatus = "PENDIENTE";
          if (diasDiferencia > 15) { 
            nuevoEstatus = "VENCIDA";
          }

          return { ...cuenta, estatus: nuevoEstatus };
        })
      );
    };

    actualizarEstatus();
    const interval = setInterval(actualizarEstatus, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
*/

  const openModal = async (modalType, data = {}) => {
    if (modalType === "crearSolicitud" && data.cuenta) {
      try {
        Swal.showLoading();
        const cotizacionData = await fetchWithToken(`${API_BASE_URL}/cotizaciones/${data.cuenta.cotizacionId}`);
        Swal.close();

        setModals((prev) => ({
          ...prev,
          [modalType]: {
            isOpen: true,
            cotizacion: cotizacionData,
            cuenta: data.cuenta,
          },
        }));
      } catch (error) {
        Swal.fire("Error", "No se pudo cargar la información de la cotización", "error");
      }
    } else {
      setModals((prev) => ({
        ...prev,
        [modalType]: { isOpen: true, ...data },
      }));
    }
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

  const limpiarFiltroFechas = () => {
    setRangoFechas([null, null]);
  };

  const clientesUnicos = [...new Set(cuentasPorCobrar.map(c => c.clienteNombre || c.cliente?.razonSocial))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  const handleMarcarPagada = async (responseData, montoPagado, cuentaId) => {
    const updatedCuenta = responseData.cuenta;

    setCuentasPorCobrar((prev) =>
      prev.map((c) => (c.id === updatedCuenta.id ? { ...c, ...updatedCuenta } : c))
    );

    if (responseData.mostrarModalComision && modulosActivos.comisiones) {
      setModalComision({
        isOpen: true,
        cuentaId: cuentaId,
        montoPagado: montoPagado,
      });
    } else {
      Swal.fire({
        icon: "success",
        title: "Éxito",
        text: "Cuenta marcada como pagada correctamente",
      });
    }
  };

  const handleDeleteCuenta = async (cuenta) => {
    try {
      const data = await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar/${cuenta.id}/check-vinculada`);
      if (data.vinculada) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se puede eliminar la cuenta por cobrar porque está vinculada a una solicitud de factura o nota.",
        });
        return;
      }
      openModal("confirmarEliminacion", { cuenta });
    } catch (error) {
      console.error("Error verifying vinculation:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo verificar la vinculación de la cuenta por cobrar.",
      });
    }
  };

  const handleCheckMarcarCompletada = async (cuenta) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar/${cuenta.id}/check-vinculada`);
      if (!response.vinculada) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "La cuenta por cobrar no está vinculada a una solicitud de factura. No se puede marcar como completada.",
        });
        return;
      }
      openModal("comprobante", { cuenta });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo verificar la vinculación: " + error.message,
      });
    }
  };

  const handleVerDetalles = async (cuenta) => {
    try {
      Swal.showLoading();

      let cotizacionData = {};
      let tratoNombre = null;

      if (modulosActivos.cotizaciones && cuenta.cotizacionId) {
        cotizacionData = await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cuenta.cotizacionId}`);

        if (modulosActivos.tratos && cotizacionData.tratoId) {
          try {
            const tratoResponse = await fetchWithToken(`${API_BASE_URL}/tratos/${cotizacionData.tratoId}`);
            tratoNombre = tratoResponse.nombre;
          } catch (error) {
            console.warn("No se pudo cargar el trato:", error);
          }
        }
      }

      Swal.close();

      setModals((prev) => ({
        ...prev,
        detalles: {
          isOpen: true,
          cuenta: cuenta,
          cotizacion: cotizacionData,
          tratoNombre: tratoNombre,
        },
      }));
    } catch (error) {
      Swal.close();
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo cargar la información: " + error.message });
    }
  };

  const handleDescargarComprobante = async (cuenta) => {
    if (!cuenta.id) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se encontró el ID de la cuenta por cobrar.",
      });
      return;
    }

    if (!cuenta.comprobantePagoUrl) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se encontró un comprobante de pago asociado a esta cuenta.",
      });
      return;
    }

    // Verificar si hay errores en la subida del comprobante
    if (cuenta.comprobantePagoUrl === "ERROR_UPLOAD") {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "El comprobante de pago no se pudo subir correctamente. Intente subirlo nuevamente.",
      });
      return;
    }

    if (cuenta.comprobantePagoUrl === "UPLOADING") {
      Swal.fire({
        icon: "warning",
        title: "En proceso",
        text: "El comprobante de pago está siendo procesado. Intente más tarde.",
      });
      return;
    }

    try {
      const response = await fetchFileWithToken(`${API_BASE_URL}/cuentas-por-cobrar/${cuenta.id}/download-comprobante`, {
        method: "GET",
      });

      if (!response.ok) throw new Error(`Error al descargar el archivo: ${response.statusText}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cuenta.comprobantePagoUrl.split("/").pop() || "comprobante_pago.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Descarga Completada",
        text: "El comprobante de pago se ha descargado correctamente.",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `No se pudo descargar el comprobante: ${error.message}`,
      });
    }
  };

  const cuentasFiltradas = cuentasPorCobrar.filter((cuenta) => {
    if (filtroFolio) {
      return cuenta.folio === filtroFolio;
    }
    const pasaFiltroEstatus = filtroEstatus === "Todas" || cuenta.estatus === filtroEstatus;

    const nombreCliente = cuenta.clienteNombre || cuenta.cliente?.razonSocial;
    const pasaFiltroCliente = filtroCliente === "" || nombreCliente === filtroCliente;

    let pasaFiltroFechas = true;
    if (fechaInicio || fechaFin) {
      const fechaCuenta = new Date(cuenta.fechaPago + 'T00:00:00');

      let inicio = fechaInicio ? new Date(fechaInicio) : null;
      let fin = fechaFin ? new Date(fechaFin) : null;

      // Normalizar fechas
      if (inicio) {
        inicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
      }
      if (fin) {
        fin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59);
      }

      pasaFiltroFechas = (!inicio || fechaCuenta >= inicio) && (!fin || fechaCuenta <= fin);
    }

    return pasaFiltroEstatus && pasaFiltroCliente && pasaFiltroFechas;
  });

  const cuentasOrdenadas = cuentasFiltradas.sort((a, b) => {
    const fechaA = new Date(a.fechaPago);
    const fechaB = new Date(b.fechaPago);

    if (ordenFecha === 'asc') {
      return fechaA - fechaB;
    } else {
      return fechaB - fechaA;
    }
  });

  const toggleOrdenFecha = () => {
    setOrdenFecha(prevOrden => prevOrden === 'asc' ? 'desc' : 'asc');
  };

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="cuentascobrar-loading">
            <div className="spinner"></div>
            <p>Cargando datos de cuentas por cobrar...</p>
          </div>
        )}
        <main className="cuentascobrar-main-content">
          <div className="cuentascobrar-container">
            <section className="cuentascobrar-sidebar">
              <div className="cuentascobrar-sidebar-header">
                <h3 className="cuentascobrar-sidebar-title">Administración</h3>
              </div>
              <div className="cuentascobrar-sidebar-menu">
                {userRol === "ADMINISTRADOR" && modulosActivos.balance && (
                  <div className="cuentascobrar-menu-item" onClick={() => handleMenuNavigation("balance")}>
                    Balance
                  </div>
                )}
                {modulosActivos.transacciones && (
                  <div className="cuentascobrar-menu-item" onClick={() => handleMenuNavigation("transacciones")}>
                    Transacciones
                  </div>
                )}
                {modulosActivos.cotizaciones && (
                  <div className="cuentascobrar-menu-item" onClick={() => handleMenuNavigation("cotizaciones")}>
                    Cotizaciones
                  </div>
                )}
                {modulosActivos.facturacion && (
                  <div className="cuentascobrar-menu-item" onClick={() => handleMenuNavigation("facturacion")}>
                    Facturas/Notas
                  </div>
                )}
                {modulosActivos.cxc && (
                  <div className="cuentascobrar-menu-item cuentascobrar-menu-item-active" onClick={() => handleMenuNavigation("cuentas-cobrar")}>
                    Cuentas por Cobrar
                  </div>
                )}
                {modulosActivos.cxp && (
                  <div className="cuentascobrar-menu-item" onClick={() => handleMenuNavigation("cuentas-pagar")}>
                    Cuentas por Pagar
                  </div>
                )}
                {modulosActivos.transacciones && (
                  <div className="cuentascobrar-menu-item" onClick={() => handleMenuNavigation("caja-chica")}>
                    Caja chica
                  </div>
                )}
                {modulosActivos.comisiones && (
                  <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("comisiones")}>
                    Comisiones
                  </div>
                )}
              </div>
            </section>

            <section className="cuentascobrar-content-panel">
              <div className="cuentascobrar-header">
                <div className="cuentascobrar-header-info">
                  <h3 className="cuentascobrar-page-title">Cuentas por Cobrar</h3>
                  <p className="cuentascobrar-subtitle">Gestión de cobros pendientes</p>
                </div>
              </div>

              <div className="cuentascobrar-table-card">
                <div className="cuentascobrar-table-header">
                  <h4 className="cuentascobrar-table-title">Cuentas por cobrar</h4>
                  <div className="cuentascobrar-filters-container">

                    {filtroFolio && (
                      <div className="cuentascobrar-filter-container">
                        <div style={{ height: '21px' }}></div>
                        <button
                          className="cuentascobrar-btn cuentascobrar-btn-cancel"
                          onClick={() => { setFiltroFolio(""); setFiltroEstatus("PENDIENTE"); }}
                          style={{ backgroundColor: '#6c757d', color: 'white' }}
                        >
                          Ver lista completa (Filtro: {filtroFolio}) ✕
                        </button>
                      </div>
                    )}

                    <div className="cuentascobrar-filter-container">
                      <div style={{ height: '21px' }}></div>
                      <button
                        className="cuentascobrar-btn-orden"
                        onClick={toggleOrdenFecha}
                        title={`Cambiar a orden ${ordenFecha === 'asc' ? 'descendente' : 'ascendente'}`}
                      >
                        {ordenFecha === 'asc' ? '📅 ↑ Antiguas primero' : '📅 ↓ Recientes primero'}
                      </button>
                    </div>

                    <div className="cuentascobrar-filter-container">
                      <label htmlFor="filtroCliente">Filtrar por cliente:</label>
                      <select
                        id="filtroCliente"
                        value={filtroCliente}
                        onChange={(e) => setFiltroCliente(e.target.value)}
                        className="cuentascobrar-filter-select"
                      >
                        <option value="">Todos los clientes</option>
                        {clientesUnicos.map((nombre, index) => (
                          <option key={index} value={nombre}>
                            {nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="cuentascobrar-filter-container">
                      <label htmlFor="filtroEstatus">Filtrar por estatus:</label>
                      <select
                        id="filtroEstatus"
                        value={filtroEstatus}
                        onChange={(e) => setFiltroEstatus(e.target.value)}
                        className="cuentascobrar-filter-select"
                      >
                        <option value="Todas">Todas</option>
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="VENCIDA">Vencida</option>
                        <option value="EN_PROCESO">En Proceso</option>
                        <option value="PAGADO">Pagado</option>
                      </select>
                    </div>

                    <div className="cuentascobrar-filter-container cuentascobrar-date-filter">
                      <label>Filtrar por fecha de pago:</label>
                      <div className="cuentascobrar-date-picker-container">
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

                <div className="cuentascobrar-table-container">
                  <table className="cuentascobrar-table">
                    <thead className="cuentascobrar-table-header-fixed">
                      <tr>
                        <th>Folio</th>
                        <th>Fecha de Pago</th>
                        <th>Cliente</th>
                        <th>Estatus</th>
                        <th>Esquema</th>
                        <th>Monto neto</th>
                        <th>Concepto/s</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentasOrdenadas.length > 0 ? (
                        cuentasOrdenadas.map((cuenta) => (
                          <tr key={cuenta.id}>
                            <td>{cuenta.folio}</td>
                            <td>{cuenta.fechaPago}</td>
                            <td>{cuenta.clienteNombre || cuenta.cliente}</td>
                            <td>
                              <span className={`cuentascobrar-estatus-badge ${getEstatusClass(cuenta.estatus)}`}>
                                {cuenta.estatus}
                              </span>
                            </td>
                            <td>{cuenta.esquema}</td>
                            <td>
                              <div className="cuentascobrar-monto-info">
                                <div>{formatCurrency(cuenta.cantidadCobrar)}</div>
                                {cuenta.montoPagado > 0 && (
                                  <div className="cuentascobrar-monto-detalle">
                                    <small>Pagado: {formatCurrency(cuenta.montoPagado)}</small>
                                    <small>Pendiente: {formatCurrency(cuenta.saldoPendiente)}</small>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="cuentascobrar-concepto-cell">
                              {cuenta.conceptos && cuenta.conceptos.length > 0 ? (
                                cuenta.conceptos.length > 1
                                  ? `${cuenta.conceptos.length} conceptos`
                                  : cuenta.conceptos[0].concepto.length > 50
                                    ? cuenta.conceptos[0].concepto.substring(0, 50) + "..."
                                    : cuenta.conceptos[0].concepto
                              ) : (
                                "Sin conceptos"
                              )}
                            </td>
                            <td>
                              <div className="cuentascobrar-actions">
                                <button
                                  className="cuentascobrar-action-btn cuentascobrar-details-btn"
                                  onClick={() => handleVerDetalles(cuenta)}
                                  title="Ver detalles"
                                >
                                  <img
                                    src={detailsIcon}
                                    alt="Detalles"
                                    className="cuentascobrar-action-icon"
                                  />
                                </button>
                                <button
                                  className="cuentascobrar-action-btn cuentascobrar-delete-btn"
                                  onClick={() => handleDeleteCuenta(cuenta)}
                                  title="Eliminar"
                                >
                                  <img
                                    src={deleteIcon || "/placeholder.svg"}
                                    alt="Eliminar"
                                    className="cuentascobrar-action-icon"
                                  />
                                </button>
                                {cuenta.estatus !== "PAGADO" && (
                                  <button
                                    className="cuentascobrar-action-btn cuentascobrar-edit-btn"
                                    onClick={() => openModal("editarCuenta", { cuenta })}
                                    title="Editar cuenta"
                                  >
                                    <img
                                      src={editIcon}
                                      alt="Editar"
                                      className="cuentascobrar-action-icon"
                                    />
                                  </button>
                                )}
                                {cuenta.estatus !== "PAGADO" && (
                                  <button
                                    className="cuentascobrar-action-btn cuentascobrar-check-btn"
                                    onClick={() => handleCheckMarcarCompletada(cuenta)}
                                    title="Marcar como completado"
                                  >
                                    <img
                                      src={checkIcon || "/placeholder.svg"}
                                      alt="Completar"
                                      className="cuentascobrar-action-icon"
                                    />
                                  </button>
                                )}
                                {cuenta.estatus === "PAGADO" &&
                                  cuenta.comprobantePagoUrl &&
                                  cuenta.comprobantePagoUrl !== "ERROR_UPLOAD" &&
                                  cuenta.comprobantePagoUrl !== "UPLOADING" && (
                                    <button
                                      className="cuentascobrar-action-btn cuentascobrar-download-btn"
                                      onClick={() => handleDescargarComprobante(cuenta)}
                                      title="Descargar comprobante de pago"
                                    >
                                      <img
                                        src={downloadIcon || "/placeholder.svg"}
                                        alt="Descargar"
                                        className="cuentascobrar-action-icon"
                                      />
                                    </button>
                                  )}
                                {modulosActivos.facturacion && (
                                  <button
                                    className={`cuentascobrar-action-btn cuentascobrar-download-btn ${cuentasVinculadas.has(cuenta.id)
                                      ? 'cuentascobrar-request-btn-vinculada'
                                      : 'cuentascobrar-request-btn-disponible'
                                      }`}
                                    onClick={async () => {
                                      if (cuentasVinculadas.has(cuenta.id)) {
                                        Swal.fire({
                                          icon: "warning",
                                          title: "Alerta",
                                          text: "Ya se generó su solicitud de factura/nota",
                                        });
                                      } else {
                                        openModal("crearSolicitud", { cuenta: cuenta });
                                      }
                                    }}
                                    title={
                                      cuentasVinculadas.has(cuenta.id)
                                        ? "Solicitud ya generada"
                                        : "Generar Solicitud de Factura o Nota"
                                    }
                                  >
                                    <img
                                      src={requestIcon || "/placeholder.svg"}
                                      alt="Emitir"
                                      className="cuentascobrar-action-icon"
                                    />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="cuentascobrar-no-data">
                            {filtroEstatus === "Todas"
                              ? "No hay cuentas por cobrar registradas"
                              : `No hay cuentas por cobrar con estatus "${filtroEstatus}"`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <SolicitudModal
            isOpen={modals.crearSolicitud.isOpen}
            onClose={() => closeModal("crearSolicitud")}
            onSave={(savedSolicitud) => {
              setSolicitudes((prev) => [...prev, savedSolicitud]);
              const cuentaId = modals.crearSolicitud.cuenta?.id;
              if (cuentaId) {
                setCuentasVinculadas(prev => new Set([...prev, cuentaId]));
              }
              Swal.fire({
                icon: "success",
                title: "Éxito",
                text: "Solicitud creada correctamente",
              });
              closeModal("crearSolicitud");
            }}
            cotizaciones={modals.crearSolicitud.cotizacion ? [modals.crearSolicitud.cotizacion] : []}
            cuentasPorCobrar={cuentasPorCobrar}
            emisores={emisores}
            preloadedCotizacion={modals.crearSolicitud.cotizacion}
            preloadedCuenta={modals.crearSolicitud.cuenta}
          />

          <ComprobanteModal
            isOpen={modals.comprobante.isOpen}
            onClose={() => closeModal("comprobante")}
            onSave={handleMarcarPagada}
            cuenta={modals.comprobante.cuenta}
          />

          <EditarCuentaModal
            isOpen={modals.editarCuenta.isOpen}
            onClose={() => closeModal("editarCuenta")}
            onSave={async (updatedData) => {
              try {
                const payload = {
                  ...updatedData,
                  cantidadCobrar: parseFloat(updatedData.cantidadCobrar),
                  conceptos: updatedData.conceptos.map(c => ({
                    ...c,
                    cantidad: parseInt(c.cantidad),
                    precioUnitario: parseFloat(c.precioUnitario),
                    importeTotal: parseFloat(c.importeTotal),
                    descuento: parseFloat(c.descuento || 0)
                  }))
                };

                const response = await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar/${modals.editarCuenta.cuenta.id}`, {
                  method: "PUT",
                  body: JSON.stringify(payload),
                });

                setCuentasPorCobrar(prev =>
                  prev.map(c => c.id === modals.editarCuenta.cuenta.id ? response : c)
                );

                closeModal("editarCuenta");
                Swal.fire("Éxito", "Cuenta y conceptos actualizados", "success");
              } catch (error) {
                Swal.fire("Error", error.message, "error");
              }
            }}
            cuenta={modals.editarCuenta.cuenta}
          />

          <ConfirmarEliminacionModal
            isOpen={modals.confirmarEliminacion.isOpen}
            onClose={() => closeModal("confirmarEliminacion")}
            onConfirm={(cuentaId) => {
              setCuentasPorCobrar((prev) => prev.filter((c) => c.id !== cuentaId));
              closeModal("confirmarEliminacion");
            }}
            cuenta={modals.confirmarEliminacion.cuenta}
          />

          <DetallesCuentaModal
            isOpen={modals.detalles.isOpen}
            onClose={() => closeModal("detalles")}
            cuenta={modals.detalles.cuenta}
            cotizacion={modals.detalles.cotizacion}
            tratoNombre={modals.detalles.tratoNombre}
          />

          {modalComision.isOpen && modalComision.cuentaId && (
            <CrearComisionDesdeCuentaModal
              isOpen={modalComision.isOpen}
              onClose={async () => {
                setModalComision({ isOpen: false, cuentaId: null, montoPagado: 0 });

                const params = filtroEstatus !== "Todas" ? `?estatus=${filtroEstatus}` : "";
                const cuentasActualizadas = await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar${params}`);
                setCuentasPorCobrar(cuentasActualizadas);

                Swal.fire({
                  icon: "success",
                  title: "Éxito",
                  text: "Cuenta marcada como pagada correctamente",
                });
              }}
              onSave={async (comisionData) => {
                try {
                  console.log("Creando comisión para cuenta ID:", modalComision.cuentaId);

                  await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar/${modalComision.cuentaId}/crear-comision`, {
                    method: "POST",
                    body: JSON.stringify(comisionData),
                    headers: { "Content-Type": "application/json" },
                  });

                  setModalComision({ isOpen: false, cuentaId: null, montoPagado: 0 });
                  const params = filtroEstatus !== "Todas" ? `?estatus=${filtroEstatus}` : "";
                  const cuentasActualizadas = await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar${params}`);
                  setCuentasPorCobrar(cuentasActualizadas);

                  Swal.fire({
                    icon: "success",
                    title: "Éxito",
                    text: "Cuenta marcada como pagada y comisión creada correctamente",
                  });
                } catch (error) {
                  Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: "Error al crear la comisión: " + error.message,
                  });
                }
              }}
              cuentaId={modalComision.cuentaId}
              montoPagado={modalComision.montoPagado}
            />
          )}
        </main>
      </div>
    </>
  );
};

export default AdminCuentasCobrar