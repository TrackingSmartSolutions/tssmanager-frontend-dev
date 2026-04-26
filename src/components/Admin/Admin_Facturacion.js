import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Admin_Facturacion.css";
import Header from "../Header/Header";
import Swal from "sweetalert2";
import deleteIcon from "../../assets/icons/eliminar.png";
import editIcon from "../../assets/icons/editar.png";
import downloadIcon from "../../assets/icons/descarga.png";
import stampIcon from "../../assets/icons/timbrar.png"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { API_BASE_URL } from "../Config/Config";

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!options.body || !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`);
  return response;
};

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
        <div style={{ overflowY: 'auto', maxHeight: '100%', padding: '0 12px' }}>
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
            className="facturacion-btn facturacion-btn-primary"
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

// Modal para Nuevo/Editar Emisor
const EmisorModal = ({ isOpen, onClose, onSave, emisor = null }) => {
  const [formData, setFormData] = useState({
    id: null,
    nombre: "",
    razonSocial: "",
    direccion: "",
    rfc: "",
    telefono: "",
    constanciaRegimen: null,
    constanciaRegimenUrl: "",
  });
  const [errors, setErrors] = useState({});

  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!emisor;

  useEffect(() => {
    if (isOpen) {
      if (emisor) {
        setFormData({
          id: emisor.id || null,
          nombre: emisor.nombre || "",
          razonSocial: emisor.razonSocial || "",
          direccion: emisor.direccion || "",
          rfc: emisor.rfc || "",
          telefono: emisor.telefono || "",
          constanciaRegimen: null,
          constanciaRegimenUrl: emisor.constanciaRegimenFiscalUrl || "",
        });
      } else {
        setFormData({
          id: null,
          nombre: "",
          razonSocial: "",
          direccion: "",
          rfc: "",
          telefono: "",
          constanciaRegimen: null,
          constanciaRegimenUrl: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, emisor]);

  const handleInputChange = (field, value) => {
    if (field === "telefono") {
      const numericValue = value.replace(/\D/g, '').slice(0, 10);
      setFormData((prev) => ({ ...prev, [field]: numericValue }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setErrors((prev) => ({ ...prev, constanciaRegimen: "Solo se permiten archivos PDF" }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: "warning",
          title: "Archivo demasiado grande",
          text: "El archivo no puede superar 5MB. Por favor, seleccione un archivo más pequeño.",
        });
        return;
      }
      setFormData((prev) => ({ ...prev, constanciaRegimen: file, constanciaRegimenUrl: "" }));
      setErrors((prev) => ({ ...prev, constanciaRegimen: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) newErrors.nombre = "El nombre es obligatorio";
    if (!formData.razonSocial.trim()) newErrors.razonSocial = "La razón social es obligatoria";
    if (!formData.direccion.trim()) newErrors.direccion = "La dirección es obligatoria";
    if (!formData.rfc.trim()) {
      newErrors.rfc = "El RFC es obligatorio";
    } else if (!/^[A-Z0-9&]+$/.test(formData.rfc.trim())) {
      newErrors.rfc = "El RFC solo debe contener letras mayúsculas, números y &";
    } else if (formData.rfc.trim().length > 13) {
      newErrors.rfc = "El RFC no puede tener más de 13 caracteres";
    }
    if (!formData.telefono.trim()) {
      newErrors.telefono = "El teléfono es obligatorio";
    } else if (formData.telefono.trim().length < 10) {
      newErrors.telefono = "El teléfono debe tener 10 dígitos";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      const formDataToSend = new FormData();
      const emisorData = {
        id: formData.id,
        nombre: formData.nombre,
        razonSocial: formData.razonSocial,
        direccion: formData.direccion,
        rfc: formData.rfc,
        telefono: formData.telefono,
      };
      formDataToSend.append("emisor", new Blob([JSON.stringify(emisorData)], { type: "application/json" }));
      if (formData.constanciaRegimen) {
        formDataToSend.append("constanciaRegimen", formData.constanciaRegimen);
      }

      try {
        let response;
        if (isEditing) {
          response = await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/emisores/${formData.id}`, {
            method: "PUT",
            body: formDataToSend,
          });
        } else {
          response = await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/emisores`, {
            method: "POST",
            body: formDataToSend,
          });
        }
        const savedEmisor = await response.json();
        onSave(savedEmisor);
        onClose();
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: isEditing ? "Emisor actualizado correctamente" : "Emisor agregado correctamente",
        });
      } catch (error) {
        Swal.fire({ icon: "error", title: "Error", text: error.message });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Editar emisor" : "Nuevo emisor"} size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="facturacion-form" encType="multipart/form-data">
        <div className="facturacion-form-group">
          <label htmlFor="nombre">Nombre <span className="required"> *</span></label>
          <input
            type="text"
            id="nombre"
            value={formData.nombre}
            onChange={(e) => handleInputChange("nombre", e.target.value)}
            className={`facturacion-form-control ${errors.nombre ? "error" : ""}`}
          />
          {errors.nombre && <span className="facturacion-error-message">{errors.nombre}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="razonSocial">Razón Social <span className="required"> *</span></label>
          <input
            type="text"
            id="razonSocial"
            value={formData.razonSocial}
            onChange={(e) => handleInputChange("razonSocial", e.target.value)}
            className={`facturacion-form-control ${errors.razonSocial ? "error" : ""}`}
          />
          {errors.razonSocial && <span className="facturacion-error-message">{errors.razonSocial}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="direccion">Dirección <span className="required"> *</span></label>
          <input
            type="text"
            id="direccion"
            value={formData.direccion}
            onChange={(e) => handleInputChange("direccion", e.target.value)}
            className={`facturacion-form-control ${errors.direccion ? "error" : ""}`}
          />
          {errors.direccion && <span className="facturacion-error-message">{errors.direccion}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="rfc">RFC <span className="required"> *</span></label>
          <input
            type="text"
            id="rfc"
            value={formData.rfc}
            onChange={(e) => handleInputChange("rfc", e.target.value.toUpperCase())}
            className={`facturacion-form-control ${errors.rfc ? "error" : ""}`}
            maxLength={13}
          />
          {errors.rfc && <span className="facturacion-error-message">{errors.rfc}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="telefono">Teléfono <span className="required"> *</span></label>
          <input
            type="text"
            id="telefono"
            value={formData.telefono}
            onChange={(e) => handleInputChange("telefono", e.target.value)}
            className={`facturacion-form-control ${errors.telefono ? "error" : ""}`}
            maxLength={10}
          />
          {errors.telefono && <span className="facturacion-error-message">{errors.telefono}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="constanciaRegimen">Constancia de régimen de situación fiscal</label>
          <div className="facturacion-file-upload">
            <input
              type="file"
              id="constanciaRegimen"
              accept=".pdf"
              onChange={handleFileChange}
              className="facturacion-file-input"
            />
            <div className="facturacion-file-upload-area">
              <div className="facturacion-file-upload-icon">📁</div>
              <div className="facturacion-file-upload-text">
                {formData.constanciaRegimen
                  ? formData.constanciaRegimen.name || "Archivo seleccionado"
                  : formData.constanciaRegimenUrl
                    ? formData.constanciaRegimenUrl.split("/").pop() || "Archivo existente"
                    : "Arrastra y suelta tu archivo aquí"}
              </div>
              <div className="facturacion-file-upload-subtext">PDF máx. 5MB</div>
            </div>
          </div>
          {errors.constanciaRegimen && <span className="facturacion-error-message">{errors.constanciaRegimen}</span>}
        </div>
        <div className="facturacion-form-actions">
          <button type="button" onClick={onClose} className="facturacion-btn facturacion-btn-cancel">Cancelar</button>
          <button
            type="submit"
            className="facturacion-btn facturacion-btn-primary"
            disabled={isLoading}
          >
            {isLoading ? "Guardando..." : (isEditing ? "Guardar cambios" : "Agregar")}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Modal para Nueva/Editar Solicitud
const SolicitudModal = ({ isOpen, onClose, onSave, solicitud = null, cotizaciones, cuentasPorCobrar, emisores, modulosActivos = { cotizaciones: true, cxc: true } }) => {
  const [formData, setFormData] = useState({
    id: null,
    cotizacion: "",
    fechaEmision: "",
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
  const [hasAllFiscalData, setHasAllFiscalData] = useState(true);
  const isEditing = !!solicitud;

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
      if (solicitud) {
        setFormData({
          id: solicitud.id || null,
          cotizacion: solicitud.cotizacionId ? String(solicitud.cotizacionId) : "",
          fechaEmision: solicitud.fechaEmision ? solicitud.fechaEmision.split('T')[0] : "",
          metodoPago: solicitud.metodoPago || "",
          formaPago: solicitud.formaPago || "",
          tipo: solicitud.tipo || "",
          claveProductoServicio: solicitud.claveProductoServicio || "20121910",
          claveUnidad: solicitud.claveUnidad || "E48",
          emisor: solicitud.emisorId ? String(solicitud.emisorId) : (solicitud.emisor?.id ? String(solicitud.emisor.id) : ""),
          cuentaPorCobrar: solicitud.cuentaPorCobrarId ? String(solicitud.cuentaPorCobrarId) : "",
          subtotal: solicitud.subtotal !== undefined ? String(solicitud.subtotal) : "",
          iva: solicitud.iva !== undefined ? String(solicitud.iva) : "",
          total: solicitud.total !== undefined ? String(solicitud.total) : "",
          importeLetra: solicitud.importeLetra || "",
          usoCfdi: solicitud.usoCfdi || "",
        });
      } else {
        setFormData({
          id: null,
          cotizacion: "",
          fechaEmision: new Date().toLocaleDateString('en-CA'),
          metodoPago: "",
          formaPago: "",
          tipo: "",
          claveProductoServicio: "20121910",
          claveUnidad: "E48",
          emisor: emisores.length > 0 ? String(emisores[0].id) : "",
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
  }, [isOpen, solicitud, emisores]);

  useEffect(() => {
    if (formData.cotizacion && cotizaciones) {
      const cotizacionSeleccionada = cotizaciones.find((c) => c.id === parseInt(formData.cotizacion));
      if (cotizacionSeleccionada) {
        const empresa = cotizacionSeleccionada.empresaData;
        const regimenRequiereRetencion = ["601", "627"].includes(empresa.regimenFiscal);

        setFormData((prev) => ({
          ...prev,
          subtotal: String(cotizacionSeleccionada.subtotal),
          iva: String(cotizacionSeleccionada.iva),
          total: regimenRequiereRetencion
            ? String(cotizacionSeleccionada.total)
            : String(Number(cotizacionSeleccionada.subtotal) * 1.16),
          importeLetra: cotizacionSeleccionada.importeLetra,
        }));

        const empresaData = cotizacionSeleccionada.empresaData;
        const requiredFields = ["domicilioFiscal", "rfc", "razonSocial", "regimenFiscal"];
        const hasAllFiscalData = requiredFields.every((field) => !!empresaData[field]);

        if (!hasAllFiscalData) {
          setFormData((prev) => ({
            ...prev,
            tipo: "NOTA",
          }));
          Swal.fire({
            icon: "warning",
            title: "Datos fiscales incompletos",
            text: "La empresa asociada a esta cotización no tiene completos los datos fiscales requeridos (domicilio fiscal, RFC, razón social, régimen fiscal). Solo se permite generar una nota.",
            timer: 5000,
            showConfirmButton: false,
          });
        }
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

    if (modulosActivos.cxc && !formData.cuentaPorCobrar) {
      newErrors.cuentaPorCobrar = "La cuenta por cobrar es obligatoria";
    }

    if (isEditing && !formData.fechaEmision) newErrors.fechaEmision = "La fecha de emisión es obligatoria";
    if (formData.tipo === "SOLICITUD_DE_FACTURA" && (!formData.usoCfdi || formData.usoCfdi === "")) {
      newErrors.usoCfdi = "El uso de CFDI es obligatorio para solicitudes de factura";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateEmpresaFiscal = () => {
    if (formData.tipo === "SOLICITUD_DE_FACTURA") {
      const cuentaPorCobrarData = cuentasPorCobrar.find((c) => c.id === formData.cuentaPorCobrar);
      if (cuentaPorCobrarData) {
        const requiredFields = ["domicilioFiscal", "rfc", "razonSocial", "regimenFiscal"];
        const hasAllFields = requiredFields.every((field) => cuentaPorCobrarData.cliente?.[field]);
        return hasAllFields;
      }
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

      const cuentaPorCobrarData = cuentasPorCobrar.find((c) => c.id === formData.cuentaPorCobrar);
      const clienteId = cuentaPorCobrarData?.cliente?.id || null;

      const solicitudData = {
        id: formData.id,
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
        total: formData.total,
        importeLetra: formData.importeLetra,
        usoCfdi: formData.usoCfdi,
      };

      try {
        let response;
        const url = formData.id
          ? `${API_BASE_URL}/solicitudes-factura-nota/${formData.id}`
          : `${API_BASE_URL}/solicitudes-factura-nota`;
        const method = formData.id ? "PUT" : "POST";

        response = await fetchWithToken(url, {
          method,
          body: JSON.stringify(solicitudData),
          headers: { "Content-Type": "application/json" },
        });

        const savedSolicitud = await response.json();
        onSave(savedSolicitud);
        onClose();
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: isEditing ? "Solicitud actualizada correctamente" : "Solicitud creada correctamente",
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
        {modulosActivos.cotizaciones && (
          <div className="facturacion-form-group">
            <label htmlFor="cotizacion">Cotización <span className="required"> *</span></label>
            <select
              id="cotizacion"
              value={formData.cotizacion}
              onChange={(e) => handleInputChange("cotizacion", e.target.value)}
              className="facturacion-form-control"
              disabled={!!solicitud}
            >
              <option value="">Ninguna seleccionada</option>
              {cotizaciones.map((cotizacion) => (
                <option key={cotizacion.id} value={cotizacion.id}>{cotizacion.clienteNombre} - {cotizacion.id}</option>
              ))}
            </select>
          </div>
        )}
        {isEditing && (
          <div className="facturacion-form-group">
            <label htmlFor="fechaEmision">Fecha Emisión <span className="required"> *</span></label>
            <input
              type="date"
              id="fechaEmision"
              value={formData.fechaEmision}
              onChange={(e) => handleInputChange("fechaEmision", e.target.value)}
              className={`facturacion-form-control ${errors.fechaEmision ? "error" : ""}`}
            />
            {errors.fechaEmision && <span className="facturacion-error-message">{errors.fechaEmision}</span>}
          </div>
        )}
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
              const cotizacionSeleccionada = formData.cotizacion && cotizaciones
                ? cotizaciones.find((c) => c.id === parseInt(formData.cotizacion))
                : null;
              const empresaData = cotizacionSeleccionada?.empresaData || {};
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
          {!hasAllFiscalData && (
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
        {modulosActivos.cxc && (
          <div className="facturacion-form-group">
            <label htmlFor="cuentaPorCobrar">Cuenta por Cobrar <span className="required"> *</span></label>
            <select
              id="cuentaPorCobrar"
              value={formData.cuentaPorCobrar}
              onChange={(e) => handleInputChange("cuentaPorCobrar", e.target.value)}
              className={`facturacion-form-control ${errors.cuentaPorCobrar ? "error" : ""}`}
              disabled={true}
            >
              <option value="">Ninguna seleccionada</option>
              {cuentasPorCobrar
                .map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>{cuenta.folio}</option>
                ))}
            </select>
            {errors.cuentaPorCobrar && <span className="facturacion-error-message">{errors.cuentaPorCobrar}</span>}
          </div>
        )}
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

// Modal para Timbrar Solicitud
const TimbrarModal = ({ isOpen, onClose, onSave, solicitud }) => {
  const [formData, setFormData] = useState({
    folioFiscal: "",
    noSolicitud: "",
    facturaFiscal: null,
  });
  const [errors, setErrors] = useState({});

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && solicitud) {
      setFormData({
        folioFiscal: "",
        noSolicitud: solicitud.identificador || "",
        facturaFiscal: null,
      });
      setErrors({});
    }
  }, [isOpen, solicitud]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setErrors((prev) => ({ ...prev, facturaFiscal: "Solo se permiten archivos PDF" }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: "warning",
          title: "Archivo demasiado grande",
          text: "El archivo no puede superar 5MB. Por favor, seleccione un archivo más pequeño.",
        });
        return;
      }
      setFormData((prev) => ({ ...prev, facturaFiscal: file }));
      setErrors((prev) => ({ ...prev, facturaFiscal: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.folioFiscal.trim()) newErrors.folioFiscal = "El folio fiscal es obligatorio";
    if (!formData.noSolicitud.trim()) newErrors.noSolicitud = "El número de solicitud es obligatorio";
    if (!formData.facturaFiscal) newErrors.facturaFiscal = "El archivo de la factura es obligatorio";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      const formDataToSend = new FormData();
      formDataToSend.append("factura", new Blob([JSON.stringify({
        folioFiscal: formData.folioFiscal,
        noSolicitud: formData.noSolicitud,
      })], { type: "application/json" }));
      formDataToSend.append("archivo", formData.facturaFiscal);

      try {
        const response = await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/facturas`, {
          method: "POST",
          body: formDataToSend,
        });
        const savedFactura = await response.json();
        onSave(savedFactura);
        onClose();

        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: "Solicitud timbrada correctamente",
        });
      } catch (error) {
        Swal.fire({ icon: "error", title: "Error", text: error.message });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Timbrar Solicitud" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="facturacion-form" encType="multipart/form-data">
        <div className="facturacion-form-group">
          <label htmlFor="folioFiscal">Folio Fiscal <span className="required"> *</span></label>
          <input
            type="text"
            id="folioFiscal"
            value={formData.folioFiscal}
            onChange={(e) => handleInputChange("folioFiscal", e.target.value)}
            className={`facturacion-form-control ${errors.folioFiscal ? "error" : ""}`}
          />
          {errors.folioFiscal && <span className="facturacion-error-message">{errors.folioFiscal}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="noSolicitud">No. Solicitud <span className="required"> *</span></label>
          <input
            type="text"
            id="noSolicitud"
            value={formData.noSolicitud}
            onChange={(e) => handleInputChange("noSolicitud", e.target.value)}
            className={`facturacion-form-control ${errors.noSolicitud ? "error" : ""}`}
            readOnly
          />
          {errors.noSolicitud && <span className="facturacion-error-message">{errors.noSolicitud}</span>}
        </div>
        <div className="facturacion-form-group">
          <label htmlFor="facturaFiscal">Factura Fiscal <span className="required"> *</span></label>
          <div className="facturacion-file-upload">
            <input
              type="file"
              id="facturaFiscal"
              accept=".pdf"
              onChange={handleFileChange}
              className="facturacion-file-input"
            />
            <div className="facturacion-file-upload-area">
              <div className="facturacion-file-upload-icon">📁</div>
              <div className="facturacion-file-upload-text">
                {formData.facturaFiscal ? formData.facturaFiscal.name : "Arrastra y suelta tu archivo aquí"}
              </div>
              <div className="facturacion-file-upload-subtext">PDF máx. 5MB</div>
            </div>
          </div>
          {errors.facturaFiscal && <span className="facturacion-error-message">{errors.facturaFiscal}</span>}
        </div>
        <div className="facturacion-form-actions">
          <button type="button" onClick={onClose} className="facturacion-btn facturacion-btn-cancel">Cancelar</button>
          <button
            type="submit"
            className="facturacion-btn facturacion-btn-primary"
            disabled={isLoading}
          >
            {isLoading ? "Agregando..." : "Agregar"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Modal de Confirmación de Eliminación
const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm, tipo, item }) => {
  const getMessage = () => {
    switch (tipo) {
      case "emisor":
        return "¿Seguro que quieres eliminar al emisor de forma permanente?";
      case "solicitud":
        return "¿Seguro que quieres eliminar la solicitud de factura/nota de forma permanente?";
      default:
        return "¿Seguro que quieres eliminar este elemento de forma permanente?";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar eliminación" size="sm" closeOnOverlayClick={false}>
      <div className="facturacion-confirmar-eliminacion">
        <div className="facturacion-confirmation-content">
          <p className="facturacion-confirmation-message">{getMessage()}</p>

          <div className="facturacion-confirmation-actions">
            <button
              type="button"
              onClick={onClose}
              className="facturacion-btn facturacion-btn-cancel"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="facturacion-btn facturacion-btn-confirm"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Modal para Editar Conceptos
/*const ConceptosModal = ({ isOpen, onClose, solicitud, onSave, onPreview }) => {
  const [conceptosEditables, setConceptosEditables] = useState("");
  const [conceptosOriginales, setConceptosOriginales] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && solicitud) {
      fetchConceptos();
    }
  }, [isOpen, solicitud]);

  const fetchConceptos = async () => {
    try {
      setIsLoading(true);
      const response = await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/solicitudes/${solicitud.id}/conceptos`);
      const data = await response.json();

      // Priorizar conceptos personalizados si existen, sino usar los seleccionados
      const conceptosActuales = data.conceptosPersonalizados && data.conceptosPersonalizados.trim()
        ? data.conceptosPersonalizados
        : data.conceptosSeleccionados || "";

      setConceptosEditables(conceptosActuales);
      setConceptosOriginales(data.conceptosSeleccionados || "");
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDescargarPDF = async () => {
    try {
      setIsLoading(true);

      await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/solicitudes/${solicitud.id}/conceptos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptosPersonalizados: conceptosEditables })
      });

      const response = await fetchWithToken(
        `${API_BASE_URL}/solicitudes-factura-nota/solicitudes/${solicitud.id}/download-pdf`,
        {
          method: "GET",
          headers: { "Content-Type": "application/pdf" },
        }
      );

      if (!response.ok) throw new Error(`Error al descargar el PDF: ${response.statusText}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const filename = `${solicitud.identificador}_${new Date(solicitud.fechaEmision).toISOString().split('T')[0]}.pdf`;

      if (onPreview) {
        onPreview(url, filename);
      }

    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `No se pudo generar la vista previa: ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetearConceptos = () => {
    setConceptosEditables(conceptosOriginales);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Conceptos del Documento" size="lg" closeOnOverlayClick={false}>
      {isLoading ? (
        <div className="facturacion-loading">
          <div className="spinner"></div>
          <p>Cargando conceptos...</p>
        </div>
      ) : (
        <div className="facturacion-conceptos-container">
          <div className="facturacion-conceptos-section">
            <h4>Conceptos Originales (referencia)</h4>
            <div className="facturacion-conceptos-readonly">
              {conceptosOriginales || "No hay conceptos originales"}
            </div>
          </div>

          <div className="facturacion-conceptos-section">
            <h4>Conceptos que aparecerán en el PDF</h4>
            <textarea
              className="facturacion-textarea-conceptos"
              value={conceptosEditables}
              onChange={(e) => setConceptosEditables(e.target.value)}
              placeholder="Escribe aquí los conceptos que aparecerán en el PDF, separados por coma y espacio (, )"
              rows={8}
            />
            <small className="facturacion-help-text">
              Estos son los conceptos que aparecerán en el documento PDF.
              Separa cada concepto con coma y espacio (, )
            </small>
          </div>

          <div className="facturacion-form-actions">
            <button type="button" onClick={onClose} className="facturacion-btn facturacion-btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={resetearConceptos} className="facturacion-btn facturacion-btn-secondary">
              Restaurar Originales
            </button>
            <button type="button" onClick={handleDescargarPDF} className="facturacion-btn facturacion-btn-primary">
              Visualizar PDF
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
*/

const CustomDatePickerInput = ({ value, onClick, placeholder }) => (
  <div className="facturacion-date-picker-wrapper">
    <input
      type="text"
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      readOnly
      className="facturacion-date-picker"
    />
    <div className="facturacion-date-picker-icons">
      <svg
        className="facturacion-calendar-icon"
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
const AdminFacturacion = () => {
  const navigate = useNavigate();
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { balance: true, transacciones: true, cotizaciones: true, facturacion: true, cxc: true, cxp: true, comisiones: true };
  const userRol = localStorage.getItem("userRol")
  const [emisores, setEmisores] = useState([]);
  const [emisorSeleccionado, setEmisorSeleccionado] = useState(0);
  const [solicitudes, setSolicitudes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ordenFecha, setOrdenFecha] = useState('asc');
  const [solicitudesTimbradas, setSolicitudesTimbradas] = useState(new Set());
  const [rangoFechas, setRangoFechas] = useState([null, null]);
  const [fechaInicio, fechaFin] = rangoFechas;
  const [filtroReceptor, setFiltroReceptor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [pdfPreview, setPdfPreview] = useState({
    isOpen: false,
    url: null,
    filename: ""
  });

  const [modals, setModals] = useState({
    emisor: { isOpen: false, emisor: null },
    solicitud: { isOpen: false, solicitud: null },
    timbrar: { isOpen: false, solicitud: null },
    confirmarEliminacion: { isOpen: false, tipo: "", item: null, onConfirm: null },
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [emisoresResp, solicitudesResp, facturasResp] = await Promise.all([
          fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/emisores`),
          fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota`),
          fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/facturas`),
        ]);

        setEmisores(await emisoresResp.json());
        setSolicitudes(await solicitudesResp.json());

        const facturasData = await facturasResp.json();
        setFacturas(facturasData);

        const timbradas = new Set(facturasData.map(f => f.noSolicitud));
        setSolicitudesTimbradas(timbradas);

        if (modulosActivos.cotizaciones) {
          try {
            const cotizacionesResp = await fetchWithToken(`${API_BASE_URL}/cotizaciones`);
            setCotizaciones(await cotizacionesResp.json());
          } catch (e) { console.warn("No se pudieron cargar cotizaciones"); }
        }

        if (modulosActivos.cxc) {
          try {
            const cuentasResp = await fetchWithToken(`${API_BASE_URL}/cuentas-por-cobrar`);
            setCuentasPorCobrar(await cuentasResp.json());
          } catch (e) { console.warn("No se pudieron cargar cuentas por cobrar"); }
        }

      } catch (error) {
        Swal.fire({ icon: "error", title: "Error", text: error.message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

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

  const limpiarFiltroFechas = () => {
    setRangoFechas([null, null]);
  };

  const receptoresUnicos = [...new Set(solicitudes.map(s => s.receptor))].filter(Boolean).sort();

  const handleSaveEmisor = (savedEmisor) => {
    setEmisores((prev) => {
      const isEditing = prev.some(e => e.id === savedEmisor.id);
      if (isEditing) {
        return prev.map((e) => (e.id === savedEmisor.id ? savedEmisor : e));
      } else {
        const newEmisores = [...prev, savedEmisor];
        setEmisorSeleccionado(newEmisores.length - 1);
        return newEmisores;
      }
    });
    closeModal("emisor");
  };

  const handleDeleteEmisor = (emisor) => {
    openModal("confirmarEliminacion", {
      tipo: "emisor",
      item: emisor,
      onConfirm: async () => {
        try {
          await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/emisores/${emisor.id}`, {
            method: "DELETE",
          });
          setEmisores((prev) => prev.filter((e) => e.id !== emisor.id));
          if (emisorSeleccionado >= emisores.length - 1) {
            setEmisorSeleccionado(Math.max(0, emisores.length - 2));
          }
          closeModal("confirmarEliminacion");
          Swal.fire({
            icon: "success",
            title: "Éxito",
            text: "Emisor eliminado correctamente",
          });
        } catch (error) {
          Swal.fire({ icon: "error", title: "Error", text: error.message });
        }
      },
    });
  };

  const handleSaveSolicitud = (savedSolicitud) => {
    setSolicitudes((prev) => {
      const isEditing = prev.some(s => s.id === savedSolicitud.id);
      if (isEditing) {
        return prev.map((s) => (s.id === savedSolicitud.id ? savedSolicitud : s));
      } else {
        return [...prev, savedSolicitud];
      }
    });
  };

  const handleDeleteSolicitud = (solicitud) => {
    openModal("confirmarEliminacion", {
      tipo: "solicitud",
      item: solicitud,
      onConfirm: async () => {
        try {
          await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/${solicitud.id}`, {
            method: "DELETE",
          });
          setSolicitudes((prev) => prev.filter((s) => s.id !== solicitud.id));
          closeModal("confirmarEliminacion");
          Swal.fire({
            icon: "success",
            title: "Éxito",
            text: "Solicitud eliminada correctamente",
          });
        } catch (error) {
          let mensajeError = error.message;

          if (error.message.includes("cuenta por cobrar asociada ya ha sido marcada como pagada")) {
            mensajeError = "No se puede eliminar esta solicitud porque la cuenta por cobrar asociada ya está pagada.";
          }

          Swal.fire({
            icon: "error",
            title: "No se puede eliminar",
            text: mensajeError
          });
        }
      },
    });
  };

  const handleTimbrarClick = (solicitud) => {
    if (solicitudesTimbradas.has(solicitud.identificador)) {
      Swal.fire({
        icon: "info",
        title: "Solicitud ya timbrada",
        text: "Esta solicitud ya ha sido timbrada previamente.",
      });
    } else {
      openModal("timbrar", { solicitud });
    }
  };

  const handleTimbrarSolicitud = (savedFactura) => {
    setFacturas((prev) => [...prev, savedFactura]);
    setSolicitudesTimbradas((prev) => new Set([...prev, savedFactura.noSolicitud]));
  };

  const handleDescargarPDF = async (solicitud) => {
    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/solicitudes-factura-nota/solicitudes/${solicitud.id}/download-pdf`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/pdf",
          },
        }
      );

      if (!response.ok) throw new Error(`Error al descargar el PDF: ${response.statusText}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${solicitud.identificador}_${new Date(solicitud.fechaEmision).toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Descarga Completada",
        text: "El PDF se ha descargado correctamente.",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `No se pudo descargar el PDF: ${error.message}`,
      });
    }
  };

  const handleDescargarFactura = async (factura) => {
    if (!factura.id) return;

    try {
      const response = await fetchWithToken(`${API_BASE_URL}/solicitudes-factura-nota/facturas/${factura.id}/download`, {
        method: "GET",
      });

      if (!response.ok) throw new Error(`Error al descargar el archivo: ${response.statusText}`);

      const blob = await response.blob();

      if (blob.type === 'application/pdf') {
        const url = window.URL.createObjectURL(blob);
        const filename = factura.archivoUrl?.split("/").pop() || "factura.pdf";

        handleOpenPreview(url, filename);
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = factura.archivoUrl?.split("/").pop() || "archivo";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `No se pudo descargar el archivo: ${error.message}`,
      });
    }
  };

  const handleOpenPreview = (url, filename) => {
    setPdfPreview({ isOpen: true, url, filename });
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

  const handleVisualizarDirecto = async (solicitud) => {
    setIsLoading(true);
    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/solicitudes-factura-nota/solicitudes/${solicitud.id}/download-pdf`,
        {
          method: "GET",
          headers: { "Content-Type": "application/pdf" },
        }
      );

      if (!response.ok) throw new Error(`Error al generar el PDF`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const filename = `${solicitud.identificador}_${new Date(solicitud.fechaEmision).toISOString().split('T')[0]}.pdf`;

      handleOpenPreview(url, filename);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `No se pudo generar la vista previa: ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClosePreview = () => {
    if (pdfPreview.url) {
      window.URL.revokeObjectURL(pdfPreview.url);
    }
    setPdfPreview({ isOpen: false, url: null, filename: "" });
  };

  const navegarEmisor = (direccion) => {
    if (direccion === "anterior" && emisorSeleccionado > 0) {
      setEmisorSeleccionado(emisorSeleccionado - 1);
    } else if (direccion === "siguiente" && emisorSeleccionado < emisores.length - 1) {
      setEmisorSeleccionado(emisorSeleccionado + 1);
    }
  };

  const emisorActual = emisores[emisorSeleccionado];

  const solicitudesFiltradas = solicitudes.filter((solicitud) => {
    const pasaReceptor = filtroReceptor === "" || solicitud.receptor === filtroReceptor;

    const pasaTipo = filtroTipo === "" || solicitud.tipo === filtroTipo;

    let pasaFechas = true;
    if (fechaInicio || fechaFin) {
      const fechaSol = new Date(solicitud.fechaEmision + 'T00:00:00');

      let inicio = fechaInicio ? new Date(fechaInicio) : null;
      let fin = fechaFin ? new Date(fechaFin) : null;

      // Normalizar fechas
      if (inicio) {
        inicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
      }
      if (fin) {
        fin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59);
      }

      pasaFechas = (!inicio || fechaSol >= inicio) && (!fin || fechaSol <= fin);
    }

    return pasaReceptor && pasaTipo && pasaFechas;
  });

  const solicitudesOrdenadas = solicitudesFiltradas.sort((a, b) => {
    const fechaA = new Date(a.fechaEmision || '1900-01-01');
    const fechaB = new Date(b.fechaEmision || '1900-01-01');

    if (ordenFecha === 'asc') {
      return fechaA - fechaB;
    } else {
      return fechaB - fechaA;
    }
  });

  const facturasOrdenadas = facturas.sort((a, b) => {
    const fechaA = new Date(a.fechaCreacion || a.id);
    const fechaB = new Date(b.fechaCreacion || b.id);

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
          <div className="facturacion-loading">
            <div className="spinner"></div>
            <p>Cargando datos de facturación...</p>
          </div>
        )}
        <main className="facturacion-main-content">
          <div className="facturacion-container">
            <section className="facturacion-sidebar">
              <div className="facturacion-sidebar-header">
                <h3 className="facturacion-sidebar-title">Administración</h3>
              </div>
              <div className="facturacion-sidebar-menu">
                {userRol === "ADMINISTRADOR" && modulosActivos.balance && (
                  <div className="facturacion-menu-item" onClick={() => handleMenuNavigation("balance")}>
                    Balance
                  </div>
                )}
                {modulosActivos.transacciones && (
                  <div className="facturacion-menu-item" onClick={() => handleMenuNavigation("transacciones")}>
                    Transacciones
                  </div>
                )}
                {modulosActivos.cotizaciones && (
                  <div className="facturacion-menu-item" onClick={() => handleMenuNavigation("cotizaciones")}>
                    Cotizaciones
                  </div>
                )}
                {modulosActivos.facturacion && (
                  <div className="facturacion-menu-item facturacion-menu-item-active" onClick={() => handleMenuNavigation("facturacion")}>
                    Facturas/Notas
                  </div>
                )}
                {modulosActivos.cxc && (
                  <div className="facturacion-menu-item" onClick={() => handleMenuNavigation("cuentas-cobrar")}>
                    Cuentas por Cobrar
                  </div>
                )}
                {modulosActivos.cxp && (
                  <div className="facturacion-menu-item" onClick={() => handleMenuNavigation("cuentas-pagar")}>
                    Cuentas por Pagar
                  </div>
                )}
                {modulosActivos.transacciones && (
                  <div className="facturacion-menu-item" onClick={() => handleMenuNavigation("caja-chica")}>
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
            <section className="facturacion-content-panel">
              <div className="facturacion-header">
                <div className="facturacion-header-info">
                  <h3 className="facturacion-page-title">Facturas/Notas</h3>
                  <p className="facturacion-subtitle">Gestión de solicitudes de facturas, notas y facturas</p>
                </div>
                <div className="facturacion-header-actions">
                  <div className="facturacion-emisor-section">
                    <div className="facturacion-emisor-header">
                      <span className="facturacion-emisor-label">Datos del emisor</span>
                      <div className="facturacion-emisor-navigation">
                        <button
                          className="facturacion-nav-btn"
                          onClick={() => navegarEmisor("anterior")}
                          disabled={emisorSeleccionado === 0}
                        >
                          ←
                        </button>
                        <button
                          className="facturacion-nav-btn"
                          onClick={() => navegarEmisor("siguiente")}
                          disabled={emisorSeleccionado === emisores.length - 1}
                        >
                          →
                        </button>
                      </div>
                    </div>
                    {emisorActual && (
                      <div className="facturacion-emisor-info">
                        <div className="facturacion-emisor-data">
                          <span className="facturacion-emisor-name">Nombre: {emisorActual.nombre}</span>
                          <span className="facturacion-emisor-rfc">RFC: {emisorActual.rfc}</span>
                        </div>
                        <div className="facturacion-emisor-actions">
                          <button
                            className="facturacion-btn-icon"
                            onClick={() => openModal("emisor", { emisor: emisorActual })}
                            title="Editar emisor"
                          >
                            <img src={editIcon || "/placeholder.svg"} alt="Editar" className="facturacion-icon" />
                          </button>
                          <button
                            className="facturacion-btn-icon"
                            onClick={() => handleDeleteEmisor(emisorActual)}
                            title="Eliminar emisor"
                          >
                            <img src={deleteIcon || "/placeholder.svg"} alt="Eliminar" className="facturacion-icon" />
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      className="facturacion-btn facturacion-btn-secondary"
                      onClick={() => openModal("emisor", { emisor: null })}
                    >
                      Nuevo emisor
                    </button>
                  </div>
                </div>
              </div>
              <div className="facturacion-table-card">
                <div className="facturacion-table-header">
                  <h4 className="facturacion-table-title">Solicitudes de Facturas y Notas</h4>
                  <div className="facturacion-filters-container">

                    <div className="facturacion-filter-container">
                      <div style={{ height: '21px' }}></div>
                      <button
                        className="facturacion-btn-orden"
                        onClick={toggleOrdenFecha}
                        title={`Cambiar a orden ${ordenFecha === 'asc' ? 'descendente' : 'ascendente'}`}
                      >
                        {ordenFecha === 'asc' ? '📅 ↑ Antiguas primero' : '📅 ↓ Recientes primero'}
                      </button>
                    </div>

                    <div className="facturacion-filter-container">
                      <label htmlFor="filtroTipo">Filtrar por tipo:</label>
                      <select
                        id="filtroTipo"
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}
                        className="facturacion-filter-select"
                      >
                        <option value="">Todos los tipos</option>
                        <option value="SOLICITUD_DE_FACTURA">Solicitud de Factura</option>
                        <option value="NOTA">Nota</option>
                      </select>
                    </div>

                    <div className="facturacion-filter-container">
                      <label htmlFor="filtroReceptor">Filtrar por receptor:</label>
                      <select
                        id="filtroReceptor"
                        value={filtroReceptor}
                        onChange={(e) => setFiltroReceptor(e.target.value)}
                        className="facturacion-filter-select"
                      >
                        <option value="">Todos los receptores</option>
                        {receptoresUnicos.map((receptor, index) => (
                          <option key={index} value={receptor}>
                            {receptor}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="facturacion-filter-container facturacion-date-filter">
                      <label>Filtrar por fecha emisión:</label>
                      <div className="facturacion-date-picker-container">
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

                    <div className="facturacion-filter-container">
                      <div style={{ height: '21px' }}></div>
                      <button
                        className="facturacion-btn facturacion-btn-primary"
                        onClick={() => openModal("solicitud", { solicitud: null })}
                      >
                        Generar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="facturacion-table-container">
                  <table className="facturacion-table">
                    <thead className="facturacion-table-header-fixed">
                      <tr>
                        <th>Identificador</th>
                        <th>Fecha emisión</th>
                        <th>Receptor</th>
                        <th>Concepto</th>
                        <th>Total</th>
                        <th>Forma de Pago</th>
                        <th>Cuenta por Cobrar</th>
                        <th>Estatus</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solicitudesOrdenadas.length > 0 ? (
                        solicitudesOrdenadas.map((solicitud) => {
                          const cuentaAsociada = cuentasPorCobrar.find(
                            c => c.id === solicitud.cuentaPorCobrarId
                          );
                          const esCuentaPagada = cuentaAsociada?.estatus === "PAGADO";
                          return (
                            <tr key={solicitud.id}>
                              <td>{solicitud.identificador}</td>
                              <td>{solicitud.fechaEmision || "N/A"}</td>
                              <td>{solicitud.receptor || "N/A"}</td>
                              <td className="facturacion-concepto-cell">{solicitud.concepto || "N/A"}</td>
                              <td>${(solicitud.total || 0).toFixed(2)}</td>
                              <td>
                                {solicitud.formaPago === "01"
                                  ? "Efectivo"
                                  : solicitud.formaPago === "03"
                                    ? "Transferencia electrónica de fondos"
                                    : solicitud.formaPago === "02"
                                      ? "Tarjeta Spin"
                                      : solicitud.formaPago === "04"
                                        ? "Tarjeta de crédito"
                                        : solicitud.formaPago === "28"
                                          ? "Tarjeta de débito"
                                          : solicitud.formaPago === "07"
                                            ? "Con saldo acumulado"
                                            : solicitud.formaPago === "30"
                                              ? "Aplicación de anticipos"
                                              : solicitud.formaPago === "99"
                                                ? "Por definir"
                                                : "otros"}
                              </td>
                              <td>{solicitud.folio || "N/A"}</td>
                              <td>
                                <span
                                  className={`facturacion-estatus-badge ${solicitud.estatusCuentaPorCobrar === "PAGADO"
                                    ? "facturacion-estatus-pagado"
                                    : "facturacion-estatus-pendiente"
                                    }`}
                                >
                                  {solicitud.estatusCuentaPorCobrar === "PAGADO" ? "Pagado" : "Pendiente"}
                                </span>
                              </td>
                              <td>
                                <div className="facturacion-actions">
                                  <button
                                    className="facturacion-action-btn facturacion-edit-btn"
                                    onClick={() => openModal("solicitud", { solicitud })}
                                    title="Editar"
                                  >
                                    <img src={editIcon || "/placeholder.svg"} alt="Editar" className="facturacion-action-icon" />
                                  </button>
                                  <button
                                    className={`facturacion-action-btn facturacion-delete-btn ${esCuentaPagada ? 'facturacion-btn-disabled' : ''
                                      }`}
                                    onClick={() => !esCuentaPagada && handleDeleteSolicitud(solicitud)}
                                    disabled={esCuentaPagada}
                                    title={
                                      esCuentaPagada
                                        ? "No se puede eliminar - Cuenta pagada"
                                        : "Eliminar"
                                    }
                                  >
                                    <img src={deleteIcon} alt="Eliminar" className="facturacion-action-icon" />
                                  </button>
                                  <button
                                    className="facturacion-action-btn facturacion-download-btn"
                                    onClick={() => handleVisualizarDirecto(solicitud)}
                                    title="Visualizar PDF"
                                  >
                                    <img src={downloadIcon || "/placeholder.svg"} alt="Editar conceptos" className="facturacion-action-icon" />
                                  </button>
                                  {solicitud.tipo === "SOLICITUD_DE_FACTURA" && (
                                    <button
                                      className={`facturacion-action-btn ${solicitudesTimbradas.has(solicitud.identificador)
                                        ? 'facturacion-stamp-btn-vinculada'
                                        : 'facturacion-stamp-btn-disponible'
                                        }`}
                                      onClick={() => handleTimbrarClick(solicitud)}
                                      title={solicitudesTimbradas.has(solicitud.identificador) ? "Ya timbrada" : "Timbrar"}
                                    >
                                      <img
                                        src={stampIcon || "/placeholder.svg"}
                                        alt="Timbrar"
                                        className="facturacion-action-icon"
                                      />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="9" className="facturacion-no-data">No hay solicitudes registradas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="facturacion-table-card">
                <h4 className="facturacion-table-title">Facturas</h4>
                <div className="facturacion-table-container">
                  <table className="facturacion-table">
                    <thead className="facturacion-table-header-fixed">
                      <tr>
                        <th>Folio Fiscal</th>
                        <th>No. Solicitud</th>
                        <th>Factura Fiscal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasOrdenadas.length > 0 ? (
                        facturasOrdenadas.map((factura) => (
                          <tr key={factura.id}>
                            <td>{factura.folioFiscal}</td>
                            <td>{factura.noSolicitud}</td>
                            <td>
                              <div className="facturacion-factura-actions">
                                <span className="facturacion-archivo-nombre">
                                  {factura.nombreArchivo || "archivo.pdf"}
                                </span>
                                <button
                                  className="facturacion-action-btn facturacion-download-btn"
                                  onClick={() => handleDescargarFactura(factura)}
                                  title="Descargar"
                                >
                                  <img src={downloadIcon || "/placeholder.svg"} alt="Descargar" className="facturacion-action-icon" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="facturacion-no-data">No hay facturas timbradas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
          <EmisorModal
            isOpen={modals.emisor.isOpen}
            onClose={() => closeModal("emisor")}
            onSave={handleSaveEmisor}
            emisor={modals.emisor.emisor}
          />
          <SolicitudModal
            isOpen={modals.solicitud.isOpen}
            onClose={() => closeModal("solicitud")}
            onSave={handleSaveSolicitud}
            solicitud={modals.solicitud.solicitud}
            cotizaciones={cotizaciones}
            cuentasPorCobrar={cuentasPorCobrar}
            emisores={emisores}
            modulosActivos={modulosActivos}
          />
          <TimbrarModal
            isOpen={modals.timbrar.isOpen}
            onClose={() => closeModal("timbrar")}
            onSave={handleTimbrarSolicitud}
            solicitud={modals.timbrar.solicitud}
          />
          <ConfirmarEliminacionModal
            isOpen={modals.confirmarEliminacion.isOpen}
            onClose={() => closeModal("confirmarEliminacion")}
            onConfirm={modals.confirmarEliminacion.onConfirm}
            tipo={modals.confirmarEliminacion.tipo}
            item={modals.confirmarEliminacion.item}
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
  );
};

export default AdminFacturacion;