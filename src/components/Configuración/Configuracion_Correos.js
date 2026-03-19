import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../Header/Header";
import Swal from "sweetalert2";
import { API_BASE_URL } from "../Config/Config";
import "./Configuracion_Correos.css";

const fetchWithToken = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`Error: ${response.status}`);
  return response;
};

const ConfiguracionCorreos = () => {
  const [correos, setCorreos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCorreos();
  }, []);

  const fetchCorreos = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/correos`);
      if (response.status === 204) {
        setCorreos([]);
      } else {
        const data = await response.json();
        setCorreos(data);
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cargar el historial de correos",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatearFecha = (fechaString) => {
    if (!fechaString) return "-";
    const fecha = new Date(fechaString);
    return fecha.toLocaleString("es-MX", {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="page-with-header">
      <Header />
      <div className="correos-config-header">
        <h2 className="correos-config-title">Configuración</h2>
        <nav className="correos-config-nav">
          <div className="correos-nav-item" onClick={() => navigate("/configuracion_plantillas")}>Plantillas de correo</div>
          <div className="correos-nav-item" onClick={() => navigate("/configuracion_admin_datos")}>Administrador de datos</div>
          <div className="correos-nav-item" onClick={() => navigate("/configuracion_empresa")}>Configuración de la empresa</div>
          <div className="correos-nav-item" onClick={() => navigate("/configuracion_almacenamiento")}>Almacenamiento</div>
          <div className="correos-nav-item" onClick={() => navigate("/configuracion_copias_seguridad")}>Copias de Seguridad</div>
          <div className="correos-nav-item" onClick={() => navigate("/configuracion_usuarios")}>Usuarios y roles</div>
          <div className="correos-nav-item" onClick={() => navigate("/configuracion_gestion_sectores_plataformas")}>Sectores</div>
          <div className="correos-nav-item correos-nav-item-active">Historial de Correos</div>
        </nav>
      </div>

      <main className="correos-main-content">
        <div className="correos-container">
          <div className="correos-section">
            <div className="correos-section-header">
              <h3 className="correos-section-title">Registro de Correos Enviados</h3>
            </div>

            {isLoading ? (
              <div className="correos-loading">
                <div className="spinner"></div>
                <p>Cargando correos...</p>
              </div>
            ) : (
              <div className="correos-table-container">
                <table className="correos-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Fecha</th>
                      <th>Destinatario</th>
                      <th>Asunto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correos.length > 0 ? (
                      correos.map((correo) => (
                        <tr key={correo.id}>
                          <td>{correo.id}</td>
                          <td>{formatearFecha(correo.fechaEnvio)}</td>
                          <td>{correo.destinatario}</td>
                          <td>{correo.asunto}</td>
                          <td>
                            <span className={`status-badge status-${correo.status || (correo.exito ? 'sent' : 'failed')}`}>
                              {correo.status === 'sent' ? 'Enviado' :
                                correo.status === 'delivered' ? 'Entregado' :
                                  correo.status === 'bounced' ? 'Rebotado' :
                                    correo.exito ? 'Enviado' : 'Rebotado'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                          No hay correos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConfiguracionCorreos;