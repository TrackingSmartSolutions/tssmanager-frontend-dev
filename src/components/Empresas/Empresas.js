import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useParams } from 'react-router-dom';
import "./Empresas.css"
import "./MapModal.css"
import Header from "../Header/Header"
import editIcon from "../../assets/icons/editar.png"
import deleteIcon from "../../assets/icons/eliminar.png"
import detailsIcon from "../../assets/icons/lupa.png"
import { NuevoTratoModal } from '../Tratos/Tratos';
import { API_BASE_URL } from "../Config/Config"
import MapModal from './MapModal';
import Swal from "sweetalert2"
import stringSimilarity from "string-similarity";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token")

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })
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
    sm: "modal-sm",
    md: "modal-md",
    lg: "modal-lg",
    xl: "modal-xl",
  }

  return (
    <div className="modal-overlay" onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div className={`modal-content ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {canClose && (
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// Modal de Empresa (Agregar/Editar)
const EmpresaModal = ({ isOpen, onClose, onSave, empresa, mode, onCompanyCreated, users, hasTratos, existingCompanies }) => {
  const [formData, setFormData] = useState({
    nombre: "",
    estatus: "POR_CONTACTAR",
    sitioWeb: "",
    sectorId: null,
    domicilioFisico: "",
    domicilioFiscal: "",
    rfc: "",
    razonSocial: "",
    regimenFiscal: "",
    propietarioId: null,
    latitud: null,
    longitud: null,
  });

  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [mapModal, setMapModal] = useState({ isOpen: false });
  const [isAddressEditable, setIsAddressEditable] = useState(false);
  const [sectores, setSectores] = useState([])
  const [sectorSearch, setSectorSearch] = useState("");
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);
  const [filteredSectores, setFilteredSectores] = useState([]);

  const fetchSectores = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/sectores`)
      if (!response.ok) throw new Error("Error al cargar sectores")
      const data = await response.json()
      setSectores(data)
    } catch (error) {
      console.error("Error al cargar sectores:", error)
    }
  }

  const regimenFiscalOptions = [
    { clave: "605", descripcion: "Sueldos y Salarios e Ingresos Asimilados a Salarios" },
    { clave: "606", descripcion: "Arrendamiento" },
    { clave: "608", descripcion: "Demás ingresos" },
    { clave: "611", descripcion: "Ingresos por Dividendos (socios y accionistas)" },
    { clave: "612", descripcion: "Personas Físicas con Actividades Empresariales y Profesionales" },
    { clave: "614", descripcion: "Ingresos por intereses" },
    { clave: "615", descripcion: "Régimen de los ingresos por obtención de premios" },
    { clave: "616", descripcion: "Sin obligaciones fiscales" },
    { clave: "621", descripcion: "Incorporación Fiscal" },
    { clave: "622", descripcion: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
    { clave: "626", descripcion: "Régimen Simplificado de Confianza (Persona Fisica)" },
    { clave: "627", descripcion: "Régimen Simplificado de Confianza (Persona Moral)" },
    { clave: "629", descripcion: "De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales" },
    { clave: "630", descripcion: "Enajenación de acciones en bolsa de valores" },
    { clave: "601", descripcion: "General de Ley Personas Morales" },
    { clave: "603", descripcion: "Personas Morales con Fines no Lucrativos" },
    { clave: "607", descripcion: "Régimen de Enajenación o Adquisición de Bienes" },
    { clave: "609", descripcion: "Consolidación" },
    { clave: "620", descripcion: "Sociedades Cooperativas de Producción que optan por Diferir sus Ingresos" },
    { clave: "623", descripcion: "Opcional para Grupos de Sociedades" },
    { clave: "624", descripcion: "Coordinados" },
    { clave: "628", descripcion: "Hidrocarburos" },
    { clave: "NO_APLICA", descripcion: "No aplica" },
  ]

  const estatusOptions = [
    { value: "POR_CONTACTAR", label: "Por Contactar" },
    { value: "EN_PROCESO", label: "En Proceso" },
    { value: "CONTACTAR_MAS_ADELANTE", label: "Contactar Más Adelante" },
    { value: "PERDIDO", label: "Perdido" },
    { value: "CLIENTE", label: "Cliente" },
  ]

  useEffect(() => {
    if (empresa && mode === "edit") {
      setFormData({
        nombre: empresa.nombre || "",
        estatus: empresa.estatus || "POR_CONTACTAR",
        sitioWeb: empresa.sitioWeb || "",
        sectorId: empresa.sectorId || null,
        domicilioFisico: empresa.domicilioFisico || "",
        domicilioFiscal: empresa.domicilioFiscal || "",
        rfc: empresa.rfc || "XAXX010101000",
        razonSocial: empresa.razonSocial || "",
        regimenFiscal: empresa.regimenFiscal || "",
        propietarioId: empresa.propietario?.id || null,
        latitud: empresa.latitud || null,
        longitud: empresa.longitud || null,
      });
      const selectedSector = sectores.find(s => s.id === empresa.sectorId);
      setSectorSearch(selectedSector ? selectedSector.nombreSector : "");
      setIsAddressEditable(!!empresa.domicilioFisico);
    } else {
      setFormData({
        nombre: "",
        estatus: "POR_CONTACTAR",
        sitioWeb: "",
        sectorId: null,
        domicilioFisico: "",
        domicilioFiscal: "",
        rfc: "XAXX010101000",
        razonSocial: "",
        regimenFiscal: "",
        propietarioId: null,
        latitud: null,
        longitud: null,
      });
      setSectorSearch("");
      setIsAddressEditable(false);
    }
    setErrors({});
    setShowSectorDropdown(false);
  }, [empresa, mode, isOpen, sectores]);

  useEffect(() => {
    fetchSectores()
  }, [])

  useEffect(() => {
    if (sectorSearch.trim() === "") {
      setFilteredSectores(sectores);
    } else {
      const filtered = sectores.filter(sector =>
        sector.nombreSector.toLowerCase().includes(sectorSearch.toLowerCase())
      );
      setFilteredSectores(filtered);
    }
  }, [sectorSearch, sectores]);


  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSectorInputChange = (value) => {
    setSectorSearch(value);
    setShowSectorDropdown(true);

    if (value.trim() === "") {
      handleInputChange("sectorId", null);
    }
  };

  const handleSectorSelect = (sector) => {
    setSectorSearch(sector.nombreSector);
    handleInputChange("sectorId", sector.id);
    setShowSectorDropdown(false);
  };

  const handleSectorInputFocus = () => {
    setShowSectorDropdown(true);
  };

  const handleSectorInputBlur = () => {
    setTimeout(() => {
      setShowSectorDropdown(false);
    }, 150);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = "Este campo es obligatorio";
    } else if (mode === "add") {
      const similarityThreshold = 0.80;
      const existingNames = existingCompanies
        ? existingCompanies.map((c) => c.nombre?.toLowerCase() || "")
        : [];
      const newName = formData.nombre.toLowerCase();


      if (existingNames.length > 0) {
        const similarities = existingNames.map((name) =>
          stringSimilarity.compareTwoStrings(newName, name)
        );
        const maxSimilarity = Math.max(...similarities, 0);


        if (maxSimilarity >= similarityThreshold) {
          newErrors.nombre = "Esta empresa parece ser un duplicado. Verifica el nombre.";
        }
      }
    }

    // Validación Sitio Web: URL válida si se proporciona
    if (formData.sitioWeb) {
      try {
        const urlToValidate = formData.sitioWeb.startsWith('http')
          ? formData.sitioWeb
          : `https://${formData.sitioWeb}`;

        const url = new URL(urlToValidate);

        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Protocolo no válido');
        }

      } catch (error) {
        newErrors.sitioWeb = "Este campo debe ser una URL válida (ej. https://ejemplo.com)";
      }
    }

    if (formData.latitud !== null && formData.latitud !== '') {
      const lat = parseFloat(formData.latitud);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitud = "La latitud debe estar entre -90 y 90 grados";
      }
    }

    if (formData.longitud !== null && formData.longitud !== '') {
      const lng = parseFloat(formData.longitud);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.longitud = "La longitud debe estar entre -180 y 180 grados";
      }
    }

    // Validaciones para estatus CLIENTE
    if (formData.estatus === "CLIENTE") {
      // Domicilio Fiscal
      if (!formData.domicilioFiscal?.trim()) {
        newErrors.domicilioFiscal = "Este campo es obligatorio para estatus Cliente";
      } else if (!/^[A-Za-z0-9\s,.\-ÁÉÍÓÚáéíóúÑñ]+$/.test(formData.domicilioFiscal.trim())) {
        newErrors.domicilioFisico = "Este campo contiene caracteres no permitidos";
      }

      // RFC: Solo letras mayúsculas, números y &
      if (!formData.rfc?.trim()) {
        newErrors.rfc = "Este campo es obligatorio para estatus Cliente";
        setFormData(prev => ({ ...prev, rfc: "XAXX010101000" }));
      } else if (!/^[A-Z0-9&]+$/.test(formData.rfc.trim())) {
        newErrors.rfc = "Este campo solo debe contener letras mayúsculas, números y &";
      } else if (formData.rfc.trim().length > 13) {
        newErrors.rfc = "El RFC no puede tener más de 13 caracteres";
      }

      if (!formData.razonSocial?.trim()) {
        newErrors.razonSocial = "Este campo es obligatorio para estatus Cliente";
      }

      // Régimen Fiscal: Debe estar seleccionado
      if (!formData.regimenFiscal) {
        newErrors.regimenFiscal = "Este campo es obligatorio para estatus Cliente";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMapLocationSelect = (locationData) => {
    handleInputChange("domicilioFisico", locationData.address);
    handleInputChange("latitud", locationData.latitude);
    handleInputChange("longitud", locationData.longitude);
    setIsAddressEditable(true);
    setMapModal({ isOpen: false });
  };

  const showCoordinateFields = mode === "edit" || (formData.domicilioFisico && formData.domicilioFisico.trim());


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (mode === "edit") {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Los cambios se guardarán.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) {
        return;
      }
    }
    const formattedDomicilioFisico = formData.domicilioFisico && formData.domicilioFisico.trim()
      ? (formData.domicilioFisico.endsWith(", México")
        ? formData.domicilioFisico
        : `${formData.domicilioFisico}, México`)
      : null;

    const empresaData = {
      nombre: formData.nombre,
      estatus: formData.estatus,
      sitioWeb: formData.sitioWeb || null,
      sectorId: formData.sectorId || null,
      domicilioFisico: formattedDomicilioFisico,
      domicilioFiscal: formData.domicilioFiscal || null,
      rfc: formData.rfc || null,
      razonSocial: formData.razonSocial || null,
      regimenFiscal: formData.regimenFiscal || null,
      latitud: formData.latitud || null,
      longitud: formData.longitud || null,
      ...(mode === "edit" && { propietarioId: formData.propietarioId || null }),
    };

    setIsLoading(true)
    try {
      let response;
      if (mode === "add") {
        response = await fetchWithToken(`${API_BASE_URL}/empresas`, {
          method: "POST",
          body: JSON.stringify(empresaData),
        });
      } else {
        response = await fetchWithToken(`${API_BASE_URL}/empresas/${empresa.id}`, {
          method: "PUT",
          body: JSON.stringify(empresaData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al guardar la empresa");
      }

      const savedEmpresa = await response.json();
      onSave(savedEmpresa);

      if (mode === "add") {
        onCompanyCreated(savedEmpresa);
      }

      await Swal.fire({
        icon: "success",
        title: mode === "add" ? "¡Empresa creada!" : "¡Empresa actualizada!",
        text: mode === "add"
          ? `La empresa "${savedEmpresa.nombre}" ha sido creada exitosamente.`
          : `La empresa "${savedEmpresa.nombre}" ha sido actualizada exitosamente.`,
        confirmButtonText: 'OK'
      });

      setIsLoading(false)
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message,
      });
      setIsLoading(false)
    }
  };


  const isCliente = formData.estatus === "CLIENTE"

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === "add" ? "Nueva Empresa" : "Editar Empresa"} size="lg" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        {mode === "edit" && (
          <div className="modal-form-row">
            <div className="modal-form-group">
              <label htmlFor="propietario">
                Propietario <span className="required">*</span>
              </label>
              <select
                id="propietario"
                value={formData.propietarioId || ""}
                onChange={(e) => handleInputChange("propietarioId", e.target.value ? Number(e.target.value) : null)}
                className="modal-form-control"
              >
                <option value="">Seleccione un propietario</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nombreUsuario}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="nombre">
              Nombre <span className="required">*</span>
            </label>
            <input
              type="text"
              id="nombre"
              value={formData.nombre}
              onChange={(e) => handleInputChange("nombre", e.target.value)}
              className={`modal-form-control ${errors.nombre ? "error" : ""}`}
              placeholder="Nombre comercial de la empresa"
            />
            {errors.nombre && <span className="error-message">{errors.nombre}</span>}
          </div>

          <div className="modal-form-row">
            <div className="modal-form-group">
              <label htmlFor="estatus">
                Estatus <span className="required">*</span>
              </label>
              <select
                id="estatus"
                value={formData.estatus}
                onChange={(e) => handleInputChange("estatus", e.target.value)}
                className="modal-form-control"
                disabled={mode === "edit" && hasTratos}
              >
                {estatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {mode === "edit" && hasTratos && (
                <small className="help-text">El estatus no puede editarse porque la empresa tiene tratos asociados.</small>
              )}
            </div>
          </div>
        </div>

        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="sitioWeb">Sitio Web</label>
            <input
              type="url"
              id="sitioWeb"
              value={formData.sitioWeb}
              onChange={(e) => handleInputChange("sitioWeb", e.target.value)}
              className={`modal-form-control ${errors.sitioWeb ? "error" : ""}`}
              placeholder="https://ejemplo.com"
            />
            {errors.sitioWeb && <span className="error-message">{errors.sitioWeb}</span>}
          </div>

          <div className="modal-form-group">
            <label htmlFor="sectorId">Sector</label>
            <div className="autocomplete-container">
              <input
                type="text"
                id="sectorSearch"
                value={sectorSearch}
                onChange={(e) => handleSectorInputChange(e.target.value)}
                onFocus={handleSectorInputFocus}
                onBlur={handleSectorInputBlur}
                className="modal-form-control"
                placeholder="Buscar sector..."
                autoComplete="off"
              />
              {showSectorDropdown && filteredSectores.length > 0 && (
                <div className="autocomplete-dropdown">
                  {filteredSectores.map((sector) => (
                    <div
                      key={sector.id}
                      className="autocomplete-option"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSectorSelect(sector);
                      }}
                    >
                      {sector.nombreSector}
                    </div>
                  ))}
                </div>
              )}
              {showSectorDropdown && sectorSearch.trim() !== "" && filteredSectores.length === 0 && (
                <div className="autocomplete-dropdown">
                  <div className="autocomplete-no-results">
                    No se encontraron sectores
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-form-row">
          <div className="modal-form-group full-width">
            <label htmlFor="domicilioFisico">Domicilio Físico</label>
            <div className="address-input-container">
              <input
                type="text"
                id="domicilioFisico"
                value={formData.domicilioFisico}
                onChange={(e) => handleInputChange("domicilioFisico", e.target.value)}
                className={`modal-form-control address-input ${errors.domicilioFisico ? "error" : ""}`}
                placeholder={isAddressEditable ? "Ej: Elefante 175, Villa Magna, 37208 León de los Aldama, Guanajuato, México" : "Buscar dirección"}
                readOnly={!isAddressEditable}
                style={{
                  backgroundColor: isAddressEditable ? 'white' : '#f8f9fa',
                  cursor: isAddressEditable ? 'text' : 'pointer'
                }}
                onClick={() => {
                  if (!isAddressEditable) {
                    setMapModal({ isOpen: true });
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setMapModal({ isOpen: true })}
                className="btn btn-map"
                title="Buscar en mapa"
              >
                Buscar en mapa
              </button>
            </div>
            <small className="help-text">
              {isAddressEditable
                ? "Puedes editar la dirección o usar el botón \"Buscar en mapa\" para seleccionar una nueva ubicación."
                : "Haz clic en el campo o en \"Buscar en mapa\" para seleccionar una dirección."
              }
            </small>
            {errors.domicilioFisico && <span className="error-message">{errors.domicilioFisico}</span>}
          </div>
        </div>

        {showCoordinateFields && (
          <div className="modal-form-row">
            <div className="modal-form-group">
              <label htmlFor="latitud">Latitud</label>
              <input
                type="number"
                id="latitud"
                value={formData.latitud || ''}
                onChange={(e) => handleInputChange("latitud", e.target.value ? parseFloat(e.target.value) : null)}
                className="modal-form-control"
                placeholder="21.1269"
                step="any"
              />
            </div>
            <div className="modal-form-group">
              <label htmlFor="longitud">Longitud</label>
              <input
                type="number"
                id="longitud"
                value={formData.longitud || ''}
                onChange={(e) => handleInputChange("longitud", e.target.value ? parseFloat(e.target.value) : null)}
                className="modal-form-control"
                placeholder="-101.6968"
                step="any"
              />
            </div>
          </div>
        )}

        {isCliente && (
          <>
            <div className="modal-form-row">
              <div className="modal-form-group">
                <label htmlFor="domicilioFiscal">
                  Domicilio Fiscal <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="domicilioFiscal"
                  value={formData.domicilioFiscal}
                  onChange={(e) => handleInputChange("domicilioFiscal", e.target.value)}
                  className={`modal-form-control ${errors.domicilioFiscal ? "error" : ""}`}
                  placeholder="Domicilio fiscal"
                />
                {errors.domicilioFiscal && <span className="error-message">{errors.domicilioFiscal}</span>}
              </div>

              <div className="modal-form-group">
                <label htmlFor="rfc">
                  RFC <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="rfc"
                  value={formData.rfc}
                  onChange={(e) => handleInputChange("rfc", e.target.value.toUpperCase())}
                  className={`modal-form-control ${errors.rfc ? "error" : ""}`}
                  placeholder="RFC de la empresa"
                  maxLength={13}
                />
                {errors.rfc && <span className="error-message">{errors.rfc}</span>}
              </div>
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label htmlFor="razonSocial">
                  Razón Social <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="razonSocial"
                  value={formData.razonSocial}
                  onChange={(e) => handleInputChange("razonSocial", e.target.value)}
                  className={`modal-form-control ${errors.razonSocial ? "error" : ""}`}
                  placeholder="Razón social"
                />
                {errors.razonSocial && <span className="error-message">{errors.razonSocial}</span>}
              </div>

              <div className="modal-form-group">
                <label htmlFor="regimenFiscal">
                  Régimen Fiscal <span className="required">*</span>
                </label>
                <select
                  id="regimenFiscal"
                  value={formData.regimenFiscal}
                  onChange={(e) => handleInputChange("regimenFiscal", e.target.value)}
                  className={`modal-form-control ${errors.regimenFiscal ? "error" : ""}`}
                >
                  <option value="">Seleccione un régimen fiscal</option>
                  {regimenFiscalOptions.map((option) => (
                    <option key={option.clave} value={option.clave}>
                      {option.clave} - {option.descripcion}
                    </option>
                  ))}
                </select>
                {errors.regimenFiscal && <span className="error-message">{errors.regimenFiscal}</span>}
              </div>
            </div>
          </>
        )}

        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {mode === "add" ? "Creando..." : "Guardando..."}
              </>
            ) : (
              mode === "add" ? "Crear Empresa" : "Guardar"
            )}
          </button>
        </div>
      </form>
      <MapModal
        isOpen={mapModal.isOpen}
        onClose={() => setMapModal({ isOpen: false })}
        onLocationSelect={handleMapLocationSelect}
        initialAddress={formData.domicilioFisico}
      />
    </Modal>
  )
}

// Modal de Contacto (Agregar/Editar)
const ContactoModal = ({
  isOpen,
  onClose,
  onSave,
  contacto,
  empresaId,
  empresaNombre,
  mode,
  isInitialContact,
  users,
}) => {
  const [formData, setFormData] = useState({
    nombre: "",
    correos: [""],
    telefonos: [""],
    celular: "",
    rol: "RECEPCION",
  });

  const [errors, setErrors] = useState({});

  const rolesOptions = [
    "RECEPCION",
    "VENTAS",
    "MARKETING",
    "FINANZAS",
    "ASISTENTE",
    "SECRETARIO",
    "GERENTE",
    "DIRECTOR",
  ];

  useEffect(() => {
    if (contacto && mode === "edit") {
      const correos = contacto.correos?.length > 0 ? contacto.correos.map((item) => item.correo || "") : [""];
      const telefonos = contacto.telefonos?.length > 0 ? contacto.telefonos.map((item) => item.telefono || "") : [""];

      setFormData({
        nombre: contacto.nombre || "",
        correos,
        telefonos,
        celular: contacto.celular || "",
        rol: contacto.rol || "RECEPCION",
      });
    } else {
      setFormData({
        nombre: "",
        correos: [""],
        telefonos: [""],
        celular: "",
        rol: "RECEPCION",
      });
    }
    setErrors({});
  }, [contacto, mode, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleArrayChange = (field, index, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
    if (errors[field]?.[index]) {
      setErrors((prev) => ({
        ...prev,
        [field]: prev[field].map((err, i) => (i === index ? "" : err)),
      }));
    }
  };

  const addArrayItem = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));
    setErrors((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), ""],
    }));
  };

  const removeArrayItem = (field, index) => {
    if (formData[field].length > 1) {
      setFormData((prev) => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index),
      }));
      setErrors((prev) => ({
        ...prev,
        [field]: (prev[field] || []).filter((_, i) => i !== index),
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validación Nombre: Solo letras (incluye Ñ/ñ y acentos), opcional
    if (formData.nombre && !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(formData.nombre.trim())) {
      newErrors.nombre = "Este campo solo debe contener letras";
    }

    // Validación Correos
    newErrors.correos = formData.correos.map((correo, index) => {
      // Si el campo está vacío
      if (!correo || !correo.trim()) {
        // Solo marcamos error si es el segundo campo en adelante
        if (index > 0) return "Este campo es obligatorio si fue agregado";
        return "";
      }
      // Si tiene contenido, validamos el formato
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return "Este campo debe ser un correo válido";
      }
      return "";
    });

    // Validación Teléfonos: 10 dígitos
    newErrors.telefonos = formData.telefonos.map((telefono, index) => {
      // Si el campo está vacío
      if (!telefono || !telefono.trim()) {
        // Error solo si el usuario agregó un input extra mediante el botón "+"
        if (index > 0) return "Este campo es obligatorio si fue agregado";
        return "";
      }
      // Si tiene contenido, validamos los 10 dígitos
      if (!/^\d{10}$/.test(telefono)) {
        return "Debe tener exactamente 10 dígitos.";
      }
      return "";
    });

    // Validación Celular: 10 dígitos si se proporciona
    if (formData.celular) {
      if (!/^\d{10}$/.test(formData.celular)) {
        if (/[a-zA-Z]/.test(formData.celular)) {
          newErrors.celular = "El número no puede contener letras.";
        } else {
          newErrors.celular = "Este campo debe tener exactamente 10 dígitos.";
        }
      }
    }

    // Validación Rol
    if (!formData.rol) {
      newErrors.rol = "Este campo es obligatorio";
    }

    setErrors(newErrors);
    return !Object.values(newErrors)
      .flat()
      .some((error) => error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Solo mostrar alerta de confirmación si estamos en modo "edit"
    if (mode === "edit") {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Los cambios se guardarán.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) {
        return;
      }
    }

    let nombreFinal = formData.nombre.trim();
    if (!nombreFinal) {
      nombreFinal = `Contacto de ${formData.rol}`;
    }

    const username = localStorage.getItem("username") || "unknown";

    const contactoData = {
      nombre: nombreFinal,
      correos: formData.correos.filter((email) => email.trim()).map((email) => ({ correo: email })),
      telefonos: formData.telefonos.filter((tel) => tel.trim()).map((tel) => ({ telefono: tel })),
      celular: formData.celular || null,
      rol: formData.rol,
      modificadoPor: username,
    };

    try {
      let response;
      if (mode === "add") {
        response = await fetchWithToken(`${API_BASE_URL}/empresas/${empresaId}/contactos`, {
          method: "POST",
          body: JSON.stringify(contactoData),
        });
      } else {
        response = await fetchWithToken(`${API_BASE_URL}/empresas/contactos/${contacto.id}`, {
          method: "PUT",
          body: JSON.stringify(contactoData),
        });
      }

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = "Error al guardar el contacto";

        try {
          const errorData = JSON.parse(text);
          if (errorData.message) errorMessage = errorData.message;
        } catch (e) {
          if (text) errorMessage = text;
        }

        throw new Error(errorMessage);
      }

      const savedContacto = await response.json();
      onSave(savedContacto);

      await Swal.fire({
        icon: "success",
        title: mode === "add" ? "¡Contacto agregado!" : "¡Contacto actualizado!",
        text: mode === "add"
          ? `El contacto "${savedContacto.nombre}" ha sido agregado exitosamente.`
          : `El contacto "${savedContacto.nombre}" ha sido actualizado exitosamente.`,
        confirmButtonText: 'OK'
      });
    } catch (error) {
      const isDuplicate = error.message.includes("Ya existe un contacto") ||
        error.message.includes("mismo Nombre");

      Swal.fire({
        icon: isDuplicate ? "warning" : "error",
        title: isDuplicate ? "Contacto Duplicado" : "Error",
        text: error.message,
        confirmButtonColor: isDuplicate ? "#FF9800" : "#d33",
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isInitialContact
          ? "Agregar Contacto Inicial (Obligatorio)"
          : mode === "add"
            ? "Nuevo Contacto"
            : "Editar Contacto"
      }
      size="md"
      closeOnOverlayClick={false}
      canClose={!isInitialContact}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="nombre">Nombre</label>
            <input
              type="text"
              id="nombre"
              value={formData.nombre}
              onChange={(e) => handleInputChange("nombre", e.target.value)}
              className={`modal-form-control ${errors.nombre ? "error" : ""}`}
              placeholder="Nombre del contacto"
            />
            <small className="help-text">
              Si se deja vacío, se generará automáticamente como "Contacto de {formData.rol}"
            </small>
            {errors.nombre && <span className="error-message">{errors.nombre}</span>}
          </div>
        </div>

        {empresaNombre && (
          <div className="modal-form-row">
            <div className="modal-form-group">
              <label>Empresa</label>
              <input type="text" value={empresaNombre} className="modal-form-control readonly" readOnly />
            </div>
          </div>
        )}

        <div className="modal-form-group">
          <label>Correo/s</label>
          {formData.correos.map((correo, index) => (
            <div key={index} className="array-input-group">
              <input
                type="email"
                value={correo}
                onChange={(e) => handleArrayChange("correos", index, e.target.value)}
                className={`modal-form-control ${errors.correos?.[index] ? "error" : ""}`}
                placeholder="correo@ejemplo.com"
              />
              <div className="array-actions">
                <button
                  type="button"
                  onClick={() => addArrayItem("correos")}
                  className="btn-array-action add"
                  title="Agregar correo"
                  disabled={formData.correos.some(c => !c || c.trim() === "")}
                >
                  +
                </button>
                {formData.correos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArrayItem("correos", index)}
                    className="btn-array-action remove"
                    title="Eliminar correo"
                  >
                    ✕
                  </button>
                )}
              </div>
              {errors.correos?.[index] && <span className="error-message">{errors.correos[index]}</span>}
            </div>
          ))}
        </div>

        <div className="modal-form-group">
          <label>Teléfono/s</label>
          {formData.telefonos.map((telefono, index) => (
            <div key={index} className="array-input-group">
              <input
                type="tel"
                value={telefono}
                onChange={(e) => handleArrayChange("telefonos", index, e.target.value.replace(/\D/g, ""))}
                className={`modal-form-control ${errors.telefonos?.[index] ? "error" : ""}`}
                placeholder="4771234567"
                maxLength="10"
              />
              <div className="array-actions">
                <button
                  type="button"
                  onClick={() => addArrayItem("telefonos")}
                  className="btn-array-action add"
                  title="Agregar teléfono"
                  disabled={formData.telefonos.some(t => !t || t.trim() === "")}
                >
                  +
                </button>
                {formData.telefonos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArrayItem("telefonos", index)}
                    className="btn-array-action remove"
                    title="Eliminar teléfono"
                  >
                    ✕
                  </button>
                )}
              </div>
              {errors.telefonos?.[index] && <span className="error-message">{errors.telefonos[index]}</span>}
            </div>
          ))}
        </div>

        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="celular">Celular</label>
            <input
              type="tel"
              id="celular"
              value={formData.celular}
              onChange={(e) => handleInputChange("celular", e.target.value.replace(/\D/g, ""))}
              className={`modal-form-control ${errors.celular ? "error" : ""}`}
              placeholder="4771234567"
              maxLength="10"
            />
            {errors.celular && <span className="error-message">{errors.celular}</span>}
          </div>

          <div className="modal-form-group">
            <label htmlFor="rol">
              Rol <span className="required">*</span>
            </label>
            <select
              id="rol"
              value={formData.rol}
              onChange={(e) => handleInputChange("rol", e.target.value)}
              className={`modal-form-control ${errors.rol ? "error" : ""}`}
            >
              {rolesOptions.map((rol) => (
                <option key={rol} value={rol}>
                  {rol.charAt(0) + rol.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            {errors.rol && <span className="error-message">{errors.rol}</span>}
          </div>
        </div>

        <div className="modal-form-actions">
          {isInitialContact ? (
            <button type="submit" className="btn btn-primary">
              Agregar Contacto
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                {mode === "add" ? "Agregar" : "Guardar"}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
};

// Modal de Detalles de Empresa
const DetallesEmpresaModal = ({ isOpen, onClose, empresa, sectores }) => {
  if (!empresa) return null

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    })
  }

  const statusMap = {
    POR_CONTACTAR: "Por Contactar",
    EN_PROCESO: "En Proceso",
    CONTACTAR_MAS_ADELANTE: "Contactar Más Adelante",
    PERDIDO: "Perdido",
    CLIENTE: "Cliente",
  }

  const getStatusText = (status) => statusMap[status] || status
  const getSectorText = (sectorId, sectorNombre) => {
    if (sectorNombre) return sectorNombre;
    if (sectorId && sectores.length > 0) {
      const sector = sectores.find(s => s.id === sectorId);
      return sector ? sector.nombreSector : "N/A";
    }
    return "N/A";
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles Empresa" size="lg" closeOnOverlayClick={false}>
      <div className="detalles-content">
        <div className="detalles-grid">
          <div className="detalle-item">
            <label>Propietario:</label>
            <span>{empresa.propietario?.nombreUsuario || "N/A"}</span>
          </div>
          <div className="detalle-item">
            <label>Nombre:</label>
            <span>{empresa.nombre || "N/A"}</span>
          </div>
          <div className="detalle-item">
            <label>Estatus:</label>
            <div className="status-display">
              <span className="status-indicator" style={{ backgroundColor: empresa.statusColor || "#87CEEB" }}></span>
              {getStatusText(empresa.estatus)}
            </div>
          </div>
          <div className="detalle-item">
            <label>Sitio Web:</label>
            <span>
              {empresa.sitioWeb ? (
                <a href={empresa.sitioWeb} target="_blank" rel="noopener noreferrer">
                  {empresa.sitioWeb}
                </a>
              ) : (
                "N/A"
              )}
            </span>
          </div>
          <div className="detalle-item">
            <label>Sector:</label>
            <span>{getSectorText(empresa.sectorId, empresa.sectorNombre)}</span>
          </div>
          <div className="detalle-item full-width">
            <label>Domicilio Físico:</label>
            <span>{empresa.domicilioFisico || "N/A"}</span>
          </div>
          {empresa.domicilioFiscal && (
            <div className="detalle-item full-width">
              <label>Domicilio Fiscal:</label>
              <span>{empresa.domicilioFiscal}</span>
            </div>
          )}
          {empresa.rfc && (
            <div className="detalle-item">
              <label>RFC:</label>
              <span>{empresa.rfc}</span>
            </div>
          )}
          {empresa.razonSocial && (
            <div className="detalle-item">
              <label>Razón Social:</label>
              <span>{empresa.razonSocial}</span>
            </div>
          )}
          {empresa.regimenFiscal && (
            <div className="detalle-item">
              <label>Régimen Fiscal:</label>
              <span>{empresa.regimenFiscal}</span>
            </div>
          )}
        </div>
        <div className="auditoria-section">
          <h3>Información de Auditoría</h3>
          <div className="detalles-grid">
            <div className="detalle-item">
              <label>Creado Por:</label>
              <span>{empresa.creadoPor || "N/A"}</span>
            </div>
            <div className="detalle-item">
              <label>Fecha Creación:</label>
              <span>{formatDate(empresa.fechaCreacion)}</span>
            </div>
            <div className="detalle-item">
              <label>Fecha Modificación:</label>
              <span>{formatDate(empresa.fechaModificacion)}</span>
            </div>
            <div className="detalle-item">
              <label>Última Actividad:</label>
              <span>{formatDate(empresa.fechaUltimaActividad)}</span>
            </div>
          </div>
        </div>
        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-primary">
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Modal de Detalles de Contacto
const DetallesContactoModal = ({ isOpen, onClose, contacto }) => {
  if (!contacto) return null

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    })
  }

  const correos = contacto.correos?.map((item) => item.correo) || []
  const telefonos = contacto.telefonos?.map((item) => item.telefono) || []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles Contacto" size="md" closeOnOverlayClick={false}>
      <div className="detalles-content">
        <div className="detalles-grid">
          <div className="detalle-item">
            <label>Propietario:</label>
            <span>{contacto.propietario?.nombreUsuario || "N/A"}</span>
          </div>
          <div className="detalle-item">
            <label>Nombre:</label>
            <span>{contacto.nombre || "N/A"}</span>
          </div>
          <div className="detalle-item full-width">
            <label>Correo/s:</label>
            <div className="multiple-values">
              {correos.length > 0 ? (
                correos.map((correo, index) => (
                  <span key={index} className="value-item">
                    <a href={`mailto:${correo}`}>{correo}</a>
                  </span>
                ))
              ) : (
                <span>N/A</span>
              )}
            </div>
          </div>
          <div className="detalle-item full-width">
            <label>Teléfono/s:</label>
            <div className="multiple-values">
              {telefonos.length > 0 ? (
                telefonos.map((telefono, index) => (
                  <span key={index} className="value-item">
                    <a href={`tel:${telefono}`}>{telefono}</a>
                  </span>
                ))
              ) : (
                <span>N/A</span>
              )}
            </div>
          </div>
          {contacto.celular && (
            <div className="detalle-item">
              <label>Celular:</label>
              <span>
                <a href={`tel:${contacto.celular}`}>{contacto.celular}</a>
              </span>
            </div>
          )}
          <div className="detalle-item">
            <label>Rol:</label>
            <span>{contacto.rol ? contacto.rol.charAt(0) + contacto.rol.slice(1).toLowerCase() : "N/A"}</span>
          </div>
        </div>
        <div className="auditoria-section">
          <h3>Información de Auditoría</h3>
          <div className="detalles-grid">
            <div className="detalle-item">
              <label>Fecha Creación:</label>
              <span>{formatDate(contacto.fechaCreacion)}</span>
            </div>
            <div className="detalle-item">
              <label>Fecha Modificación:</label>
              <span>{formatDate(contacto.fechaModificacion)}</span>
            </div>
            <div className="detalle-item">
              <label>Modificado Por:</label>
              <span>{contacto.modificadoPor || "N/A"}</span>
            </div>
          </div>
        </div>
        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-primary">
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Modal de Confirmación de Eliminación 
const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm, contacto, isLastContact = false }) => {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar eliminación" size="sm" closeOnOverlayClick={false}>
      <div className="confirmar-eliminacion">
        {isLastContact ? (
          <div className="warning-content">
            <p className="warning-message">
              No se puede eliminar el último contacto de la empresa. Debe haber al menos un contacto asociado.
            </p>
            <div className="modal-form-actions">
              <button type="button" onClick={onClose} className="btn btn-primary">
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <div className="confirmation-content">
            <p className="confirmation-message">¿Seguro que quieres eliminar el contacto de forma permanente?</p>
            <div className="modal-form-actions">
              <button type="button" onClick={onClose} className="btn btn-cancel">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} className="btn btn-confirm">
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// Componente Principal
const Empresas = () => {
  const userRol = localStorage.getItem("userRol");
  const params = useParams();
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { tratos: true };
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [contacts, setContacts] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [contactSearch, setContactSearch] = useState("")
  const [contactRole, setContactRole] = useState("")
  const [users, setUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState([null, null])
  const [companiesWithoutDeals, setCompaniesWithoutDeals] = useState(new Set())
  const [startDate, endDate] = dateRange
  const navigate = useNavigate()

  const [modals, setModals] = useState({
    empresa: { isOpen: false, mode: "add", data: null },
    contacto: { isOpen: false, mode: "add", data: null, isInitialContact: false },
    detallesEmpresa: { isOpen: false, data: null },
    detallesContacto: { isOpen: false, data: null },
    confirmarEliminacion: { isOpen: false, data: null, isLastContact: false },
    nuevoTrato: { isOpen: false, empresaPreseleccionada: null },
  })

  const [tratos, setTratos] = useState([]);
  const [sectores, setSectores] = useState([])

  const statusMap = {
    POR_CONTACTAR: "Por Contactar",
    EN_PROCESO: "En Proceso",
    CONTACTAR_MAS_ADELANTE: "Contactar Más Adelante",
    PERDIDO: "Perdido",
    CLIENTE: "Cliente",
  }

  const estatusOptions = [
    { value: "POR_CONTACTAR", label: "Por Contactar" },
    { value: "EN_PROCESO", label: "En Proceso" },
    { value: "CONTACTAR_MAS_ADELANTE", label: "Contactar Más Adelante" },
    { value: "PERDIDO", label: "Perdido" },
    { value: "CLIENTE", label: "Cliente" },
  ]

  const rolesOptions = [
    "RECEPCION",
    "VENTAS",
    "MARKETING",
    "FINANZAS",
    "ASISTENTE",
    "SECRETARIO",
    "GERENTE",
    "DIRECTOR",
  ]

  const getStatusText = (status) => statusMap[status] || status

  const fetchUsers = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/auth/users`)
      if (!response.ok) throw new Error("Error al cargar los usuarios")
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error("Error al cargar usuarios:", error)
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message,
      })
    }
  }

  const fetchAllCompanies = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/empresas`);
      if (!response.ok) throw new Error("Error al cargar las empresas");
      const data = await response.json();

      const companiesWithColors = data.map((company) => ({
        ...company,
        statusColor: getStatusColor(company.estatus),
        domicilioFisico: company.domicilioFisico
          ? (company.domicilioFisico.endsWith(", México")
            ? company.domicilioFisico
            : `${company.domicilioFisico}, México`)
          : null,
      }));

      setCompanies(companiesWithColors);

    } catch (error) {
      console.error("Error al cargar empresas:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message,
      });
    }
  };

  const filteredCompanies = companies.filter((company) => {
    const matchesName = !searchTerm ||
      company.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || company.estatus === filterStatus;

    // Filtro por rango de fechas
    let matchesDateRange = true;
    if (startDate || endDate) {
      const companyDate = new Date(company.fechaCreacion);
      if (startDate && endDate) {
        matchesDateRange = companyDate >= startDate && companyDate <= endDate;
      } else if (startDate) {
        matchesDateRange = companyDate >= startDate;
      } else if (endDate) {
        matchesDateRange = companyDate <= endDate;
      }
    }

    return matchesName && matchesStatus && matchesDateRange;
  });

  const fetchSectores = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/sectores`)
      if (!response.ok) throw new Error("Error al cargar sectores")
      const data = await response.json()
      setSectores(data)
    } catch (error) {
      console.error("Error al cargar sectores:", error)
    }
  }

  const cargarDatosIniciales = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        fetchUsers(),
        fetchAllCompanies(),
        fetchSectores()
      ])
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    if (params.empresaId && companies.length > 0) {
      const empresaFromUrl = companies.find(company => company.id === parseInt(params.empresaId));
      if (empresaFromUrl) {
        if (!selectedCompany || selectedCompany.id !== empresaFromUrl.id) {
          setContacts([]);
          setTratos([]);
          setSelectedCompany(empresaFromUrl);
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Empresa no encontrada',
          text: 'La empresa solicitada no existe o no tienes permisos para verla',
        });
        navigate('/empresas', { replace: true });
      }
    }
  }, [params.empresaId, companies.length]);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!selectedCompany?.id) {
        setContacts([]);
        return;
      }

      const empresaIdActual = selectedCompany.id;

      try {
        const response = await fetchWithToken(`${API_BASE_URL}/empresas/${empresaIdActual}/contactos`);
        if (!response.ok) throw new Error("Error al cargar los contactos");
        const contactsData = await response.json();

        // Verificar que aún estamos en la misma empresa
        setContacts(prevContacts => {
          if (selectedCompany?.id === empresaIdActual) {
            const normalizedContacts = contactsData.map((contact) => ({
              ...contact,
              correos: contact.correos || [],
              telefonos: contact.telefonos || [],
            }));
            return normalizedContacts;
          }
          return prevContacts;
        });
      } catch (error) {
        console.error("Error al cargar contactos:", error);
        if (selectedCompany?.id === empresaIdActual) {
          setContacts([]);
        }
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message,
        });
      }
    };

    setContacts([]);
    fetchContacts();
  }, [selectedCompany?.id]);

  useEffect(() => {
    const fetchTratos = async () => {

      if (!selectedCompany?.id || !modulosActivos.tratos) {
        setTratos([]);
        return;
      }

      const empresaIdActual = selectedCompany.id;

      try {
        const response = await fetchWithToken(
          `${API_BASE_URL}/tratos/filtrar?empresaId=${empresaIdActual}`
        );
        if (!response.ok) throw new Error("Error al cargar los tratos");
        const data = await response.json();

        setTratos(prevTratos => {
          if (selectedCompany?.id === empresaIdActual) {
            return data;
          }
          return prevTratos;
        });
      } catch (error) {
        console.error("Error al cargar tratos:", error);
        if (selectedCompany?.id === empresaIdActual) {
          setTratos([]);
        }
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message,
        });
      }
    };

    setTratos([]);
    fetchTratos();
  }, [selectedCompany?.id]);

  useEffect(() => {
    if (companies.length > 0 && modulosActivos.tratos) {
      checkCompaniesWithoutDeals();
    }
  }, [companies.length]);


  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch = contact.nombre?.toLowerCase().includes(contactSearch.toLowerCase())
    const matchesRole = !contactRole || contact.rol === contactRole
    return matchesSearch && matchesRole
  })

  const handleCompanySelect = (company) => {
    if (!selectedCompany || selectedCompany.id !== company.id) {
      setContacts([]);
      setTratos([]);
      setSelectedCompany(company);
      navigate(`/empresas/${company.id}`, { replace: true });
    }
  };

  const handleTratoClick = (tratoId) => {
    navigate(`/detallestrato/${tratoId}`);
  };

  const handleDeleteTrato = async (tratoId, e) => {
    e.stopPropagation();

    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción eliminará el trato y todos sus datos asociados (actividades, notas, cotizaciones). Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/tratos/${tratoId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar el trato");
      }

      setTratos(prevTratos => prevTratos.filter(t => t.id !== tratoId));

      await Swal.fire({
        icon: "success",
        title: "¡Trato eliminado!",
        text: "El trato y todos sus datos asociados han sido eliminados exitosamente.",
        confirmButtonText: 'OK'
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message,
      });
    }
  };

  const openModal = (modalType, mode = "add", data = null, extra = {}) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: {
        isOpen: true,
        mode,
        data,
        ...extra,
        existingCompanies: companies || []
      },
    }));
  };

  const closeModal = (modalType) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: {
        isOpen: false,
        mode: "add",
        data: null,
        isInitialContact: false,
        isLastContact: false,
        empresaPreseleccionada: null
      },
    }))
  }

  const handleAddCompany = () => {
    openModal("empresa", "add", null, { existingCompanies: [...companies] });
  };

  const handleEditCompany = async () => {
    if (selectedCompany) {
      try {
        const response = await fetchWithToken(`${API_BASE_URL}/empresas/${selectedCompany.id}/has-tratos`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Response error:", errorText);
          throw new Error("Error checking tratos");
        }
        const hasTratos = await response.json();
        openModal("empresa", "edit", selectedCompany, { hasTratos, existingCompanies: companies });
      } catch (error) {
        console.error("Error checking tratos:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message,
        });
      }
    }
  };

  const handleCompanyDetails = () => {
    if (selectedCompany) {
      openModal("detallesEmpresa", "view", selectedCompany)
    }
  }

  const handleViewMap = () => {
    if (selectedCompany?.latitud && selectedCompany?.longitud) {
      navigate("/mapa", { state: { companies, selectedCompany } })
    } else {
      Swal.fire({
        icon: "warning",
        title: "Advertencia",
        text: "La empresa seleccionada no tiene coordenadas de ubicación registradas.",
      })
    }
  }

  const handleAddContact = () => {
    if (selectedCompany) {
      openModal("contacto", "add", { empresaId: selectedCompany.id, empresaNombre: selectedCompany.nombre })
    }
  }

  const handleEditContact = (contactId) => {
    const contact = contacts.find((c) => c.id === contactId)
    if (contact) {
      openModal("contacto", "edit", {
        ...contact,
        empresaId: selectedCompany.id,
        empresaNombre: selectedCompany.nombre,
      })
    }
  }

  const handleDeleteContact = (contactId) => {
    const contact = contacts.find((c) => c.id === contactId)
    const isLastContact = contacts.length === 1

    if (contact) {
      openModal("confirmarEliminacion", "delete", contact, { isLastContact })
    }
  }

  const handleContactDetails = (contactId) => {
    const contact = contacts.find((c) => c.id === contactId)
    if (contact) {
      openModal("detallesContacto", "view", contact)
    }
  }

  const handleSaveEmpresa = async (empresaData) => {
    const formattedDomicilioFisico = empresaData.domicilioFisico
      ? (empresaData.domicilioFisico.endsWith(", México")
        ? empresaData.domicilioFisico
        : `${empresaData.domicilioFisico}, México`)
      : null;

    const updatedEmpresa = {
      ...empresaData,
      domicilioFisico: formattedDomicilioFisico,
      statusColor: getStatusColor(empresaData.estatus),
      contacts: modals.empresa.mode === "edit" ? selectedCompany?.contacts || [] : [],
    }

    if (modals.empresa.mode === "add") {
      closeModal("empresa")
    } else {
      setCompanies((prev) => prev.map((company) =>
        company.id === empresaData.id ? updatedEmpresa : company
      ))

      setSelectedCompany(prev => ({
        ...updatedEmpresa,
        contacts: prev?.contacts || []
      }))

      closeModal("empresa")
    }
  }

  const handleCompanyCreated = (empresaData) => {
    const formattedDomicilioFisico = empresaData.domicilioFisico
      ? (empresaData.domicilioFisico.endsWith(", México")
        ? empresaData.domicilioFisico
        : `${empresaData.domicilioFisico}, México`)
      : null;

    const newCompany = {
      ...empresaData,
      domicilioFisico: formattedDomicilioFisico,
      statusColor: getStatusColor(empresaData.estatus),
      contacts: [],
    }
    setCompanies((prev) => [...prev, newCompany])
    setSelectedCompany(newCompany)

    navigate(`/empresas/${newCompany.id}`, { replace: true });

    closeModal("empresa")
    openModal(
      "contacto",
      "add",
      { empresaId: newCompany.id, empresaNombre: newCompany.nombre },
      { isInitialContact: true },
    )
  }

  const handleSaveContacto = async (contactoData) => {

    const tieneCorreo = contactoData.correos && contactoData.correos.some(c => c.correo && c.correo.trim() !== "");
    const tieneTelefono = contactoData.telefonos && contactoData.telefonos.some(t => t.telefono && t.telefono.trim() !== "");

    if (!tieneCorreo && !tieneTelefono) {
      Swal.fire({
        icon: "warning",
        title: "Información requerida",
        text: "Es obligatorio ingresar al menos un teléfono o un correo electrónico para guardar el contacto.",
      });
      return;
    }
    const normalizedContacto = {
      ...contactoData,
      correos: contactoData.correos || [],
      telefonos: contactoData.telefonos || [],
    }

    const empresaId = selectedCompany.id;
    if (modals.contacto.mode === "add") {
      setCompanies((prev) =>
        prev.map((company) =>
          company.id === empresaId
            ? {
              ...company,
              contacts: [...(company.contacts || []), normalizedContacto],
              fechaUltimaActividad: new Date().toISOString(),
            }
            : company,
        ),
      )
      setSelectedCompany((prev) => ({
        ...prev,
        contacts: [...(prev.contacts || []), normalizedContacto],
        fechaUltimaActividad: new Date().toISOString(),
      }))
      setContacts(prev => [...prev, normalizedContacto])
    } else {
      setCompanies((prev) =>
        prev.map((company) =>
          company.id === empresaId
            ? {
              ...company,
              contacts: (company.contacts || []).map((contact) =>
                contact.id === normalizedContacto.id ? normalizedContacto : contact,
              ),
              fechaUltimaActividad: new Date().toISOString(),
            }
            : company,
        ),
      )
      setSelectedCompany((prev) => ({
        ...prev,
        contacts: (prev.contacts || []).map((contact) =>
          contact.id === normalizedContacto.id ? normalizedContacto : contact,
        ),
        fechaUltimaActividad: new Date().toISOString(),
      }))
      setContacts(prev => prev.map(contact =>
        contact.id === normalizedContacto.id ? normalizedContacto : contact
      ))
    }

    closeModal("contacto")
  }

  const handleConfirmDeleteContact = async () => {
    const contactId = modals.confirmarEliminacion.data?.id

    if (!contactId) return

    try {
      const response = await fetchWithToken(`${API_BASE_URL}/empresas/contactos/${contactId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Error al eliminar el contacto")
      }

      setCompanies((prev) =>
        prev.map((company) =>
          company.id === selectedCompany.id
            ? {
              ...company,
              contacts: (company.contacts || []).filter((contact) => contact.id !== contactId),
              fechaUltimaActividad: new Date().toISOString(),
            }
            : company,
        ),
      )

      setSelectedCompany((prev) => ({
        ...prev,
        contacts: (prev.contacts || []).filter((contact) => contact.id !== contactId),
        fechaUltimaActividad: new Date().toISOString(),
      }))

      setContacts(prev => prev.filter(contact => contact.id !== contactId))

      closeModal("confirmarEliminacion")
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message,
      })
    }
  }

  const handleCrearTratoDesdeEmpresa = () => {
    if (selectedCompany) {
      openModal("nuevoTrato", "add", null, { empresaPreseleccionada: selectedCompany });
    }
  }

  const handleSaveNuevoTrato = async (newTrato) => {
    try {
      const contactoEncontrado = contacts.find(contacto => contacto.id === newTrato.contactoId);

      setTratos(prev => [...prev, {
        id: newTrato.id,
        nombre: newTrato.nombre,
        contacto: {
          nombre: contactoEncontrado?.nombre || "N/A"
        },
        propietarioNombre: newTrato.propietarioNombre,
        fase: newTrato.fase,
        fechaCierre: newTrato.fechaCierre,
        noTrato: newTrato.noTrato
      }]);

      setCompaniesWithoutDeals(prev => {
        const updated = new Set(prev);
        updated.delete(selectedCompany.id);
        return updated;
      });

      closeModal("nuevoTrato");

      Swal.fire({
        title: "¡Trato creado!",
        text: "El trato se ha creado exitosamente",
        icon: "success",
      });
    } catch (error) {
      console.error("Error al crear el trato:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo crear el trato. Intenta de nuevo.",
      });
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      POR_CONTACTAR: "#87CEEB",
      EN_PROCESO: "#0057c9",
      CONTACTAR_MAS_ADELANTE: "#FF9800",
      PERDIDO: "#F44336",
      CLIENTE: "#4CAF50",
    }
    return statusColors[status] || "#87CEEB"
  }

  const checkCompaniesWithoutDeals = async (companiesList) => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/empresas/sin-tratos`)
      if (response.ok) {
        const empresasSinTratos = await response.json()
        setCompaniesWithoutDeals(new Set(empresasSinTratos))
      }
    } catch (error) {
      console.error('Error checking companies without deals:', error)
    }
  }

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="empresas-loading">
            <div className="spinner"></div>
            <p>Cargando empresas...</p>
          </div>
        )}
        <main className="main-content">
          <div className="empresas-container">
            <section className="companies-panel">
              <div className="panel-header">
                <button className="btn btn-add" onClick={handleAddCompany}>
                  Agregar empresa
                </button>
              </div>

              <div className="search-section">
                <div className="search-filter-row">
                  <div className="search-input-container">
                    <input
                      type="text"
                      placeholder="Buscar nombre de la empresa"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Todas</option>
                    {estatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="date-filter-row">
                  <div className="date-filter-container">
                    <DatePicker
                      selectsRange={true}
                      startDate={startDate}
                      endDate={endDate}
                      onChange={(update) => {
                        setDateRange(update);
                      }}
                      placeholderText="Seleccionar un rango de fechas de creación"
                      className="date-picker-input"
                      dateFormat="dd/MM/yyyy"
                      isClearable={true}
                    />
                  </div>
                </div>
              </div>

              <div className="companies-list">
                {filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className={`company-item ${selectedCompany?.id === company.id ? "selected" : ""} ${modulosActivos.tratos && companiesWithoutDeals.has(company.id) ? "no-deals" : ""}`}
                    onClick={() => handleCompanySelect(company)}
                  >
                    <div className="company-info">
                      <h3>{company.nombre || "N/A"}</h3>
                      <div
                        className="status-indicator"
                        style={{ backgroundColor: company.statusColor || "#87CEEB" }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="company-details-panel">
              {selectedCompany ? (
                <>
                  <div className="company-form">
                    <div className="form-header">
                      <h3>Datos de la Empresa</h3>
                      <div className="form-actions">
                        <button className="btn btn-add" onClick={handleEditCompany}>
                          Editar empresa
                        </button>
                        <button className="btn btn-details" onClick={handleCompanyDetails} title="Detalles empresa">
                          <img src={detailsIcon || "/placeholder.svg"} alt="Detalles" className="btn-icon" />
                          Detalles
                        </button>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Nombre de la empresa</label>
                        <input type="text" value={selectedCompany.nombre || "N/A"} className="form-control" readOnly />
                      </div>
                      <div className="form-group">
                        <label>Estatus</label>
                        <input
                          type="text"
                          value={getStatusText(selectedCompany.estatus)}
                          className="form-control"
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Sitio web</label>
                      <input
                        type="text"
                        value={selectedCompany.sitioWeb || "N/A"}
                        className="form-control clickable"
                        readOnly
                        onClick={() => {
                          if (selectedCompany.sitioWeb) {
                            window.open(selectedCompany.sitioWeb, "_blank", "noopener,noreferrer");
                          }
                        }}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group address-group">
                        <label>Domicilio</label>
                        <input
                          type="text"
                          value={selectedCompany.domicilioFisico || "Sin domicilio"}
                          className="form-control"
                          readOnly
                        />
                        <button className="btn btn-ver-en-el-mapa" onClick={handleViewMap} title="Ver en el mapa">
                          Ver en el mapa
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="contacts-section">
                    <div className="contacts-header">
                      <button className="btn btn-new-contact" onClick={handleAddContact}>
                        Nuevo contacto
                      </button>

                      <div className="contacts-search-row">
                        <div className="contacts-search">
                          <label>Nombre del contacto:</label>
                          <input
                            type="text"
                            placeholder="Ingresa el nombre del contacto"
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            className="search-input small"
                          />
                        </div>

                        <div className="contacts-filter">
                          <label>Rol:</label>
                          <select
                            value={contactRole}
                            onChange={(e) => setContactRole(e.target.value)}
                            className="filter-select small"
                          >
                            <option value="">Todas</option>
                            {rolesOptions.map((rol) => (
                              <option key={rol} value={rol}>
                                {rol.charAt(0) + rol.slice(1).toLowerCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="contacts-table-container">
                      <table className="contacts-table">
                        <thead>
                          <tr>
                            <th>No.</th>
                            <th>Nombre del contacto</th>
                            <th>Teléfono</th>
                            <th>Correo electrónico</th>
                            <th>Rol</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredContacts.length > 0 ? (
                            filteredContacts.map((contact, index) => (
                              <tr key={contact.id}>
                                <td>{index + 1}</td>
                                <td>{contact.nombre || "N/A"}</td>
                                <td>{contact.telefonos?.[0]?.telefono || "N/A"}</td>
                                <td>{contact.correos?.[0]?.correo || "N/A"}</td>
                                <td>
                                  {contact.rol ? contact.rol.charAt(0) + contact.rol.slice(1).toLowerCase() : "N/A"}
                                </td>
                                <td>
                                  <div className="action-buttons">
                                    <button
                                      className="btn-action edit"
                                      onClick={() => handleEditContact(contact.id)}
                                      title="Editar"
                                    >
                                      <img src={editIcon || "/placeholder.svg"} alt="Editar" />
                                    </button>
                                    <button
                                      className="btn-action delete"
                                      onClick={() => handleDeleteContact(contact.id)}
                                      title="Eliminar"
                                    >
                                      <img src={deleteIcon || "/placeholder.svg"} alt="Eliminar" />
                                    </button>
                                    <button
                                      className="btn-action details"
                                      onClick={() => handleContactDetails(contact.id)}
                                      title="Detalles"
                                    >
                                      <img src={detailsIcon || "/placeholder.svg"} alt="Detalles" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" className="no-data">
                                No se encontraron contactos
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {modulosActivos.tratos && (
                    <div className="tratos-section">
                      <div className="tratos-header">
                        <h3>Tratos de la Empresa</h3>
                        <button
                          className="btn btn-add"
                          onClick={handleCrearTratoDesdeEmpresa}
                          disabled={!selectedCompany}
                        >
                          Crear Trato
                        </button>
                      </div>
                      <div className="tratos-table-container">
                        <table className="tratos-table">
                          <thead>
                            <tr>
                              <th>No. Trato</th>
                              <th>Nombre del Trato</th>
                              <th>Nombre del Contacto</th>
                              <th>Propietario</th>
                              <th>Fase</th>
                              <th>Fecha de Cierre</th>
                              {(userRol === "ADMINISTRADOR" || userRol === "GESTOR") && (
                                <th>Acciones</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {tratos.length > 0 ? (
                              tratos.map((trato, index) => (
                                <tr
                                  key={trato.id}
                                  style={{ cursor: 'pointer' }}
                                  className="trato-row-clickable"
                                >
                                  <td onClick={() => handleTratoClick(trato.id)}>{trato.noTrato || index + 1}</td>
                                  <td onClick={() => handleTratoClick(trato.id)}>{trato.nombre || "N/A"}</td>
                                  <td onClick={() => handleTratoClick(trato.id)}>{trato.contacto?.nombre || "N/A"}</td>
                                  <td onClick={() => handleTratoClick(trato.id)}>{trato.propietarioNombre || "N/A"}</td>
                                  <td onClick={() => handleTratoClick(trato.id)}>{trato.fase || "N/A"}</td>
                                  <td onClick={() => handleTratoClick(trato.id)}>
                                    {trato.fechaCierre
                                      ? new Date(trato.fechaCierre).toLocaleDateString("es-MX")
                                      : "N/A"}
                                  </td>
                                  {(userRol === "ADMINISTRADOR" || userRol === "GESTOR") && (
                                    <td>
                                      <div className="action-buttons">
                                        <button
                                          className="btn-action delete"
                                          onClick={(e) => handleDeleteTrato(trato.id, e)}
                                          title="Eliminar trato"
                                        >
                                          <img src={deleteIcon} alt="Eliminar" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan={(userRol === "ADMINISTRADOR" || userRol === "GESTOR") ? 7 : 6}
                                  className="no-data"
                                >
                                  No se encontraron tratos para esta empresa
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-selection">
                  <p>Selecciona una empresa para ver sus detalles</p>
                </div>
              )}
            </section>
          </div>

          <EmpresaModal
            isOpen={modals.empresa.isOpen}
            onClose={() => closeModal("empresa")}
            onSave={handleSaveEmpresa}
            empresa={modals.empresa.data}
            mode={modals.empresa.mode}
            onCompanyCreated={handleCompanyCreated}
            users={users}
            hasTratos={modals.empresa.hasTratos}
            existingCompanies={modals.empresa.existingCompanies}
          />

          <ContactoModal
            isOpen={modals.contacto.isOpen}
            onClose={() => closeModal("contacto")}
            onSave={handleSaveContacto}
            contacto={modals.contacto.data}
            empresaId={modals.contacto.data?.empresaId}
            empresaNombre={modals.contacto.data?.empresaNombre}
            mode={modals.contacto.mode}
            isInitialContact={modals.contacto.isInitialContact}
            users={users}
          />

          <DetallesEmpresaModal
            isOpen={modals.detallesEmpresa.isOpen}
            onClose={() => closeModal("detallesEmpresa")}
            empresa={modals.detallesEmpresa.data}
            sectores={sectores}
          />

          <DetallesContactoModal
            isOpen={modals.detallesContacto.isOpen}
            onClose={() => closeModal("detallesContacto")}
            contacto={modals.detallesContacto.data}
          />

          <ConfirmarEliminacionModal
            isOpen={modals.confirmarEliminacion.isOpen}
            onClose={() => closeModal("confirmarEliminacion")}
            onConfirm={handleConfirmDeleteContact}
            contacto={modals.confirmarEliminacion.data}
            isLastContact={modals.confirmarEliminacion.isLastContact}
          />

          <NuevoTratoModal
            isOpen={modals.nuevoTrato.isOpen}
            onClose={() => closeModal("nuevoTrato")}
            onSave={handleSaveNuevoTrato}
            empresaPreseleccionada={modals.nuevoTrato.empresaPreseleccionada}
          />
        </main>
      </div>
    </>
  )
}

export default Empresas
