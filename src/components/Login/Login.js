import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import loginBg from '../../assets/images/login-bg.png';
import axios from 'axios';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../Config/Config';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLogo, setCurrentLogo] = useState(localStorage.getItem("cachedLogoUrl") || "");
  const [requiereCambio, setRequiereCambio] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  // Activa animación inicial tras un breve retraso
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/configuracion/empresa`);
        if (response.data && response.data.logoUrl) {
          setCurrentLogo(response.data.logoUrl);
          localStorage.setItem("cachedLogoUrl", response.data.logoUrl);
        }
      } catch (error) {
        console.log("Usando logo en caché o por defecto (Endpoint protegido o sin conexión).");
      }
    };
    fetchLogo();
  }, []);

  // Maneja el envío del formulario de login
  const handleSubmit = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    if (!username || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor ingresa tu usuario y contraseña',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#f27474',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        nombreUsuario: username,
        contrasena: password,
      });

      if (response.data.requiereCambioContrasena) {
        setTempUsername(response.data.nombreUsuario);
        setRequiereCambio(true);
        setIsLoading(false);
        return;
      }

      const { token, message, rol } = response.data;
      localStorage.setItem('token', token);
      const name = message.replace('Bienvenido/a ', '').trim();
      localStorage.setItem('userName', name);
      localStorage.setItem('userRol', rol);

      const userResponse = await axios.get(`${API_BASE_URL}/auth/users/by-username/${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userId = userResponse.data.id;
      localStorage.setItem('userId', userId);

      await Swal.fire({
        icon: 'success',
        title: '¡Inicio de sesión exitoso!',
        text: message,
        timer: 1500,
        showConfirmButton: false,
      });

      setTimeout(() => {
        setIsLoading(false);
        navigate('/principal');
      }, 500);
    } catch (error) {
      setIsLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Error de inicio de sesión',
        text: 'Usuario o contraseña incorrectos',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
      });
    }
  };

  const handleCambioContrasena = async (e) => {
    e.preventDefault();
    if (nuevaContrasena !== confirmarContrasena) {
      Swal.fire({ icon: 'warning', title: 'Atención', text: 'Las contraseñas no coinciden', confirmButtonColor: '#f27474' });
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/forzar-cambio-contrasena`, {
        nombreUsuario: tempUsername,
        nuevaContrasena: nuevaContrasena
      });

      Swal.fire({ icon: 'success', title: '¡Actualizada!', text: 'Contraseña cambiada con éxito. Por favor, inicia sesión con tus nuevas credenciales.', confirmButtonColor: '#3085d6' });

      // Reseteamos el estado para volver al login normal
      setRequiereCambio(false);
      setNuevaContrasena("");
      setConfirmarContrasena("");
      document.getElementById('password').value = ''; // Limpiar el input original
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar la contraseña' });
    } finally {
      setIsLoading(false);
    }
  };

  // Función para solicitar cambio de contraseña
  const manejarSolicitudCambioContrasena = async (e) => {
    e.preventDefault();

    const { value: correo } = await Swal.fire({
      title: 'Recuperar contraseña',
      text: 'Ingresa tu correo electrónico para solicitar un cambio de contraseña',
      input: 'email',
      inputPlaceholder: 'tu@email.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar solicitud',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3085d6',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes ingresar tu correo electrónico';
        }
      }
    });

    if (correo) {
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/solicitar-cambio-contrasena`, {
          correo: correo
        });

        // Si la respuesta es exitosa
        if (response.data.success) {
          await Swal.fire({
            icon: 'success',
            title: '¡Solicitud enviada!',
            text: 'Los administradores han sido notificados de tu solicitud',
            timer: 2000,
            showConfirmButton: false,
          });
        }
      } catch (error) {
        // Manejar diferentes tipos de errores
        if (error.response) {
          const { status, data } = error.response;

          if (status === 404) {
            // Correo no encontrado
            await Swal.fire({
              icon: 'warning',
              title: 'Correo no encontrado',
              text: 'El correo electrónico ingresado no está registrado en el sistema',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#f27474',
            });
          } else if (status === 400) {
            // Error de validación
            await Swal.fire({
              icon: 'error',
              title: 'Error de validación',
              text: data.message || 'Datos inválidos',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#3085d6',
            });
          } else if (status === 500) {
            // Error del servidor
            await Swal.fire({
              icon: 'error',
              title: 'Error del servidor',
              text: 'Ocurrió un error interno. Inténtalo más tarde.',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#3085d6',
            });
          } else {
            // Otros errores
            await Swal.fire({
              icon: 'error',
              title: 'Error',
              text: data.message || 'No se pudo enviar la solicitud',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#3085d6',
            });
          }
        } else {
          // Error de red u otros errores
          await Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#3085d6',
          });
        }
      }
    }
  };

  // Alterna visibilidad de la contraseña
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleNewPasswordVisibility = () => {
    setShowNewPassword(!showNewPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      )}
      <div className="map-container">
        <img src={loginBg} alt="Mapa de fondo" className="background-image" />
        <div className={`login-card ${isLoaded ? 'loaded' : ''}`}>
          <div className="logo-container">
            <div className="logo">
              <div className="logo-waves">
                <div className="wave wave-1"></div>
                <div className="wave wave-2"></div>
                <div className="wave wave-3"></div>
              </div>
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt="Logo de la empresa"
                  className="company-logo"
                />
              ) : (
                <div className="no-logo-placeholder">
                  <span>Sin logo</span>
                </div>
              )}
            </div>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group-login">
              <label htmlFor="username">Usuario</label>
              <input type="text" id="username" className="form-control-login" />
            </div>
            <div className="form-group-login">
              <label htmlFor="password">Contraseña</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                className="form-control-login"
              />
              <div className="toggle-password">
                <input
                  type="checkbox"
                  id="show-password"
                  onChange={togglePasswordVisibility}
                />
                <label htmlFor="show-password"></label>
              </div>
            </div>
            <button type="submit" className="login-btn" disabled={isLoading}>
              {isLoading ? 'Cargando...' : 'Iniciar sesión'}
            </button>
            <div className="forgot-password">
              <a href="#" onClick={manejarSolicitudCambioContrasena}>¿Olvidaste tu contraseña?</a>
            </div>
          </form>
        </div>
        <div className="marker marker-1"></div>
        <div className="marker marker-2"></div>
        <div className="marker marker-3"></div>
        <div className="marker marker-4"></div>
        <div className="marker marker-5"></div>
        <div className="marker marker-6"></div>
        <div className="dotted-line line-1"></div>
        <div className="dotted-line line-2"></div>
        <div className="dotted-line line-3"></div>
      </div>
      {requiereCambio && (
        <div className="loading-overlay" style={{ zIndex: 101, backgroundColor: 'rgba(0, 10, 30, 0.95)' }}>
          <div className="login-card loaded" style={{ position: 'relative', transform: 'none', top: 'auto', left: 'auto', margin: '0 20px' }}>
            <div className="logo-container" style={{ marginBottom: '15px' }}>
              <h3 style={{ color: 'var(--white)', textAlign: 'center', fontSize: '18px' }}>Bienvenido</h3>
              <p style={{ color: 'var(--light-blue-2)', fontSize: '12px', textAlign: 'center', marginTop: '5px' }}>
                Por seguridad, es obligatorio cambiar tu contraseña de acceso inicial.
              </p>
            </div>
            <form className="login-form" onSubmit={handleCambioContrasena}>
              <div className="form-group-login">
                <label htmlFor="new-password">Nueva Contraseña</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="new-password"
                  className="form-control-login"
                  value={nuevaContrasena}
                  onChange={(e) => setNuevaContrasena(e.target.value)}
                  required
                />
                <div className="toggle-password">
                  <input
                    type="checkbox"
                    id="show-new-password"
                    onChange={toggleNewPasswordVisibility}
                  />
                  <label htmlFor="show-new-password"></label>
                </div>
              </div>
              <div className="form-group-login">
                <label htmlFor="confirm-password">Confirmar Contraseña</label>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-password"
                  className="form-control-login"
                  value={confirmarContrasena}
                  onChange={(e) => setConfirmarContrasena(e.target.value)}
                  required
                />
                <div className="toggle-password">
                  <input
                    type="checkbox"
                    id="show-confirm-password"
                    onChange={toggleConfirmPasswordVisibility}
                  />
                  <label htmlFor="show-confirm-password"></label>
                </div>
              </div>
              <button type="submit" className="login-btn" disabled={isLoading}>
                {isLoading ? 'Guardando...' : 'Cambiar y Continuar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login