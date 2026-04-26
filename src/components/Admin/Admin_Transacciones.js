import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Admin_Transacciones.css"
import Header from "../Header/Header"
import Swal from "sweetalert2"
import deleteIcon from "../../assets/icons/eliminar.png"
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

const fetchEmpresas = async () => {
  try {
    const response = await fetchWithToken(`${API_BASE_URL}/empresas?estatus=CLIENTE`);
    const clientesResponse = await fetchWithToken(`${API_BASE_URL}/empresas?estatus=EN_PROCESO`);
    return [...(response.data || []), ...(clientesResponse.data || [])];
  } catch (error) {
    console.error("Error fetching empresas:", error);
    return [];
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
    sm: "transacciones-modal-sm",
    md: "transacciones-modal-md",
    lg: "transacciones-modal-lg",
    xl: "transacciones-modal-xl",
  }

  return (
    <div className="transacciones-modal-overlay" onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div className={`transacciones-modal-content ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
        <div className="transacciones-modal-header">
          <h2 className="transacciones-modal-title">{title}</h2>
          {canClose && (
            <button className="transacciones-modal-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        <div className="transacciones-modal-body">{children}</div>
      </div>
    </div>
  )
}

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultPagos = (esquema) => {
  switch (esquema) {
    case "UNICA": return 1;
    case "SEMANAL": return 4;
    case "QUINCENAL": return 6;
    case "MENSUAL": return 12;
    case "BIMESTRAL": return 6;
    case "TRIMESTRAL": return 4;
    case "SEMESTRAL": return 4;
    case "ANUAL": return 3;
    default: return 1;
  }
};

const NuevaTransaccionModal = ({ isOpen, onClose, onSave, categorias, cuentas, formasPago, setTransacciones, modulosActivos }) => {
  const [formData, setFormData] = useState({
    fecha: getTodayDate(),
    tipo: "",
    categoria: "",
    cuenta: "",
    esquema: "UNICA",
    fechaPago: "",
    monto: "",
    formaPago: "01",
    nota: "",
  });
  const [errors, setErrors] = useState({});
  const [dynamicCuentas, setDynamicCuentas] = useState([]);
  const [apiCuentas, setApiCuentas] = useState([]);
  const esquemas = ["UNICA", "SEMANAL", "QUINCENAL", "MENSUAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];
  const [mostrarModalPagoInmediato, setMostrarModalPagoInmediato] = useState(false);
  const [cuentaPorPagarCreada, setCuentaPorPagarCreada] = useState(null);
  const [datosTransaccionCreada, setDatosTransaccionCreada] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const today = getTodayDate();
      const defaultPagos = getDefaultPagos("UNICA");
      setFormData({
        fecha: today,
        tipo: "",
        categoria: "",
        cuenta: "",
        esquema: "UNICA",
        numeroPagos: defaultPagos.toString(),
        fechaPago: today,
        monto: "",
        formaPago: "01",
        nota: "",
      });
      setErrors({});
      setDynamicCuentas([]);
    }
  }, [isOpen]);
  useEffect(() => {
    if (formData.esquema) {
      const defaultPagos = getDefaultPagos(formData.esquema);
      setFormData((prev) => ({
        ...prev,
        numeroPagos: defaultPagos.toString(),
      }));
    }
  }, [formData.esquema]);


  useEffect(() => {
    const fetchDynamicCuentas = async () => {
      if (formData.categoria) {
        const cat = categorias.find(c => c.descripcion === formData.categoria);
        if (cat) {
          const cuentasForCat = cuentas.filter(c => c.categoria && c.categoria.id === cat.id).map(c => c.nombre);

          let cuentasAPI = [];
          const categoriaDesc = formData.categoria.toLowerCase();

          if (modulosActivos.empresas) {
            if (formData.tipo === "INGRESO" && ["ventas", "datos y plataforma", "revisiones", "equipos", "pagos de préstamo", "depósitos en garantía"].includes(categoriaDesc)) {
              const empresas = await fetchEmpresas();
              cuentasAPI = empresas.map(emp => emp.nombre);
            } else if (formData.tipo === "GASTO") {
              if (["rentas", "compra y activación de sim", "recargas de saldos"].includes(categoriaDesc)) {
                const empresas = await fetchEmpresas();
                cuentasAPI = empresas.map(emp => emp.nombre);
              }
            }
          }

          const todasLasCuentas = [...cuentasForCat, ...cuentasAPI];
          setDynamicCuentas(todasLasCuentas);
          setApiCuentas([]);
        }
      }
    };
    fetchDynamicCuentas();
  }, [formData.categoria, formData.tipo, cuentas, categorias]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "tipo" && { categoria: "", cuenta: "" }),
      ...(field === "categoria" && { cuenta: "" }),
    }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fecha) newErrors.fecha = "La fecha es obligatoria";
    if (!formData.tipo) newErrors.tipo = "El tipo es obligatorio";
    if (!formData.categoria) newErrors.categoria = "La categoría es obligatoria";
    if (!formData.cuenta) newErrors.cuenta = "La cuenta es obligatoria";
    if (!formData.monto || Number.parseFloat(formData.monto) <= 0)
      newErrors.monto = "El monto debe ser mayor a 0";
    if (!formData.fechaPago) newErrors.fechaPago = "La fecha de pago es obligatoria";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        const response = await fetchWithToken(`${API_BASE_URL}/transacciones/crear`, {
          method: "POST",
          body: JSON.stringify({
            fecha: formData.fecha,
            tipo: formData.tipo,
            categoriaId: categorias.find((c) => c.descripcion === formData.categoria)?.id,
            cuentaId: cuentas.find((c) => c.nombre === formData.cuenta)?.id || null,
            cuentaNombre: formData.cuenta,
            monto: parseFloat(formData.monto),
            esquema: formData.esquema,
            numeroPagos: parseInt(formData.numeroPagos),
            fechaPago: formData.fechaPago,
            formaPago: formData.formaPago,
            notas: formData.nota,
          }),
        });

        // Verificar si es GASTO con esquema UNICA
        if (response.data.esUnicaGasto && response.data.cuentaPorPagarId && modulosActivos.cxp) {
          setDatosTransaccionCreada(response.data.transaccion);
          setCuentaPorPagarCreada(response.data.cuentaPorPagarId);
          setMostrarModalPagoInmediato(true);
        } else {
          // Flujo normal
          onSave(response.data.transaccion || response.data);
          onClose();
          Swal.fire({
            icon: "success",
            title: "Éxito",
            text: "Transacción creada correctamente",
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "No se pudo crear la transacción",
        });
      }
    }
  };

  const categoriasFiltradas = categorias ? categorias.filter((cat) => cat && cat.tipo === formData.tipo) : [];
  const cuentasFiltradas = dynamicCuentas;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva transacción" size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="transacciones-form">
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="fecha">Fecha de registro <span className="required"> *</span></label>
            <input
              type="date"
              id="fecha"
              value={formData.fecha}
              onChange={(e) => handleInputChange("fecha", e.target.value)}
              className={`transacciones-form-control ${errors.fecha ? "error" : ""}`}
            />
            {errors.fecha && <span className="transacciones-error-message">{errors.fecha}</span>}
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="tipo">Tipo <span className="required"> *</span></label>
            <select
              id="tipo"
              value={formData.tipo}
              onChange={(e) => handleInputChange("tipo", e.target.value)}
              className={`transacciones-form-control ${errors.tipo ? "error" : ""}`}
            >
              <option value="">Ninguna seleccionada</option>
              <option value="INGRESO">Ingreso</option>
              <option value="GASTO">Gasto</option>
            </select>
            {errors.tipo && <span className="transacciones-error-message">{errors.tipo}</span>}
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="categoria">Categoría <span className="required"> *</span></label>
            <select
              id="categoria"
              value={formData.categoria}
              onChange={(e) => handleInputChange("categoria", e.target.value)}
              className={`transacciones-form-control ${errors.categoria ? "error" : ""}`}
              disabled={!formData.tipo}
            >
              <option value="">Ninguna seleccionada</option>
              {categoriasFiltradas
                .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' }))
                .map((cat) => (
                  <option key={cat.id} value={cat.descripcion}>
                    {cat.descripcion}
                  </option>
                ))}
            </select>
            {errors.categoria && <span className="transacciones-error-message">{errors.categoria}</span>}
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="cuenta">Cuenta <span className="required"> *</span></label>
            <select
              id="cuenta"
              value={formData.cuenta}
              onChange={(e) => handleInputChange("cuenta", e.target.value)}
              className={`transacciones-form-control ${errors.cuenta ? "error" : ""}`}
              disabled={!formData.categoria}
            >
              <option value="">Ninguna seleccionada</option>
              {cuentasFiltradas
                .sort((a, b) => a.localeCompare(b))
                .map((cuenta, index) => (
                  <option key={index} value={cuenta}>
                    {cuenta}
                  </option>
                ))}
            </select>
            {errors.cuenta && <span className="transacciones-error-message">{errors.cuenta}</span>}
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="esquema">Esquema <span className="required"> *</span></label>
            <select
              id="esquema"
              value={formData.esquema}
              onChange={(e) => handleInputChange("esquema", e.target.value)}
              className="transacciones-form-control"
            >
              {esquemas.map((esquema) => (
                <option key={esquema} value={esquema}>
                  {esquema === "UNICA" ? "Única" :
                    esquema === "SEMANAL" ? "Semanal" :
                      esquema === "QUINCENAL" ? "Quincenal" :
                        esquema === "MENSUAL" ? "Mensual" :
                          esquema === "BIMESTRAL" ? "Bimestral" :
                            esquema === "TRIMESTRAL" ? "Trimestral" :
                              esquema === "SEMESTRAL" ? "Semestral" :
                                "Anual"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="numeroPagos">Número de pagos <span className="required"> *</span></label>
            <input
              type="number"
              id="numeroPagos"
              value={formData.numeroPagos}
              onChange={(e) => handleInputChange("numeroPagos", e.target.value)}
              className="transacciones-form-control"
              min="1"
              placeholder="Número de pagos"
              disabled={formData.esquema === "UNICA"}
              readOnly={formData.esquema === "UNICA"}
            />
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="fechaPago">
              {formData.tipo === "GASTO"
                ? "Fecha de gasto"
                : formData.tipo === "INGRESO"
                  ? "Fecha de cobro"
                  : "Fecha de pago"}
              <span className="required"> *</span>
            </label>
            <input
              type="date"
              id="fechaPago"
              value={formData.fechaPago}
              onChange={(e) => handleInputChange("fechaPago", e.target.value)}
              className={`transacciones-form-control ${errors.fechaPago ? "error" : ""}`}
              disabled={false}
            />
            {errors.fechaPago && <span className="transacciones-error-message">{errors.fechaPago}</span>}
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="monto">Monto <span className="required"> *</span></label>
            <input
              type="number"
              id="monto"
              value={formData.monto}
              onChange={(e) => handleInputChange("monto", e.target.value)}
              className={`transacciones-form-control ${errors.monto ? "error" : ""}`}
              placeholder="$"
              step="0.01"
              min="0"
            />
            {errors.monto && <span className="transacciones-error-message">{errors.monto}</span>}
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="formaPago">Forma de Pago <span className="required"> *</span></label>
            <select
              id="formaPago"
              value={formData.formaPago}
              onChange={(e) => handleInputChange("formaPago", e.target.value)}
              className="transacciones-form-control"
            >
              {formasPago.map((forma) => (
                <option key={forma.value} value={forma.value}>
                  {forma.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="transacciones-form-row">
          <div className="transacciones-form-group">
            <label htmlFor="nota">Nota</label>
            <textarea
              id="nota"
              value={formData.nota}
              onChange={(e) => handleInputChange("nota", e.target.value)}
              className="transacciones-form-control"
              rows="3"
              placeholder="Nota opcional"
            />
          </div>
        </div>
        <div className="transacciones-form-actions">
          <button type="button" onClick={onClose} className="transacciones-btn transacciones-btn-cancel">
            Cancelar
          </button>
          <button type="submit" className="transacciones-btn transacciones-btn-primary">
            Crear
          </button>
        </div>
      </form>
      <ModalPagoInmediato
        isOpen={mostrarModalPagoInmediato}
        monto={formData.monto}
        formaPago={formData.formaPago}
        formasPago={formasPago}
        onConfirmarPago={async (datosPago) => {
          try {
            await fetchWithToken(`${API_BASE_URL}/cuentas-por-pagar/marcar-como-pagada`, {
              method: "POST",
              body: JSON.stringify({
                id: cuentaPorPagarCreada,
                montoPago: datosPago.montoPago,
                formaPago: datosPago.formaPago,
                usuarioId: 1
              }),
            });

            const transaccionActualizada = {
              ...datosTransaccionCreada,
              notas: " Transacción generada desde Cuentas por Pagar -" + (datosTransaccionCreada.notas || "")
            };

            onSave(transaccionActualizada);

            setMostrarModalPagoInmediato(false);
            onClose();

            Swal.fire({
              icon: "success",
              title: "Éxito",
              text: "Transacción creada y marcada como pagada",
            });
          } catch (error) {
            Swal.fire({
              icon: "error",
              title: "Error",
              text: "No se pudo marcar como pagada: " + error.message,
            });
          }
        }}
        onOmitir={() => {
          onSave(datosTransaccionCreada);
          setMostrarModalPagoInmediato(false);
          onClose();

          Swal.fire({
            icon: "success",
            title: "Éxito",
            text: "Transacción creada correctamente (Pendiente de pago)",
          });
        }}
      />
    </Modal>
  );
};

const GestionarCategoriasModal = ({ isOpen, onClose, categorias, onSaveCategoria, onDeleteCategoria }) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ tipo: "INGRESO", descripcion: "" })
  const [errors, setErrors] = useState({})

  const handleAddCategoria = () => {
    setShowAddForm(true)
    setFormData({ tipo: "INGRESO", descripcion: "" })
    setErrors({})
  }

  const handleSaveCategoria = async (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = "La descripción es obligatoria"
    }

    if (Object.keys(newErrors).length === 0) {
      try {
        const response = await fetchWithToken(`${API_BASE_URL}/categorias/crear`, {
          method: "POST",
          body: JSON.stringify({
            tipo: formData.tipo.toUpperCase(),
            descripcion: formData.descripcion.trim(),
          }),
        })


        onSaveCategoria(response)

        setShowAddForm(false)
        setFormData({ tipo: "INGRESO", descripcion: "" })
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: "Categoría creada correctamente",
        })
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "No se pudo crear la categoría",
        })
      }
    } else {
      setErrors(newErrors)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Categorías" size="lg" closeOnOverlayClick={false}>
      <div className="transacciones-categorias-content">
        {!showAddForm ? (
          <>
            <div className="transacciones-categorias-header">
              <button className="transacciones-btn transacciones-btn-primary" onClick={handleAddCategoria}>
                Agregar categoría
              </button>
            </div>

            <div className="transacciones-table-container">
              <table className="transacciones-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...categorias]
                    .sort((a, b) => {
                      const tipoCompare = a.tipo.localeCompare(b.tipo, 'es', { sensitivity: 'base' });
                      if (tipoCompare !== 0) return tipoCompare;
                      return a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
                    })
                    .map((categoria) => (
                      <tr key={categoria.id}>
                        <td>{categoria.tipo}</td>
                        <td>{categoria.descripcion}</td>
                        <td>
                          <button
                            className="transacciones-action-btn transacciones-delete-btn"
                            onClick={() => onDeleteCategoria(categoria)}
                            title="Eliminar"
                          >
                            <img
                              src={deleteIcon || "/placeholder.svg"}
                              alt="Eliminar"
                              className="transacciones-action-icon"
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="transacciones-modal-actions">
              <button className="transacciones-btn transacciones-btn-primary" onClick={onClose}>
                Guardar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSaveCategoria} className="transacciones-add-categoria-form">
            <h4>Agregar categoría</h4>

            <div className="transacciones-form-group">
              <label htmlFor="tipoCategoria">Tipo <span className="required"> *</span></label>
              <select
                id="tipoCategoria"
                value={formData.tipo}
                onChange={(e) => setFormData((prev) => ({ ...prev, tipo: e.target.value.toUpperCase() }))} // Convert to uppercase
                className="transacciones-form-control"
              >
                <option value="INGRESO">Ingreso</option>
                <option value="GASTO">Gasto</option>
              </select>
            </div>

            <div className="transacciones-form-group">
              <label htmlFor="descripcionCategoria">Descripción <span className="required"> *</span></label>
              <input
                type="text"
                id="descripcionCategoria"
                value={formData.descripcion}
                onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                className={`transacciones-form-control ${errors.descripcion ? "error" : ""}`}
                placeholder="Descripción de la categoría"
              />
              {errors.descripcion && <span className="transacciones-error-message">{errors.descripcion}</span>}
            </div>

            <div className="transacciones-form-actions">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="transacciones-btn transacciones-btn-cancel"
              >
                Cancelar
              </button>
              <button type="submit" className="transacciones-btn transacciones-btn-primary">
                Agregar
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}

const GestionarCuentasModal = ({ isOpen, onClose, cuentas, categorias, onSaveCuenta, onDeleteCuenta }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ categoria: "", nombre: "" });
  const [errors, setErrors] = useState({});
  const [filtroCategoria, setFiltroCategoria] = useState("Todas las categorías");

  const handleAddCuenta = () => {
    setShowAddForm(true);
    setFormData({ categoria: "", nombre: "" });
    setErrors({});
  };

  const handleSaveCuenta = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.categoria) {
      newErrors.categoria = "La categoría es obligatoria";
    }
    if (!formData.nombre.trim()) {
      newErrors.nombre = "El nombre es obligatorio";
    }

    if (Object.keys(newErrors).length === 0) {
      try {
        const selectedCategory = categorias.find((cat) => cat.descripcion === formData.categoria);
        const categoryId = selectedCategory ? selectedCategory.id : null;

        if (!categoryId) {
          throw new Error("Categoría no encontrada");
        }

        const response = await fetchWithToken(`${API_BASE_URL}/cuentas/crear`, {
          method: "POST",
          body: JSON.stringify({
            nombre: formData.nombre.trim(),
            categoriaId: categoryId,
          }),
        });
        onSaveCuenta(response);
        setShowAddForm(false);
        setFormData({ categoria: "", nombre: "" });
        Swal.fire({
          icon: "success",
          title: "Éxito",
          text: "Cuenta creada correctamente",
        });
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "No se pudo crear la cuenta",
        });
      }
    } else {
      setErrors(newErrors);
    }
  };

  const cuentasFiltradas =
    filtroCategoria === "Todas las categorías"
      ? cuentas
      : cuentas.filter((cuenta) => cuenta.categoria.descripcion === filtroCategoria);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cuentas" size="lg" closeOnOverlayClick={false}>
      <div className="transacciones-cuentas-content">
        {!showAddForm ? (
          <>
            <div className="transacciones-cuentas-header">
              <div className="transacciones-filter-group">
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="transacciones-form-control"
                >
                  <option value="Todas las categorías">Todas las categorías</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.descripcion}>
                      {cat.descripcion}
                    </option>
                  ))}
                </select>
              </div>
              <button className="transacciones-btn transacciones-btn-primary" onClick={handleAddCuenta}>
                Agregar cuenta
              </button>
            </div>

            <div className="transacciones-table-container">
              <table className="transacciones-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Nombre</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cuentasFiltradas]
                    .sort((a, b) => {
                      const categoriaCompare = a.categoria.descripcion.localeCompare(b.categoria.descripcion);
                      if (categoriaCompare !== 0) return categoriaCompare;
                      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
                    })
                    .map((cuenta) => (
                      <tr key={cuenta.id}>
                        <td>{cuenta.categoria.descripcion}</td>
                        <td>{cuenta.nombre}</td>
                        <td>
                          <button
                            className="transacciones-action-btn transacciones-delete-btn"
                            onClick={() => onDeleteCuenta(cuenta)}
                            title="Eliminar"
                          >
                            <img
                              src={deleteIcon || "/placeholder.svg"}
                              alt="Eliminar"
                              className="transacciones-action-icon"
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="transacciones-modal-actions">
              <button className="transacciones-btn transacciones-btn-primary" onClick={onClose}>
                Guardar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSaveCuenta} className="transacciones-add-cuenta-form">
            <h4>Agregar cuenta</h4>

            <div className="transacciones-form-group">
              <label htmlFor="categoriaCuenta">Categoría <span className="required"> *</span></label>
              <select
                id="categoriaCuenta"
                value={formData.categoria}
                onChange={(e) => setFormData((prev) => ({ ...prev, categoria: e.target.value }))}
                className={`transacciones-form-control ${errors.categoria ? "error" : ""}`}
              >
                <option value="">Seleccione una categoría</option>
                {categorias
                  .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
                  .map((cat) => (
                    <option key={cat.id} value={cat.descripcion}>
                      {cat.descripcion}
                    </option>
                  ))}
              </select>
              {errors.categoria && <span className="transacciones-error-message">{errors.categoria}</span>}
            </div>

            <div className="transacciones-form-group">
              <label htmlFor="nombreCuenta">Nombre <span className="required"> *</span></label>
              <input
                type="text"
                id="nombreCuenta"
                value={formData.nombre}
                onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
                className={`transacciones-form-control ${errors.nombre ? "error" : ""}`}
                placeholder="Nombre de la cuenta"
              />
              {errors.nombre && <span className="transacciones-error-message">{errors.nombre}</span>}
            </div>

            <div className="transacciones-form-actions">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="transacciones-btn transacciones-btn-cancel"
              >
                Cancelar
              </button>
              <button type="submit" className="transacciones-btn transacciones-btn-primary">
                Agregar
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

const ModalPagoInmediato = ({ isOpen, onClose, onConfirmarPago, onOmitir, monto, formaPago, formasPago }) => {
  const [montoPago, setMontoPago] = useState("");
  const [formaPagoSeleccionada, setFormaPagoSeleccionada] = useState("01");

  useEffect(() => {
    if (isOpen) {
      setMontoPago(monto || "");
      setFormaPagoSeleccionada(formaPago || "01");
    }
  }, [isOpen, monto, formaPago]);

  const handleConfirmar = () => {
    if (!montoPago || parseFloat(montoPago) <= 0) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "El monto debe ser mayor a 0",
      });
      return;
    }

    onConfirmarPago({
      montoPago: parseFloat(montoPago),
      formaPago: formaPagoSeleccionada
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onOmitir} title="¿Marcar como pagada?" size="sm" closeOnOverlayClick={false}>
      <div className="transacciones-pago-inmediato">
        <p className="transacciones-pago-mensaje" style={{ marginBottom: "20px", fontSize: "14px" }}>
          Esta cuenta por pagar ha sido creada. ¿Deseas marcarla como pagada ahora?
        </p>

        <div className="transacciones-form-group">
          <label htmlFor="montoPagoInmediato">Monto a pagar <span className="required"> *</span></label>
          <input
            type="number"
            id="montoPagoInmediato"
            value={montoPago}
            onChange={(e) => setMontoPago(e.target.value)}
            className="transacciones-form-control"
            step="0.01"
            min="0"
            placeholder="$"
          />
        </div>

        <div className="transacciones-form-group">
          <label htmlFor="formaPagoInmediato">Forma de pago <span className="required"> *</span></label>
          <select
            id="formaPagoInmediato"
            value={formaPagoSeleccionada}
            onChange={(e) => setFormaPagoSeleccionada(e.target.value)}
            className="transacciones-form-control"
          >
            {formasPago.map((forma) => (
              <option key={forma.value} value={forma.value}>
                {forma.label}
              </option>
            ))}
          </select>
        </div>

        <div className="transacciones-modal-form-actions">
          <button
            type="button"
            onClick={onOmitir}
            className="transacciones-btn transacciones-btn-cancel"
          >
            Omitir
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            className="transacciones-btn transacciones-btn-confirm"
          >
            Marcar como pagada
          </button>
        </div>
      </div>
    </Modal>
  );
};

const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm, tipo, item }) => {
  const getMessage = () => {
    switch (tipo) {
      case "transaccion":
        return "¿Seguro que quieres eliminar la transacción de forma permanente?"
      case "categoria":
        return "¿Seguro que quieres eliminar la categoría de forma permanente?"
      case "cuenta":
        return "¿Seguro que quieres eliminar la cuenta de forma permanente?"
      default:
        return "¿Seguro que quieres eliminar este elemento de forma permanente?"
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar eliminación" size="sm" closeOnOverlayClick={false}>
      <div className="transacciones-confirmar-eliminacion">
        <div className="transacciones-confirmation-content">
          <p className="transacciones-confirmation-message">{getMessage()}</p>
          <div className="transacciones-modal-form-actions">
            <button type="button" onClick={onClose} className="transacciones-btn transacciones-btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} className="transacciones-btn transacciones-btn-confirm">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

const CustomDatePickerInput = ({ value, onClick, placeholder }) => (
  <div className="transacciones-date-picker-wrapper">
    <input
      type="text"
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      readOnly
      className="transacciones-date-picker"
    />
    <div className="transacciones-date-picker-icons">
      <svg
        className="transacciones-calendar-icon"
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

const AdminTransacciones = () => {
  const navigate = useNavigate();
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { balance: true, transacciones: true, cotizaciones: true, facturacion: true, cxc: true, cxp: true, comisiones: true };
  const userRol = localStorage.getItem("userRol")
  const [transacciones, setTransacciones] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [filtrosCuenta, setFiltrosCuenta] = useState("Todas");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroFormaPago, setFiltroFormaPago] = useState("Todas");
  const [isLoading, setIsLoading] = useState(true);
  const [ordenFecha, setOrdenFecha] = useState('asc');
  const [modals, setModals] = useState({
    nuevaTransaccion: { isOpen: false },
    gestionarCategorias: { isOpen: false },
    gestionarCuentas: { isOpen: false },
    confirmarEliminacion: { isOpen: false, tipo: "", item: null, onConfirm: null },
  });

  const [rangoFechas, setRangoFechas] = useState([null, null]);
  const [fechaInicio, fechaFin] = rangoFechas;

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

  const obtenerRangoMesActual = () => {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = ahora.getMonth();

    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);

    return [primerDia, ultimoDia];
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [transaccionesResp, categoriasResp, cuentasResp] = await Promise.all([
          fetchWithToken(`${API_BASE_URL}/transacciones`),
          fetchWithToken(`${API_BASE_URL}/categorias`),
          fetchWithToken(`${API_BASE_URL}/cuentas`),
        ]);
        setTransacciones(transaccionesResp.data || []);
        setCategorias(categoriasResp.data || []);
        setCuentas(cuentasResp.data || []);

        const rangoMesActual = obtenerRangoMesActual();
        setRangoFechas(rangoMesActual);
      } catch (error) {
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

  const isFullyPaid = (transaccionId) => {
    const transaccion = transacciones.find((t) => t.id === transaccionId);
    return transaccion && transaccion.notas && transaccion.notas.includes("Transacción generada desde Cuentas por Pagar");
  };

  const filtrarTransaccionesPorFecha = (transacciones) => {
    return transacciones.filter(transaccion => {
      const fechaTransaccion = new Date(transaccion.fechaPago + 'T00:00:00');

      let inicio = fechaInicio ? new Date(fechaInicio) : null;
      let fin = fechaFin ? new Date(fechaFin) : null;

      if (inicio) {
        inicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
      }

      if (fin) {
        fin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59);
      }

      const pasaFechas = (!inicio || fechaTransaccion >= inicio) && (!fin || fechaTransaccion <= fin);

      return pasaFechas;
    });
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

  const handleSaveTransaccion = async (transaccionData) => {
    setTransacciones((prev) => [...prev, transaccionData]);
  };

  const handleSaveCategoria = async (categoriaData) => {
    setCategorias((prev) => [...prev, categoriaData.data]);
  };

  const handleSaveCuenta = async (cuentaData) => {
    setCuentas((prev) => [...prev, cuentaData.data]);
  };

  const handleCategoriaChange = (categoria) => {
    setFiltroCategoria(categoria);
    setFiltrosCuenta("Todas");
  };

  const handleDeleteTransaccion = (transaccion) => {
    openModal("confirmarEliminacion", {
      tipo: "transaccion",
      item: transaccion,
      onConfirm: async () => {
        try {
          const result = await fetchWithToken(`${API_BASE_URL}/transacciones/${transaccion.id}`, { method: "DELETE" });
          if (result.status === 204) {
            setTransacciones((prev) => prev.filter((t) => t.id !== transaccion.id));
            closeModal("confirmarEliminacion");
            Swal.fire({
              icon: "success",
              title: "Éxito",
              text: "Transacción eliminada correctamente",
            });
          } else {
            throw new Error("Respuesta inesperada del servidor");
          }
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo eliminar la transacción",
          });
        }
      },
    });
  };

  const handleDeleteCategoria = (categoria) => {
    const tieneCuentas = cuentas.some((cuenta) => cuenta.categoria.descripcion === categoria.descripcion);

    if (tieneCuentas) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se puede eliminar la categoría porque tiene cuentas vinculadas",
      });
      return;
    }

    openModal("confirmarEliminacion", {
      tipo: "categoria",
      item: categoria,
      onConfirm: async () => {
        try {
          const result = await fetchWithToken(`${API_BASE_URL}/categorias/${categoria.id}`, { method: "DELETE" });
          if (result.status === 204) {
            setCategorias((prev) => prev.filter((c) => c.id !== categoria.id));
            closeModal("confirmarEliminacion");
            Swal.fire({
              icon: "success",
              title: "Éxito",
              text: "Categoría eliminada correctamente",
            });
          } else {
            throw new Error("Respuesta inesperada del servidor");
          }
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo eliminar la categoría",
          });
        }
      },
    });
  };

  const handleDeleteCuenta = (cuenta) => {
    const tieneTransacciones = transacciones.some((transaccion) => {
      return transaccion.cuentaId === cuenta.id ||
        transaccion.cuenta?.id === cuenta.id ||
        transaccion.cuenta?.nombre === cuenta.nombre;
    });

    if (tieneTransacciones) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se puede eliminar la cuenta porque está vinculada a una o más transacciones",
      });
      return;
    }

    openModal("confirmarEliminacion", {
      tipo: "cuenta",
      item: cuenta,
      onConfirm: async () => {
        try {
          const result = await fetchWithToken(`${API_BASE_URL}/cuentas/${cuenta.id}`, { method: "DELETE" });
          if (result.status === 204) {
            setCuentas((prev) => prev.filter((c) => c.id !== cuenta.id));
            closeModal("confirmarEliminacion");
            Swal.fire({
              icon: "success",
              title: "Éxito",
              text: "Cuenta eliminada correctamente",
            });
          } else {
            throw new Error("Respuesta inesperada del servidor");
          }
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo eliminar la cuenta",
          });
        }
      },
    });
  };

  const transaccionesBase = transacciones.filter((t) => t.tipo === "INGRESO" || (t.tipo === "GASTO" && isFullyPaid(t.id)));
  const transaccionesPorFecha = filtrarTransaccionesPorFecha(transaccionesBase);

  // Filtrar por categoría primero
  const transaccionesPorCategoria = filtroCategoria === "Todas"
    ? transaccionesPorFecha
    : transaccionesPorFecha.filter((t) => t.categoria && t.categoria.descripcion === filtroCategoria);

  // Luego filtrar por cuenta
  const transaccionesSinOrdenar = filtrosCuenta === "Todas"
    ? transaccionesPorCategoria
    : transaccionesPorCategoria.filter((t) => t.cuenta && t.cuenta.nombre === filtrosCuenta);

  const transaccionesPorFormaPago = filtroFormaPago === "Todas"
    ? transaccionesSinOrdenar
    : transaccionesSinOrdenar.filter((t) => t.formaPago === filtroFormaPago);

  const transaccionesFiltradas = transaccionesPorFormaPago.sort((a, b) => {
    const fechaA = new Date(a.fechaPago);
    const fechaB = new Date(b.fechaPago);
    return ordenFecha === 'desc' ? fechaB - fechaA : fechaA - fechaB;
  });

  const cuentasUnicas = (() => {
    if (filtroCategoria === "Todas") {
      return ["Todas", ...new Set(cuentas.filter(c => c && c.nombre).map((c) => c.nombre))];
    } else {
      const cuentasFiltradas = cuentas.filter(c =>
        c && c.nombre && c.categoria && c.categoria.descripcion === filtroCategoria
      );
      return ["Todas", ...new Set(cuentasFiltradas.map((c) => c.nombre))];
    }
  })();

  const categoriasUnicas = ["Todas", ...new Set(categorias.map(c => c.descripcion))];

  const toggleOrdenFecha = () => {
    setOrdenFecha(prevOrden => prevOrden === 'desc' ? 'asc' : 'desc');
  };

  const totalIngresos = transaccionesFiltradas
    .filter(t => t.tipo === "INGRESO")
    .reduce((acc, curr) => acc + Number(curr.monto), 0);

  const totalGastos = transaccionesFiltradas
    .filter(t => t.tipo === "GASTO")
    .reduce((acc, curr) => acc + Number(curr.monto), 0);

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="transacciones-loading">
            <div className="spinner"></div>
            <p>Cargando datos de transacciones...</p>
          </div>
        )}
        <main className="transacciones-main-content">
          <div className="transacciones-container">
            <section className="transacciones-sidebar">
              <div className="transacciones-sidebar-header">
                <h3 className="transacciones-sidebar-title">Administración</h3>
              </div>
              <div className="transacciones-sidebar-menu">
                {userRol === "ADMINISTRADOR" && modulosActivos.balance && (
                  <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("balance")}>
                    Balance
                  </div>
                )}
                {modulosActivos.transacciones && (
                  <div className="transacciones-menu-item transacciones-menu-item-active" onClick={() => handleMenuNavigation("transacciones")}>
                    Transacciones
                  </div>
                )}
                {modulosActivos.cotizaciones && (
                  <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("cotizaciones")}>
                    Cotizaciones
                  </div>
                )}
                {modulosActivos.facturacion && (
                  <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("facturacion")}>
                    Facturas/Notas
                  </div>
                )}
                {modulosActivos.cxc && (
                  <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("cuentas-cobrar")}>
                    Cuentas por Cobrar
                  </div>
                )}
                {modulosActivos.cxp && (
                  <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("cuentas-pagar")}>
                    Cuentas por Pagar
                  </div>
                )}
                {modulosActivos.transacciones && (
                  <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("caja-chica")}>
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
            <section className="transacciones-content-panel">
              <div className="transacciones-header">
                <div className="transacciones-header-info">
                  <h3 className="transacciones-page-title">Transacciones</h3>
                  <p className="transacciones-subtitle">Gestión de ingresos y gastos</p>
                </div>
                <div className="transacciones-header-actions">
                  <button
                    className="transacciones-btn transacciones-btn-primary"
                    onClick={() => openModal("nuevaTransaccion")}
                  >
                    Crear transacción
                  </button>
                  <button
                    className="transacciones-btn transacciones-btn-secondary"
                    onClick={() => openModal("gestionarCategorias")}
                  >
                    Gestionar categorías
                  </button>
                  <button
                    className="transacciones-btn transacciones-btn-secondary"
                    onClick={() => openModal("gestionarCuentas")}
                  >
                    Gestionar cuentas
                  </button>
                </div>
              </div>
              <div className="transacciones-resumen-grid">
                <div className="transacciones-resumen-card transacciones-ingresos">
                  <h4 className="transacciones-resumen-titulo">Total Ingresos</h4>
                  <p className="transacciones-resumen-monto">
                    ${totalIngresos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="transacciones-resumen-card transacciones-gastos">
                  <h4 className="transacciones-resumen-titulo">Total Gastos</h4>
                  <p className="transacciones-resumen-monto">
                    ${totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="transacciones-filters-section">
                <div className="filters-left">

                  <div className="transacciones-filter-group">
                    <select
                      value={filtroCategoria}
                      onChange={(e) => handleCategoriaChange(e.target.value)}
                      className="transacciones-filter-select"
                    >
                      {categoriasUnicas.map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria === "Todas" ? "Todas las categorías" : categoria}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="transacciones-filter-group">
                    <select
                      value={filtrosCuenta}
                      onChange={(e) => setFiltrosCuenta(e.target.value)}
                      className="transacciones-filter-select"
                    >
                      {cuentasUnicas.map((cuenta) => (
                        <option key={cuenta} value={cuenta}>
                          {cuenta === "Todas" ? "Todas las cuentas" : cuenta}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="transacciones-filter-group">
                    <select
                      value={filtroFormaPago}
                      onChange={(e) => setFiltroFormaPago(e.target.value)}
                      className="transacciones-filter-select"
                    >
                      <option value="Todas">Todas las formas de pago</option>
                      {formasPago.map((forma) => (
                        <option key={forma.value} value={forma.value}>
                          {forma.label}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>

                <div className="filters-right">
                  <div className="transacciones-filtro-grupo">
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
                    className="transacciones-btn transacciones-btn-filtro"
                    onClick={() => setRangoFechas(obtenerRangoMesActual())}
                    title="Mes actual"
                  >
                    Mes
                  </button>
                  <button
                    className="transacciones-btn transacciones-btn-filtro transacciones-btn-orden"
                    onClick={toggleOrdenFecha}
                    title={`Cambiar a orden ${ordenFecha === 'desc' ? 'ascendente' : 'descendente'}`}
                  >
                    {ordenFecha === 'desc' ? '📅 ↓ Recientes primero' : '📅 ↑ Antiguas primero'}
                  </button>
                </div>
              </div>
              <div className="transacciones-table-card">
                <h4 className="transacciones-table-title">Transacciones</h4>
                <div className="transacciones-table-container">
                  <table className="transacciones-table">
                    <thead className="transacciones-table-header-fixed">
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Categoría</th>
                        <th>Cuenta</th>
                        <th>Monto</th>
                        <th>Forma de pago</th>
                        <th>Nota</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transaccionesFiltradas.length > 0 ? (
                        transaccionesFiltradas.map((transaccion) => (
                          <tr key={transaccion.id}>
                            <td>
                              {transaccion.fechaPago}
                            </td>
                            <td>
                              <span className={`transacciones-tipo-badge ${transaccion.tipo.toLowerCase()}`}>
                                {transaccion.tipo}
                              </span>
                            </td>
                            <td>{transaccion.categoria?.descripcion || 'N/A'}</td>
                            <td>{transaccion.cuenta?.nombre || 'N/A'}</td>
                            <td>${transaccion.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                            <td>
                              {formasPago.find((fp) => fp.value === transaccion.formaPago)?.label || transaccion.formaPago}
                            </td>
                            <td>{transaccion.notas || "-"}</td>
                            <td>
                              <button
                                className="transacciones-action-btn transacciones-delete-btn"
                                onClick={() => handleDeleteTransaccion(transaccion)}
                                title="Eliminar"
                              >
                                <img
                                  src={deleteIcon || "/placeholder.svg"}
                                  alt="Eliminar"
                                  className="transacciones-action-icon"
                                />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="transacciones-no-data">
                            No hay transacciones registradas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
          <NuevaTransaccionModal
            isOpen={modals.nuevaTransaccion.isOpen}
            onClose={() => closeModal("nuevaTransaccion")}
            onSave={handleSaveTransaccion}
            categorias={categorias}
            cuentas={cuentas}
            formasPago={formasPago}
            setTransacciones={setTransacciones}
            modulosActivos={modulosActivos}
          />
          <GestionarCategoriasModal
            isOpen={modals.gestionarCategorias.isOpen}
            onClose={() => closeModal("gestionarCategorias")}
            categorias={categorias}
            onSaveCategoria={handleSaveCategoria}
            onDeleteCategoria={handleDeleteCategoria}
          />
          <GestionarCuentasModal
            isOpen={modals.gestionarCuentas.isOpen}
            onClose={() => closeModal("gestionarCuentas")}
            cuentas={cuentas}
            categorias={categorias}
            onSaveCuenta={handleSaveCuenta}
            onDeleteCuenta={handleDeleteCuenta}
          />
          <ConfirmarEliminacionModal
            isOpen={modals.confirmarEliminacion.isOpen}
            onClose={() => closeModal("confirmarEliminacion")}
            onConfirm={modals.confirmarEliminacion.onConfirm}
            tipo={modals.confirmarEliminacion.tipo}
            item={modals.confirmarEliminacion.item}
          />
        </main>
      </div>
    </>
  );
};

export default AdminTransacciones