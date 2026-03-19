import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Configuracion_Copias.css"
import Header from "../Header/Header"
import downloadIcon from "../../assets/icons/descarga.png"
import alertIcon from "../../assets/icons/alerta.png"
import checkIcon from "../../assets/icons/comprobado.png"
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

const ConfiguracionCopias = () => {
  const [backupSettings, setBackupSettings] = useState({
    datosRespaldar: [],
    frecuencia: "SEMANAL",
    horaRespaldo: "02:00",
  })

  const [googleDriveSettings, setGoogleDriveSettings] = useState({
    email: "",
    vinculada: false,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [backupHistory, setBackupHistory] = useState([])
  const usuarioId = localStorage.getItem("userId");

  const cargarDatosIniciales = async () => {
    setIsLoading(true)
    try {
      const fetchConfiguracion = async () => {
        const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/configuracion/${usuarioId}`);
        const data = await response.json();
        setBackupSettings({
          datosRespaldar: data.datosRespaldar || [],
          frecuencia: data.frecuencia || "SEMANAL",
          horaRespaldo: data.horaRespaldo || "02:00",
        });
        setGoogleDriveSettings({
          email: data.googleDriveEmail || "",
          vinculada: data.googleDriveVinculada || false,
        });
      };

      const fetchHistorial = async () => {
        const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/usuario/${usuarioId}`);
        const data = await response.json();
        setBackupHistory(data.map(copia => ({
          id: copia.id,
          tipoDatos: copia.tipoDatos,
          numeroCopia: formatDateShort(copia.fechaCreacion),
          fechaCreacion: copia.fechaCreacion,
          fechaEliminacion: copia.fechaEliminacion,
          estado: copia.estado.toLowerCase(),
          tamaño: copia.tamañoArchivo,
          frecuencia: copia.frecuencia,
        })));
      };

      const fetchEstadisticas = async () => {
        const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/estadisticas/${usuarioId}`);
        const data = await response.json();
        setEstadisticas({
          copiasActivas: data.copiasActivas || 0,
          copiasEstesMes: data.copiasEstesMes || 0,
          espacioUtilizado: data.espacioUtilizado || "0 B",
          ultimaCopia: data.ultimaCopia ? formatDate(data.ultimaCopia) : "N/A",
        });
      };

      if (usuarioId) {
        await Promise.all([
          fetchConfiguracion(),
          fetchHistorial(),
          fetchEstadisticas()
        ]);
      }
    } catch (error) {
      console.error("Error al cargar datos iniciales:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los datos del módulo.",
      });
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    cargarDatosIniciales()
  }, [usuarioId]);

  const navigate = useNavigate()

  const datosRespaldoOptions = [
    { value: "TRATOS", label: "Tratos" },
    { value: "EMPRESAS", label: "Empresas" },
    { value: "CONTACTOS", label: "Contactos" },
  ]

  const frecuenciaOptions = [
    { value: "SEMANAL", label: "Semanal" },
    { value: "MENSUAL", label: "Mensual" },
  ]

  const handleSettingChange = (field, value) => {
    setBackupSettings((prev) => ({
      ...prev,
      [field]: field === "datosRespaldar" ? value : value.toUpperCase(),
    }))
  }

  const handleGoogleDriveChange = (field, value) => {
    setGoogleDriveSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleLinkGoogleDrive = async () => {
    if (googleDriveSettings.vinculada) {
      const result = await Swal.fire({
        title: "¿Desvincular cuenta?",
        text: "Se desvinculará la cuenta de Google Drive. Las copias futuras no se guardarán automáticamente.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Desvincular",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#f44336",
      });

      if (result.isConfirmed) {
        try {
          const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/google-drive/desvincular/${usuarioId}`, {
            method: "DELETE",
          });
          const data = await response.json();
          setGoogleDriveSettings((prev) => ({
            ...prev,
            vinculada: false,
            email: "",
          }));
          Swal.fire({
            icon: "success",
            title: "Cuenta desvinculada",
            text: data.message,
          });
        } catch (error) {
          console.error("Error al desvincular Google Drive:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo desvincular la cuenta de Google Drive.",
          });
        }
      }
    } else {
      try {
        const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/google-drive/auth-url/${usuarioId}`);
        const data = await response.json();
        window.location.href = data.authUrl;
      } catch (error) {
        console.error("Error al obtener URL de autenticación:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo iniciar el proceso de vinculación con Google Drive.",
        });
      }
    }
  };

  const handleGenerateInstantBackup = async () => {
    const result = await Swal.fire({
      title: "¿Generar copia instantánea?",
      text: `Se generará una copia de seguridad de los datos seleccionados inmediatamente.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Generar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: "Generando copia de seguridad...",
          text: "Por favor espere mientras se genera la copia.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/generar/${usuarioId}`, {
          method: "POST",
          body: JSON.stringify(backupSettings.datosRespaldar),
        });
        const data = await response.json();
        // Refrescar historial
        await new Promise(resolve => setTimeout(resolve, 500));
        const historyResponse = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/usuario/${usuarioId}`);
        const newHistory = await historyResponse.json();
        setBackupHistory(newHistory.map(copia => ({
          id: copia.id,
          tipoDatos: copia.tipoDatos,
          numeroCopia: formatDateShort(copia.fechaCreacion),
          fechaCreacion: copia.fechaCreacion,
          fechaEliminacion: copia.fechaEliminacion,
          estado: copia.estado.toLowerCase(),
          tamaño: copia.tamañoArchivo,
          frecuencia: copia.frecuencia,
        })));
        const statsResponse = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/estadisticas/${usuarioId}`);
        const statsData = await statsResponse.json();
        setEstadisticas({
          copiasActivas: statsData.copiasActivas || 0,
          copiasEstesMes: statsData.copiasEstesMes || 0,
          espacioUtilizado: statsData.espacioUtilizado || "0 B",
          ultimaCopia: statsData.ultimaCopia ? formatDate(statsData.ultimaCopia) : "N/A",
        });
        Swal.fire({
          icon: "success",
          title: "Copia generada",
          text: data.message,
        });
      } catch (error) {
        console.error("Error al generar copia:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Ocurrió un error al generar la copia de seguridad.",
        });
      }
    }
  };

  const handleDownloadBackup = async (backup, format) => {
    try {
      Swal.fire({
        title: `Descargando copia ${format.toUpperCase()}...`,
        text: "Por favor espere mientras se prepara la descarga.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/descargar/${backup.id}/${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `copia_${backup.id}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Descarga completada",
        text: `La copia ${backup.numeroCopia} en formato ${format.toUpperCase()} se ha descargado correctamente.`,
      });
    } catch (error) {
      console.error(`Error al descargar ${format}:`, error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `No se pudo descargar la copia en formato ${format.toUpperCase()}.`,
      });
    }
  };

  const handleRestoreBackup = async (backup) => {
    const result = await Swal.fire({
      title: "¿Restaurar copia de seguridad?",
      html: `
      <div style="text-align: left; margin: 20px 0;">
        <p><strong>Copia:</strong> ${backup.numeroCopia}</p>
        <p><strong>Fecha de creación:</strong> ${formatDate(backup.fechaCreacion)}</p>
        <p><strong>Tamaño:</strong> ${backup.tamaño}</p>
      </div>
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 12px; margin: 15px 0;">
        <strong>⚠️ Advertencia:</strong> Esta acción sobrescribirá todos los datos actuales del sistema. Esta acción no se puede deshacer.
      </div>
    `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Restaurar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f44336",
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: "Restaurando datos...",
          text: "Por favor espere mientras se restauran los datos. No cierre la aplicación.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/restaurar/${backup.id}`, {
          method: "POST",
        });
        const data = await response.json();
        Swal.fire({
          icon: "success",
          title: "Datos restaurados",
          text: data.message,
        });
      } catch (error) {
        console.error("Error al restaurar copia:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Ocurrió un error al restaurar la copia de seguridad.",
        });
      }
    }
  };

  const handleDeleteBackup = async (backupId) => {
    const backup = backupHistory.find((b) => b.id === backupId);

    const result = await Swal.fire({
      title: "¿Eliminar copia de seguridad?",
      text: `¿Está seguro de que desea eliminar la copia ${backup.numeroCopia}? Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f44336",
    });

    if (result.isConfirmed) {
      try {
        const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/${backupId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        setBackupHistory((prev) => prev.filter((b) => b.id !== backupId));
        const statsResponse = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/estadisticas/${usuarioId}`);
        const statsData = await statsResponse.json();
        setEstadisticas({
          copiasActivas: statsData.copiasActivas || 0,
          copiasEstesMes: statsData.copiasEstesMes || 0,
          espacioUtilizado: statsData.espacioUtilizado || "0 B",
          ultimaCopia: statsData.ultimaCopia ? formatDate(statsData.ultimaCopia) : "N/A",
        });
        Swal.fire({
          icon: "success",
          title: "Copia eliminada",
          text: data.message,
        });
      } catch (error) {
        console.error("Error al eliminar copia:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo eliminar la copia de seguridad.",
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

  const formatDateShort = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const handleSaveSettings = async () => {
    try {
      const configData = {
        usuarioId: usuarioId,
        datosRespaldar: backupSettings.datosRespaldar,
        frecuencia: backupSettings.frecuencia,
        horaRespaldo: backupSettings.horaRespaldo,
      };
      const response = await fetchWithToken(`${API_BASE_URL}/copias-seguridad/configuracion`, {
        method: "POST",
        body: JSON.stringify(configData),
      });
      await response.json();
      Swal.fire({
        icon: "success",
        title: "Configuración guardada",
        text: "La configuración de copias de seguridad se ha guardado correctamente.",
      });
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo guardar la configuración de copias de seguridad.",
      });
    }
  };

  const [estadisticas, setEstadisticas] = useState({
    copiasActivas: 0,
    copiasEstesMes: 0,
    espacioUtilizado: "0 B",
    ultimaCopia: null,
  });


  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="config-copias-loading">
            <div className="spinner"></div>
            <p>Cargando configuración...</p>
          </div>
        )}
        {/* Configuracion de navegación */}
        <div className="config-copias-config-header">
          <h2 className="config-copias-config-title">Configuración</h2>
          <nav className="config-copias-config-nav">
            <div className="config-copias-nav-item" onClick={() => navigate("/configuracion_plantillas")}>
              Plantillas de correo
            </div>
            <div className="config-copias-nav-item" onClick={() => navigate("/configuracion_admin_datos")}>
              Administrador de datos
            </div>
            <div className="config-copias-nav-item" onClick={() => navigate("/configuracion_empresa")}>
              Configuración de la empresa
            </div>
            <div className="config-copias-nav-item" onClick={() => navigate("/configuracion_almacenamiento")}>
              Almacenamiento
            </div>
            <div className="config-copias-nav-item config-copias-nav-item-active">Copias de Seguridad</div>
            <div className="config-copias-nav-item" onClick={() => navigate("/configuracion_usuarios")}>
              Usuarios y roles
            </div>
            <div
              className="config-copias-nav-item"
              onClick={() => navigate("/configuracion_gestion_sectores_plataformas")}
            >
              Sectores
            </div>
            <div
              className="config-copias-nav-item"
              onClick={() => navigate("/configuracion_correos")}
            >
              Historial de Correos
            </div>
          </nav>
        </div>

        <main className="config-copias-main-content">
          <div className="config-copias-container">
            <section className="config-copias-section">
              <h3 className="config-copias-section-title">Copia de seguridad</h3>

              {/* Box de informacion */}
              <div className="config-copias-info-box">
                <div className="config-copias-info-icon">
                  <img src={alertIcon || "/placeholder.svg"} alt="Información" />
                </div>
                <div className="config-copias-info-content">
                  <strong>Información</strong>
                  <p>
                    El sistema guarda automáticamente una copia de seguridad de los registros y están disponibles para
                    descargar o restaurar durante 3 meses.
                  </p>
                </div>
              </div>

              <div className="config-copias-form-row">
                {/* Configuracion respaldo */}
                <div className="config-copias-left-column">
                  <div className="config-copias-form-group">
                    <label>Datos a respaldar</label>
                    <div className="config-copias-checkbox-group">
                      {datosRespaldoOptions.map((option) => (
                        <div key={option.value} className="config-copias-checkbox-item">
                          <input
                            type="checkbox"
                            id={`datos-${option.value}`}
                            value={option.value}
                            checked={backupSettings.datosRespaldar.includes(option.value)}
                            onChange={(e) => {
                              const value = e.target.value;
                              const isChecked = e.target.checked;
                              const newSelection = isChecked
                                ? [...backupSettings.datosRespaldar, value]
                                : backupSettings.datosRespaldar.filter(item => item !== value);
                              handleSettingChange("datosRespaldar", newSelection);
                            }}
                            className="config-copias-checkbox"
                          />
                          <label htmlFor={`datos-${option.value}`} className="config-copias-checkbox-label">
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="config-copias-form-group">
                    <label htmlFor="frecuencia-respaldo">Frecuencia de respaldo</label>
                    <select
                      id="frecuencia-respaldo"
                      value={backupSettings.frecuencia}
                      onChange={(e) => handleSettingChange("frecuencia", e.target.value)}
                      className="config-copias-form-control"
                    >
                      {frecuenciaOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="config-copias-form-group">
                    <label htmlFor="hora-respaldo">Hora de respaldo</label>
                    <input
                      type="time"
                      id="hora-respaldo"
                      value={backupSettings.horaRespaldo}
                      onChange={(e) => handleSettingChange("horaRespaldo", e.target.value)}
                      className="config-copias-form-control"
                    />
                  </div>

                  <div className="config-copias-form-group">
                    <button
                      className="config-copias-btn config-copias-btn-primary"
                      onClick={handleSaveSettings}
                    >
                      Guardar Configuración
                    </button>
                  </div>
                </div>

                {/* Google Drive Ajustes */}
                <div className="config-copias-right-column">
                  <div className="config-copias-google-drive-section">
                    <label>Cuenta de Google Drive</label>
                    <div className="config-copias-drive-input-group">
                      <input
                        type="email"
                        value={googleDriveSettings.email}
                        onChange={(e) => handleGoogleDriveChange("email", e.target.value)}
                        className="config-copias-form-control"
                        placeholder="correo@ejemplo.com"
                        disabled={googleDriveSettings.vinculada}
                      />
                      <button
                        className={`config-copias-btn ${googleDriveSettings.vinculada ? "config-copias-btn-secondary" : "config-copias-btn-primary"}`}
                        onClick={handleLinkGoogleDrive}
                      >
                        {googleDriveSettings.vinculada ? "Desvincular" : "Vincular"}
                      </button>
                    </div>

                    {googleDriveSettings.vinculada && (
                      <div className="config-copias-drive-status">
                        <div className="config-copias-status-icon">
                          <img src={checkIcon || "/placeholder.svg"} alt="Vinculada" />
                        </div>
                        <div className="config-copias-status-content">
                          <strong>Cuenta vinculada</strong>
                          <p>Las copias se guardarán automáticamente a Google Drive</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="config-copias-statistics-section">
                <h3 className="config-copias-section-title">Estadísticas de Copias de Seguridad</h3>
                <div className="config-copias-info-box">
                  <div className="config-copias-info-content">
                    <p><strong>Copias Activas:</strong> {estadisticas.copiasActivas}</p>
                    <p><strong>Copias Este Mes:</strong> {estadisticas.copiasEstesMes}</p>
                    <p><strong>Espacio Utilizado:</strong> {estadisticas.espacioUtilizado}</p>
                    <p><strong>Última Copia:</strong> {estadisticas.ultimaCopia}</p>
                  </div>
                </div>
              </div>

              {/* Tabla de historial de respaldos */}
              <div className="config-copias-history-section">
                <div className="config-copias-history-header">
                  <h4>Historial de copias de seguridad</h4>
                  <button className="config-copias-btn config-copias-btn-instant" onClick={handleGenerateInstantBackup}>
                    <img src={downloadIcon || "/placeholder.svg"} alt="Generar" className="config-copias-btn-icon" />
                    Generar copia instantánea
                  </button>
                </div>

                <div className="config-copias-table-container">
                  <table className="config-copias-table">
                    <thead>
                      <tr>
                        <th>Tipo de Datos</th>
                        <th>Fecha de Creación</th>
                        <th>Fecha de Eliminación</th>
                        <th>Tamaño</th>
                        <th>Frecuencia</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupHistory.map((backup) => (
                        <tr key={backup.id}>
                          <td>{backup.tipoDatos}</td>
                          <td>{formatDateShort(backup.fechaCreacion)}</td>
                          <td>{formatDateShort(backup.fechaEliminacion)}</td>
                          <td>{backup.tamaño}</td>
                          <td>{backup.frecuencia}</td>
                          <td>
                            <div className="config-copias-action-buttons">
                              <button
                                className="config-copias-action-btn config-copias-csv-btn"
                                onClick={() => handleDownloadBackup(backup, "csv")}
                                title="Descargar CSV"
                              >
                                CSV
                              </button>
                              <button
                                className="config-copias-action-btn config-copias-pdf-btn"
                                onClick={() => handleDownloadBackup(backup, "pdf")}
                                title="Descargar PDF"
                              >
                                PDF
                              </button>
                              <button
                                className="config-copias-action-btn config-copias-restore-btn"
                                onClick={() => handleRestoreBackup(backup)}
                                title="Restaurar"
                              >
                                Restaurar
                              </button>
                              <button
                                className="config-copias-action-btn config-copias-delete-btn"
                                onClick={() => handleDeleteBackup(backup.id)}
                                title="Eliminar"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>

                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffc107",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px"
                }}>
                  <span style={{ fontSize: "18px" }}>⚠️</span>
                  <div>
                    <strong>Advertencia al restaurar:</strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
                      Al restaurar una copia de seguridad, se eliminarán y reemplazarán todos los datos actuales del tipo seleccionado,
                      incluyendo registros relacionados como comisiones, cotizaciones, cuentas por cobrar, solicitudes de factura y tratos asociados.
                      Esta acción es irreversible. Se recomienda generar una copia de seguridad actualizada antes de restaurar.
                    </p>
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

export default ConfiguracionCopias
