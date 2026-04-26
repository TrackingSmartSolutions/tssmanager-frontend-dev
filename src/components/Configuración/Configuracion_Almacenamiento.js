import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Configuracion_Almacenamiento.css"
import Header from "../Header/Header"
import warningIcon from "../../assets/icons/advertencia.png"
import deleteIcon from "../../assets/icons/eliminar.png"
import { API_BASE_URL } from "../Config/Config";
import Swal from "sweetalert2"

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`Error en la solicitud: ${response.status} - ${response.statusText}`);
  return response;
};

const ConfiguracionAlmacenamiento = () => {
  const [storageData, setStorageData] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { tratos: true, empresas: true, cotizaciones: true, facturacion: true };

  const [cleanupSettings, setCleanupSettings] = useState({
    tipoRegistros: "Auditoria",
    antiguedadMinima: "6meses",
  })

  const [cleanupStats, setCleanupStats] = useState({
    cantidadRegistros: 0,
    almacenajeTotal: 0,
    porcentajeRecuperado: 0,
  })

  const [totalUsage, setTotalUsage] = useState({
    used: 0,
    available: 100,
    totalSpaceMB: 0,
    espacioRecuperable: 0,
    maxCapacity: 1024,
  })

  const navigate = useNavigate()

  const tiposRegistrosOptions = [
    ...(modulosActivos.tratos ? [
      { value: "Tratos", label: "Tratos" },
      { value: "Notas_Tratos", label: "Notas" },
      { value: "Actividades", label: "Actividades" }
    ] : []),
    ...(modulosActivos.empresas ? [
      { value: "Empresas", label: "Empresas" },
      { value: "Contactos", label: "Contactos" },
      { value: "Email_records", label: "Correos electrónicos" }
    ] : []),
    ...(modulosActivos.cotizaciones ? [{ value: "Cotizaciones", label: "Cotizaciones" }] : []),
    ...(modulosActivos.facturacion ? [{ value: "Facturas", label: "Facturas" }] : []),
    { value: "Notificaciones", label: "Notificaciones" },
    { value: "Auditoria", label: "Auditoría" }
  ];

  const antiguedadOptions = [
    { value: "3meses", label: "Más de 3 meses" },
    { value: "6meses", label: "Más de 6 meses" },
    { value: "1año", label: "Más de 1 año" },
    { value: "2años", label: "Más de 2 años" },
  ]

  const tablaToModulo = {
    ...(modulosActivos.tratos ? {
      "Tratos": "Tratos",
      "Notas_Tratos": "Notas",
      "Actividades": "Actividades",
    } : {}),
    ...(modulosActivos.empresas ? {
      "Empresas": "Empresas",
      "Contactos": "Contactos",
      "Email_records": "Correos electrónicos",
    } : {}),
    ...(modulosActivos.facturacion ? { "Facturas": "Facturas" } : {}),
    ...(modulosActivos.cotizaciones ? { "Cotizaciones": "Cotizaciones" } : {}),
    "Notificaciones": "Notificaciones",
    "Auditoria": "Auditoría",
  }

  // Mapeo inverso para el frontend
  const moduloToTabla = Object.fromEntries(
    Object.entries(tablaToModulo).map(([tabla, modulo]) => [modulo, tabla])
  )

  // Cargar estadísticas de almacenamiento
  const cargarEstadisticasAlmacenamiento = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/almacenamiento/estadisticas`)
      const data = await response.json()

      // Transformar datos del backend al formato del frontend
      const datosTransformados = data.map((item, index) => ({
        id: index + 1,
        modulo: tablaToModulo[item.tablaNombre] || item.tablaNombre,
        tablaNombre: item.tablaNombre,
        cantidad: item.totalRegistros,
        almacenaje: parseFloat(item.tamanoMb.toFixed(2)),
        unidad: "MB",
        registrosAntiguos: item.registrosAntiguos,
        espacioRecuperable: parseFloat(item.espacioRecuperableMb.toFixed(2)),
        color: getColorForModule(tablaToModulo[item.tablaNombre] || item.tablaNombre)
      }))

      setStorageData(datosTransformados)
    } catch (error) {
      console.error('Error al cargar estadísticas:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las estadísticas de almacenamiento'
      })
    }
  }


  const cargarResumenAlmacenamiento = async () => {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/almacenamiento/resumen`)
      const data = await response.json()


      const espacioTotalMB = parseFloat(data.espacioTotalMb) || 0
      const espacioRecuperableMB = parseFloat(data.espacioRecuperableMb) || 0
      const capacidadMaxima = 1024


      const porcentajeUsado = capacidadMaxima > 0 ? Math.min((espacioTotalMB / capacidadMaxima) * 100, 100) : 0
      const porcentajeDisponible = 100 - porcentajeUsado

      setTotalUsage({
        used: Math.round(porcentajeUsado * 10) / 10,
        available: Math.round(porcentajeDisponible * 10) / 10,
        totalSpaceMB: espacioTotalMB,
        espacioRecuperable: espacioRecuperableMB,
        maxCapacity: capacidadMaxima,
        totalRegistros: data.totalRegistros || 0,
        registrosAntiguos: data.registrosAntiguos || 0,
        totalTablas: data.totalTablas || 0
      })
    } catch (error) {
      console.error('Error al cargar resumen:', error)
      setTotalUsage(prevState => ({
        ...prevState,
        used: 0,
        available: 100,
        totalSpaceMB: 0,
        espacioRecuperable: 0
      }))
    }
  }


  const getColorForModule = (modulo) => {
    const colors = {
      "Tratos": "#037ce0",
      "Empresas": "#9c16f7",
      "Contactos": "#38b6ff",
      "Notas": "#f27100",
      "Actividades": "#af86ff",
      "Correos electrónicos": "#00347f",
      "Notificaciones": "#2a5cf8",
      "Auditoría": "#ff6b6b",
      "Facturas": "#4ecdc4",
      "Cotizaciones": "#45b7d1"
    }
    return colors[modulo] || "#666666"
  }

  // Cargar datos iniciales
  const cargarDatosIniciales = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        cargarEstadisticasAlmacenamiento(),
        cargarResumenAlmacenamiento()
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
    if (cleanupSettings.tipoRegistros && cleanupSettings.antiguedadMinima && !isLoading) {
      calcularEstadisticasLimpieza()
    }
  }, [cleanupSettings])

  const calcularEstadisticasLimpieza = async () => {
    try {
      const tablaNombre = cleanupSettings.tipoRegistros;

      const diasMap = {
        "3meses": 90,
        "6meses": 180,
        "1año": 365,
        "2años": 730
      };
      const dias = diasMap[cleanupSettings.antiguedadMinima];

      const response = await fetchWithToken(
        `${API_BASE_URL}/almacenamiento/estadisticas/${tablaNombre}?diasAntiguedad=${dias}`
      );
      const data = await response.json();

      setCleanupStats({
        cantidadRegistros: data.registrosAntiguos || 0,
        almacenajeTotal: parseFloat((data.espacioRecuperableMb || 0).toFixed(2)),
        porcentajeRecuperado: totalUsage.totalSpaceMB > 0 ?
          Math.round((parseFloat(data.espacioRecuperableMb || 0) / totalUsage.totalSpaceMB) * 100 * 10) / 10 : 0
      });
    } catch (error) {
      console.error('Error al calcular estadísticas de limpieza:', error);
      setCleanupStats({
        cantidadRegistros: 0,
        almacenajeTotal: 0,
        porcentajeRecuperado: 0
      });
    }
  };

  const handleCleanupSettingChange = (field, value) => {
    setCleanupSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleDeleteSelected = async () => {
    const tipoSeleccionado = tiposRegistrosOptions.find((tipo) => tipo.value === cleanupSettings.tipoRegistros)
    const antiguedadSeleccionada = antiguedadOptions.find((ant) => ant.value === cleanupSettings.antiguedadMinima)

    const result = await Swal.fire({
      title: "¿Eliminar registros seleccionados?",
      html: `
      <div style="text-align: left; margin: 20px 0;">
        <p><strong>Tipo:</strong> ${tipoSeleccionado.label}</p>
        <p><strong>Antigüedad:</strong> ${antiguedadSeleccionada.label}</p>
        <p><strong>Registros a eliminar:</strong> ${cleanupStats.cantidadRegistros.toLocaleString()}</p>
        <p><strong>Espacio a recuperar:</strong> ${cleanupStats.almacenajeTotal} MB</p>
      </div>
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 12px; margin: 15px 0;">
        <strong>⚠️ Advertencia:</strong> Esta acción no se puede deshacer. Los registros eliminados no podrán ser recuperados.
      </div>
    `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f44336",
      customClass: {
        popup: "config-almacenamiento-swal-popup",
      },
    })

    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: "Eliminando registros...",
          text: "Por favor espere mientras se eliminan los registros seleccionados.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading()
          },
        })

        const diasMap = {
          "3meses": 90,
          "6meses": 180,
          "1año": 365,
          "2años": 730
        }

        const solicitud = {
          tablaNombre: cleanupSettings.tipoRegistros, // Usar directamente el valor del backend
          diasAntiguedad: diasMap[cleanupSettings.antiguedadMinima],
          criterioEliminacion: `${tipoSeleccionado.label} - ${antiguedadSeleccionada.label}`,
          confirmarEliminacion: true
        }

        const response = await fetchWithToken(`${API_BASE_URL}/almacenamiento/limpieza/manual`, {
          method: 'POST',
          body: JSON.stringify(solicitud)
        })

        const resultado = await response.json()

        if (resultado.exito) {
          // Recargar datos después de la limpieza exitosa
          await cargarDatosIniciales()

          Swal.fire({
            icon: "success",
            title: "Registros eliminados",
            html: `
            <p>Se han eliminado <strong>${resultado.registrosEliminados.toLocaleString()}</strong> registros.</p>
            <p>Espacio recuperado: <strong>${resultado.espacioLiberadoMb} MB</strong></p>
          `,
          })

          // Recalcular estadísticas de limpieza
          await calcularEstadisticasLimpieza()
        } else {
          Swal.fire({
            icon: "error",
            title: "Error en la limpieza",
            text: resultado.mensaje || "No se pudieron eliminar los registros"
          })
        }
      } catch (error) {
        console.error('Error durante la limpieza:', error)
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Ocurrió un error al eliminar los registros.",
        })
      }
    }
  }

  const formatStorage = (value, unit = "MB") => {
    if (value === 0) return "0 KB"
    if (unit === "MB" || value >= 1) {
      return `${value} MB`
    } else {
      return value >= 1000 ? `${(value / 1000).toFixed(2)} MB` : `${Math.round(value * 1024)} KB`
    }
  }

  const getProgressBarClass = () => {
    if (totalUsage.used <= 50) return "config-almacenamiento-progress-safe"
    if (totalUsage.used <= 80) return "config-almacenamiento-progress-warning"
    return "config-almacenamiento-progress-danger"
  }

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="config-almacenamiento-loading">
            <div className="spinner"></div>
            <p>Cargando datos de almacenamiento...</p>
          </div>
        )}

        {/* Navegación de configuración */}
        <div className="config-almacenamiento-config-header">
          <h2 className="config-almacenamiento-config-title">Configuración</h2>
          <nav className="config-almacenamiento-config-nav">
            <div className="config-almacenamiento-nav-item" onClick={() => navigate("/configuracion_plantillas")}>
              Plantillas de correo
            </div>
            <div className="config-almacenamiento-nav-item" onClick={() => navigate("/configuracion_admin_datos")}>
              Administrador de datos
            </div>
            <div className="config-almacenamiento-nav-item" onClick={() => navigate("/configuracion_empresa")}>
              Configuración de la empresa
            </div>
            <div className="config-almacenamiento-nav-item config-almacenamiento-nav-item-active">Almacenamiento</div>
            <div className="config-almacenamiento-nav-item" onClick={() => navigate("/configuracion_copias_seguridad")}>
              Copias de Seguridad
            </div>
            <div className="config-almacenamiento-nav-item" onClick={() => navigate("/configuracion_usuarios")}>
              Usuarios y roles
            </div>
            <div
              className="config-almacenamiento-nav-item"
              onClick={() => navigate("/configuracion_gestion_sectores_plataformas")}
            >
              Sectores
            </div>
            <div
              className="config-almacenamiento-nav-item"
              onClick={() => navigate("/configuracion_correos")}
            >
              Historial de Correos
            </div>
          </nav>
        </div>

        <main className="config-almacenamiento-main-content">
          <div className="config-almacenamiento-container">
            {/* Sección de uso de almacenamiento */}
            <section className="config-almacenamiento-section">
              <h3 className="config-almacenamiento-section-title">Uso de almacenamiento</h3>

              {/* Información de resumen */}
              <div className="config-almacenamiento-summary-info">
                <div className="config-almacenamiento-summary-item">
                  <span className="config-almacenamiento-summary-label">Espacio total utilizado:</span>
                  <span className="config-almacenamiento-summary-value">{formatStorage(totalUsage.totalSpaceMB)}</span>
                </div>
                <div className="config-almacenamiento-summary-item">
                  <span className="config-almacenamiento-summary-label">Espacio recuperable:</span>
                  <span className="config-almacenamiento-summary-value">{formatStorage(totalUsage.espacioRecuperable)}</span>
                </div>
                <div className="config-almacenamiento-summary-item">
                  <span className="config-almacenamiento-summary-label">Total de registros:</span>
                  <span className="config-almacenamiento-summary-value">{totalUsage.totalRegistros?.toLocaleString() || 0}</span>
                </div>
                <div className="config-almacenamiento-summary-item">
                  <span className="config-almacenamiento-summary-label">Capacidad máxima:</span>
                  <span className="config-almacenamiento-summary-value">{formatStorage(totalUsage.maxCapacity)}</span>
                </div>
              </div>

              <div className="config-almacenamiento-usage-bar">
                <div className="config-almacenamiento-usage-labels">
                  <span className="config-almacenamiento-used-label">
                    Espacio utilizado ({totalUsage.used}%) - {formatStorage(totalUsage.totalSpaceMB)}
                  </span>
                  <span className="config-almacenamiento-available-label">
                    Espacio disponible ({totalUsage.available}%) - {formatStorage(totalUsage.maxCapacity - totalUsage.totalSpaceMB)}
                  </span>
                </div>
                <div className="config-almacenamiento-progress-bar">
                  <div
                    className={`config-almacenamiento-progress-fill ${getProgressBarClass()}`}
                    style={{ width: `${Math.min(totalUsage.used, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="config-almacenamiento-content-row">
                {/* Detalles de almacenamiento */}
                <div className="config-almacenamiento-details-section">
                  <h4 className="config-almacenamiento-subsection-title">Detalles de uso</h4>
                  <div className="config-almacenamiento-details-table">
                    <div className="config-almacenamiento-table-header">
                      <div className="config-almacenamiento-header-cell">Nombre del módulo</div>
                      <div className="config-almacenamiento-header-cell">Cantidad de registros</div>
                      <div className="config-almacenamiento-header-cell">Almacenaje</div>
                      <div className="config-almacenamiento-header-cell">Registros antiguos</div>
                      <div className="config-almacenamiento-header-cell">Espacio recuperable</div>
                    </div>
                    <div className="config-almacenamiento-table-body">
                      {storageData.length > 0 ? storageData.map((item) => (
                        <div key={item.id} className="config-almacenamiento-table-row">
                          <div className="config-almacenamiento-cell config-almacenamiento-module-cell">
                            <div
                              className="config-almacenamiento-module-indicator"
                              style={{ backgroundColor: item.color }}
                            ></div>
                            {item.modulo}
                          </div>
                          <div className="config-almacenamiento-cell">{item.cantidad.toLocaleString()}</div>
                          <div className="config-almacenamiento-cell">{formatStorage(item.almacenaje)}</div>
                          <div className="config-almacenamiento-cell">{item.registrosAntiguos.toLocaleString()}</div>
                          <div className="config-almacenamiento-cell">{formatStorage(item.espacioRecuperable)}</div>
                        </div>
                      )) : (
                        <div className="config-almacenamiento-table-row">
                          <div className="config-almacenamiento-cell" style={{ textAlign: 'center', padding: '20px', gridColumn: '1 / -1' }}>
                            {isLoading ? 'Cargando datos...' : 'No hay datos disponibles'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Limpieza de almacenamiento */}
                <div className="config-almacenamiento-cleanup-section">
                  <h4 className="config-almacenamiento-subsection-title">Limpiar almacenamiento</h4>

                  <div className="config-almacenamiento-warning-box">
                    <div className="config-almacenamiento-warning-icon">
                      <img src={warningIcon || "/placeholder.svg"} alt="Advertencia" />
                    </div>
                    <div className="config-almacenamiento-warning-content">
                      <strong>Advertencia</strong>
                      <p>
                        La eliminación de registros es permanente y no se puede deshacer. Los tratos en fase "CERRADO_PERDIDO" se
                        eliminan automáticamente después de 3 meses, pero antes se guardan en una copia de seguridad.
                      </p>
                    </div>
                  </div>

                  <div className="config-almacenamiento-cleanup-form">
                    <div className="config-almacenamiento-form-group">
                      <label htmlFor="tipo-registros">Tipo de registros</label>
                      <select
                        id="tipo-registros"
                        value={cleanupSettings.tipoRegistros}
                        onChange={(e) => handleCleanupSettingChange("tipoRegistros", e.target.value)}
                        className="config-almacenamiento-form-control"
                      >
                        {tiposRegistrosOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="config-almacenamiento-form-group">
                      <label htmlFor="antiguedad-minima">Antigüedad mínima</label>
                      <select
                        id="antiguedad-minima"
                        value={cleanupSettings.antiguedadMinima}
                        onChange={(e) => handleCleanupSettingChange("antiguedadMinima", e.target.value)}
                        className="config-almacenamiento-form-control"
                      >
                        {antiguedadOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="config-almacenamiento-cleanup-stats">
                      <div className="config-almacenamiento-stat-item">
                        <span className="config-almacenamiento-stat-label">Cantidad de registros</span>
                        <span className="config-almacenamiento-stat-value">
                          {cleanupStats.cantidadRegistros.toLocaleString()}
                        </span>
                      </div>
                      <div className="config-almacenamiento-stat-item">
                        <span className="config-almacenamiento-stat-label">Almacenaje total</span>
                        <span className="config-almacenamiento-stat-value">{formatStorage(cleanupStats.almacenajeTotal)}</span>
                      </div>
                      <div className="config-almacenamiento-stat-item">
                        <span className="config-almacenamiento-stat-label">Porcentaje recuperado</span>
                        <span className="config-almacenamiento-stat-value">{cleanupStats.porcentajeRecuperado}%</span>
                      </div>
                    </div>

                    <div className="config-almacenamiento-cleanup-actions">
                      <button
                        className="config-almacenamiento-btn config-almacenamiento-btn-danger"
                        onClick={handleDeleteSelected}
                        disabled={cleanupStats.cantidadRegistros === 0 || isLoading}
                      >
                        <img
                          src={deleteIcon || "/placeholder.svg"}
                          alt="Eliminar"
                          className="config-almacenamiento-delete-icon"
                        />
                        Eliminar seleccionados
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  )
}

export default ConfiguracionAlmacenamiento