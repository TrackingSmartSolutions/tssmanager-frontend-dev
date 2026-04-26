import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Configuracion_Usuarios.css"
import Header from "../Header/Header"
import editIcon from "../../assets/icons/editar.png"
import restoreIcon from "../../assets/icons/restablecer-la-contrasena.png"
import Swal from "sweetalert2"
import activeUserIcon from "../../assets/icons/usuario-activo.png"
import inactiveUserIcon from "../../assets/icons/usuario-inactivo.png"
import { API_BASE_URL } from "../Config/Config";

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

// Modal para Agregar/Editar Usuario
const UsuarioModal = ({ isOpen, onClose, onSave, usuario, mode }) => {
  const [formData, setFormData] = useState({
    nombre: "",
    apellidos: "",
    correoElectronico: "",
    nuevaContrasena: "",
    confirmarContrasena: "",
    rol: "",
  })

  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const rolesOptions = [
    { value: "ADMINISTRADOR", label: "Administrador" },
    { value: "EMPLEADO", label: "Empleado" },
    { value: "GESTOR", label: "Gestor" },
  ]

  useEffect(() => {
    if (usuario && mode === "edit") {
      setFormData({
        nombre: usuario.nombre || "",
        apellidos: usuario.apellidos || "",
        correoElectronico: usuario.correoElectronico || "",
        nuevaContrasena: "",
        confirmarContrasena: "",
        rol: usuario.rol || "",
      })
    } else {
      setFormData({
        nombre: "",
        apellidos: "",
        correoElectronico: "",
        nuevaContrasena: "",
        confirmarContrasena: "",
        rol: "",
      })
    }
    setErrors({})
  }, [usuario, mode, isOpen])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const generatePassword = () => {
    const specialChars = "!@#$%^&*";
    const randomNum1 = Math.floor(Math.random() * 10);
    const randomNum2 = Math.floor(Math.random() * 10);
    const randomSpecial = specialChars[Math.floor(Math.random() * specialChars.length)];

    // Tomar el nombre y apellidos desde formData
    const namePart = formData.nombre.trim().substring(0, Math.min(formData.nombre.length, 10));
    const apellidoPart = formData.apellidos.trim().substring(0, 2).toLowerCase();
    const capitalizedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    // Construir la contraseña base
    let password = `${capitalizedName}${apellidoPart}${randomNum1}${randomNum2}${randomSpecial}`;

    // Asegurar longitud mínima de 8
    while (password.length < 8) {
      password += specialChars[Math.floor(Math.random() * specialChars.length)];
    }

    setFormData((prev) => ({
      ...prev,
      nuevaContrasena: password,
      confirmarContrasena: password,
    }));
  };


  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = "Este campo es obligatorio";
    }

    if (!formData.apellidos.trim()) {
      newErrors.apellidos = "Este campo es obligatorio";
    }

    if (!formData.correoElectronico.trim()) {
      newErrors.correoElectronico = "Este campo es obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correoElectronico)) {
      newErrors.correoElectronico = "Ingrese un correo electrónico válido";
    }

    if (mode === "add") {
      if (!formData.nuevaContrasena) {
        newErrors.nuevaContrasena = "Este campo es obligatorio";
      } else if (formData.nuevaContrasena.length < 8) {
        newErrors.nuevaContrasena = "La contraseña debe tener al menos 8 caracteres";
      } else if (!/(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*_\-+?])/.test(formData.nuevaContrasena)) {
        newErrors.nuevaContrasena = "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial";
      }

      if (!formData.confirmarContrasena) {
        newErrors.confirmarContrasena = "Este campo es obligatorio";
      } else if (formData.nuevaContrasena !== formData.confirmarContrasena) {
        newErrors.confirmarContrasena = "Las contraseñas no coinciden";
      }
    }

    if (!formData.rol) {
      newErrors.rol = "Este campo es obligatorio";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      if (mode === "add" && errors.nuevaContrasena) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: errors.nuevaContrasena,
        });
      }
      return;
    }

    const userData = {
      id: mode === "edit" ? usuario.id : undefined,
      nombre: formData.nombre,
      apellidos: formData.apellidos,
      correoElectronico: formData.correoElectronico,
      rol: formData.rol,
      estatus: mode === "edit" ? usuario.estatus : "ACTIVO",
      ...(mode === "add" && { contrasena: formData.nuevaContrasena }),
      fechaCreacion: mode === "edit" ? usuario.fechaCreacion : new Date().toISOString(),
      fechaModificacion: new Date().toISOString(),
    };

    onSave(userData, mode);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === "add" ? "Nuevo usuario" : "Editar usuario"} size="md" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
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
              placeholder="Nombre del usuario"
            />
            {errors.nombre && <span className="error-message">{errors.nombre}</span>}
          </div>
        </div>

        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="apellidos">
              Apellidos <span className="required">*</span>
            </label>
            <input
              type="text"
              id="apellidos"
              value={formData.apellidos}
              onChange={(e) => handleInputChange("apellidos", e.target.value)}
              className={`modal-form-control ${errors.apellidos ? "error" : ""}`}
              placeholder="Apellidos del usuario"
            />
            {errors.apellidos && <span className="error-message">{errors.apellidos}</span>}
          </div>
        </div>

        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="correoElectronico">
              Correo Electrónico <span className="required">*</span>
            </label>
            <input
              type="email"
              id="correoElectronico"
              value={formData.correoElectronico}
              onChange={(e) => handleInputChange("correoElectronico", e.target.value)}
              className={`modal-form-control ${errors.correoElectronico ? "error" : ""}`}
              placeholder="correo@ejemplo.com"
            />
            {errors.correoElectronico && <span className="error-message">{errors.correoElectronico}</span>}
          </div>
        </div>

        {mode === "add" && (
          <>
            <div className="modal-form-row">
              <div className="modal-form-group">
                <label htmlFor="nuevaContrasena">
                  Nueva Contraseña <span className="required">*</span>
                </label>
                <div className="password-input-group">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="nuevaContrasena"
                    value={formData.nuevaContrasena}
                    onChange={(e) => handleInputChange("nuevaContrasena", e.target.value)}
                    className={`modal-form-control ${errors.nuevaContrasena ? "error" : ""}`}
                    placeholder="Contraseña"
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <img
                      src={
                        showPassword
                          ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300347f'%3E%3Cpath d='M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z'/%3E%3C/svg%3E"
                          : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300347f'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3-1.34-3-3-3z'/%3E%3C/svg%3E"
                      }
                      alt={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="password-toggle-icon"
                    />
                  </button>
                </div>
                <small className="help-text">
                  La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.
                </small>
              </div>
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label htmlFor="confirmarContrasena">
                  Confirmar Contraseña <span className="required">*</span>
                </label>
                <div className="password-input-group">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmarContrasena"
                    value={formData.confirmarContrasena}
                    onChange={(e) => handleInputChange("confirmarContrasena", e.target.value)}
                    className={`modal-form-control ${errors.confirmarContrasena ? "error" : ""}`}
                    placeholder="Confirmar contraseña"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <img
                      src={
                        showConfirmPassword
                          ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300347f'%3E%3Cpath d='M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z'/%3E%3C/svg%3E"
                          : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300347f'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3-1.34-3-3-3z'/%3E%3C/svg%3E"
                      }
                      alt={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="password-toggle-icon"
                    />
                  </button>
                </div>
                {errors.confirmarContrasena && <span className="error-message">{errors.confirmarContrasena}</span>}
              </div>
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={generatePassword}
                  disabled={!formData.nombre.trim() || !formData.apellidos.trim()}
                >
                  Generar
                </button>
                <small className="help-text">
                  Generar una contraseña automáticamente, asegúrese de rellenar los campos de nombre y apellidos primero
                </small>
              </div>
            </div>
          </>
        )}

        <div className="modal-form-row">
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
              <option value="">Seleccione un rol</option>
              {rolesOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.rol && <span className="error-message">{errors.rol}</span>}
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

// Modal para Restablecer Contraseña
const RestablecerContrasenaModal = ({ isOpen, onClose, onSave, usuario }) => {
  const [formData, setFormData] = useState({
    nuevaContrasena: "",
    confirmarContrasena: "",
  })

  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormData({
        nuevaContrasena: "",
        confirmarContrasena: "",
      })
      setErrors({})
    }
  }, [isOpen])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const generatePassword = () => {
    const specialChars = "!@#$%^&*";
    const randomNum1 = Math.floor(Math.random() * 10);
    const randomNum2 = Math.floor(Math.random() * 10);
    const randomSpecial = specialChars[Math.floor(Math.random() * specialChars.length)];

    // Tomar el nombre y apellidos desde el usuario recibido
    const namePart = usuario.nombre.trim().substring(0, Math.min(usuario.nombre.length, 10));
    const apellidoPart = usuario.apellidos.trim().substring(0, 2).toLowerCase();
    const capitalizedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    // Construir la contraseña base
    let password = `${capitalizedName}${apellidoPart}${randomNum1}${randomNum2}${randomSpecial}`;

    // Asegurar longitud mínima de 8
    while (password.length < 8) {
      password += specialChars[Math.floor(Math.random() * specialChars.length)];
    }

    setFormData((prev) => ({
      ...prev,
      nuevaContrasena: password,
      confirmarContrasena: password,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nuevaContrasena) {
      newErrors.nuevaContrasena = "Este campo es obligatorio";
    } else if (formData.nuevaContrasena.length < 8) {
      newErrors.nuevaContrasena = "La contraseña debe tener al menos 8 caracteres";
    } else if (!/(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*_\-+?])/.test(formData.nuevaContrasena)) {
      newErrors.nuevaContrasena = "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial";
    }

    if (!formData.confirmarContrasena) {
      newErrors.confirmarContrasena = "Este campo es obligatorio";
    } else if (formData.nuevaContrasena !== formData.confirmarContrasena) {
      newErrors.confirmarContrasena = "Las contraseñas no coinciden";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      if (errors.nuevaContrasena) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: errors.nuevaContrasena,
        });
      }
      return;
    }

    onSave(usuario.id, formData.nuevaContrasena);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Restablecer contraseña" size="sm" closeOnOverlayClick={false}>
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="nuevaContrasena">
              Nueva contraseña <span className="required">*</span>
            </label>
            <div className="password-input-group">
              <input
                type={showPassword ? "text" : "password"}
                id="nuevaContrasena"
                value={formData.nuevaContrasena}
                onChange={(e) => handleInputChange("nuevaContrasena", e.target.value)}
                className={`modal-form-control ${errors.nuevaContrasena ? "error" : ""}`}
                placeholder="Nueva contraseña"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                <img
                  src={
                    showPassword
                      ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300347f'%3E%3Cpath d='M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z'/%3E%3C/svg%3E"
                      : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300347f'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3-1.34-3-3-3z'/%3E%3C/svg%3E"
                  }
                  alt={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="password-toggle-icon"
                />
              </button>
            </div>
            <small className="help-text">
              La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.
            </small>
          </div>
        </div>

        <div className="modal-form-row">
          <div className="modal-form-group">
            <label htmlFor="confirmarContrasena">
              Confirmar contraseña <span className="required">*</span>
            </label>
            <div className="password-input-group">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmarContrasena"
                value={formData.confirmarContrasena}
                onChange={(e) => handleInputChange("confirmarContrasena", e.target.value)}
                className={`modal-form-control ${errors.confirmarContrasena ? "error" : ""}`}
                placeholder="Confirmar contraseña"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <img
                  src={
                    showConfirmPassword
                      ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300347f'%3E%3Cpath d='M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z'/%3E%3C/svg%3E"
                      : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300347f'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3-1.34-3-3-3z'/%3E%3C/svg%3E"
                  }
                  alt={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="password-toggle-icon"
                />
              </button>
            </div>
            {errors.confirmarContrasena && <span className="error-message">{errors.confirmarContrasena}</span>}
          </div>
        </div>

        <div className="modal-form-row">
          <div className="modal-form-group">
            <button type="button" className="btn btn-secondary" onClick={generatePassword}>
              Generar
            </button>
          </div>
        </div>

        <div className="modal-form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Confirmar cambios
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Modal de Confirmación de Eliminación
const ConfirmarEliminacionModal = ({ isOpen, onClose, onConfirm, usuario }) => {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar eliminación" size="sm" closeOnOverlayClick={false}>
      <div className="confirmar-eliminacion">
        <div className="confirmation-content">
          <p className="confirmation-message">¿Seguro que quieres eliminar al usuario de forma permanente?</p>
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

// Modal de Reasignación de Tratos y Actividades
const ReasignacionModal = ({ isOpen, onClose, onConfirm, usuario, usuariosActivos }) => {
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("")
  const [errors, setErrors] = useState({})
  const [contadores, setContadores] = useState({ tratos: 0, actividades: 0 })
  const [cargandoContadores, setCargandoContadores] = useState(false)

  useEffect(() => {
    if (isOpen && usuario) {
      setUsuarioSeleccionado("")
      setErrors({})
      cargarContadores()
    }
  }, [isOpen, usuario])

  const cargarContadores = async () => {
    if (!usuario?.id) return

    setCargandoContadores(true)
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/auth/users/${usuario.id}/assignment-counts`)
      const data = await response.json()
      setContadores(data)
    } catch (error) {
      console.error("Error cargando contadores:", error)
      setContadores({ tratos: 0, actividades: 0 })
    } finally {
      setCargandoContadores(false)
    }
  }

  const handleConfirm = () => {
    if (!usuarioSeleccionado) {
      setErrors({ usuario: "Debe seleccionar un usuario" })
      return
    }
    onConfirm(usuarioSeleccionado)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reasignar tratos y actividades" size="md" closeOnOverlayClick={false}>
      <div className="reasignacion-modal">
        <div className="confirmation-content">
          <p className="confirmation-message">
            ¿A quién desea asignar los tratos y actividades de <strong>{usuario?.nombre} {usuario?.apellidos}</strong>?
          </p>

          {/* Mostrar contadores */}
          <div className="contadores-reasignacion">
            {cargandoContadores ? (
              <p>Cargando información...</p>
            ) : (
              <div className="contadores-info">
                <div className="contador-item">
                  <span className="contador-numero">{contadores.tratos}</span>
                  <span className="contador-label">Tratos como propietario</span>
                </div>
                <div className="contador-item">
                  <span className="contador-numero">{contadores.actividades}</span>
                  <span className="contador-label">Actividades abiertas asignadas</span>
                </div>
              </div>
            )}
          </div>

          <div className="modal-form-group">
            <label htmlFor="usuarioDestino">
              Seleccionar usuario <span className="required">*</span>
            </label>
            <select
              id="usuarioDestino"
              value={usuarioSeleccionado}
              onChange={(e) => {
                setUsuarioSeleccionado(e.target.value)
                if (errors.usuario) {
                  setErrors({ ...errors, usuario: "" })
                }
              }}
              className={`modal-form-control ${errors.usuario ? "error" : ""}`}
            >
              <option value="">Seleccione un usuario</option>
              {usuariosActivos.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellidos} - {u.rol}
                </option>
              ))}
            </select>
            {errors.usuario && <span className="error-message">{errors.usuario}</span>}
          </div>

          <div className="modal-form-actions">
            <button type="button" onClick={onClose} className="btn btn-cancel">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} className="btn btn-confirm">
              Reasignar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

const ConflictResolutionModal = ({ isOpen, onClose, onConfirm, conflictos }) => {
  const [resoluciones, setResoluciones] = useState({});

  useEffect(() => {
    if (isOpen && conflictos) {
      const initialUsers = {};
      conflictos.forEach((c) => {
        initialUsers[c.actividad.id] = {
          id: c.actividad.id,
          fecha: c.actividad.fechaLimite,
          hora: c.actividad.horaInicio ? c.actividad.horaInicio.substring(0, 5) : "09:00", // Recortar segundos si vienen
        };
      });
      setResoluciones(initialUsers);
    }
  }, [isOpen, conflictos]);

  const handleChange = (id, field, value) => {
    setResoluciones((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleConfirm = () => {
    const listaResoluciones = Object.values(resoluciones);
    onConfirm(listaResoluciones);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conflictos de Agenda Detectados" size="lg" closeOnOverlayClick={false}>
      <div className="conflict-modal-body">
        <div className="alert alert-warning" style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '4px' }}>
          <strong>¡Atención!</strong> Se encontraron {conflictos.length} actividades que coinciden con la agenda del usuario receptor.
          Por favor, asigna una nueva fecha u hora para evitar empalmes.
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table className="config-usuarios-table">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Horario Original</th>
                <th>Nueva Fecha</th>
                <th>Nueva Hora</th>
              </tr>
            </thead>
            <tbody>
              {conflictos.map((item) => (
                <tr key={item.actividad.id}>
                  <td>
                    <small>{item.actividad.descripcion}</small>
                  </td>
                  <td style={{ color: '#dc3545' }}>
                    {item.actividad.fechaLimite} {item.actividad.horaInicio}
                  </td>
                  <td>
                    <input
                      type="date"
                      className="modal-form-control"
                      value={resoluciones[item.actividad.id]?.fecha || ""}
                      onChange={(e) => handleChange(item.actividad.id, "fecha", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      className="modal-form-control"
                      value={resoluciones[item.actividad.id]?.hora || ""}
                      onChange={(e) => handleChange(item.actividad.id, "hora", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-form-actions" style={{ marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar reasignación
          </button>
          <button type="button" onClick={handleConfirm} className="btn btn-primary">
            Confirmar y Reasignar
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Componente Principal
const ConfiguracionUsuarios = () => {

  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { empresas: true, tratos: true };
  const [usuariosActivos, setUsuariosActivos] = useState([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState([]);
  const [pendingReassignData, setPendingReassignData] = useState(null);
  const [modals, setModals] = useState({
    usuario: { isOpen: false, mode: "add", data: null },
    restablecerContrasena: { isOpen: false, data: null },
    confirmarEliminacion: { isOpen: false, data: null },
    reasignacion: { isOpen: false, data: null },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/auth/users`);
      const data = await response.json();
      const usuariosData = data.map(user => ({
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        nombreUsuario: user.nombreUsuario,
        correoElectronico: user.correoElectronico,
        rol: user.rol,
        estatus: user.estatus,
        fechaCreacion: user.fechaCreacion,
        fechaModificacion: user.fechaModificacion,
      }));

      setUsuarios(usuariosData);

      setUsuariosActivos(usuariosData.filter(u => u.estatus === "ACTIVO"));

    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los usuarios" });
    } finally {
      setIsLoading(false);
    }
  };

  const navigate = useNavigate()
  const openModal = (modalType, mode = "add", data = null) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: { isOpen: true, mode, data },
    }))
  }

  const closeModal = (modalType) => {
    setModals((prev) => ({
      ...prev,
      [modalType]: { isOpen: false, mode: "add", data: null },
    }))
  }

  const handleAddUser = () => {
    openModal("usuario", "add")
  }

  const handleEditUser = (userId) => {
    const user = usuarios.find((u) => u.id === userId)
    if (user) {
      openModal("usuario", "edit", user)
    }
  }

  const handleResetPassword = (userId) => {
    const user = usuarios.find((u) => u.id === userId)
    if (user) {
      openModal("restablecerContrasena", "reset", user)
    }
  }

  const handleToggleStatus = async (userId) => {
    const usuario = usuarios.find((u) => u.id === userId)

    if (usuario.estatus === "ACTIVO") {
      if (!modulosActivos.tratos) {
        await ejecutarCambioEstatus(userId);
        return;
      }

      const usuariosDisponibles = usuariosActivos.filter(u => u.id !== userId)
      if (usuariosDisponibles.length === 0) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No hay otros usuarios activos disponibles para reasignar los tratos y actividades.",
        });
        return;
      }
      openModal("reasignacion", "reassign", { usuario, usuariosDisponibles })
    } else {
      // Si va a activar, proceder normalmente
      await ejecutarCambioEstatus(userId)
    }
  }

  const handleSaveUser = async (userData, mode) => {
    try {
      const existingUser = usuarios.find(
        (u) => u.correoElectronico.toLowerCase() === userData.correoElectronico.toLowerCase() &&
          (mode !== "edit" || u.id !== userData.id)
      );
      if (existingUser) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "El correo electrónico ya está registrado por otro usuario.",
        });
        return;
      }

      const url = `${API_BASE_URL}/auth/users${userData.id ? `/${userData.id}` : ''}`;
      const method = userData.id ? 'PUT' : 'POST';
      const response = await fetchWithToken(url, {
        method,
        body: JSON.stringify({
          ...userData,
          estatus: userData.estatus.toUpperCase(),
          contrasena: userData.id ? (userData.nuevaContrasena || undefined) : userData.contrasena,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const savedUser = await response.json();
      fetchData();
      Swal.fire({
        icon: "success",
        title: userData.id ? "Usuario actualizado" : "Usuario creado",
        text: `El usuario se ha ${userData.id ? 'actualizado' : 'creado'} correctamente.`,
      });
      closeModal("usuario");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al guardar el usuario.",
      });
    }
  };
  const handleSavePassword = async (userId, newPassword) => {
    try {
      await fetchWithToken(`${API_BASE_URL}/auth/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ nuevaContrasena: newPassword }),
        headers: { "Content-Type": "application/json" },
      });
      fetchData();
      Swal.fire({
        icon: "success",
        title: "Contraseña restablecida",
        text: "La contraseña se ha restablecido correctamente.",
      });
      closeModal("restablecerContrasena");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al restablecer la contraseña.",
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await fetchWithToken(`${API_BASE_URL}/auth/users/${modals.confirmarEliminacion.data.id}`, { method: 'DELETE' });
      fetchData();
      Swal.fire({
        icon: "success",
        title: "Usuario eliminado",
        text: "El usuario se ha eliminado correctamente.",
      });
      closeModal("confirmarEliminacion");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al eliminar el usuario.",
      });
    }
  };

  const ejecutarCambioEstatus = async (userId, usuarioDestinoId = null) => {
    try {
      const url = usuarioDestinoId
        ? `${API_BASE_URL}/auth/users/${userId}/status?reasignarA=${usuarioDestinoId}`
        : `${API_BASE_URL}/auth/users/${userId}/status`;

      const response = await fetchWithToken(url, { method: 'PATCH' });
      const updatedUser = await response.json();

      setUsuarios(prev => prev.map(u => u.id === userId ? {
        ...u,
        estatus: updatedUser.estatus,
        fechaModificacion: updatedUser.fechaModificacion
      } : u));

      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: usuarioDestinoId
          ? `El usuario ha sido desactivado y sus tratos/actividades han sido reasignados correctamente.`
          : `El usuario ha sido ${updatedUser.estatus.toLowerCase()} correctamente.`,
      });
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  const handleConfirmReasignacion = async (usuarioDestinoId) => {
    const usuarioOrigen = modals.reasignacion.data?.usuario;
    if (!usuarioOrigen) return;

    setPendingReassignData({
      origenId: usuarioOrigen.id,
      destinoId: usuarioDestinoId
    });

    try {
      // Verificar conflictos
      const response = await fetchWithToken(`${API_BASE_URL}/auth/users/${usuarioOrigen.id}/check-conflicts?targetUserId=${usuarioDestinoId}`);
      const conflictos = await response.json();

      if (conflictos && conflictos.length > 0) {
        closeModal("reasignacion");
        setConflictData(conflictos);
        setConflictModalOpen(true);
      } else {
        await ejecutarCambioEstatus(usuarioOrigen.id, usuarioDestinoId);
        closeModal("reasignacion");
      }
    } catch (error) {
      console.error("Error verificando conflictos:", error);
      Swal.fire({ icon: "error", title: "Error", text: "Error al verificar disponibilidad de agenda." });
    }
  };

  const handleResolveConflicts = async (resoluciones) => {
    if (!pendingReassignData) return;

    try {
      const response = await fetchWithToken(`${API_BASE_URL}/auth/users/${pendingReassignData.origenId}/deactivate-resolved`, {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: pendingReassignData.destinoId,
          resoluciones: resoluciones
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: "Reasignación Exitosa",
          text: "Los usuarios y actividades han sido actualizados correctamente.",
        });
        setConflictModalOpen(false);
        fetchData();
      } else {
        throw new Error("Error en la respuesta del servidor");
      }
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo completar la reasignación." });
    }
  };

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="config-usuarios-loading">
            <div className="spinner"></div>
            <p>Cargando usuarios...</p>
          </div>
        )}
        <div className="config-usuarios-config-header">
          <h2 className="config-usuarios-config-title">Configuración</h2>
          <nav className="config-usuarios-config-nav">
            <div className="config-usuarios-nav-item" onClick={() => navigate("/configuracion_plantillas")}>
              Plantillas de correo
            </div>
            <div className="config-usuarios-nav-item" onClick={() => navigate("/configuracion_admin_datos")}>
              Administrador de datos
            </div>
            <div className="config-usuarios-nav-item" onClick={() => navigate("/configuracion_empresa")}>
              Configuración de la empresa
            </div>
            <div className="config-usuarios-nav-item" onClick={() => navigate("/configuracion_almacenamiento")}>
              Almacenamiento
            </div>
            <div className="config-usuarios-nav-item" onClick={() => navigate("/configuracion_copias_seguridad")}>
              Copias de Seguridad
            </div>
            <div className="config-usuarios-nav-item config-usuarios-nav-item-active">Usuarios y roles</div>
            {modulosActivos.empresas && (
              <div
                className="config-usuarios-nav-item"
                onClick={() => navigate("/configuracion_gestion_sectores_plataformas")}
              >
                Sectores
              </div>
            )}
            <div
              className="config-usuarios-nav-item"
              onClick={() => navigate("/configuracion_correos")}
            >
              Historial de Correos
            </div>
          </nav>
        </div>

        <main className="config-usuarios-main-content">
          <div className="config-usuarios-container">
            <section className="config-usuarios-section">
              <div className="config-usuarios-section-header">
                <h3 className="config-usuarios-section-title">Usuarios y roles</h3>
                <button className="config-usuarios-btn config-usuarios-btn-add" onClick={handleAddUser}>
                  Agregar nuevo usuario
                </button>
              </div>

              <div className="config-usuarios-table-container">
                <table className="config-usuarios-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Apellidos</th>
                      <th>Nombre de Usuario</th>
                      <th>Correo Electrónico</th>
                      <th>Rol</th>
                      <th>Estatus</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id}>
                        <td>{usuario.nombre}</td>
                        <td>{usuario.apellidos}</td>
                        <td>{usuario.nombreUsuario}</td>
                        <td>{usuario.correoElectronico}</td>
                        <td>{usuario.rol}</td>
                        <td>
                          <div className="config-usuarios-status-cell">{usuario.estatus}</div>
                        </td>
                        <td>
                          <div className="config-usuarios-action-buttons">
                            <button
                              className="config-usuarios-btn-action config-usuarios-edit"
                              onClick={() => handleEditUser(usuario.id)}
                              title="Editar usuario"
                            >
                              <img src={editIcon || "/placeholder.svg"} alt="Editar" />
                            </button>
                            <button
                              className="config-usuarios-btn-action config-usuarios-toggle-status"
                              onClick={() => handleToggleStatus(usuario.id)}
                              title="Cambiar estatus"
                            >
                              <img
                                src={usuario.estatus === "ACTIVO" ? inactiveUserIcon : activeUserIcon}
                                alt={usuario.estatus === "ACTIVO" ? "Desactivar" : "Activar"}
                                className="config-usuarios-toggle-icon"
                              />
                            </button>
                            <button
                              className="config-usuarios-btn-action config-usuarios-reset-password"
                              onClick={() => handleResetPassword(usuario.id)}
                              title="Restablecer contraseña"
                            >
                              <img src={restoreIcon || "/placeholder.svg"} alt="Restablecer contraseña" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>

        <UsuarioModal
          isOpen={modals.usuario.isOpen}
          onClose={() => closeModal("usuario")}
          onSave={handleSaveUser}
          usuario={modals.usuario.data}
          mode={modals.usuario.mode}
        />

        <RestablecerContrasenaModal
          isOpen={modals.restablecerContrasena.isOpen}
          onClose={() => closeModal("restablecerContrasena")}
          onSave={handleSavePassword}
          usuario={modals.restablecerContrasena.data}
        />

        <ConfirmarEliminacionModal
          isOpen={modals.confirmarEliminacion.isOpen}
          onClose={() => closeModal("confirmarEliminacion")}
          onConfirm={handleConfirmDelete}
          usuario={modals.confirmarEliminacion.data}
        />
        <ReasignacionModal
          isOpen={modals.reasignacion.isOpen}
          onClose={() => closeModal("reasignacion")}
          onConfirm={handleConfirmReasignacion}
          usuario={modals.reasignacion.data?.usuario}
          usuariosActivos={modals.reasignacion.data?.usuariosDisponibles || []}
        />
        <ConflictResolutionModal
          isOpen={conflictModalOpen}
          onClose={() => setConflictModalOpen(false)}
          conflictos={conflictData}
          onConfirm={handleResolveConflicts}
        />
      </div>
    </>
  )
}

export default ConfiguracionUsuarios
