import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login/Login';
import Principal from './components/Principal/Principal';
import Empresas from './components/Empresas/Empresas';
import Mapa from './components/Mapa/Mapa';
import Tratos from './components/Tratos/Tratos';
import DetallesTrato from './components/Tratos/DetallesTrato'
import AdminBalance from './components/Admin/Admin_Balance';
import AdminTransacciones from './components/Admin/Admin_Transacciones';
import AdminCotizaciones from './components/Admin/Admin_Cotizaciones';
import AdminFacturacion from './components/Admin/Admin_Facturacion';
import AdminCuentasCobrar from './components/Admin/Admin_CuentasCobrar';
import AdminCuentasPagar from './components/Admin/Admin_CuentasPagar';
import AdminCajaChica from './components/Admin/Admin_CajaChica';
import AdminComisiones from './components/Admin/Admin_Comisiones';
import ReportePersonal from './components/Reporte/ReportePersonal';
import ConfiguracionPlantillas from './components/Configuración/Configuracion_Plantillas';
import ConfiguracionAdministrador from './components/Configuración/Configuracion_Administrador';
import ConfiguracionEmpresa from './components/Configuración/Configuracion_Empresa';
import ConfiguracionAlmacenamiento from './components/Configuración/Configuracion_Almacenamiento';
import ConfiguracionCopias from './components/Configuración/Configuracion_Copias';
import ConfiguracionUsuarios from './components/Configuración/Configuracion_Usuarios';
import GoogleDriveCallback from './components/Configuración/GoogleDriveCallback';
import DashboardMetricas from './components/Dashboard Metricas/DashboardMetricas';
import ConfiguracionGestionSectoresPlataformas from './components/Configuración/Configuracion_GestionSectoresPlataformas';
import ConfiguracionCorreos from './components/Configuración/Configuracion_Correos';
import Calendario from './components/Calendario/Calendario';

const ProtectedRoute = ({ children, requiredModule }) => {
  const token = localStorage.getItem("token");
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { crm: true, admin: true, configuracion: true };

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (requiredModule && modulosActivos[requiredModule] === false) {
    return <Navigate to="/principal" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/principal" element={<ProtectedRoute><Principal /></ProtectedRoute>} />

        <Route path="/calendario" element={<ProtectedRoute requiredModule="calendario"><Calendario /></ProtectedRoute>} />

        <Route path="/empresas/:empresaId?" element={<ProtectedRoute requiredModule="empresas"><Empresas key={window.location.pathname} /></ProtectedRoute>} />
        <Route path="/mapa" element={<ProtectedRoute requiredModule="empresas"><Mapa /></ProtectedRoute>} />
        <Route path="/tratos" element={<ProtectedRoute requiredModule="tratos"><Tratos /></ProtectedRoute>} />
        <Route path="/detallestrato/:id" element={<ProtectedRoute requiredModule="tratos"><DetallesTrato /></ProtectedRoute>} />
        <Route path="/reporte_personal" element={<ProtectedRoute requiredModule="reportes"><ReportePersonal /></ProtectedRoute>} />
        <Route path="/metricas_generales" element={<ProtectedRoute requiredModule="metricas"><DashboardMetricas /></ProtectedRoute>} />

        <Route path="/admin_balance" element={<ProtectedRoute requiredModule="balance"><AdminBalance /></ProtectedRoute>} />
        <Route path="/admin_transacciones" element={<ProtectedRoute requiredModule="transacciones"><AdminTransacciones /></ProtectedRoute>} />
        <Route path="/admin_cotizaciones" element={<ProtectedRoute requiredModule="cotizaciones"><AdminCotizaciones /></ProtectedRoute>} />
        <Route path="/admin_facturacion" element={<ProtectedRoute requiredModule="facturacion"><AdminFacturacion /></ProtectedRoute>} />
        <Route path="/admin_cuentas_cobrar" element={<ProtectedRoute requiredModule="cxc"><AdminCuentasCobrar /></ProtectedRoute>} />
        <Route path="/admin_cuentas_pagar" element={<ProtectedRoute requiredModule="cxp"><AdminCuentasPagar /></ProtectedRoute>} />
        <Route path="/admin_caja_chica" element={<ProtectedRoute requiredModule="transacciones"><AdminCajaChica /></ProtectedRoute>} />
        <Route path="/admin_comisiones" element={<ProtectedRoute requiredModule="comisiones"><AdminComisiones /></ProtectedRoute>} />

        <Route path="/configuracion_plantillas" element={<ProtectedRoute requiredModule="configuracion"><ConfiguracionPlantillas /></ProtectedRoute>} />
        <Route path="/configuracion_admin_datos" element={<ProtectedRoute requiredModule="configuracion"><ConfiguracionAdministrador /></ProtectedRoute>} />
        <Route path="/configuracion_empresa" element={<ProtectedRoute requiredModule="configuracion"><ConfiguracionEmpresa /></ProtectedRoute>} />
        <Route path="/configuracion_almacenamiento" element={<ProtectedRoute requiredModule="configuracion"><ConfiguracionAlmacenamiento /></ProtectedRoute>} />
        <Route path="/configuracion_copias_seguridad" element={<ProtectedRoute requiredModule="configuracion"><ConfiguracionCopias /></ProtectedRoute>} />
        <Route path="/configuracion_usuarios" element={<ProtectedRoute requiredModule="configuracion"><ConfiguracionUsuarios /></ProtectedRoute>} />
        <Route path="/configuracion_gestion_sectores_plataformas" element={<ProtectedRoute requiredModule="configuracion"><ConfiguracionGestionSectoresPlataformas /></ProtectedRoute>} />
        <Route path="/configuracion_correos" element={<ProtectedRoute requiredModule="configuracion"><ConfiguracionCorreos /></ProtectedRoute>} />
        <Route path="/google-drive-callback" element={<ProtectedRoute requiredModule="configuracion"><GoogleDriveCallback /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/principal" replace />} />
      </Routes>
    </Router>
  );
}

export default App;