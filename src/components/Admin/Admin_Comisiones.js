import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Admin_Comisiones.css"
import jsPDF from "jspdf"
import Header from "../Header/Header"
import Swal from "sweetalert2"
import deleteIcon from "../../assets/icons/eliminar.png"
import detailsIcon from "../../assets/icons/lupa.png"
import editIcon from "../../assets/icons/editar.png"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { API_BASE_URL } from "../Config/Config"

const fetchWithToken = async (url, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = new Headers();
    if (token) {
        headers.append("Authorization", `Bearer ${token}`);
    }
    if (!(options.body instanceof FormData)) {
        headers.append("Content-Type", "application/json");
    }
    const response = await fetch(url, {
        cache: "no-store",
        ...options,
        headers,
    });
    if (!response.ok) {
        throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`);
    }
    if (response.status === 204) {
        return { status: 204, data: null };
    }
    try {
        const data = await response.json();
        return { status: response.status, data };
    } catch (error) {
        return { status: response.status, data: null };
    }
};

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
        sm: "comisiones-modal-sm",
        md: "comisiones-modal-md",
        lg: "comisiones-modal-lg",
        xl: "comisiones-modal-xl",
    }

    return (
        <div className="comisiones-modal-overlay" onClick={closeOnOverlayClick ? onClose : () => { }}>
            <div className={`comisiones-modal-content ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
                <div className="comisiones-modal-header">
                    <h2 className="comisiones-modal-title">{title}</h2>
                    {canClose && (
                        <button className="comisiones-modal-close" onClick={onClose}>
                            ✕
                        </button>
                    )}
                </div>
                <div className="comisiones-modal-body">{children}</div>
            </div>
        </div>
    )
}

const CustomDatePickerInput = ({ value, onClick, placeholder }) => (
    <div className="comisiones-date-picker-wrapper">
        <input
            type="text"
            value={value}
            onClick={onClick}
            placeholder={placeholder}
            readOnly
            className="comisiones-date-picker"
        />
        <div className="comisiones-date-picker-icons">
            <svg
                className="comisiones-calendar-icon"
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

const obtenerRangoMesActual = () => {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = ahora.getMonth();

    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);

    return [primerDia, ultimoDia];
};

const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, onDownload }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Vista previa" size="xl" closeOnOverlayClick={false}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                    <button
                        type="button"
                        onClick={onDownload}
                        className="comisiones-btn"
                        style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        Descargar PDF
                    </button>
                </div>

                <div style={{
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    height: '75vh'
                }}>
                    <iframe
                        src={`${pdfUrl}#view=FitH&navpanes=0&toolbar=0`}
                        title="Vista Previa"
                        width="100%"
                        height="100%"
                        style={{ border: 'none' }}
                    />
                </div>
            </div>
        </Modal>
    );
};

const ModalFormularioComision = ({ isOpen, onClose, onSave, initialData = null, empresas, cuentasComisiones }) => {
    const isEdit = !!initialData;

    const [formData, setFormData] = useState({
        empresaId: "",
        tratoId: "",
        cuentaPorCobrarId: "",
        vendedorCuentaId: "",
        vendedorNuevoNombre: "",
        porcentajeVenta: "",
        proyectoCuentaId: "",
        proyectoNuevoNombre: "",
        porcentajeProyecto: "",
        notas: ""
    });

    const [tratos, setTratos] = useState([]);
    const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
    const [isCreatingNewVendedor, setIsCreatingNewVendedor] = useState(false);
    const [montoBase, setMontoBase] = useState(0);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen && initialData) {
            const vendedorExiste = cuentasComisiones.some(
                cuenta => cuenta.id === initialData.vendedorCuentaId
            );

            setFormData({
                empresaId: initialData.empresaId || "",
                tratoId: initialData.tratoId || "",
                cuentaPorCobrarId: initialData.cuentaPorCobrarId || "",
                vendedorCuentaId: vendedorExiste ? initialData.vendedorCuentaId || "" : "",
                vendedorNuevoNombre: "",
                porcentajeVenta: initialData.porcentajeVenta !== undefined && initialData.porcentajeVenta !== null ? initialData.porcentajeVenta : "",  // ✅ CORREGIDO
                proyectoCuentaId: initialData.proyectoCuentaId || "",
                porcentajeProyecto: initialData.porcentajeProyecto !== undefined && initialData.porcentajeProyecto !== null ? initialData.porcentajeProyecto : "",  // ✅ CORREGIDO
                notas: initialData.notas || ""
            });

            setIsCreatingNewVendedor(false);
        } else if (isOpen && !initialData) {
            setFormData({
                empresaId: "",
                tratoId: "",
                cuentaPorCobrarId: "",
                vendedorCuentaId: "",
                vendedorNuevoNombre: "",
                porcentajeVenta: "",
                proyectoCuentaId: "",
                porcentajeProyecto: "",
                notas: ""
            });
            setMontoBase(0);
            setIsCreatingNewVendedor(false);
        }
        setErrors({});
    }, [isOpen, initialData, cuentasComisiones]);

    useEffect(() => {
        if (formData.empresaId) {
            fetchTratos(formData.empresaId);
        } else {
            setTratos([]);
        }
    }, [formData.empresaId]);

    useEffect(() => {
        if (formData.tratoId) {
            fetchCuentasPorCobrar(formData.tratoId);
        } else {
            setCuentasPorCobrar([]);
        }
    }, [formData.tratoId]);

    useEffect(() => {
        if (formData.cuentaPorCobrarId) {
            const cuentaSeleccionada = cuentasPorCobrar.find(c => c.id === parseInt(formData.cuentaPorCobrarId));
            if (cuentaSeleccionada) {
                setMontoBase(cuentaSeleccionada.montoPagado || 0);
            }
        } else {
            setMontoBase(0);
        }
    }, [formData.cuentaPorCobrarId, cuentasPorCobrar]);

    const fetchTratos = async (empresaId) => {
        try {
            const response = await fetchWithToken(`${API_BASE_URL}/tratos/empresa/${empresaId}/activos`);
            setTratos(response.data || []);
        } catch (error) {
            console.error("Error al cargar tratos:", error);
            setTratos([]);
        }
    };

    const fetchCuentasPorCobrar = async (tratoId) => {
        try {
            let url = `${API_BASE_URL}/cuentas-por-cobrar/trato/${tratoId}/pagadas-proceso`;

            if (isEdit && formData.cuentaPorCobrarId) {
                url += `?cuentaActualId=${formData.cuentaPorCobrarId}`;
            }

            const response = await fetchWithToken(url);
            setCuentasPorCobrar(response.data || []);
        } catch (error) {
            console.error("Error al cargar cuentas por cobrar:", error);
            setCuentasPorCobrar([]);
        }
    };

    const handleChange = (field, value) => {
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

        if (!formData.empresaId) newErrors.empresaId = "Seleccione una empresa";
        if (!formData.tratoId) newErrors.tratoId = "Seleccione un trato";
        if (!formData.cuentaPorCobrarId) newErrors.cuentaPorCobrarId = "Seleccione una cuenta por cobrar";

        if (!isCreatingNewVendedor && !formData.vendedorCuentaId) {
            newErrors.vendedorCuentaId = "Seleccione un vendedor";
        }
        if (isCreatingNewVendedor && !formData.vendedorNuevoNombre.trim()) {
            newErrors.vendedorNuevoNombre = "Ingrese el nombre del vendedor";
        }

        const porcentajeVenta = formData.porcentajeVenta.toString().trim();
        if (!porcentajeVenta || isNaN(parseFloat(porcentajeVenta)) || parseFloat(porcentajeVenta) < 0 || parseFloat(porcentajeVenta) > 100) {
            newErrors.porcentajeVenta = "El porcentaje debe estar entre 0 y 100";
        }

        if (!formData.proyectoCuentaId) {
            newErrors.proyectoCuentaId = "Seleccione una cuenta de proyecto";
        }

        const porcentajeProyecto = formData.porcentajeProyecto.toString().trim();
        if (!porcentajeProyecto || isNaN(parseFloat(porcentajeProyecto)) || parseFloat(porcentajeProyecto) < 0 || parseFloat(porcentajeProyecto) > 100) {
            newErrors.porcentajeProyecto = "El porcentaje debe estar entre 0 y 100";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validateForm()) {
            const dataToSend = {
                empresaId: parseInt(formData.empresaId),
                tratoId: parseInt(formData.tratoId),
                cuentaPorCobrarId: parseInt(formData.cuentaPorCobrarId),
                vendedorCuentaId: isCreatingNewVendedor ? null : parseInt(formData.vendedorCuentaId),
                vendedorNuevoNombre: isCreatingNewVendedor ? formData.vendedorNuevoNombre : null,
                porcentajeVenta: parseFloat(formData.porcentajeVenta) || 0,
                proyectoCuentaId: parseInt(formData.proyectoCuentaId),
                proyectoNuevoNombre: null,
                porcentajeProyecto: parseFloat(formData.porcentajeProyecto) || 0,
                notas: formData.notas || null
            };

            onSave(dataToSend);
        }
    };

    const calcularMontoComision = (porcentaje) => {
        if (!porcentaje || !montoBase) return 0;
        return (montoBase * parseFloat(porcentaje)) / 100;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? "Editar comisión" : "Crear comisión"}
            size="md"
            closeOnOverlayClick={false}
        >
            <form onSubmit={handleSubmit} className="comisiones-form">

                <div className="comisiones-form-group">
                    <label>Empresa <span className="required">*</span></label>
                    <select
                        name="empresaId"
                        value={formData.empresaId}
                        onChange={(e) => handleChange("empresaId", e.target.value)}
                        className={`comisiones-form-control ${errors.empresaId ? "error" : ""}`}
                        disabled={isEdit}
                    >
                        <option value="">Seleccione una empresa</option>
                        {[...empresas]
                            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
                            .map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.nombre}
                                </option>
                            ))
                        }
                    </select>
                    {errors.empresaId && <span className="comisiones-error-message">{errors.empresaId}</span>}
                </div>

                <div className="comisiones-form-group">
                    <label>Trato <span className="required">*</span></label>
                    <select
                        name="tratoId"
                        value={formData.tratoId}
                        onChange={(e) => handleChange("tratoId", e.target.value)}
                        className={`comisiones-form-control ${errors.tratoId ? "error" : ""}`}
                        disabled={isEdit || !formData.empresaId}
                    >
                        <option value="">Seleccione un trato</option>
                        {tratos.map(trato => <option key={trato.id} value={trato.id}>{trato.nombre}</option>)}
                    </select>
                    {errors.tratoId && <span className="comisiones-error-message">{errors.tratoId}</span>}
                </div>

                <div className="comisiones-form-group">
                    <label>Cuenta por cobrar <span className="required">*</span></label>
                    <select
                        name="cuentaPorCobrarId"
                        value={formData.cuentaPorCobrarId}
                        onChange={(e) => handleChange("cuentaPorCobrarId", e.target.value)}
                        className={`comisiones-form-control ${errors.cuentaPorCobrarId ? "error" : ""}`}
                        disabled={isEdit || !formData.tratoId}
                    >
                        <option value="">Seleccione cuenta</option>
                        {cuentasPorCobrar.map(cuenta => (
                            <option key={cuenta.id} value={cuenta.id}>
                                {cuenta.folio} - ${cuenta.montoPagado} ({cuenta.estatus})
                            </option>
                        ))}
                    </select>
                    {errors.cuentaPorCobrarId && <span className="comisiones-error-message">{errors.cuentaPorCobrarId}</span>}
                </div>

                {montoBase > 0 && (
                    <div className="comisiones-info-box">
                        <strong>Monto base:</strong> ${montoBase.toFixed(2)}
                    </div>
                )}

                <div className="comisiones-form-group">
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
                    <div className="comisiones-form-group">
                        <label>Vendedor <span className="required">*</span></label>
                        <select
                            name="vendedorCuentaId"
                            value={formData.vendedorCuentaId}
                            onChange={(e) => handleChange("vendedorCuentaId", e.target.value)}
                            className={`comisiones-form-control ${errors.vendedorCuentaId ? "error" : ""}`}
                        >
                            <option value="">Ninguna seleccionada</option>
                            {cuentasComisiones.map(cuenta => (
                                <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                            ))}
                        </select>
                        {errors.vendedorCuentaId && <span className="comisiones-error-message">{errors.vendedorCuentaId}</span>}
                    </div>
                ) : (
                    <div className="comisiones-form-group">
                        <label>Nombre del vendedor <span className="required">*</span></label>
                        <input
                            type="text"
                            name="vendedorNuevoNombre"
                            value={formData.vendedorNuevoNombre}
                            onChange={(e) => handleChange("vendedorNuevoNombre", e.target.value)}
                            className={`comisiones-form-control ${errors.vendedorNuevoNombre ? "error" : ""}`}
                            placeholder="Ingrese el nombre"
                        />
                        {errors.vendedorNuevoNombre && <span className="comisiones-error-message">{errors.vendedorNuevoNombre}</span>}
                    </div>
                )}

                <div className="comisiones-split-row">
                    <div className="comisiones-form-group">
                        <label>Comisión <span className="required">*</span></label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                name="porcentajeVenta"
                                step="0.01"
                                min="0"
                                max="100"
                                value={formData.porcentajeVenta}
                                onChange={(e) => handleChange("porcentajeVenta", e.target.value)}
                                className={`comisiones-form-control ${errors.porcentajeVenta ? "error" : ""}`}
                                placeholder="0%"
                            />
                            <span style={{ position: 'absolute', right: '10px', top: '8px', color: '#999' }}>%</span>
                        </div>
                        {errors.porcentajeVenta && <span className="comisiones-error-message">{errors.porcentajeVenta}</span>}
                    </div>
                    <div className="comisiones-form-group">
                        <label>Monto:</label>
                        <input
                            type="text"
                            value={`$${calcularMontoComision(formData.porcentajeVenta).toFixed(2)}`}
                            className="comisiones-form-control"
                            disabled
                        />
                    </div>
                </div>

                <div className="comisiones-form-group">
                    <label>Comisión de proyecto <span className="required">*</span></label>
                    <select
                        name="proyectoCuentaId"
                        value={formData.proyectoCuentaId}
                        onChange={(e) => handleChange("proyectoCuentaId", e.target.value)}
                        className={`comisiones-form-control ${errors.proyectoCuentaId ? "error" : ""}`}
                    >
                        <option value="">Seleccione una cuenta</option>
                        {cuentasComisiones.map(cuenta => (
                            <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                        ))}
                    </select>
                    {errors.proyectoCuentaId && <span className="comisiones-error-message">{errors.proyectoCuentaId}</span>}
                </div>

                <div className="comisiones-split-row">
                    <div className="comisiones-form-group">
                        <label>Comisión <span className="required">*</span></label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                name="porcentajeProyecto"
                                step="0.01"
                                min="0"
                                max="100"
                                value={formData.porcentajeProyecto}
                                onChange={(e) => handleChange("porcentajeProyecto", e.target.value)}
                                className={`comisiones-form-control ${errors.porcentajeProyecto ? "error" : ""}`}
                                placeholder="0%"
                            />
                            <span style={{ position: 'absolute', right: '10px', top: '8px', color: '#999' }}>%</span>
                        </div>
                        {errors.porcentajeProyecto && <span className="comisiones-error-message">{errors.porcentajeProyecto}</span>}
                    </div>
                    <div className="comisiones-form-group">
                        <label>Monto <span className="required">*</span></label>
                        <input
                            type="text"
                            value={`$${calcularMontoComision(formData.porcentajeProyecto).toFixed(2)}`}
                            className="comisiones-form-control"
                            disabled
                        />
                    </div>
                </div>

                <div className="comisiones-form-group">
                    <label>Notas</label>
                    <textarea
                        name="notas"
                        value={formData.notas}
                        onChange={(e) => handleChange("notas", e.target.value)}
                        className="comisiones-form-control"
                        rows="3"
                    ></textarea>
                </div>

                <div className="comisiones-form-actions">
                    <button type="button" onClick={onClose} className="comisiones-btn comisiones-btn-cancel">
                        Cancelar
                    </button>
                    <button type="submit" className="comisiones-btn comisiones-btn-primary">
                        {isEdit ? "Guardar" : "Agregar"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const ModalDetallesComision = ({ isOpen, onClose, data }) => {
    if (!data) return null;

    const getBadgeClass = (status) => {
        if (status === 'PAGADO') return 'bg-success';
        if (status === 'PENDIENTE') return 'bg-danger';
        return 'bg-secondary';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detalles comisión" size="lg" closeOnOverlayClick={false}>

            <div className="comisiones-split-row" style={{ alignItems: 'flex-start', gap: '40px' }}>
                <div style={{ flex: 1 }}>
                    <span className="comisiones-detail-label">Empresa:</span>
                    <div className="comisiones-detail-value">{data.empresaNombre}</div>

                    <span className="comisiones-detail-label">Cuenta por cobrar:</span>
                    <div className="comisiones-detail-value">{data.folioCuentaPorCobrar}</div>

                    <span className="comisiones-detail-label">Notas:</span>
                    <div className="comisiones-detail-value" style={{ textTransform: 'none', whiteSpace: 'pre-wrap' }}>
                        {data.notas || "Sin notas"}
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: '20px' }}>
                        <span className="comisiones-detail-label">Trato:</span>
                        <div className="comisiones-detail-value">{data.tratoNombre}</div>
                    </div>

                    <div className="comisiones-split-row" style={{ gap: '30px' }}>
                        <div style={{ flex: 1 }}>
                            <span className="comisiones-detail-label">Fecha de pago:</span>
                            <div className="comisiones-detail-value">{data.fechaPago}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <span className="comisiones-detail-label">Monto base:</span>
                            <div className="comisiones-detail-value">
                                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(data.montoBase)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="comisiones-audit-section">
                <h4 className="comisiones-audit-title">Información de Comisiones</h4>

                <div className="comisiones-audit-grid" style={{ gap: '40px', alignItems: 'start' }}>

                    <div>
                        <div style={{ height: '140px' }}>
                            <span className="comisiones-detail-label">Vendedor:</span>
                            <div className="comisiones-detail-value" style={{ marginBottom: '10px' }}>{data.vendedorNombre}</div>

                            <span className="comisiones-detail-label">Estatus:</span>
                            <div className={`status-badge-large ${getBadgeClass(data.estatusVenta)}`}>
                                {data.estatusVenta}
                            </div>
                        </div>

                        <div>
                            <span className="comisiones-detail-label">Comisión de proyecto:</span>
                            <div className="comisiones-detail-value" style={{ marginBottom: '10px' }}>{data.proyectoNombre}</div>

                            <span className="comisiones-detail-label">Estatus:</span>
                            <div className={`status-badge-large ${getBadgeClass(data.estatusProyecto)}`}>
                                {data.estatusProyecto}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style={{ height: '140px' }}>
                            <div className="comisiones-split-row" style={{ gap: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <span className="comisiones-detail-label">Comisión:</span>
                                    <div className="comisiones-detail-value">{data.porcentajeVenta}%</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <span className="comisiones-detail-label">Monto:</span>
                                    <div className="comisiones-detail-value">
                                        {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(data.montoComisionVenta)}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                <span className="comisiones-detail-label">Saldo pendiente:</span>
                                <div className="comisiones-detail-value">
                                    {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(data.saldoPendienteVenta)}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="comisiones-split-row" style={{ gap: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <span className="comisiones-detail-label">Comisión:</span>
                                    <div className="comisiones-detail-value">{data.porcentajeProyecto}%</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <span className="comisiones-detail-label">Monto:</span>
                                    <div className="comisiones-detail-value">
                                        {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(data.montoComisionProyecto)}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                <span className="comisiones-detail-label">Saldo pendiente:</span>
                                <div className="comisiones-detail-value">
                                    {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(data.saldoPendienteProyecto)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="comisiones-form-actions">
                    <button type="button" onClick={onClose} className="comisiones-btn comisiones-btn-primary">
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirmar eliminación" size="sm" closeOnOverlayClick={false}>
            <div className="comisiones-confirmar-eliminacion">
                <div className="comisiones-confirmation-content">
                    <p className="comisiones-confirmation-message">
                        ¿Seguro que quieres eliminar esta comisión de forma permanente?
                    </p>
                    <div className="comisiones-modal-form-actions">
                        <button type="button" onClick={onClose} className="comisiones-btn comisiones-btn-cancel">
                            Cancelar
                        </button>
                        <button type="button" onClick={onConfirm} className="comisiones-btn comisiones-btn-confirm">
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

const AdminComisiones = () => {
    const navigate = useNavigate();
    const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { balance: true, transacciones: true, cotizaciones: true, facturacion: true, cxc: true, cxp: true, comisiones: true };
    const userRol = localStorage.getItem("userRol");
    const [comisiones, setComisiones] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [cuentasComisiones, setCuentasComisiones] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [ordenFecha, setOrdenFecha] = useState('desc');

    const [modals, setModals] = useState({
        formulario: { isOpen: false, mode: 'crear', data: null },
        detalles: { isOpen: false, data: null },
        confirmarEliminacion: { isOpen: false, item: null, onConfirm: null },
    });

    const [rangoFechas, setRangoFechas] = useState([null, null]);
    const [fechaInicio, fechaFin] = rangoFechas;

    const [filtroEmpresa, setFiltroEmpresa] = useState("");
    const [filtroVendedor, setFiltroVendedor] = useState("");

    const [pdfPreview, setPdfPreview] = useState({
        isOpen: false,
        url: null,
        filename: ""
    });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [comisionesData, empresasData, cuentasData] = await Promise.all([
                    fetchWithToken(`${API_BASE_URL}/comisiones`),
                    fetchWithToken(`${API_BASE_URL}/empresas/clientes`),
                    fetchWithToken(`${API_BASE_URL}/comisiones/cuentas-comisiones`)
                ]);

                setComisiones(comisionesData.data || comisionesData);
                setEmpresas(empresasData.data || empresasData);
                setCuentasComisiones(cuentasData.data || cuentasData);

                const rangoMesActual = obtenerRangoMesActual();
                setRangoFechas(rangoMesActual);
            } catch (error) {
                console.error("Error cargando datos:", error);
                Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los datos" });
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

    const handleCrear = async () => {
        try {
            const cuentasData = await fetchWithToken(`${API_BASE_URL}/comisiones/cuentas-comisiones?t=${Date.now()}`);
            setCuentasComisiones(cuentasData.data || cuentasData);
        } catch (error) {
            console.error("Error al refrescar vendedores:", error);
        }

        setModals(prev => ({
            ...prev,
            formulario: { isOpen: true, mode: 'crear', data: null }
        }));
    };

    const handleEditar = async (comision) => {
        try {
            const cuentasData = await fetchWithToken(`${API_BASE_URL}/comisiones/cuentas-comisiones?t=${Date.now()}`);
            setCuentasComisiones(cuentasData.data || cuentasData);
        } catch (error) {
            console.error("Error al refrescar vendedores:", error);
        }

        setModals(prev => ({
            ...prev,
            formulario: { isOpen: true, mode: 'editar', data: comision }
        }));
    };

    const handleDetalles = (comision) => {
        setModals(prev => ({
            ...prev,
            detalles: { isOpen: true, data: comision }
        }));
    };

    const handleSaveComision = async (formData) => {
        try {
            let response;

            if (modals.formulario.mode === 'editar') {
                response = await fetchWithToken(`${API_BASE_URL}/comisiones/${modals.formulario.data.id}`, {
                    method: "PUT",
                    body: JSON.stringify(formData),
                });

                setComisiones(prev => prev.map(c => c.id === modals.formulario.data.id ? response.data : c));

                Swal.fire({
                    icon: "success",
                    title: "Éxito",
                    text: "Comisión actualizada correctamente",
                });
            } else {
                response = await fetchWithToken(`${API_BASE_URL}/comisiones`, {
                    method: "POST",
                    body: JSON.stringify(formData),
                });

                setComisiones(prev => [...prev, response.data]);

                Swal.fire({
                    icon: "success",
                    title: "Éxito",
                    text: "Comisión creada correctamente",
                });
            }

            try {
                const cuentasData = await fetchWithToken(`${API_BASE_URL}/comisiones/cuentas-comisiones?t=${Date.now()}`);
                setCuentasComisiones(cuentasData.data || cuentasData);
            } catch (fetchError) {
                console.error("No se pudo actualizar la lista de vendedores:", fetchError);
            }

            closeModal("formulario");
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error.message || "Error al guardar la comisión",
            });
        }
    };

    const closeModal = (modalName) => {
        setModals(prev => ({
            ...prev,
            [modalName]: { ...prev[modalName], isOpen: false }
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

    const handleDeleteComision = (comision) => {
        openModal("confirmarEliminacion", {
            item: comision,
            onConfirm: async () => {
                try {
                    await fetchWithToken(`${API_BASE_URL}/comisiones/${comision.id}`, {
                        method: "DELETE",
                    });

                    setComisiones((prev) => prev.filter((c) => c.id !== comision.id));
                    closeModal("confirmarEliminacion");

                    Swal.fire({
                        icon: "success",
                        title: "Éxito",
                        text: "Comisión eliminada correctamente",
                    });
                } catch (error) {
                    Swal.fire({
                        icon: "error",
                        title: "Error",
                        text: "No se pudo eliminar la comisión",
                    });
                }
            },
        });
    };

    const filtrarComisiones = (comisiones) => {
        return comisiones.filter(comision => {
            const fechaComision = new Date(comision.fechaPago + 'T00:00:00');

            let inicio = fechaInicio ? new Date(fechaInicio) : null;
            let fin = fechaFin ? new Date(fechaFin) : null;

            if (inicio) {
                inicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
            }

            if (fin) {
                fin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59);
            }

            const pasaFechas = (!inicio || fechaComision >= inicio) && (!fin || fechaComision <= fin);
            const pasaEmpresa = filtroEmpresa === "" || comision.empresaNombre === filtroEmpresa;
            const pasaVendedor = filtroVendedor === "" || comision.vendedorNombre === filtroVendedor;

            return pasaFechas && pasaEmpresa && pasaVendedor;
        });
    };

    const comisionesFiltradas = filtrarComisiones(comisiones).sort((a, b) => {
        const fechaA = new Date(a.fechaPago);
        const fechaB = new Date(b.fechaPago);
        return ordenFecha === 'desc' ? fechaB - fechaA : fechaA - fechaB;
    });

    const toggleOrdenFecha = () => {
        setOrdenFecha(prevOrden => prevOrden === 'desc' ? 'asc' : 'desc');
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
        }).format(amount);
    };

    const handleClosePreview = () => {
        if (pdfPreview.url) {
            window.URL.revokeObjectURL(pdfPreview.url);
        }
        setPdfPreview({ isOpen: false, url: null, filename: "" });
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
                title: "Reporte descargado",
                text: `El archivo ${pdfPreview.filename} se ha guardado correctamente`,
                timer: 3000,
                showConfirmButton: false,
            });
        }
    };

    const handleGenerarReporte = async () => {
        try {
            Swal.fire({
                title: "Generando reporte...",
                text: "Por favor espere mientras se genera el PDF",
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading()
                },
            })

            const fechaActual = new Date().toLocaleDateString("es-MX")

            const pdf = new jsPDF("p", "mm", "a4")
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const margin = 15

            let currentY = margin

            const checkPageBreak = (requiredHeight) => {
                if (currentY + requiredHeight > pageHeight - margin) {
                    pdf.addPage()
                    currentY = margin
                    return true
                }
                return false
            }

            const splitTextToFit = (text, maxWidth) => {
                return pdf.splitTextToSize(text, maxWidth)
            }

            pdf.setFillColor(0, 19, 59)
            pdf.rect(0, 0, pageWidth, 25, "F")

            pdf.setFontSize(22)
            pdf.setFont("helvetica", "bold")
            pdf.setTextColor(255, 255, 255)
            pdf.text("REPORTE DE COMISIONES", pageWidth / 2, 12, { align: "center" })

            pdf.setFontSize(10)
            pdf.setFont("helvetica", "normal")
            pdf.text(`Fecha de generación: ${fechaActual}`, pageWidth / 2, 19, { align: "center" })

            currentY = 35
            pdf.setTextColor(0, 0, 0)

            checkPageBreak(45)
            pdf.setFontSize(16)
            pdf.setFont("helvetica", "bold")
            pdf.setTextColor(0, 19, 59)
            pdf.text("RESUMEN FINANCIERO", margin, currentY)
            currentY += 12

            const boxWidth = (pageWidth - 2 * margin - 10) / 2
            const boxHeight = 25

            // Saldo Pendiente Ventas
            pdf.setDrawColor(255, 152, 0)
            pdf.setLineWidth(0.5)
            pdf.setFillColor(255, 248, 225)
            pdf.roundedRect(margin, currentY, boxWidth, boxHeight, 3, 3, "FD")

            pdf.setFontSize(9)
            pdf.setFont("helvetica", "bold")
            pdf.setTextColor(230, 81, 0)
            pdf.text("SALDO PENDIENTE VENTAS", margin + boxWidth / 2, currentY + 8, { align: "center" })

            pdf.setFontSize(16)
            pdf.setTextColor(242, 113, 0)
            pdf.text(formatCurrency(totalComisionesVentaPendiente), margin + boxWidth / 2, currentY + 18, {
                align: "center",
            })

            // Saldo Pendiente Proyectos
            pdf.setDrawColor(33, 150, 243)
            pdf.setFillColor(227, 242, 253)
            pdf.roundedRect(margin + boxWidth + 10, currentY, boxWidth, boxHeight, 3, 3, "FD")

            pdf.setFontSize(9)
            pdf.setFont("helvetica", "bold")
            pdf.setTextColor(21, 101, 192)
            pdf.text("SALDO PENDIENTE PROYECTOS", margin + boxWidth + 10 + boxWidth / 2, currentY + 8, { align: "center" })

            pdf.setFontSize(16)
            pdf.setTextColor(33, 150, 243)
            pdf.text(
                formatCurrency(totalComisionesProyectoPendiente),
                margin + boxWidth + 10 + boxWidth / 2,
                currentY + 18,
                { align: "center" }
            )

            currentY += boxHeight + 20

            const comisionesFormateadas = comisionesFiltradas.map((comision) => ({
                fecha: comision.fechaPago,
                empresa: comision.empresaNombre,
                vendedor: comision.vendedorNombre,
                estatusVendedor: comision.estatusVenta,
                proyecto: comision.proyectoNombre,
                estatusProyecto: comision.estatusProyecto,
                montoBase: comision.montoBase,
                saldoProyecto: comision.saldoPendienteProyecto,
            }))


            const crearTablaComisiones = (datos, titulo, isLastTable = false) => {
                if (!datos || datos.length === 0) {
                    checkPageBreak(30)
                    pdf.setFontSize(14)
                    pdf.setFont("helvetica", "bold")
                    pdf.text(titulo, margin, currentY)
                    currentY += 10

                    pdf.setFontSize(10)
                    pdf.setFont("helvetica", "normal")
                    pdf.text("No hay comisiones registradas", margin, currentY)
                    currentY += 15
                    return
                }

                checkPageBreak(25)
                pdf.setFontSize(14)
                pdf.setFont("helvetica", "bold")
                pdf.setTextColor(0, 19, 59)
                pdf.text(titulo, margin, currentY)
                currentY += 10
                pdf.setTextColor(0, 0, 0)

                const tableWidth = pageWidth - 2 * margin
                const headers = ["Fecha", "Empresa", "Vendedor", "E.V", "Proyecto", "E.P", "Total Cobrado", "Saldo P."]
                const colWidths = [20, 28, 25, 17, 28, 17, 22.5, 22.5]
                const rowHeightBase = 6
                const lineHeight = 4

                checkPageBreak(rowHeightBase + 5)
                pdf.setFillColor(0, 19, 59)
                pdf.rect(margin, currentY, tableWidth, rowHeightBase, "F")

                pdf.setFontSize(8)
                pdf.setFont("helvetica", "bold")
                pdf.setTextColor(255, 255, 255)
                let xPosition = margin
                headers.forEach((header, index) => {
                    const textX = xPosition + colWidths[index] / 2
                    pdf.text(header, textX, currentY + 4, { align: "center" })
                    xPosition += colWidths[index]
                })
                currentY += rowHeightBase

                pdf.setFont("helvetica", "normal")
                pdf.setTextColor(0, 0, 0)

                datos.forEach((fila, index) => {
                    const empresaLines = splitTextToFit(fila.empresa, colWidths[1] - 3)
                    const vendedorLines = splitTextToFit(fila.vendedor, colWidths[2] - 3)
                    const proyectoLines = splitTextToFit(fila.proyecto, colWidths[4] - 3)

                    const maxLines = Math.max(empresaLines.length, vendedorLines.length, proyectoLines.length, 1)
                    const rowHeight = Math.max(rowHeightBase, maxLines * lineHeight + 2)

                    checkPageBreak(rowHeight)

                    if (index % 2 === 0) {
                        pdf.setFillColor(248, 249, 250)
                        pdf.rect(margin, currentY, tableWidth, rowHeight, "F")
                    }

                    pdf.setDrawColor(224, 224, 224)
                    pdf.setLineWidth(0.1)
                    pdf.line(margin, currentY + rowHeight, margin + tableWidth, currentY + rowHeight)

                    xPosition = margin
                    const baseY = currentY + 4

                    // Fecha
                    pdf.setFontSize(7)
                    pdf.setFont("helvetica", "normal")
                    pdf.text(fila.fecha, xPosition + colWidths[0] / 2, baseY, { align: "center" })
                    xPosition += colWidths[0]

                    pdf.setFontSize(7)
                    empresaLines.forEach((line, i) => {
                        pdf.text(line, xPosition + 1.5, baseY + (i * lineHeight))
                    })
                    xPosition += colWidths[1]

                    vendedorLines.forEach((line, i) => {
                        pdf.text(line, xPosition + 1.5, baseY + (i * lineHeight))
                    })
                    xPosition += colWidths[2]

                    pdf.setFontSize(6.5)
                    pdf.setFont("helvetica", "bold")
                    if (fila.estatusVendedor === "PAGADO") {
                        pdf.setTextColor(76, 175, 80)
                    } else if (fila.estatusVendedor === "PENDIENTE") {
                        pdf.setTextColor(244, 67, 54)
                    }
                    pdf.text(fila.estatusVendedor, xPosition + colWidths[3] / 2, baseY, { align: "center" })
                    pdf.setTextColor(0, 0, 0)
                    pdf.setFont("helvetica", "normal")
                    xPosition += colWidths[3]

                    pdf.setFontSize(7)
                    proyectoLines.forEach((line, i) => {
                        pdf.text(line, xPosition + 1.5, baseY + (i * lineHeight))
                    })
                    xPosition += colWidths[4]

                    pdf.setFontSize(6.5)
                    pdf.setFont("helvetica", "bold")
                    if (fila.estatusProyecto === "PAGADO") {
                        pdf.setTextColor(76, 175, 80)
                    } else if (fila.estatusProyecto === "PENDIENTE") {
                        pdf.setTextColor(244, 67, 54)
                    }
                    pdf.text(fila.estatusProyecto, xPosition + colWidths[5] / 2, baseY, { align: "center" })
                    pdf.setTextColor(0, 0, 0)
                    pdf.setFont("helvetica", "normal")
                    xPosition += colWidths[5]

                    pdf.setFontSize(7)
                    pdf.setFont("helvetica", "bold")
                    pdf.setTextColor(0, 19, 59)
                    const montoBaseText = formatCurrency(fila.montoBase)
                    pdf.text(montoBaseText, xPosition + colWidths[6] - 3, baseY, { align: "right" })
                    pdf.setTextColor(0, 0, 0)
                    pdf.setFont("helvetica", "normal")
                    xPosition += colWidths[6]

                    pdf.setFont("helvetica", "bold")
                    pdf.setTextColor(33, 150, 243)
                    const saldoText = formatCurrency(fila.saldoProyecto)
                    pdf.text(saldoText, xPosition + colWidths[7] - 3, baseY, { align: "right" })
                    pdf.setTextColor(0, 0, 0)
                    pdf.setFont("helvetica", "normal")

                    currentY += rowHeight
                })

                if (!isLastTable) {
                    currentY += 15
                }
            }

            crearTablaComisiones(comisionesFormateadas, "DETALLE DE COMISIONES", true);

            const fechaArchivo = new Date().toISOString().split("T")[0]
            const nombreArchivo = `Comisiones_${fechaArchivo}.pdf`
            const blobUrl = pdf.output('bloburl')

            Swal.close()

            setPdfPreview({
                isOpen: true,
                url: blobUrl,
                filename: nombreArchivo
            })

        } catch (error) {
            console.error("Error al generar el reporte:", error)
            Swal.fire({
                icon: "error",
                title: "Error al generar reporte",
                text: "Ocurrió un error al generar el PDF. Por favor, inténtelo nuevamente.",
            })
        }
    }

    const totalComisionesVentaPendiente = comisionesFiltradas.reduce((sum, c) => sum + (c.saldoPendienteVenta || 0), 0);
    const totalComisionesProyectoPendiente = comisionesFiltradas.reduce((sum, c) => sum + (c.saldoPendienteProyecto || 0), 0);

    const empresasUnicas = ["", ...[...new Set(comisiones.map(c => c.empresaNombre))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))];
    const vendedoresUnicos = ["", ...[...new Set(comisiones.map(c => c.vendedorNombre))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))];

    return (
        <>
            <div className="page-with-header">
                <Header />
                {isLoading && (
                    <div className="comisiones-loading">
                        <div className="spinner"></div>
                        <p>Cargando datos de comisiones...</p>
                    </div>
                )}
                <main className="comisiones-main-content">
                    <div className="comisiones-container">
                        <section className="comisiones-sidebar">
                            <div className="comisiones-sidebar-header">
                                <h3 className="comisiones-sidebar-title">Administración</h3>
                            </div>
                            <div className="comisiones-sidebar-menu">
                                {userRol === "ADMINISTRADOR" && modulosActivos.balance && (
                                    <div className="comisiones-menu-item" onClick={() => handleMenuNavigation("balance")}>
                                        Balance
                                    </div>
                                )}

                                {modulosActivos.transacciones && (
                                    <div className="comisiones-menu-item" onClick={() => handleMenuNavigation("transacciones")}>
                                        Transacciones
                                    </div>
                                )}

                                {modulosActivos.cotizaciones && (
                                    <div className="comisiones-menu-item" onClick={() => handleMenuNavigation("cotizaciones")}>
                                        Cotizaciones
                                    </div>
                                )}

                                {modulosActivos.facturacion && (
                                    <div className="comisiones-menu-item" onClick={() => handleMenuNavigation("facturacion")}>
                                        Facturas/Notas
                                    </div>
                                )}

                                {modulosActivos.cxc && (
                                    <div className="comisiones-menu-item" onClick={() => handleMenuNavigation("cuentas-cobrar")}>
                                        Cuentas por Cobrar
                                    </div>
                                )}

                                {modulosActivos.cxp && (
                                    <div className="comisiones-menu-item" onClick={() => handleMenuNavigation("cuentas-pagar")}>
                                        Cuentas por Pagar
                                    </div>
                                )}

                                {modulosActivos.transacciones && (
                                    <div className="comisiones-menu-item" onClick={() => handleMenuNavigation("caja-chica")}>
                                        Caja chica
                                    </div>
                                )}

                                {modulosActivos.comisiones && (
                                    <div
                                        className="comisiones-menu-item comisiones-menu-item-active"
                                        onClick={() => handleMenuNavigation("comisiones")}
                                    >
                                        Comisiones
                                    </div>
                                )}
                            </div>
                        </section>
                        <section className="comisiones-content-panel">
                            <div className="comisiones-header">
                                <div className="comisiones-header-info">
                                    <h3 className="comisiones-page-title">Comisiones</h3>
                                    <p className="comisiones-subtitle">Gestión de comisiones de venta y proyecto</p>
                                </div>
                                <div className="comisiones-header-actions">
                                    <button
                                        className="comisiones-btn comisiones-btn-reporte"
                                        onClick={handleGenerarReporte}
                                    >
                                        Visualizar Reporte
                                    </button>
                                    <button
                                        className="comisiones-btn comisiones-btn-primary"
                                        onClick={handleCrear}
                                    >
                                        Crear comisión
                                    </button>
                                </div>
                            </div>

                            <div className="comisiones-resumen-grid">
                                <div className="comisiones-resumen-card comisiones-venta">
                                    <h4 className="comisiones-resumen-titulo">Saldo Pendiente Ventas</h4>
                                    <p className="comisiones-resumen-monto">{formatCurrency(totalComisionesVentaPendiente)}</p>
                                </div>

                                <div className="comisiones-resumen-card comisiones-proyecto">
                                    <h4 className="comisiones-resumen-titulo">Saldo Pendiente Proyectos</h4>
                                    <p className="comisiones-resumen-monto">{formatCurrency(totalComisionesProyectoPendiente)}</p>
                                </div>
                            </div>

                            <div className="comisiones-filters-section">
                                <div className="filters-left">
                                    <div className="comisiones-filter-group">
                                        <select
                                            value={filtroEmpresa}
                                            onChange={(e) => setFiltroEmpresa(e.target.value)}
                                            className="comisiones-filter-select"
                                        >
                                            <option value="">Todas las empresas</option>
                                            {empresasUnicas.filter(e => e).map((empresa) => (
                                                <option key={empresa} value={empresa}>
                                                    {empresa}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="comisiones-filter-group">
                                        <select
                                            value={filtroVendedor}
                                            onChange={(e) => setFiltroVendedor(e.target.value)}
                                            className="comisiones-filter-select"
                                        >
                                            <option value="">Todos los vendedores</option>
                                            {vendedoresUnicos.filter(v => v).map((vendedor) => (
                                                <option key={vendedor} value={vendedor}>
                                                    {vendedor}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="filters-right">
                                    <div className="comisiones-filtro-grupo">
                                        <label>Filtro por fecha:</label>
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

                                    <button
                                        className="comisiones-btn comisiones-btn-filtro"
                                        onClick={() => setRangoFechas(obtenerRangoMesActual())}
                                        title="Mes actual"
                                    >
                                        Mes
                                    </button>
                                    <button
                                        className="comisiones-btn comisiones-btn-filtro comisiones-btn-orden"
                                        onClick={toggleOrdenFecha}
                                        title={`Cambiar a orden ${ordenFecha === 'desc' ? 'ascendente' : 'descendente'}`}
                                    >
                                        {ordenFecha === 'desc' ? '📅 ↓ Recientes primero' : '📅 ↑ Antiguas primero'}
                                    </button>
                                </div>
                            </div>

                            <div className="comisiones-table-card">
                                <h4 className="comisiones-table-title">Registro de Comisiones</h4>
                                <div className="comisiones-table-container">
                                    <table className="comisiones-table">
                                        <thead className="comisiones-table-header-fixed">
                                            <tr>
                                                <th>Fecha de pago</th>
                                                <th>Empresa</th>
                                                <th>Trato</th>
                                                <th className="comisiones-col-nota">Nota</th>
                                                <th>Total Cobrado</th>
                                                <th>Estatus Vendedor</th>
                                                <th>Estatus Proyecto</th>
                                                <th>Saldo Proyecto</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {comisionesFiltradas.length > 0 ? (
                                                comisionesFiltradas.map((comision) => (
                                                    <tr key={comision.id}>
                                                        <td>{comision.fechaPago}</td>
                                                        <td>{comision.empresaNombre}</td>
                                                        <td>{comision.tratoNombre}</td>
                                                        <td className="comisiones-col-nota">{comision.notas || "-"}</td>
                                                        <td>{formatCurrency(comision.montoBase)}</td>
                                                        <td>
                                                            <span className={`comisiones-status-badge ${comision.estatusVenta.toLowerCase()}`}>
                                                                {comision.estatusVenta}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`comisiones-status-badge ${comision.estatusProyecto.toLowerCase()}`}>
                                                                {comision.estatusProyecto}
                                                            </span>
                                                        </td>
                                                        <td>{formatCurrency(comision.saldoPendienteProyecto)}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                                <button
                                                                    className="comisiones-action-btn comisiones-details-btn"
                                                                    onClick={() => handleDetalles(comision)}>
                                                                    <img src={detailsIcon} alt="Detalles" className="comisiones-action-icon" />
                                                                </button>
                                                                <button
                                                                    className="comisiones-action-btn comisiones-edit-btn"
                                                                    onClick={() => handleEditar(comision)}>
                                                                    <img src={editIcon} alt="Editar" className="comisiones-action-icon" />
                                                                </button>
                                                                <button
                                                                    className="comisiones-action-btn comisiones-delete-btn"
                                                                    onClick={() => handleDeleteComision(comision)}
                                                                    title="Eliminar"
                                                                >
                                                                    <img
                                                                        src={deleteIcon || "/placeholder.svg"}
                                                                        alt="Eliminar"
                                                                        className="comisiones-action-icon"
                                                                    />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="9" className="comisiones-no-data">
                                                        No hay comisiones registradas
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    </div>
                    <ModalFormularioComision
                        isOpen={modals.formulario.isOpen}
                        onClose={() => closeModal("formulario")}
                        onSave={handleSaveComision}
                        initialData={modals.formulario.mode === 'editar' ? modals.formulario.data : null}
                        empresas={empresas}
                        cuentasComisiones={cuentasComisiones}
                    />
                    <ModalDetallesComision
                        isOpen={modals.detalles.isOpen}
                        onClose={() => closeModal("detalles")}
                        data={modals.detalles.data}
                    />
                    <ConfirmarEliminacionModal
                        isOpen={modals.confirmarEliminacion.isOpen}
                        onClose={() => closeModal("confirmarEliminacion")}
                        onConfirm={modals.confirmarEliminacion.onConfirm}
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

export default AdminComisiones;