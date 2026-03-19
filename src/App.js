import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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
import AdminComisiones from './components/Admin/Admin_Comisiones';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/principal" element={<Principal />} />
        <Route path="/empresas/:empresaId?" element={<Empresas key={window.location.pathname} />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/tratos" element={<Tratos />} />
        <Route path="/detallestrato/:id" element={<DetallesTrato />} />
        <Route path="/admin_balance" element={<AdminBalance />} />
        <Route path="/admin_transacciones" element={<AdminTransacciones />} />
        <Route path="/admin_cotizaciones" element={<AdminCotizaciones />} />
        <Route path="/admin_facturacion" element={<AdminFacturacion />} />
        <Route path="/admin_cuentas_cobrar" element={<AdminCuentasCobrar />} />
        <Route path="/admin_cuentas_pagar" element={<AdminCuentasPagar />} />
        <Route path="/admin_caja_chica" element={<AdminCajaChica />} />
        <Route path="/reporte_personal" element={<ReportePersonal />} />
        <Route path="/configuracion_plantillas" element={<ConfiguracionPlantillas />} />
        <Route path="/configuracion_admin_datos" element={<ConfiguracionAdministrador />} />
        <Route path="/configuracion_empresa" element={<ConfiguracionEmpresa />} />
        <Route path="/configuracion_almacenamiento" element={<ConfiguracionAlmacenamiento />} />
        <Route path="/configuracion_copias_seguridad" element={<ConfiguracionCopias />} />
        <Route path="/configuracion_usuarios" element={<ConfiguracionUsuarios />} />
        <Route path="/google-drive-callback" element={<GoogleDriveCallback />} />
        <Route path="/metricas_generales" element={<DashboardMetricas />} />
        <Route path='/configuracion_gestion_sectores_plataformas' element={<ConfiguracionGestionSectoresPlataformas />} />
        <Route path='/configuracion_correos' element={<ConfiguracionCorreos />} />
        <Route path="/admin_comisiones" element={<AdminComisiones />} />
      </Routes>
    </Router>
  );
}

export default App;