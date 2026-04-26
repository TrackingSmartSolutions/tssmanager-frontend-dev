import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Admin_Cotizaciones.css"
import Header from "../Header/Header"
import Swal from "sweetalert2"
import deleteIcon from "../../assets/icons/eliminar.png"
import addIcon from "../../assets/icons/agregar.png"
import editIcon from "../../assets/icons/editar.png"
import downloadIcon from "../../assets/icons/descarga.png"
import receivableIcon from "../../assets/icons/cuenta-cobrar.png"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { API_BASE_URL } from "../Config/Config";


const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token")
  const isFormData = options.body instanceof FormData

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  }

  const response = await fetch(url, { ...options, headers })
  if (!response.ok) throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`)
  return response
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

// Componente Modal Base
const Modal = ({ isOpen, onClose, title, children, size = "md", closeOnOverlayClick = true }) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050
  };

  let widthStyle = '500px';
  let maxWidthStyle = '95%';

  if (size === 'lg') widthStyle = '800px';
  else if (size === 'xl') widthStyle = '950px';

  const contentStyle = {
    backgroundColor: 'white', borderRadius: '8px', padding: '20px',
    maxHeight: '95vh', overflowY: 'auto', width: widthStyle, maxWidth: maxWidthStyle,
    position: 'relative', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
  };

  return (
    <div style={overlayStyle} onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '10px', borderBottom: '1px solid #dee2e6', paddingBottom: '10px'
        }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6c757d', padding: '0 5px'
          }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Modal de Vista Previa
const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, onDownload }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vista previa" size="xl" closeOnOverlayClick={false}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button
            type="button"
            onClick={onDownload}
            className="cotizaciones-btn cotizaciones-btn-primary" // Corregí la clase para que coincida con el módulo
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#c73232',
              borderColor: '#c73232',
              color: '#ffffff'
            }}
          >
            Descargar PDF
          </button>
        </div>

        <div style={{
          border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden',
          height: '75vh'
        }}>
          <iframe
            src={`${pdfUrl}#view=FitH&navpanes=0&toolbar=0`}
            title="Vista Previa"
            width="100%" height="100%" style={{ border: 'none' }}
          />
        </div>
      </div>
    </Modal>
  );
};

// Modal para Nuevo Concepto
const NuevoConceptoModal = ({ isOpen, onClose, onSave, concepto }) => {
  const [formData, setFormData] = useState({
    cantidad: "",
    unidad: "Servicios",
    concepto: "",
    precioUnitario: "",
    descuento: "0",
  });
  const [errors, setErrors] = useState({});

  const conceptosPredefinidos = [
    "Servicio de instalación profesional y venta de equipos de localización antenas GPS/GPRS",
    "Servicio anual de localización de equipos GPS y plataforma de monitoreo web y móvil para 1 usuario con frecuencia de auto-reporte cada 1 minuto",
    "Servicio de instalación profesional y venta de equipos Dashcam con localización antenas GPS/GPRS botón de pánico, apagado de motor (incluye botón de pánico y relevadores para apagado)",
    "Servicio mensual de localización de 1 equipo GPS servicio de datos y plataforma de monitoreo web y móvil correspondiente al mes de",
  ];

  useEffect(() => {
    if (isOpen) {
      if (concepto) {
        setFormData({
          cantidad: concepto.cantidad?.toString() || "1",
          unidad: concepto.unidad || "Servicios",
          concepto: concepto.concepto || "",
          precioUnitario: concepto.precioUnitario?.toString() || "0",
          descuento: concepto.descuento?.toString() || "0",
        });
      } else {
        setFormData({
          cantidad: "",
          unidad: "Servicios",
          concepto: "",
          precioUnitario: "",
          descuento: "0",
        });
      }
      setErrors({});
    }
  }, [isOpen, concepto]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.cantidad || Number.parseFloat(formData.cantidad) <= 0) {
      newErrors.cantidad = "La cantidad debe ser mayor a 0";
    }
    if (!formData.unidad.trim()) {
      newErrors.unidad = "La unidad es obligatoria";
    }
    if (!formData.concepto) {
      newErrors.concepto = "El concepto es obligatorio";
    }
    if (!formData.precioUnitario || Number.parseFloat(formData.precioUnitario) <= 0) {
      newErrors.precioUnitario = "El precio unitario debe ser mayor a 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateImporteTotal = () => {
    const cantidad = Number.parseFloat(formData.cantidad) || 0;
    const precioUnitario = Number.parseFloat(formData.precioUnitario) || 0;
    const descuentoPorcentaje = Number.parseFloat(formData.descuento) || 0;
    const descuentoMonto = (precioUnitario * descuentoPorcentaje / 100) * cantidad;
    return (cantidad * precioUnitario) - descuentoMonto;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const conceptoData = {
        id: concepto?.id,
        cantidad: Number.parseFloat(formData.cantidad),
        unidad: formData.unidad,
        concepto: formData.concepto,
        precioUnitario: Number.parseFloat(formData.precioUnitario),
        descuento: Number.parseFloat(formData.descuento) || 0,
        importeTotal: calculateImporteTotal(),
      };
      onSave(conceptoData);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo concepto" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="cotizaciones-form">
        <div className="cotizaciones-form-group">
          <label htmlFor="cantidad">Cantidad  <span className="required"> *</span></label>
          <input
            type="number"
            id="cantidad"
            value={formData.cantidad}
            onChange={(e) => handleInputChange("cantidad", e.target.value)}
            className={`cotizaciones-form-control ${errors.cantidad ? "error" : ""}`}
            step="1"
            min="1"
          />
          {errors.cantidad && <span className="cotizaciones-error-message">{errors.cantidad}</span>}
        </div>

        <div className="cotizaciones-form-group">
          <label htmlFor="unidad">Unidad  <span className="required"> *</span></label>
          <select
            id="unidad"
            value={formData.unidad}
            onChange={(e) => handleInputChange("unidad", e.target.value)}
            className={`cotizaciones-form-control ${errors.unidad ? "error" : ""}`}
          >
            <option value="">Ninguna seleccionada</option>
            <option value="Servicios">Servicios</option>
            <option value="Equipos">Equipos</option>
            <option value="Instalaciones">Instalaciones</option>
          </select>
          {errors.unidad && <span className="cotizaciones-error-message">{errors.unidad}</span>}
        </div>

        <div className="cotizaciones-form-group">
          <label htmlFor="concepto">Concepto <span className="required"> *</span></label>
          <select
            id="concepto-select"
            onChange={(e) => handleInputChange("concepto", e.target.value)}
            className="cotizaciones-form-control"
            value={formData.concepto}
          >
            <option value="">Seleccionar concepto</option>
            {conceptosPredefinidos.map((concepto, index) => (
              <option key={index} value={concepto}>
                {concepto.length > 50 ? `${concepto.substring(0, 50)}...` : concepto}
              </option>
            ))}
          </select>

          <textarea
            id="concepto"
            value={formData.concepto}
            onChange={(e) => handleInputChange("concepto", e.target.value)}
            className={`cotizaciones-form-control cotizaciones-concepto-textarea ${errors.concepto ? "error" : ""}`}
            rows="3"
            placeholder="O escribe tu propio concepto"
          />
          {errors.concepto && <span className="cotizaciones-error-message">{errors.concepto}</span>}
        </div>

        <div className="cotizaciones-form-group">
          <label htmlFor="precioUnitario">Precio Unitario  <span className="required"> *</span></label>
          <div className="cotizaciones-input-with-symbol">
            <span className="cotizaciones-currency-symbol">$</span>
            <input
              type="number"
              id="precioUnitario"
              value={formData.precioUnitario}
              onChange={(e) => handleInputChange("precioUnitario", e.target.value)}
              className={`cotizaciones-form-control ${errors.precioUnitario ? "error" : ""}`}
              step="0.01"
              min="0"
            />
          </div>
          {errors.precioUnitario && <span className="cotizaciones-error-message">{errors.precioUnitario}</span>}
        </div>

        <div className="cotizaciones-form-group">
          <label htmlFor="descuento">Descuento (%)</label>
          <div className="cotizaciones-input-with-symbol">
            <span className="cotizaciones-currency-symbol">%</span>
            <input
              type="number"
              id="descuento"
              value={formData.descuento}
              onChange={(e) => handleInputChange("descuento", e.target.value)}
              className="cotizaciones-form-control"
              step="0.01"
              min="0"
              max="100"
            />
          </div>
        </div>

        <div className="cotizaciones-form-group">
          <label>Importe total</label>
          <div className="cotizaciones-input-with-symbol">
            <span className="cotizaciones-currency-symbol">$</span>
            <input
              type="text"
              value={calculateImporteTotal().toFixed(2)}
              className="cotizaciones-form-control"
              readOnly
            />
          </div>
        </div>

        <div className="cotizaciones-form-actions">
          <button type="button" onClick={onClose} className="cotizaciones-btn cotizaciones-btn-cancel">
            Cancelar
          </button>
          <button type="submit" className="cotizaciones-btn cotizaciones-btn-primary">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Modal para Nueva/Editar Cotización
const CotizacionModal = ({ isOpen, onClose, onSave, cotizacion = null, clientes, modals, setModals, users }) => {
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { tratos: true };
  const [formData, setFormData] = useState({
    cliente: "",
    conceptos: [],
    tratoId: null,
  });
  const [showConceptoModal, setShowConceptoModal] = useState(false);
  const [editingConcepto, setEditingConcepto] = useState(null);
  const [errors, setErrors] = useState({});
  const [tratosDisponibles, setTratosDisponibles] = useState([]);
  const [loadingTratos, setLoadingTratos] = useState(false);

  const isEditing = !!(cotizacion?.id);

  const cargarTratosDisponibles = async (empresaId) => {
    if (!empresaId) {
      setTratosDisponibles([]);
      return;
    }

    setLoadingTratos(true);
    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/cotizaciones/tratos-disponibles/${empresaId}`
      );
      const data = await response.json();
      setTratosDisponibles(data);
    } catch (error) {
      console.error('Error cargando tratos:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los tratos disponibles'
      });
      setTratosDisponibles([]);
    } finally {
      setLoadingTratos(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (cotizacion) {
        setFormData({
          cliente: cotizacion.clienteNombre || "",
          conceptos: Array.isArray(cotizacion.unidades) ? cotizacion.unidades.map((c) => ({
            id: c.id,
            cantidad: c.cantidad,
            unidad: c.unidad,
            concepto: c.concepto,
            precioUnitario: c.precioUnitario,
            descuento: c.descuento,
            importeTotal: c.importeTotal,
          })) : [],
          empresaData: cotizacion.empresaData || null,
          tratoId: cotizacion.tratoId || null,
        });

        if (cotizacion.empresaData?.id) {
          cargarTratosDisponibles(cotizacion.empresaData.id);
        }
      } else {
        setFormData({
          cliente: "",
          conceptos: [],
          empresaData: null,
          tratoId: null,
        });
        setTratosDisponibles([]);
      }
      setErrors({});
    }
  }, [isOpen, cotizacion]);


  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const calculateImporteTotalForConcepto = (concepto) => {
    const cantidad = Number.parseFloat(concepto.cantidad) || 0;
    const precioUnitario = Number.parseFloat(concepto.precioUnitario) || 0;
    const descuentoPorcentaje = Number.parseFloat(concepto.descuento) || 0;
    const descuentoMonto = (precioUnitario * descuentoPorcentaje / 100) * cantidad;
    return (cantidad * precioUnitario) - descuentoMonto;
  };

  const handleAddConcepto = (conceptoData) => {
    if (editingConcepto !== null) {
      setFormData((prev) => ({
        ...prev,
        conceptos: prev.conceptos.map((concepto, index) =>
          index === editingConcepto ? {
            ...conceptoData,
            importeTotal: calculateImporteTotalForConcepto(conceptoData)
          } : concepto
        ),
      }));
      setEditingConcepto(null);
    } else {
      setFormData((prev) => ({
        ...prev,
        conceptos: [...prev.conceptos, {
          ...conceptoData,
          importeTotal: calculateImporteTotalForConcepto(conceptoData)
        }],
      }));
    }
    setShowConceptoModal(false);
  };

  const handleEditConcepto = (index) => {
    setEditingConcepto(index);
    setShowConceptoModal(true);
  };

  const handleDeleteConcepto = (index) => {
    setFormData((prev) => ({
      ...prev,
      conceptos: prev.conceptos.filter((_, i) => i !== index),
    }));
  };

  const calculateTotals = () => {
    const subtotal = formData.conceptos.reduce((sum, concepto) => sum + concepto.importeTotal, 0);
    const iva = subtotal * 0.16;
    let isrEstatal = 0;
    let isrFederal = 0;

    if (formData.empresaData &&
      (formData.empresaData.regimenFiscal === "601" || formData.empresaData.regimenFiscal === "627")) {
      const domicilioFiscal = (formData.empresaData.domicilioFiscal || "").toLowerCase();
      const hasGuanajuato = domicilioFiscal.includes("gto") || domicilioFiscal.includes("guanajuato");
      const cpMatch = domicilioFiscal.match(/\b(36|37|38)\d{4}\b/);

      if (cpMatch || hasGuanajuato) {
        isrEstatal = subtotal * 0.02;
        isrFederal = subtotal * 0.0125;
      } else if (!cpMatch && !hasGuanajuato) {
        isrFederal = subtotal * 0.0125;
      }
    }

    const total = subtotal + iva;
    return { subtotal, iva, isrEstatal, isrFederal, total };
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.cliente) {
      newErrors.cliente = "El cliente es obligatorio";
    }
    if (formData.conceptos.length === 0) {
      newErrors.conceptos = "Debe agregar al menos un concepto";
    }
    if (modulosActivos.tratos && tratosDisponibles.length > 0 && !formData.tratoId) {
      newErrors.tratoId = "Debe vincular un trato a la cotización";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const { subtotal, iva, total } = calculateTotals();
      const cotizacionData = {
        id: cotizacion?.id,
        cliente: formData.cliente,
        conceptos: formData.conceptos,
        cantidadTotal: formData.conceptos
          .filter(concepto => concepto.unidad === "Equipos")
          .reduce((sum, concepto) => sum + concepto.cantidad, 0),
        conceptosCount: new Set(formData.conceptos.map((c) => c.concepto)).size,
        subtotal,
        iva,
        isrEstatal: calculateTotals().isrEstatal,
        isrFederal: calculateTotals().isrFederal,
        total,
        importeConLetra: numeroALetras(total),
        fecha: cotizacion?.fecha || new Date().toLocaleDateString("es-MX"),
        empresaData: formData.empresaData,
        tratoId: formData.tratoId,
      };
      onSave(cotizacionData);
      onClose();
    }
  };

  const { subtotal, iva, total } = calculateTotals();

  const handleClienteChange = async (clienteNombre) => {
    handleInputChange("cliente", clienteNombre);

    const empresaSeleccionada = clientes.find(
      c => c.nombre === clienteNombre
    );

    if (empresaSeleccionada) {
      handleInputChange("empresaData", empresaSeleccionada);
      await cargarTratosDisponibles(empresaSeleccionada.id);
    } else {
      setTratosDisponibles([]);
      handleInputChange("tratoId", null);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? "Editar cotización" : "Nueva cotización"}
        size="lg"
        closeOnOverlayClick={false}
      >
        <form onSubmit={handleSubmit} className="cotizaciones-form">
          <div className="cotizaciones-form-group">
            <label htmlFor="cliente">Cliente  <span className="required"> *</span></label>
            <select
              id="cliente"
              value={formData.cliente}
              onChange={(e) => handleClienteChange(e.target.value)}
              className={`cotizaciones-form-control ${errors.cliente ? "error" : ""}`}
            >
              <option value="">Seleccione un cliente</option>
              {clientes
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((cliente) => (
                  <option key={cliente.id} value={cliente.nombre}>
                    {cliente.nombre}
                  </option>
                ))}
            </select>
            {errors.cliente && <span className="cotizaciones-error-message">{errors.cliente}</span>}
          </div>

          {modulosActivos.tratos && tratosDisponibles.length > 0 && (
            <div className="cotizaciones-form-group">
              <label htmlFor="trato">Vincular a Trato <span className="required"> *</span></label>
              <select
                id="trato"
                value={formData.tratoId || ""}
                onChange={(e) => handleInputChange("tratoId", e.target.value ? parseInt(e.target.value) : null)}
                className={`cotizaciones-form-control ${errors.tratoId ? "error" : ""}`}
                disabled={loadingTratos}
              >
                <option value="">Seleccionar trato...</option>
                {tratosDisponibles.map((trato) => (
                  <option key={trato.id} value={trato.id}>
                    {trato.nombre} - {trato.fase}
                  </option>
                ))}
              </select>
              {loadingTratos && <span className="cotizaciones-info-message">Cargando tratos...</span>}
              {errors.tratoId && <span className="cotizaciones-error-message">{errors.tratoId}</span>}
            </div>
          )}
          <div className="cotizaciones-form-group">
            <div className="cotizaciones-conceptos-header">
              <label>Conceptos  <span className="required"> *</span></label>
              <button
                type="button"
                onClick={() => setShowConceptoModal(true)}
                className="cotizaciones-btn cotizaciones-btn-add-concepto"
              >
                Agregar
                <img src={addIcon || "/placeholder.svg"} alt="Agregar" className="cotizaciones-btn-icon" />
              </button>
            </div>

            {formData.conceptos.length > 0 ? (
              <div className="cotizaciones-conceptos-list">
                {formData.conceptos.map((concepto, index) => (
                  <div key={concepto.id} className="cotizaciones-concepto-item">
                    <div className="cotizaciones-concepto-info">
                      <div className="cotizaciones-concepto-row">
                        <span className="cotizaciones-concepto-label">Cantidad:</span>
                        <span>{concepto.cantidad}</span>
                      </div>
                      <div className="cotizaciones-concepto-row">
                        <span className="cotizaciones-concepto-label">Unidad:</span>
                        <span>{concepto.unidad}</span>
                      </div>
                      <div className="cotizaciones-concepto-row">
                        <span className="cotizaciones-concepto-label">Concepto:</span>
                        <span className="cotizaciones-concepto-text">{concepto.concepto}</span>
                      </div>
                      <div className="cotizaciones-concepto-row">
                        <span className="cotizaciones-concepto-label">Precio:</span>
                        <span>${concepto.precioUnitario.toFixed(2)}</span>
                      </div>
                      <div className="cotizaciones-concepto-row">
                        <span className="cotizaciones-concepto-label">Descuento:</span>
                        <span>{concepto.descuento}%</span>
                      </div>
                      <div className="cotizaciones-concepto-row">
                        <span className="cotizaciones-concepto-label">Total:</span>
                        <span className="cotizaciones-concepto-total">${concepto.importeTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="cotizaciones-concepto-actions">
                      <button
                        type="button"
                        onClick={() => handleEditConcepto(index)}
                        className="cotizaciones-action-btn cotizaciones-edit-btn"
                        title="Editar"
                      >
                        <img
                          src={editIcon || "/placeholder.svg"}
                          alt="Editar"
                          className="cotizaciones-action-icon"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConcepto(index)}
                        className="cotizaciones-action-btn cotizaciones-delete-btn"
                        title="Eliminar"
                      >
                        <img
                          src={deleteIcon || "/placeholder.svg"}
                          alt="Eliminar"
                          className="cotizaciones-action-icon"
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cotizaciones-no-conceptos">No hay conceptos agregados</div>
            )}
            {errors.conceptos && <span className="cotizaciones-error-message">{errors.conceptos}</span>}
          </div>

          <div className="cotizaciones-totals-section">
            <div className="cotizaciones-form-group">
              <label>Subtotal:</label>
              <div className="cotizaciones-input-with-symbol">
                <span className="cotizaciones-currency-symbol">$</span>
                <input type="text" value={subtotal.toFixed(2)} className="cotizaciones-form-control" readOnly />
              </div>
            </div>

            <div className="cotizaciones-form-group">
              <label>IVA(16%)  <span className="required"> *</span></label>
              <div className="cotizaciones-input-with-symbol">
                <span className="cotizaciones-currency-symbol">$</span>
                <input type="text" value={iva.toFixed(2)} className="cotizaciones-form-control" readOnly />
              </div>
            </div>

            <div className="cotizaciones-form-group">
              <label>Total</label>
              <div className="cotizaciones-input-with-symbol">
                <span className="cotizaciones-currency-symbol">$</span>
                <input type="text" value={total.toFixed(2)} className="cotizaciones-form-control" readOnly />
              </div>
            </div>


            <div className="cotizaciones-form-group">
              <label>Importe con Letra</label>
              <textarea
                value={numeroALetras(total)}
                className="cotizaciones-form-control cotizaciones-importe-letra"
                readOnly
                rows="2"
              />
            </div>
          </div>

          <div className="cotizaciones-form-actions">
            <button type="button" onClick={onClose} className="cotizaciones-btn cotizaciones-btn-cancel">
              Cancelar
            </button>
            <button type="submit" className="cotizaciones-btn cotizaciones-btn-primary">
              {isEditing ? "Guardar cambios" : "Crear"}
            </button>
          </div>
        </form>
      </Modal>

      <NuevoConceptoModal
        isOpen={showConceptoModal}
        onClose={() => {
          setShowConceptoModal(false);
          setEditingConcepto(null);
        }}
        onSave={handleAddConcepto}
        concepto={editingConcepto !== null ? formData.conceptos[editingConcepto] : null}
      />
    </>
  );
};

// Modal de Confirmación de Eliminación
const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar eliminación" size="sm" closeOnOverlayClick={false}>
      <div className="cotizaciones-confirmar-eliminacion">
        <div className="cotizaciones-confirmation-content">
          <p className="cotizaciones-confirmation-message">
            ¿Seguro que quieres eliminar esta cotización de forma permanente?
          </p>
          <div className="cotizaciones-modal-form-actions">
            <button type="button" onClick={onClose} className="cotizaciones-btn cotizaciones-btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} className="cotizaciones-btn cotizaciones-btn-confirm">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Modal para Crear Cuentas por Cobrar
const CrearCuentasModal = ({ isOpen, onClose, onSave, cotizacion }) => {
  const [formData, setFormData] = useState({
    cotizacionId: "",
    clienteNombre: "",
    noEquipos: "",
    esquema: "ANUAL",
    numeroPagos: "1",
    fechaInicial: "",
    conceptos: [],
  });
  const [errors, setErrors] = useState({});

  const esquemas = [
    { value: "ANUAL", label: "Anual", editablePagos: true },
    { value: "MENSUAL", label: "Mensual", editablePagos: true },
    { value: "DISTRIBUIDOR", label: "Distribuidor - 1 solo pago", editablePagos: false },
    { value: "VITALICIA", label: "Vitalicia - 1 solo pago", editablePagos: false },
  ];

  useEffect(() => {
    if (isOpen && cotizacion) {
      setFormData({
        cotizacionId: cotizacion.id || "",
        clienteNombre: cotizacion.clienteNombre || "",
        noEquipos: cotizacion.unidades
          ? cotizacion.unidades.reduce((sum, u) => u.unidad === "Equipos" ? sum + u.cantidad : sum, 0)
          : 0,
        esquema: "ANUAL",
        numeroPagos: "1",
        fechaInicial: new Date().toISOString().split('T')[0],
        conceptos: cotizacion.unidades ? cotizacion.unidades.map(u => ({ text: u.concepto, selected: true })) : [],
      });
      setErrors({});
    }
  }, [isOpen, cotizacion]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "esquema") {
        const esquemaSeleccionado = esquemas.find((e) => e.value === value);
        if (esquemaSeleccionado.editablePagos) {
          newData.numeroPagos = value === "MENSUAL" ? "12" : "1";
        } else {
          newData.numeroPagos = "1";
        }
      }
      return newData;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }

  };
  const validateForm = () => {
    const newErrors = {};
    if (!formData.clienteNombre) newErrors.clienteNombre = "El cliente es obligatorio";
    if (!formData.esquema) newErrors.esquema = "El esquema es obligatorio";
    if (!formData.numeroPagos || Number.parseInt(formData.numeroPagos) <= 0) {
      newErrors.numeroPagos = "El número de pagos debe ser mayor a 0";
    }
    if (!formData.fechaInicial) newErrors.fechaInicial = "La fecha inicial es obligatoria"; // AGREGAR ESTA LÍNEA
    if (formData.conceptos.filter(c => c.selected).length === 0) {
      newErrors.conceptos = "Debe seleccionar al menos un concepto";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const conceptosSeleccionados = formData.conceptos.filter(c => c.selected).map(c => c.text);
    if (conceptosSeleccionados.length === 0) {
      setErrors((prev) => ({ ...prev, conceptos: "Debe seleccionar al menos un concepto" }));
      return;
    }
    try {
      const queryParams = new URLSearchParams();
      conceptosSeleccionados.forEach(concepto => queryParams.append('conceptosSeleccionados', concepto));
      queryParams.append('numeroPagos', formData.numeroPagos);
      const url = `${API_BASE_URL}/cuentas-por-cobrar/from-cotizacion/${formData.cotizacionId}?esquema=${formData.esquema}&fechaInicial=${formData.fechaInicial}&${queryParams.toString()}`;

      const response = await fetchWithToken(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const savedCuentas = await response.json();
      onSave(savedCuentas);
      onClose();
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cuenta/s por Cobrar" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="cuentascobrar-form">
        <div className="cuentascobrar-form-group">
          <label htmlFor="cliente">Cliente</label>
          <input type="text" id="cliente" value={formData.clienteNombre} className="cuentascobrar-form-control" readOnly />
        </div>
        <div className="cuentascobrar-form-group">
          <label htmlFor="noEquipos">Número de Equipos</label>
          <input type="number" id="noEquipos" value={formData.noEquipos} className="cuentascobrar-form-control" readOnly />
        </div>
        <div className="cuentascobrar-form-group">
          <label htmlFor="esquema">Esquema <span className="required"> *</span></label>
          <select
            id="esquema"
            value={formData.esquema}
            onChange={(e) => handleInputChange("esquema", e.target.value)}
            className={`cuentascobrar-form-control cuentascobrar-select-contained ${errors.esquema ? "error" : ""}`}
          >
            {esquemas.map((esquema) => (
              <option key={esquema.value} value={esquema.value}>{esquema.label}</option>
            ))}
          </select>
          {errors.esquema && <span className="cuentascobrar-error-message">{errors.esquema}</span>}
        </div>
        <div className="cuentascobrar-form-group">
          <label htmlFor="numeroPagos">Número de Pagos</label>
          <input
            type="number"
            id="numeroPagos"
            value={formData.numeroPagos}
            onChange={(e) => {
              const esquemaSeleccionado = esquemas.find(e => e.value === formData.esquema);
              if (esquemaSeleccionado.editablePagos) {
                handleInputChange("numeroPagos", e.target.value);
              }
            }}
            className="cuentascobrar-form-control"
            readOnly={!esquemas.find(e => e.value === formData.esquema)?.editablePagos}
            min="1"
          />
          {errors.numeroPagos && <span className="cuentascobrar-error-message">{errors.numeroPagos}</span>}
        </div>
        <div className="cuentascobrar-form-group">
          <label htmlFor="fechaInicial">Fecha Inicial <span className="required"> *</span></label>
          <input
            type="date"
            id="fechaInicial"
            value={formData.fechaInicial}
            onChange={(e) => handleInputChange("fechaInicial", e.target.value)}
            className={`cuentascobrar-form-control ${errors.fechaInicial ? "error" : ""}`}
            required
          />
          {errors.fechaInicial && <span className="cuentascobrar-error-message">{errors.fechaInicial}</span>}
        </div>
        <div className="cuentascobrar-form-group">
          <label>Concepto/s</label>
          {formData.conceptos.map((concepto, index) => (
            <div key={index} className="cuentascobrar-concepto-item">
              <input
                type="checkbox"
                checked={concepto.selected}
                onChange={(e) => {
                  const updatedConceptos = [...formData.conceptos];
                  updatedConceptos[index].selected = e.target.checked;
                  setFormData((prev) => ({ ...prev, conceptos: updatedConceptos }));
                }}
              />
              <span className="cuentascobrar-concepto-text">{concepto.text}</span>
            </div>
          ))}
          {errors.conceptos && <span className="cuentascobrar-error-message">{errors.conceptos}</span>}
        </div>
        <div className="cuentascobrar-form-actions">
          <button type="button" onClick={onClose} className="cuentascobrar-btn cuentascobrar-btn-cancel">Cancelar</button>
          <button type="submit" className="cuentascobrar-btn cuentascobrar-btn-primary">Generar</button>
        </div>
      </form>
    </Modal>
  );
};

const SubirArchivoModal = ({ isOpen, onClose, onDownload, cotizacion }) => {
  const [notasComerciales, setNotasComerciales] = useState(null);
  const [fichaTecnica, setFichaTecnica] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setNotasComerciales(null);
      setFichaTecnica(null);
      setErrors({});
    }
  }, [isOpen]);

  const handleFileChange = (tipo, e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'application/pdf' || file.type === 'image/png')) {
      if (tipo === 'notas') {
        setNotasComerciales(file);
      } else {
        setFichaTecnica(file);
      }
      setErrors(prev => ({ ...prev, [tipo]: null }));
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Solo se permiten archivos PDF y PNG'
      });
      e.target.value = '';
    }
  };

  const validateFiles = () => {
    const newErrors = {};

    if ((notasComerciales && !fichaTecnica) || (!notasComerciales && fichaTecnica)) {
      newErrors.general = 'Si subes un archivo, debes subir ambos: Notas Comerciales y Ficha Técnica';
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  const handleDownloadWithFiles = async () => {
    if (!validateFiles()) return;

    setUploading(true);
    const formData = new FormData();

    if (notasComerciales) {
      formData.append('notasComerciales', notasComerciales);
    }
    if (fichaTecnica) {
      formData.append('fichaTecnica', fichaTecnica);
    }

    try {
      await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cotizacion.id}/upload-archivos`, {
        method: 'POST',
        body: formData,
      });

      await onDownload(cotizacion.id, true);
      onClose();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al subir los archivos: ' + error.message
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadWithoutFiles = async () => {
    await onDownload(cotizacion.id, false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Descargar Cotización" size="lg" closeOnOverlayClick={false}>
      <div className="cotizaciones-form">
        <div className="cotizaciones-form-group">
          <p className="cotizaciones-modal-text">
            ¿Deseas agregar archivos adicionales a esta cotización?
          </p>
          {errors.general && (
            <div className="cotizaciones-error-message">{errors.general}</div>
          )}
        </div>

        {/* Advertencia de tamaños recomendados */}
        <div className="cotizaciones-form-group">
          <div className="cotizaciones-size-warning">
            <h4 className="cotizaciones-warning-title">Recomendaciones para imágenes PNG:</h4>
            <ul className="cotizaciones-warning-list">
              <li><strong>Tamaño recomendado:</strong> 1240 x 1754 píxeles (proporción A4)</li>
              <li><strong>Orientación:</strong> Vertical (portrait) preferentemente</li>
            </ul>
            <p className="cotizaciones-warning-note">
              <strong>Nota:</strong> Las imágenes PNG se convertirán automáticamente a PDF y se ajustarán al tamaño de página A4.
            </p>
          </div>
        </div>

        <div className="cotizaciones-form-group">
          <label>Notas Comerciales (PDF o PNG):</label>
          <input
            type="file"
            accept=".pdf,.png"
            onChange={(e) => handleFileChange('notas', e)}
            className="cotizaciones-form-control"
          />
          {notasComerciales && (
            <div className="cotizaciones-file-info">
              <p className="cotizaciones-file-selected">
                <strong>Archivo seleccionado:</strong> {notasComerciales.name}
              </p>
              <p className="cotizaciones-file-details">
                <strong>Tamaño:</strong> {(notasComerciales.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        <div className="cotizaciones-form-group">
          <label>Ficha Técnica (PDF o PNG):</label>
          <input
            type="file"
            accept=".pdf,.png"
            onChange={(e) => handleFileChange('ficha', e)}
            className="cotizaciones-form-control"
          />
          {fichaTecnica && (
            <div className="cotizaciones-file-info">
              <p className="cotizaciones-file-selected">
                <strong>Archivo seleccionado:</strong> {fichaTecnica.name}
              </p>
              <p className="cotizaciones-file-details">
                <strong>Tamaño:</strong> {(fichaTecnica.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        <div className="cotizaciones-form-actions">
          <button
            onClick={onClose}
            className="cotizaciones-btn cotizaciones-btn-cancel"
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            onClick={handleDownloadWithoutFiles}
            className="cotizaciones-btn cotizaciones-btn-secondary"
            disabled={uploading}
          >
            Ver sin archivos
          </button>
          <button
            onClick={handleDownloadWithFiles}
            className="cotizaciones-btn cotizaciones-btn-primary"
            disabled={uploading || (!notasComerciales && !fichaTecnica)}
          >
            {uploading ? 'Cargando...' : 'Cargar y ver'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Modal para Compartir Cotización con opción de archivos
const CompartirCotizacionModal = ({ isOpen, onClose, onCompartir, cotizacion }) => {
  const [notasComerciales, setNotasComerciales] = useState(null);
  const [fichaTecnica, setFichaTecnica] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setNotasComerciales(null);
      setFichaTecnica(null);
      setErrors({});
    }
  }, [isOpen]);

  const handleFileChange = (tipo, e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'application/pdf' || file.type === 'image/png')) {
      if (tipo === 'notas') {
        setNotasComerciales(file);
      } else {
        setFichaTecnica(file);
      }
      setErrors(prev => ({ ...prev, [tipo]: null }));
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Solo se permiten archivos PDF y PNG'
      });
      e.target.value = '';
    }
  };

  const validateFiles = () => {
    const newErrors = {};

    if ((notasComerciales && !fichaTecnica) || (!notasComerciales && fichaTecnica)) {
      newErrors.general = 'Si subes un archivo, debes subir ambos: Notas Comerciales y Ficha Técnica';
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  const handleCompartirConArchivos = async () => {
    if (!validateFiles()) return;

    setUploading(true);
    const formData = new FormData();

    if (notasComerciales) {
      formData.append('notasComerciales', notasComerciales);
    }
    if (fichaTecnica) {
      formData.append('fichaTecnica', fichaTecnica);
    }

    try {
      await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cotizacion.id}/upload-archivos`, {
        method: 'POST',
        body: formData,
      });

      await onCompartir(true);
      onClose();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al subir los archivos: ' + error.message
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCompartirSinArchivos = async () => {
    await onCompartir(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compartir Cotización" size="lg" closeOnOverlayClick={false}>
      <div className="cotizaciones-form">
        <div className="cotizaciones-form-group">
          <p className="cotizaciones-modal-text">
            ¿Deseas agregar archivos adicionales antes de compartir esta cotización?
          </p>
          {errors.general && (
            <div className="cotizaciones-error-message">{errors.general}</div>
          )}
        </div>

        <div className="cotizaciones-form-group">
          <div className="cotizaciones-size-warning">
            <h4 className="cotizaciones-warning-title">Recomendaciones para imágenes PNG:</h4>
            <ul className="cotizaciones-warning-list">
              <li><strong>Tamaño recomendado:</strong> 1240 x 1754 píxeles (proporción A4)</li>
              <li><strong>Orientación:</strong> Vertical (portrait) preferentemente</li>
            </ul>
            <p className="cotizaciones-warning-note">
              <strong>Nota:</strong> Las imágenes PNG se convertirán automáticamente a PDF y se ajustarán al tamaño de página A4.
            </p>
          </div>
        </div>

        <div className="cotizaciones-form-group">
          <label>Notas Comerciales (PDF o PNG):</label>
          <input
            type="file"
            accept=".pdf,.png"
            onChange={(e) => handleFileChange('notas', e)}
            className="cotizaciones-form-control"
          />
          {notasComerciales && (
            <div className="cotizaciones-file-info">
              <p className="cotizaciones-file-selected">
                <strong>Archivo seleccionado:</strong> {notasComerciales.name}
              </p>
              <p className="cotizaciones-file-details">
                <strong>Tamaño:</strong> {(notasComerciales.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        <div className="cotizaciones-form-group">
          <label>Ficha Técnica (PDF o PNG):</label>
          <input
            type="file"
            accept=".pdf,.png"
            onChange={(e) => handleFileChange('ficha', e)}
            className="cotizaciones-form-control"
          />
          {fichaTecnica && (
            <div className="cotizaciones-file-info">
              <p className="cotizaciones-file-selected">
                <strong>Archivo seleccionado:</strong> {fichaTecnica.name}
              </p>
              <p className="cotizaciones-file-details">
                <strong>Tamaño:</strong> {(fichaTecnica.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        <div className="cotizaciones-form-actions">
          <button
            onClick={onClose}
            className="cotizaciones-btn cotizaciones-btn-cancel"
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            onClick={handleCompartirSinArchivos}
            className="cotizaciones-btn cotizaciones-btn-secondary"
            disabled={uploading}
          >
            Compartir sin archivos
          </button>
          <button
            onClick={handleCompartirConArchivos}
            className="cotizaciones-btn cotizaciones-btn-primary"
            disabled={uploading || (!notasComerciales && !fichaTecnica)}
          >
            {uploading ? 'Cargando...' : 'Compartir con archivos'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const CustomDatePickerInput = ({ value, onClick, placeholder }) => (
  <div className="cotizaciones-date-picker-wrapper">
    <input
      type="text"
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      readOnly
      className="cotizaciones-date-picker"
    />
    <div className="cotizaciones-date-picker-icons">
      <svg
        className="cotizaciones-calendar-icon"
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
const AdminCotizaciones = () => {
  const navigate = useNavigate()
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { balance: true, transacciones: true, cotizaciones: true, facturacion: true, cxc: true, cxp: true, comisiones: true };
  const userRol = localStorage.getItem("userRol")
  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [users, setUsers] = useState([]);
  const [emisores, setEmisores] = useState([]);
  const [filterReceptor, setFilterReceptor] = useState("");
  const [cotizacionesVinculadas, setCotizacionesVinculadas] = useState(new Set());
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
  const [ordenFecha, setOrdenFecha] = useState('asc');
  const [isLoading, setIsLoading] = useState(true);
  const [rangoFechas, setRangoFechas] = useState([null, null]);
  const [fechaInicio, fechaFin] = rangoFechas;
  const [pdfPreview, setPdfPreview] = useState({
    isOpen: false,
    url: null,
    filename: ""
  });

  const [modals, setModals] = useState({
    cotizacion: { isOpen: false, cotizacion: null },
    confirmarEliminacion: { isOpen: false, cotizacion: null },
    crearCuentas: { isOpen: false, cotizacion: null },
    subirArchivo: { isOpen: false, cotizacion: null },
    compartirCotizacion: { isOpen: false, cotizacion: null },
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const fasesInteres = "COTIZACION_PROPUESTA_PRACTICA,NEGOCIACION_REVISION,CERRADO_GANADO";
        const [
          empresasPorFaseResp,
          cotizacionesResp,
          usersResp,
          emisoresResp,
          cuentasResp
        ] = await Promise.all([
          fetchWithToken(`${API_BASE_URL}/empresas/por-fases-trato?fases=${fasesInteres}`),
          fetchWithToken(`${API_BASE_URL}/cotizaciones`),
          fetchWithToken(`${API_BASE_URL}/auth/users`),
          fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/emisores`),
          fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar`),
        ]);

        // Procesamos las respuestas
        const empresasData = await empresasPorFaseResp.json();
        const cotizacionesData = await cotizacionesResp.json();
        const usersData = await usersResp.json();
        const emisoresData = await emisoresResp.json();
        const cuentasData = await cuentasResp.json();

        const listaClientes = Array.isArray(empresasData) ? empresasData : empresasData.data || [];
        const cotizaciones = Array.isArray(cotizacionesData) ? cotizacionesData : cotizacionesData.data || [];
        const users = Array.isArray(usersData) ? usersData : usersData.data || [];
        const emisores = Array.isArray(emisoresData) ? emisoresData : emisoresData.data || [];
        const cuentasPorCobrar = Array.isArray(cuentasData) ? cuentasData : cuentasData.data || [];

        setClientes(listaClientes);
        setCotizaciones(cotizaciones);

        if (cotizaciones.length > 0) {
          await checkVinculaciones(cotizaciones);
        }
        setUsers(users);
        setEmisores(emisores);
        setCuentasPorCobrar(cuentasPorCobrar);

      } catch (error) {
        console.error("Error en fetchData:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudieron cargar los datos: " + error.message,
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

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
        navigate("/admin_balance")
        break
      case "transacciones":
        navigate("/admin_transacciones")
        break
      case "cotizaciones":
        navigate("/admin_cotizaciones")
        break
      case "facturacion":
        navigate("/admin_facturacion")
        break
      case "cuentas-cobrar":
        navigate("/admin_cuentas_cobrar")
        break
      case "cuentas-pagar":
        navigate("/admin_cuentas_pagar")
        break
      case "caja-chica":
        navigate("/admin_caja_chica")
        break
      case "comisiones":
        navigate("/admin_comisiones");
        break;
      default:
        break
    }
  }

  const limpiarFiltroFechas = () => {
    setRangoFechas([null, null]);
  };

  const handleSaveCotizacion = async (cotizacionData) => {
    try {
      const url = cotizacionData.id
        ? `${API_BASE_URL}/cotizaciones/${cotizacionData.id}`
        : `${API_BASE_URL}/cotizaciones`;
      const method = cotizacionData.id ? "PUT" : "POST";

      const response = await fetchWithToken(url, {
        method,
        body: JSON.stringify({
          clienteNombre: cotizacionData.cliente,
          tratoId: cotizacionData.tratoId,
          unidades: cotizacionData.conceptos.map((c) => ({
            cantidad: c.cantidad,
            unidad: c.unidad,
            concepto: c.concepto,
            precioUnitario: c.precioUnitario,
            descuento: c.descuento ?? 0,
            importeTotal: c.importeTotal,
          })),
          empresaData: cotizacionData.empresaData,
        }),
      });

      const data = await response.json();
      if (cotizacionData.id) {
        setCotizaciones((prev) =>
          prev.map((c) => (c.id === cotizacionData.id ? { ...c, ...data } : c))
        );
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: "Cotización actualizada correctamente",
        });
      } else {
        setCotizaciones((prev) => [...prev, data]);
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: "Cotización creada correctamente",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo guardar la cotización: " + error.message,
      });
    }
  };


  const handleDeleteCotizacion = (cotizacion) => {
    openModal("confirmarEliminacion", { cotizacion });
  };

  const handleConfirmDelete = async () => {
    const cotizacionId = modals.confirmarEliminacion.cotizacion?.id;

    try {
      // Primero verificar si la cotización está vinculada a alguna cuenta por cobrar
      const checkResponse = await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cotizacionId}/check-vinculada`);
      const checkData = await checkResponse.json();

      if (checkData.vinculada) {
        closeModal("confirmarEliminacion");
        Swal.fire({
          icon: "warning",
          title: "No se puede eliminar",
          text: "No se puede eliminar la cotización porque está vinculada a una o más cuentas por cobrar",
          confirmButtonText: "Entendido"
        });
        return;
      }

      // Si no está vinculada, proceder con la eliminación
      const deleteResponse = await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cotizacionId}`, {
        method: "DELETE"
      });

      if (deleteResponse.ok) {
        setCotizaciones((prev) => prev.filter((c) => c.id !== cotizacionId));
        closeModal("confirmarEliminacion");
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: "Cotización eliminada correctamente",
        });
      } else {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || "Error al eliminar la cotización");
      }

    } catch (error) {
      closeModal("confirmarEliminacion");
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo eliminar la cotización",
      });
    }
  };

  const handleSaveCuenta = (cuenta) => {
    setCuentasPorCobrar((prev) =>
      prev.map((c) => (c.id === cuenta.id ? { ...c, ...cuenta } : c))
    );
    Swal.fire({
      icon: "success",
      title: "Éxito",
      text: "Cuenta/s por cobrar actualizada correctamente",
    });
  };


  const handleDownloadCotizacionPDF = (cotizacionId) => {
    openModal("subirArchivo", { cotizacion: { id: cotizacionId } });
  };

  const executeDownload = async (cotizacionId, incluirArchivos) => {
    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/cotizaciones/${cotizacionId}/download-pdf?incluirArchivos=${incluirArchivos}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/pdf' }
        }
      );

      if (!response.ok) throw new Error('Error downloading PDF');

      const blob = await response.blob();

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

  const toggleOrdenFecha = () => {
    setOrdenFecha(prevOrden => prevOrden === 'desc' ? 'asc' : 'desc');
  };

  const cotizacionesFiltradas = cotizaciones.filter((cotizacion) => {
    const pasaReceptor = cotizacion.clienteNombre
      ?.toLowerCase()
      .includes(filterReceptor.toLowerCase());

    let pasaFechas = true;
    if (fechaInicio || fechaFin) {
      const fechaItem = new Date(cotizacion.fechaCreacion || cotizacion.fecha);

      let inicio = fechaInicio ? new Date(fechaInicio) : null;
      let fin = fechaFin ? new Date(fechaFin) : null;

      if (inicio) {
        inicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
      }
      if (fin) {
        fin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59);
      }

      if (!isNaN(fechaItem.getTime())) {
        pasaFechas = (!inicio || fechaItem >= inicio) && (!fin || fechaItem <= fin);
      }
    }

    return pasaReceptor && pasaFechas;
  });

  const ordenarCotizaciones = (cotizacionesList) => {
    return [...cotizacionesList].sort((a, b) => {
      const fechaA = new Date(a.fechaCreacion);
      const fechaB = new Date(b.fechaCreacion);

      if (ordenFecha === 'desc') {
        return fechaB - fechaA;
      } else {
        return fechaA - fechaB;
      }
    });
  };

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="cotizaciones-loading">
            <div className="spinner"></div>
            <p>Cargando cotizaciones...</p>
          </div>
        )}
        <main className="cotizaciones-main-content">
          <div className="cotizaciones-container">
            <section className="cotizaciones-sidebar">
              <div className="cotizaciones-sidebar-header">
                <h3 className="cotizaciones-sidebar-title">Administración</h3>
              </div>
              <div className="cotizaciones-sidebar-menu">
                {userRol === "ADMINISTRADOR" && modulosActivos.balance && (
                  <div className="cotizaciones-menu-item" onClick={() => handleMenuNavigation("balance")}>
                    Balance
                  </div>
                )}
                {modulosActivos.transacciones && (
                  <div className="cotizaciones-menu-item" onClick={() => handleMenuNavigation("transacciones")}>
                    Transacciones
                  </div>
                )}
                {modulosActivos.cotizaciones && (
                  <div className="cotizaciones-menu-item cotizaciones-menu-item-active" onClick={() => handleMenuNavigation("cotizaciones")}>
                    Cotizaciones
                  </div>
                )}
                {modulosActivos.facturacion && (
                  <div className="cotizaciones-menu-item" onClick={() => handleMenuNavigation("facturacion")}>
                    Facturas/Notas
                  </div>
                )}
                {modulosActivos.cxc && (
                  <div className="cotizaciones-menu-item" onClick={() => handleMenuNavigation("cuentas-cobrar")}>
                    Cuentas por Cobrar
                  </div>
                )}
                {modulosActivos.cxp && (
                  <div className="cotizaciones-menu-item" onClick={() => handleMenuNavigation("cuentas-pagar")}>
                    Cuentas por Pagar
                  </div>
                )}
                {modulosActivos.transacciones && (
                  <div className="cotizaciones-menu-item" onClick={() => handleMenuNavigation("caja-chica")}>
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

            {/* Main Content */}
            <section className="cotizaciones-content-panel">
              <div className="cotizaciones-header">

                <div className="cotizaciones-header-info">
                  <h3 className="cotizaciones-page-title">Cotizaciones</h3>
                  <p className="cotizaciones-subtitle">Gestión de cotizaciones para clientes</p>
                </div>
                <div className="cotizaciones-header-actions">
                  <button
                    className="cotizaciones-btn cotizaciones-btn-primary"
                    onClick={() => openModal("cotizacion", { cotizacion: null })}
                  >
                    Crear cotización
                  </button>
                </div>
              </div>

              {/* Tabla de Cotizaciones */}
              <div className="cotizaciones-table-card">

                <div className="cotizaciones-table-header-row">
                  <h4 className="cotizaciones-table-title">Cotizaciones</h4>

                  <div className="cotizaciones-header-controls">

                    {/* Filtro Receptor */}
                    <input
                      type="text"
                      value={filterReceptor}
                      onChange={(e) => setFilterReceptor(e.target.value)}
                      placeholder="Buscar por receptor..."
                      className="cotizaciones-filter-input"
                    />

                    {/* Filtro Fechas */}
                    <div className="cotizaciones-date-picker-container">
                      <DatePicker
                        selectsRange={true}
                        startDate={fechaInicio}
                        endDate={fechaFin}
                        onChange={(update) => {
                          setRangoFechas(update);
                        }}
                        isClearable={true}
                        placeholderText="Seleccionar rango de fechas"
                        dateFormat="dd/MM/yyyy"
                        customInput={<CustomDatePickerInput />}
                        locale="es"
                      />
                    </div>

                    {/* Botón Ordenar */}
                    <button
                      className="cotizaciones-btn-orden"
                      onClick={toggleOrdenFecha}
                      title={`Cambiar a orden ${ordenFecha === 'desc' ? 'ascendente' : 'descendente'}`}
                    >
                      <span className="cotizaciones-icon-orden">📅</span>
                      {ordenFecha === 'desc' ? '↓ Recientes primero' : '↑ Antiguas primero'}
                    </button>
                  </div>
                </div>

                <div className="cotizaciones-table-container">
                  <table className="cotizaciones-table">
                    <thead className="cotizaciones-table-header-fixed">
                      <tr>
                        <th>No. Cotización</th>
                        <th>Receptor</th>
                        <th>Fecha</th>
                        <th className="cotizaciones-equipos-column-header">Total de equipos</th>
                        <th>Concepto</th>
                        <th>Subtotal</th>
                        <th>IVA</th>
                        <th>Total</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cotizaciones.length > 0 ? (
                        ordenarCotizaciones(cotizacionesFiltradas)
                          .map((cotizacion, index) => (
                            <tr key={cotizacion.id}>
                              <td>#{cotizacion.id}</td>
                              <td>{cotizacion.clienteNombre}</td>
                              <td>{cotizacion.fecha}</td>
                              <td className="cotizaciones-equipos-column">{cotizacion.cantidadTotal || 0}</td>
                              <td>{cotizacion.conceptosCount === 1 ? "1 concepto" : cotizacion.conceptosCount > 0 ? `${cotizacion.conceptosCount} conceptos` : "0 conceptos"}</td>
                              <td>${cotizacion.subtotal?.toFixed(2) || '0.00'}</td>
                              <td>${cotizacion.iva?.toFixed(2) || '0.00'}</td>
                              <td className="cotizaciones-total-cell">${cotizacion.total?.toFixed(2) || '0.00'}</td>
                              <td>
                                <div className="cotizaciones-actions">
                                  <button
                                    className="cotizaciones-action-btn cotizaciones-edit-btn"
                                    onClick={() => openModal("cotizacion", { cotizacion })}
                                    title="Editar"
                                  >
                                    <img
                                      src={editIcon || "/placeholder.svg"}
                                      alt="Editar"
                                      className="cotizaciones-action-icon"
                                    />
                                  </button>
                                  <button
                                    className="cotizaciones-action-btn cotizaciones-delete-btn"
                                    onClick={() => handleDeleteCotizacion(cotizacion)}
                                    title="Eliminar"
                                  >
                                    <img
                                      src={deleteIcon || "/placeholder.svg"}
                                      alt="Eliminar"
                                      className="cotizaciones-action-icon"
                                    />
                                  </button>
                                  <button
                                    className="cotizaciones-action-btn cotizaciones-download-btn"
                                    onClick={() => handleDownloadCotizacionPDF(cotizacion.id)}
                                    title="Descargar Cotización en PDF"
                                  >
                                    <img
                                      src={downloadIcon || "/placeholder.svg"}
                                      alt="Descargar"
                                      className="cotizaciones-action-icon"
                                    />
                                  </button>
                                  {modulosActivos.cxc && (
                                    <button
                                      className={`cotizaciones-action-btn cotizaciones-receivable-btn ${cotizacionesVinculadas.has(cotizacion.id)
                                        ? 'cotizaciones-receivable-btn-vinculada'
                                        : 'cotizaciones-receivable-btn-disponible'
                                        }`}
                                      onClick={async () => {
                                        const response = await fetchWithToken(`${API_BASE_URL}/cotizaciones/${cotizacion.id}/check-vinculada`);
                                        const { vinculada } = await response.json();
                                        if (vinculada) {
                                          Swal.fire({
                                            icon: "warning",
                                            title: "Alerta",
                                            text: "Ya se generaron las cuentas por cobrar",
                                          });
                                        } else {
                                          openModal("crearCuentas", { cotizacion: cotizacion });
                                        }
                                      }}
                                      title={
                                        cotizacionesVinculadas.has(cotizacion.id)
                                          ? "Cuentas por cobrar ya generadas"
                                          : "Generar Cuenta por Cobrar"
                                      }
                                    >
                                      <img
                                        src={receivableIcon || "/placeholder.svg"}
                                        alt="Generar Cuenta"
                                        className="cotizaciones-action-icon"
                                      />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan="10" className="cotizaciones-no-data">
                            No hay cotizaciones registradas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          {/* Modales */}
          <CotizacionModal
            isOpen={modals.cotizacion.isOpen}
            onClose={() => closeModal("cotizacion")}
            onSave={handleSaveCotizacion}
            cotizacion={modals.cotizacion.cotizacion}
            clientes={clientes}
            modals={modals}
            setModals={setModals}
            users={users}
          />
          <ConfirmarEliminacionModal
            isOpen={modals.confirmarEliminacion.isOpen}
            onClose={() => closeModal("confirmarEliminacion")}
            onConfirm={handleConfirmDelete}
            cotizacion={modals.confirmarEliminacion.cotizacion}
          />
          <CrearCuentasModal
            isOpen={modals.crearCuentas?.isOpen || false}
            onClose={() => closeModal("crearCuentas")}
            onSave={(savedCuentas) => {
              setCuentasPorCobrar((prev) => [...prev, ...savedCuentas]);
              setCotizacionesVinculadas(prev => new Set([...prev, modals.crearCuentas?.cotizacion?.id]));
              handleSaveCuenta(savedCuentas[0]);
              Swal.fire({
                icon: "success",
                title: "Éxito",
                text: "Cuenta/s por cobrar creada correctamente",
              });
              closeModal("crearCuentas");
            }}
            cotizacion={modals.crearCuentas?.cotizacion}
          />

          <SubirArchivoModal
            isOpen={modals.subirArchivo.isOpen}
            onClose={() => closeModal("subirArchivo")}
            onDownload={executeDownload}
            cotizacion={modals.subirArchivo.cotizacion}
          />

          <PdfPreviewModal
            isOpen={pdfPreview.isOpen}
            onClose={handleClosePreview}
            pdfUrl={pdfPreview.url}
            onDownload={handleDownloadFromPreview}
          />

        </main>
      </div>
    </>
  )
}

export default AdminCotizaciones;
export { CotizacionModal };
export { CrearCuentasModal };
export { SubirArchivoModal };
export { NuevoConceptoModal };
export { CompartirCotizacionModal }; 
