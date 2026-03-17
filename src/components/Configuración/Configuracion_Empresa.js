import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Configuracion_Empresa.css";
import Header from "../Header/Header";
import uploadIcon from "../../assets/icons/subir.png";
import { API_BASE_URL } from "../Config/Config";
import Swal from "sweetalert2";

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`);
  return response;
};

const ConfiguracionEmpresa = () => {
  const [companyData, setCompanyData] = useState({
    id: 1,
    nombre: "",
    eslogan: "",
    correoContacto: "",
    telefonoMovil: "",
    telefonoFijo: "",
    direccionPrincipal: "",
    logo: null,
    logoPreview: null,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate();

  useEffect(() => {
    const cargarConfiguracion = async () => {
      setIsLoading(true)
      try {
        const response = await fetchWithToken(`${API_BASE_URL}/configuracion/empresa`);
        const data = await response.json();
        setCompanyData({
          id: data.id,
          nombre: data.nombre || "",
          eslogan: data.eslogan || "",
          correoContacto: data.correoContacto || "",
          telefonoMovil: data.telefonoMovil || "",
          telefonoFijo: data.telefonoFijo || "",
          direccionPrincipal: data.direccionPrincipal || "",
          logo: null,
          logoPreview: data.logoUrl || null,
        });
      } catch (error) {
        console.error('Error al cargar configuración:', error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo cargar la configuración de la empresa.",
        });
      } finally {
        setIsLoading(false)
      }
    };

    cargarConfiguracion();
  }, []);

  const handleInputChange = (field, value) => {
    setCompanyData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setHasChanges(true);
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
      if (!allowedTypes.includes(file.type)) {
        Swal.fire({
          icon: "error",
          title: "Formato incorrecto",
          text: "Solo se permiten archivos PNG, JPG o SVG.",
        });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        Swal.fire({
          icon: "error",
          title: "Archivo muy grande",
          text: "El logo no debe exceder 2MB.",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setCompanyData((prev) => ({
          ...prev,
          logo: file,
          logoPreview: e.target.result,
        }));
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setCompanyData((prev) => ({
      ...prev,
      logo: null,
      logoPreview: null,
    }));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!companyData.nombre.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Campo requerido",
        text: "El nombre de la empresa es obligatorio.",
      });
      return;
    }
    if (!companyData.correoContacto.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Campo requerido",
        text: "El correo de contacto es obligatorio.",
      });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyData.correoContacto)) {
      Swal.fire({
        icon: "warning",
        title: "Correo inválido",
        text: "Por favor ingrese un correo electrónico válido.",
      });
      return;
    }

    try {
      const result = await Swal.fire({
        title: "¿Guardar cambios?",
        text: "Los cambios se aplicarán en toda la plataforma y en las comunicaciones enviadas.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Guardar",
        cancelButtonText: "Cancelar",
      });

      if (result.isConfirmed) {
        Swal.fire({
          title: "Guardando cambios...",
          text: "Por favor espere mientras se actualizan los datos de la empresa.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const formData = new FormData();
        formData.append("configuracion", new Blob([JSON.stringify({
          id: companyData.id,
          nombre: companyData.nombre,
          eslogan: companyData.eslogan,
          correoContacto: companyData.correoContacto,
          telefonoMovil: companyData.telefonoMovil,
          telefonoFijo: companyData.telefonoFijo,
          direccionPrincipal: companyData.direccionPrincipal,
        })], { type: "application/json" }));
        if (companyData.logo) {
          formData.append("logo", companyData.logo);
        }

        const response = await fetchWithToken(`${API_BASE_URL}/configuracion/empresa`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          if (response.status === 409) {
            const reloadResponse = await fetchWithToken(`${API_BASE_URL}/configuracion/empresa`);
            const reloadedData = await reloadResponse.json();
            setCompanyData({
              id: reloadedData.id,
              nombre: reloadedData.nombre || "",
              eslogan: reloadedData.eslogan || "",
              correoContacto: reloadedData.correoContacto || "",
              telefonoMovil: reloadedData.telefonoMovil || "",
              telefonoFijo: reloadedData.telefonoFijo || "",
              direccionPrincipal: reloadedData.direccionPrincipal || "",
              logo: null,
              logoPreview: reloadedData.logoUrl || null,
            });
            setHasChanges(false);
            Swal.fire({
              icon: "warning",
              title: "Conflicto de actualización",
              text: "La configuración fue modificada por otro usuario. La página se ha recargado con los datos más recientes.",
            });
          } else {
            throw new Error(`Error al guardar: ${response.statusText}`);
          }
        } else {
          const data = await response.json();
          setCompanyData((prev) => ({
            ...prev,
            logoPreview: data.logoUrl || prev.logoPreview,
          }));
          localStorage.setItem("cachedLogoUrl", data.logoUrl || "/placeholder.svg");
          window.dispatchEvent(new Event("logoUpdated"));
          Swal.fire({
            icon: "success",
            title: "Cambios guardados",
            text: "La información de la empresa se ha actualizado correctamente.",
          });
          setHasChanges(false);
        }
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al guardar los cambios: " + error.message,
      });
    }
  };

  const handleDiscardChanges = async () => {
    if (hasChanges) {
      const result = await Swal.fire({
        title: "¿Descartar cambios?",
        text: "Se perderán todos los cambios no guardados.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Descartar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#f44336",
      });

      if (result.isConfirmed) {
        const response = await fetchWithToken(`${API_BASE_URL}/configuracion/empresa`);
        const data = await response.json();
        setCompanyData({
          id: data.id,
          nombre: data.nombre || "",
          eslogan: data.eslogan || "",
          correoContacto: data.correoContacto || "",
          telefonoMovil: data.telefonoMovil || "",
          telefonoFijo: data.telefonoFijo || "",
          direccionPrincipal: data.direccionPrincipal || "",
          logo: null,
          logoPreview: data.logoUrl || null,
        });
        setHasChanges(false);
      }
    }
  };

  return (
    <>
      <div className="page-with-header">
        <Header logoUrl={companyData.logoPreview} />
        {isLoading && (
          <div className="config-empresa-loading">
            <div className="spinner"></div>
            <p>Cargando configuración de la empresa...</p>
          </div>
        )}
        <div className="config-empresa-config-header">
          <h2 className="config-empresa-config-title">Configuración</h2>
          <nav className="config-empresa-config-nav">
            <div className="config-empresa-nav-item" onClick={() => navigate("/configuracion_plantillas")}>
              Plantillas de correo
            </div>
            <div className="config-empresa-nav-item" onClick={() => navigate("/configuracion_admin_datos")}>
              Administrador de datos
            </div>
            <div className="config-empresa-nav-item config-empresa-nav-item-active">Configuración de la empresa</div>
            <div className="config-empresa-nav-item" onClick={() => navigate("/configuracion_almacenamiento")}>
              Almacenamiento
            </div>
            <div className="config-empresa-nav-item" onClick={() => navigate("/configuracion_copias_seguridad")}>
              Copias de Seguridad
            </div>
            <div className="config-empresa-nav-item" onClick={() => navigate("/configuracion_usuarios")}>
              Usuarios y roles
            </div>
            <div
              className="config-empresa-nav-item"
              onClick={() => navigate("/configuracion_gestion_sectores_plataformas")}
            >
              Sectores y plataformas
            </div>
            <div
              className="config-empresa-nav-item"
              onClick={() => navigate("/configuracion_correos")}
            >
              Historial de Correos
            </div>
          </nav>
        </div>

        <main className="config-empresa-main-content">
          <div className="config-empresa-container">
            <section className="config-empresa-section">
              <h3 className="config-empresa-section-title">Información de la Empresa</h3>

              <div className="config-empresa-form">
                <div className="config-empresa-form-row">
                  <div className="config-empresa-form-group">
                    <label htmlFor="nombre">
                      Nombre de la empresa <span className="config-empresa-required">*</span>
                    </label>
                    <input
                      type="text"
                      id="nombre"
                      value={companyData.nombre}
                      onChange={(e) => handleInputChange("nombre", e.target.value)}
                      className="config-empresa-form-control"
                      placeholder="Ingrese el nombre de la empresa"
                    />
                  </div>

                  <div className="config-empresa-form-group">
                    <label htmlFor="direccion">Dirección principal</label>
                    <input
                      type="text"
                      id="direccion"
                      value={companyData.direccionPrincipal}
                      onChange={(e) => handleInputChange("direccionPrincipal", e.target.value)}
                      className="config-empresa-form-control"
                      placeholder="Ingrese la dirección principal"
                    />
                  </div>
                </div>

                <div className="config-empresa-form-row">
                  <div className="config-empresa-form-group config-empresa-full-width">
                    <label htmlFor="eslogan">Eslogan</label>
                    <input
                      type="text"
                      id="eslogan"
                      value={companyData.eslogan}
                      onChange={(e) => handleInputChange("eslogan", e.target.value)}
                      className="config-empresa-form-control"
                      placeholder="Ingrese el eslogan de la empresa"
                    />
                  </div>
                </div>

                <div className="config-empresa-form-row">
                  <div className="config-empresa-form-group">
                    <label htmlFor="correo">
                      Correo de contacto <span className="config-empresa-required">*</span>
                    </label>
                    <input
                      type="email"
                      id="correo"
                      value={companyData.correoContacto}
                      onChange={(e) => handleInputChange("correoContacto", e.target.value)}
                      className="config-empresa-form-control"
                      placeholder="correo@empresa.com"
                    />
                  </div>

                  <div className="config-empresa-logo-section">
                    <label>Logo de la empresa</label>
                    <div className="config-empresa-logo-upload-area">
                      <div className="config-empresa-logo-drop-zone">
                        <div className="config-empresa-upload-icon">
                          <img src={uploadIcon || "/placeholder.svg"} alt="Upload" />
                        </div>
                        <p>Arrastra y suelta tu logo aquí</p>
                        <p className="config-empresa-file-formats">PNG, JPG o SVG (máx. 2mb)</p>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg"
                          onChange={handleLogoUpload}
                          className="config-empresa-file-input"
                        />
                        <button
                          type="button"
                          className="config-empresa-btn config-empresa-btn-secondary"
                          onClick={() => document.querySelector(".config-empresa-file-input").click()}
                        >
                          Seleccionar archivo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="config-empresa-form-row">
                  <div className="config-empresa-form-group">
                    <label htmlFor="telefono-movil">Teléfono de contacto móvil</label>
                    <input
                      type="tel"
                      id="telefono-movil"
                      value={companyData.telefonoMovil}
                      onChange={(e) => handleInputChange("telefonoMovil", e.target.value)}
                      className="config-empresa-form-control"
                      placeholder="+52 1 477 123 4567"
                    />
                  </div>

                  <div className="config-empresa-logo-preview-section">
                    <label>Vista previa</label>
                    <div className="config-empresa-logo-preview">
                      {companyData.logoPreview ? (
                        <div className="config-empresa-preview-container">
                          <img
                            src={companyData.logoPreview || "/placeholder.svg"}
                            alt="Logo preview"
                            className="config-empresa-logo-image"
                          />
                          <button
                            type="button"
                            className="config-empresa-remove-logo"
                            onClick={handleRemoveLogo}
                            title="Eliminar logo"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="config-empresa-no-preview">
                          <p>No hay logo seleccionado</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="config-empresa-form-row">
                  <div className="config-empresa-form-group">
                    <label htmlFor="telefono-fijo">Teléfono de contacto fijo</label>
                    <input
                      type="tel"
                      id="telefono-fijo"
                      value={companyData.telefonoFijo}
                      onChange={(e) => handleInputChange("telefonoFijo", e.target.value)}
                      className="config-empresa-form-control"
                      placeholder="+52 1 477 123 4567"
                    />
                  </div>
                  <div className="config-empresa-form-group"></div>
                </div>

                <div className="config-empresa-form-actions">
                  {hasChanges && (
                    <button className="config-empresa-btn config-empresa-btn-secondary" onClick={handleDiscardChanges}>
                      Descartar cambios
                    </button>
                  )}
                  <button
                    className="config-empresa-btn config-empresa-btn-primary"
                    onClick={handleSaveChanges}
                    disabled={!hasChanges}
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default ConfiguracionEmpresa