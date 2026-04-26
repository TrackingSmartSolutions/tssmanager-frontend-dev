import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"
import "./Configuracion_Administrador.css"
import Header from "../Header/Header"
import downloadIcon from "../../assets/icons/descarga.png"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { API_BASE_URL } from "../Config/Config";
import Swal from "sweetalert2"

const fetchWithToken = async (url, options = {}, parseAsJson = true) => {
  const token = localStorage.getItem("token");
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!options.body || !(options.body instanceof FormData)) {
    if (parseAsJson) {
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`);
  }
  return parseAsJson ? response.json() : response;
};

const CustomDatePickerInput = ({ value, onClick, placeholder }) => (
  <div className="config-admin-date-picker-wrapper">
    <input
      type="text"
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      readOnly
      className="config-admin-date-picker"
    />
    <div className="config-admin-date-picker-icons">
      <svg
        className="config-admin-calendar-icon"
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

const ConfiguracionAdministrador = () => {
  const [exportData, setExportData] = useState({
    tiposDatos: "auditoria",
    formato: "csv",
  });

  const [rangoFechasExport, setRangoFechasExport] = useState([null, null]);
  const [fechaInicioExport, fechaFinExport] = rangoFechasExport;
  const [exportHistory, setExportHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { tratos: true, empresas: true, crm: true };

  const tiposDatosOptions = [
    ...(modulosActivos.tratos ? [{ value: "tratos", label: "Tratos" }] : []),
    ...(modulosActivos.empresas ? [
      { value: "empresas", label: "Empresas" },
      { value: "contactos", label: "Contactos" },
      { value: "correoContactos", label: "Correos de los contactos" }
    ] : []),
    { value: "auditoria", label: "Auditoría del Sistema" },
  ];

  const formatosExportacion = [
    { value: "csv", label: "CSV" },
    { value: "pdf", label: "PDF" },
  ];

  const handleExportInputChange = (field, value) => {
    setExportData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleExportData = async () => {
    try {
      const result = await Swal.fire({
        title: "¿Exportar datos?",
        text: `¿Está seguro de que desea exportar los datos de ${exportData.tiposDatos} en formato ${exportData.formato.toUpperCase()}?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Exportar",
        cancelButtonText: "Cancelar",
      });
      if (result.isConfirmed) {
        Swal.fire({
          title: "Exportando datos...",
          text: "Por favor espere mientras se genera el archivo.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        const response = await fetchWithToken(`${API_BASE_URL}/administrador-datos/exportar-datos`, {
          method: "POST",
          body: JSON.stringify({
            tipoDatos: exportData.tiposDatos,
            formatoExportacion: exportData.formato,
            fechaInicio: fechaInicioExport ? fechaInicioExport.toISOString().split('T')[0] : "",
            fechaFin: fechaFinExport ? fechaFinExport.toISOString().split('T')[0] : "",
            usuarioId: parseInt(localStorage.getItem("userId")),
          }),
        });
        const resultData = await response;

        Swal.fire({
          icon: resultData.exito ? "success" : "error",
          title: resultData.exito ? "Datos exportados" : "Error",
          text: resultData.mensaje || "Ocurrió un error al exportar los datos.",
        });
        if (resultData.exito) {
          fetchExportHistory();
        }
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al exportar los datos: " + error.message,
      });
    }
  };

  const fetchExportHistory = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/administrador-datos/historial-exportaciones/${localStorage.getItem("userId")}`);
      const data = await response;
      setExportHistory(data.map(item => ({
        id: item.id,
        tipoDatos: item.tipoDatos,
        formato: item.formatoExportacion,
        nombre: item.nombreArchivo,
        tamaño: item.tamañoArchivo,
        fecha: item.fechaCreacion,
        fechaInicio: item.fechaInicio,
        fechaFin: item.fechaFin
      })));
    } catch (error) {
      console.error("Error fetching export history:", error);
    }
  };

  const handleDownloadExport = async (exportItem) => {
    try {
      const response = await fetchWithToken(
        `${API_BASE_URL}/administrador-datos/descargar-exportacion/${exportItem.id}?usuarioId=${localStorage.getItem("userId")}`,
        {},
        false
      );

      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Obtener el blob del archivo
      const blob = await response.blob();

      // Verificar que el blob no esté vacío
      if (blob.size === 0) {
        throw new Error("El archivo está vacío");
      }

      // Crear URL para descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportItem.nombre;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Descarga completada",
        text: `El archivo ${exportItem.nombre} se ha descargado correctamente.`,
      });
    } catch (error) {
      console.error("Error al descargar archivo:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `No se pudo descargar el archivo: ${error.message}`,
      });
    }
  };

  const handleDeleteExport = async (exportId) => {
    const exportItem = exportHistory.find((item) => item.id === exportId);
    const result = await Swal.fire({
      title: "¿Eliminar exportación?",
      text: `¿Está seguro de que desea eliminar "${exportItem.nombre}"? Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f44336",
    });

    if (result.isConfirmed) {
      try {
        await fetchWithToken(
          `${API_BASE_URL}/administrador-datos/eliminar-exportacion/${exportId}?usuarioId=${localStorage.getItem("userId")}`,
          {
            method: "DELETE",
          },
          false
        );

        setExportHistory((prev) => prev.filter((item) => item.id !== exportId));
        Swal.fire({
          icon: "success",
          title: "Exportación eliminada",
          text: "La exportación se ha eliminado correctamente.",
        });
        fetchExportHistory();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo eliminar la exportación.",
        });
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const cargarDatosIniciales = async () => {
    setIsLoading(true)
    try {
      await fetchExportHistory()
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    cargarDatosIniciales()
  }, [])


  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="config-admin-loading">
            <div className="spinner"></div>
            <p>Cargando configuración...</p>
          </div>
        )}
        {/* Configuration Navigation */}
        <div className="config-admin-config-header">
          <h2 className="config-admin-config-title">Configuración</h2>
          <nav className="config-admin-config-nav">
            <div className="config-admin-nav-item" onClick={() => navigate("/configuracion_plantillas")}>
              Plantillas de correo
            </div>
            <div className="config-admin-nav-item config-admin-nav-item-active">Administrador de datos</div>
            <div className="config-admin-nav-item" onClick={() => navigate("/configuracion_empresa")}>
              Configuración de la empresa
            </div>
            <div className="config-admin-nav-item" onClick={() => navigate("/configuracion_almacenamiento")}>
              Almacenamiento
            </div>
            <div className="config-admin-nav-item" onClick={() => navigate("/configuracion_copias_seguridad")}>
              Copias de Seguridad
            </div>
            <div className="config-admin-nav-item" onClick={() => navigate("/configuracion_usuarios")}>
              Usuarios y roles
            </div>
            <div
              className="config-admin-nav-item"
              onClick={() => navigate("/configuracion_gestion_sectores_plataformas")}
            >
              Sectores
            </div>
            <div
              className="config-admin-nav-item"
              onClick={() => navigate("/configuracion_correos")}
            >
              Historial de Correos
            </div>
          </nav>
        </div>

        <main className="config-admin-main-content">
          <div className="config-admin-container">
            {/* Exportar Datos */}
            <section className="config-admin-section">
              <h3 className="config-admin-section-title">Exportar datos</h3>

              <div className="config-admin-form-row">
                <div className="config-admin-form-group">
                  <label htmlFor="export-tipos-datos">Tipos de datos</label>
                  <select
                    id="export-tipos-datos"
                    value={exportData.tiposDatos}
                    onChange={(e) => handleExportInputChange("tiposDatos", e.target.value)}
                    className="config-admin-form-control"
                  >
                    {tiposDatosOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="config-admin-form-group">
                  <label htmlFor="export-formato">Formato de exportación</label>
                  <select
                    id="export-formato"
                    value={exportData.formato}
                    onChange={(e) => handleExportInputChange("formato", e.target.value)}
                    className="config-admin-form-control"
                  >
                    {formatosExportacion.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="config-admin-date-range-section">
                <label>Rango de fechas (opcional)</label>
                <div className="config-admin-date-picker-container">
                  <DatePicker
                    selectsRange={true}
                    startDate={fechaInicioExport}
                    endDate={fechaFinExport}
                    onChange={(update) => setRangoFechasExport(update)}
                    isClearable={true}
                    placeholderText="Seleccionar rango de fechas"
                    dateFormat="dd/MM/yyyy"
                    customInput={<CustomDatePickerInput />}
                    locale="es"
                    disabled={false}
                  />
                </div>
                <small className="config-admin-help-text">
                  Deja en blanco para exportar todos los datos
                </small>
              </div>

              <div className="config-admin-form-actions">
                <button className="config-admin-btn config-admin-btn-primary" onClick={handleExportData}>
                  Exportar datos
                </button>
              </div>
            </section>

            {/* Historial de Exportaciones */}
            <section className="config-admin-section">
              <h3 className="config-admin-section-title">Historial de exportaciones</h3>
              <div className="config-admin-export-history">
                {exportHistory.length > 0 ? (
                  <div className="config-admin-history-list">
                    {exportHistory.map((exportItem) => (
                      <div key={exportItem.id} className="config-admin-history-item">
                        <div className="config-admin-history-info">
                          <h4>{exportItem.nombre}</h4>
                          <div className="config-admin-history-details">
                            <span className="config-admin-history-type">
                              {tiposDatosOptions.find((t) => t.value === exportItem.tipoDatos)?.label} - {exportItem.formato.toUpperCase()}
                            </span>
                            <span className="config-admin-history-size">{exportItem.tamaño}</span>
                            <span className="config-admin-history-date">{formatDate(exportItem.fecha)}</span>
                          </div>
                        </div>
                        <div className="config-admin-history-actions">
                          <button
                            className="config-admin-btn-action config-admin-download"
                            onClick={() => handleDownloadExport(exportItem)}
                            title="Descargar"
                          >
                            <img src={downloadIcon || "/placeholder.svg"} alt="Descargar" />
                          </button>
                          <button
                            className="config-admin-btn-action config-admin-delete"
                            onClick={() => handleDeleteExport(exportItem.id)}
                            title="Eliminar"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="config-admin-no-history">
                    <p>No hay exportaciones en el historial</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  )
}

export default ConfiguracionAdministrador
