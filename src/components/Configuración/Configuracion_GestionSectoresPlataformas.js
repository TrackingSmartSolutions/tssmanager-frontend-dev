import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Configuracion_GestionSectoresPlataformas.css"
import Header from "../Header/Header"
import editIcon from "../../assets/icons/editar.png"
import deleteIcon from "../../assets/icons/eliminar.png"
import Swal from "sweetalert2"
import { API_BASE_URL } from "../Config/Config"

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

// Modal para Agregar/Editar Sector
const SectorModal = ({ isOpen, onClose, onSave, sector, mode }) => {
  const [formData, setFormData] = useState({
    nombreSector: "",
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (sector && mode === "edit") {
      setFormData({
        nombreSector: sector.nombreSector || "",
      })
    } else {
      setFormData({
        nombreSector: "",
      })
    }
    setErrors({})
  }, [sector, mode, isOpen])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.nombreSector.trim()) {
      newErrors.nombreSector = "Este campo es obligatorio"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const sectorData = {
      id: mode === "edit" ? sector.id : undefined,
      nombreSector: formData.nombreSector.trim(),
    }

    onSave(sectorData, mode)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "add" ? "Nuevo sector" : "Editar sector"}
      size="md"
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="nombreSector">
              Nombre Sector <span className="required">*</span>
            </label>
            <input
              type="text"
              id="nombreSector"
              value={formData.nombreSector}
              onChange={(e) => handleInputChange("nombreSector", e.target.value)}
              className={`modal-form-control ${errors.nombreSector ? "error" : ""}`}
              placeholder="Ej. Agricultura, cría y explotación de animales, aprovechamiento forestal, pesca y caza"
            />
            {errors.nombreSector && <span className="error-message">{errors.nombreSector}</span>}
          </div>
        </div>

        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {mode === "add" ? "Agregar" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Modal de Confirmación de Eliminación
const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm, item, type }) => {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const getTitle = () => {
    return type === "sector" ? "Confirmar eliminación de sector" : "Confirmar eliminación de plataforma"
  }

  const getMessage = () => {
    return type === "sector"
      ? "¿Seguro que quieres eliminar este sector de forma permanente?"
      : "¿Seguro que quieres eliminar esta plataforma de forma permanente?"
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()} size="sm" closeOnOverlayClick={false}>
      <div className="confirmar-eliminacion">
        <div className="confirmation-content">
          <p className="confirmation-message">{getMessage()}</p>
          <div className="modal-form-actions">
            <button type="button" onClick={onClose} className="btn btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} className="btn btn-confirm">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Componente Principal
const ConfiguracionGestionSectoresPlataformas = () => {
  const [sectores, setSectores] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("sectores")
  const [modals, setModals] = useState({
    sector: { isOpen: false, mode: "add", data: null },
    confirmarEliminacion: { isOpen: false, data: null, type: null },
  })

  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch sectores
      const sectoresResponse = await fetchWithToken(`${API_BASE_URL}/sectores`)
      const sectoresData = await sectoresResponse.json()
      setSectores(sectoresData)

    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los datos" })
    } finally {
      setIsLoading(false)
    }
  }

  const openModal = (modalType, mode = "add", data = null, type = null) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: { isOpen: true, mode, data, type },
    }))
  }

  const closeModal = (modalType) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: { isOpen: false, mode: "add", data: null, type: null },
    }))
  }

  // Handlers para Sectores
  const handleAddSector = () => {
    openModal("sector", "add")
  }

  const handleEditSector = (sectorId) => {
    const sector = sectores.find((s) => s.id === sectorId)
    if (sector) {
      openModal("sector", "edit", sector)
    }
  }

  const handleDeleteSector = (sectorId) => {
    const sector = sectores.find((s) => s.id === sectorId)
    if (sector) {
      openModal("confirmarEliminacion", "delete", sector, "sector")
    }
  }

  const handleSaveSector = async (sectorData, mode) => {
    try {
      // Verificar si el nombre ya existe
      const existingSector = sectores.find(
        (s) =>
          s.nombreSector.toLowerCase() === sectorData.nombreSector.toLowerCase() &&
          (mode !== "edit" || s.id !== sectorData.id),
      )
      if (existingSector) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "El Nombre Sector ya está registrado. Por favor, ingrese un nombre diferente.",
        })
        return
      }

      const url = `${API_BASE_URL}/sectores${sectorData.id ? `/${sectorData.id}` : ""}`
      const method = sectorData.id ? "PUT" : "POST"
      const response = await fetchWithToken(url, {
        method,
        body: JSON.stringify(sectorData),
        headers: { "Content-Type": "application/json" },
      })

      fetchData()
      Swal.fire({
        icon: "success",
        title: sectorData.id ? "Sector actualizado" : "Sector creado",
        text: `El sector se ha ${sectorData.id ? "actualizado" : "creado"} correctamente.`,
      })
      closeModal("sector")
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al guardar el sector.",
      })
    }
  }

  const handleConfirmDelete = async () => {
    const { data, type } = modals.confirmarEliminacion

    try {
      const checkResponse = await fetchWithToken(`${API_BASE_URL}/sectores/${data.id}/check-associations`)
      const checkData = await checkResponse.json()

      if (checkData.hasAssociations) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se puede eliminar el sector porque está vinculado a una o más empresas.",
        })
        closeModal("confirmarEliminacion")
        return
      }

      await fetchWithToken(`${API_BASE_URL}/sectores/${data.id}`, { method: "DELETE" })
      Swal.fire({
        icon: "success",
        title: "Sector eliminado",
        text: "El sector se ha eliminado correctamente.",
      })

      fetchData()
      closeModal("confirmarEliminacion")
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al eliminar el sector.",
      })
    }
  }

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="sectores-plataformas-loading">
            <div className="spinner"></div>
            <p>Cargando datos...</p>
          </div>
        )}
        <div className="sectores-plataformas-config-header">
          <h2 className="sectores-plataformas-config-title">Configuración</h2>
          <nav className="sectores-plataformas-config-nav">
            <div className="sectores-plataformas-nav-item" onClick={() => navigate("/configuracion_plantillas")}>
              Plantillas de correo
            </div>
            <div className="sectores-plataformas-nav-item" onClick={() => navigate("/configuracion_admin_datos")}>
              Administrador de datos
            </div>
            <div className="sectores-plataformas-nav-item" onClick={() => navigate("/configuracion_empresa")}>
              Configuración de la empresa
            </div>
            <div className="sectores-plataformas-nav-item" onClick={() => navigate("/configuracion_almacenamiento")}>
              Almacenamiento
            </div>
            <div className="sectores-plataformas-nav-item" onClick={() => navigate("/configuracion_copias_seguridad")}>
              Copias de Seguridad
            </div>
            <div className="sectores-plataformas-nav-item" onClick={() => navigate("/configuracion_usuarios")}>
              Usuarios y roles
            </div>
            <div className="sectores-plataformas-nav-item sectores-plataformas-nav-item-active">
              Sectores
            </div>
            <div
              className="sectores-plataformas-nav-item"
              onClick={() => navigate("/configuracion_correos")}
            >
              Historial de Correos
            </div>
          </nav>
        </div>

        <main className="sectores-plataformas-main-content">
          <div className="sectores-plataformas-container">
            {/* Sub-navegación para las pestañas */}
            <div className="sectores-plataformas-sub-nav">
              <div
                className={`sectores-plataformas-sub-nav-item ${activeTab === "sectores" ? "sectores-plataformas-sub-nav-item-active" : ""}`}
                onClick={() => setActiveTab("sectores")}
              >
                Gestión de Sectores
              </div>
            </div>

            {/* Contenido de Sectores */}
            {activeTab === "sectores" && (
              <section className="sectores-plataformas-section">
                <div className="sectores-plataformas-section-header">
                  <h3 className="sectores-plataformas-section-title">Gestión de Sectores</h3>
                  <button className="sectores-plataformas-btn sectores-plataformas-btn-add" onClick={handleAddSector}>
                    Agregar nuevo sector
                  </button>
                </div>

                <div className="sectores-plataformas-table-container">
                  <table className="sectores-plataformas-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nombre Sector</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectores.map((sector) => (
                        <tr key={sector.id}>
                          <td>{sector.id}</td>
                          <td>{sector.nombreSector}</td>
                          <td>
                            <div className="sectores-plataformas-action-buttons">
                              <button
                                className="sectores-plataformas-btn-action sectores-plataformas-edit"
                                onClick={() => handleEditSector(sector.id)}
                                title="Editar sector"
                              >
                                <img src={editIcon || "/placeholder.svg"} alt="Editar" />
                              </button>
                              <button
                                className="sectores-plataformas-btn-action sectores-plataformas-delete"
                                onClick={() => handleDeleteSector(sector.id)}
                                title="Eliminar sector"
                              >
                                <img src={deleteIcon || "/placeholder.svg"} alt="Eliminar" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

          </div>
        </main>

        {/* Modales */}
        <SectorModal
          isOpen={modals.sector.isOpen}
          onClose={() => closeModal("sector")}
          onSave={handleSaveSector}
          sector={modals.sector.data}
          mode={modals.sector.mode}
        />

        <ConfirmarEliminacionModal
          isOpen={modals.confirmarEliminacion.isOpen}
          onClose={() => closeModal("confirmarEliminacion")}
          onConfirm={handleConfirmDelete}
          item={modals.confirmarEliminacion.data}
          type={modals.confirmarEliminacion.type}
        />
      </div>
    </>
  )
}

export default ConfiguracionGestionSectoresPlataformas
