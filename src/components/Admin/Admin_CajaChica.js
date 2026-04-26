import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Admin_CajaChica.css"
import Header from "../Header/Header"
import Swal from "sweetalert2"
import jsPDF from "jspdf"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
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
  return response.json()
}

const Modal = ({ isOpen, onClose, title, children, size = "md", closeOnOverlayClick = true }) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050
  };

  let widthStyle = '500px';
  let maxWidthStyle = '95%';
  if (size === 'lg') {
    widthStyle = '800px';
  } else if (size === 'xl') {
    widthStyle = '950px';
  }

  const contentStyle = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    maxHeight: '95vh',
    overflowY: 'auto',
    width: widthStyle,
    maxWidth: maxWidthStyle,
    position: 'relative',
    boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div style={overlayStyle} onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          borderBottom: '1px solid #dee2e6',
          paddingBottom: '10px'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.10rem', fontWeight: 600 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6c757d',
              padding: '0 5px'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, onDownload }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vista previa" size="xl" closeOnOverlayClick={false}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button
            type="button"
            onClick={onDownload}
            className="cajachica-btn"
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            Descargar PDF
          </button>
        </div>

        <div style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          overflow: 'hidden',
          height: '75vh'
        }}>
          <iframe
            src={`${pdfUrl}#view=FitH&navpanes=0&toolbar=0`}
            title="Vista Previa"
            width="100%"
            height="100%"
            style={{ border: 'none' }}
          />
        </div>
      </div>
    </Modal>
  );
};

const CustomDatePickerInput = ({ value, onClick, placeholder }) => (
  <div className="cajachica-date-picker-wrapper">
    <input
      type="text"
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      readOnly
      className="cajachica-date-picker"
    />
    <div className="cajachica-date-picker-icons">
      <svg
        className="cajachica-calendar-icon"
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

const AdminCajaChica = () => {
  const navigate = useNavigate()
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { balance: true, transacciones: true, cotizaciones: true, facturacion: true, cxc: true, cxp: true, comisiones: true };
  const userRol = localStorage.getItem("userRol")
  const [transaccionesEfectivo, setTransaccionesEfectivo] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [ordenFecha, setOrdenFecha] = useState('asc');
  const [resumenCajaChica, setResumenCajaChica] = useState({
    totalIngresos: 0,
    totalGastos: 0,
    utilidadPerdida: 0,
  })
  const [categorias, setCategorias] = useState([])
  const [cuentas, setCuentas] = useState([])
  const formasPago = [{ value: "01", label: "Efectivo" }]

  const [rangoFechas, setRangoFechas] = useState([null, null]);
  const [fechaInicio, fechaFin] = rangoFechas;

  const [filtroCuenta, setFiltroCuenta] = useState("");
  const [pdfPreview, setPdfPreview] = useState({
    isOpen: false,
    url: null,
    filename: ""
  });

  const obtenerRangoMesActual = () => {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = ahora.getMonth();

    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);

    return [primerDia, ultimoDia];
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [transaccionesResp, categoriasResp, cuentasResp] = await Promise.all([
          fetchWithToken(`${API_BASE_URL}/transacciones`),
          fetchWithToken(`${API_BASE_URL}/categorias`),
          fetchWithToken(`${API_BASE_URL}/cuentas`),
        ])

        const transaccionesFiltradas = transaccionesResp.filter(
          (t) =>
            t.formaPago === "01" &&
            (t.tipo === "INGRESO" ||
              (t.tipo === "GASTO" && t.notas && t.notas.includes("Transacción generada desde Cuentas por Pagar"))),
        )

        setTransaccionesEfectivo(transaccionesFiltradas)
        setCategorias(categoriasResp)
        setCuentas(cuentasResp)

        const rangoMesActual = obtenerRangoMesActual();
        setRangoFechas(rangoMesActual);

      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudieron cargar los datos",
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const updateTransacciones = async () => {
      try {
        const transaccionesResp = await fetchWithToken(`${API_BASE_URL}/transacciones`)
        const transaccionesFiltradas = transaccionesResp.filter((t) => t.formaPago === "01")
        setTransaccionesEfectivo(transaccionesFiltradas)
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudieron actualizar los datos",
        })
      }
    }

    window.addEventListener("transaccionUpdated", updateTransacciones)
    return () => window.removeEventListener("transaccionUpdated", updateTransacciones)
  }, [])

  useEffect(() => {
    const calcularResumen = () => {
      const totalIngresos = transaccionesEfectivo
        .filter((t) => t.tipo === "INGRESO")
        .reduce((sum, t) => sum + t.monto, 0)
      const totalGastos = transaccionesEfectivo.filter((t) => t.tipo === "GASTO").reduce((sum, t) => sum + t.monto, 0)
      const utilidadPerdida = totalIngresos - totalGastos

      setResumenCajaChica({ totalIngresos, totalGastos, utilidadPerdida })
    }
    calcularResumen()
  }, [transaccionesEfectivo])

  const handleMenuNavigation = (menuItem) => {
    switch (menuItem) {
      case "balance":
        navigate("/admin_balance")
        break
      case "transacciones":
        navigate("/admin_transacciones")
        break
      case "cotizaciones":
        navigate("/admin_cotizaciones")
        break
      case "facturacion":
        navigate("/admin_facturacion")
        break
      case "cuentas-cobrar":
        navigate("/admin_cuentas_cobrar")
        break
      case "cuentas-pagar":
        navigate("/admin_cuentas_pagar")
        break
      case "caja-chica":
        navigate("/admin_caja_chica")
        break
      case "comisiones":
        navigate("/admin_comisiones");
        break;
      default:
        break
    }
  }

  const calcularSaldoAcumulado = () => {
    const fechaInicioNormalizada = fechaInicio ? new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate()) : null;

    const todasTransaccionesOrdenadas = [...transaccionesEfectivo]
      .sort((a, b) => new Date(a.fechaPago + 'T00:00:00') - new Date(b.fechaPago + 'T00:00:00'));

    let saldoInicial = 0;

    // Calcular saldo inicial considerando la cuenta seleccionada
    if (fechaInicio) {
      todasTransaccionesOrdenadas.forEach((transaccion) => {
        const fechaTransaccion = new Date(transaccion.fechaPago + 'T00:00:00');

        const esCuentaCorrecta = filtroCuenta === "" || transaccion.cuenta.id.toString() === filtroCuenta;

        if (fechaTransaccion < fechaInicioNormalizada && esCuentaCorrecta) {
          if (transaccion.tipo === "INGRESO") saldoInicial += transaccion.monto;
          else saldoInicial -= transaccion.monto;
        }
      });
    }

    // Obtener las transacciones del rango y cuenta seleccionada
    const transaccionesFiltradas = filtrarTransacciones(transaccionesEfectivo);

    const transaccionesOrdenadas = transaccionesFiltradas
      .sort((a, b) => new Date(a.fechaPago + 'T00:00:00') - new Date(b.fechaPago + 'T00:00:00'));

    let saldoAcumulado = saldoInicial;

    const transaccionesConSaldo = transaccionesOrdenadas.map((transaccion) => {
      if (transaccion.tipo === "INGRESO") saldoAcumulado += transaccion.monto;
      else saldoAcumulado -= transaccion.monto;
      return { ...transaccion, saldoAcumulado };
    });

    if (ordenFecha === 'desc') {
      return transaccionesConSaldo.reverse();
    } else {
      return transaccionesConSaldo;
    }
  };

  const filtrarTransacciones = (transacciones) => {
    return transacciones.filter(transaccion => {
      const fechaTransaccion = new Date(transaccion.fechaPago + 'T00:00:00');

      let inicio = fechaInicio ? new Date(fechaInicio) : null;
      let fin = fechaFin ? new Date(fechaFin) : null;

      if (inicio) {
        inicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
      }

      if (fin) {
        fin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59);
      }

      const pasaFechas = (!inicio || fechaTransaccion >= inicio) && (!fin || fechaTransaccion <= fin);
      const pasaCuenta = filtroCuenta === "" || transaccion.cuenta.id.toString() === filtroCuenta;

      return pasaFechas && pasaCuenta;
    });
  };

  const transaccionesConSaldo = calcularSaldoAcumulado();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount)
  }

  const toggleOrdenFecha = () => {
    setOrdenFecha(prevOrden => prevOrden === 'desc' ? 'asc' : 'desc');
  };


  // Función para dividir transacciones en chunks
  const dividirTransaccionesEnChunks = (datos, filasPorPagina = 20) => {
    const chunks = []
    for (let i = 0; i < datos.length; i += filasPorPagina) {
      chunks.push(datos.slice(i, i + filasPorPagina))
    }
    return chunks
  }

  const handleGenerarReporte = async () => {
    try {
      // Mostrar loading
      Swal.fire({
        title: "Generando reporte...",
        text: "Por favor espere mientras se genera el PDF",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        },
      })

      // Preparar datos formateados
      const transaccionesFormateadas = transaccionesConSaldo.map((transaccion) => ({
        fecha: new Date(transaccion.fecha + 'T00:00:00').toLocaleDateString("es-MX"),
        cuenta: transaccion.cuenta.nombre,
        nota: transaccion.notas || "-",
        gastos: transaccion.tipo === "GASTO" ? formatCurrency(transaccion.monto) : "-",
        ingresos: transaccion.tipo === "INGRESO" ? formatCurrency(transaccion.monto) : "-",
        saldo: formatCurrency(transaccion.saldoAcumulado),
      }))

      // Dividir transacciones en chunks si son muchas
      const chunksTransacciones = dividirTransaccionesEnChunks(transaccionesFormateadas, 18)

      const fechaActual = new Date().toLocaleDateString("es-MX")

      // Crear PDF
      const pdf = new jsPDF("p", "mm", "a4")
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 15

      let currentY = margin

      // Función para agregar nueva página si es necesario
      const checkPageBreak = (requiredHeight) => {
        if (currentY + requiredHeight > pageHeight - margin) {
          pdf.addPage()
          currentY = margin
          return true
        }
        return false
      }

      // Encabezado del reporte
      pdf.setFontSize(20)
      pdf.setFont("helvetica", "bold")
      pdf.text("REPORTE DE CAJA CHICA", pageWidth / 2, currentY, { align: "center" })
      currentY += 10

      pdf.setFontSize(12)
      pdf.setFont("helvetica", "normal")
      pdf.text(`Fecha de generación: ${fechaActual}`, pageWidth / 2, currentY, { align: "center" })
      currentY += 15

      // Resumen financiero
      checkPageBreak(40)
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("RESUMEN FINANCIERO", margin, currentY)
      currentY += 10

      const resumenHeight = 25
      checkPageBreak(resumenHeight)

      // Crear cajas para el resumen
      const boxWidth = (pageWidth - 2 * margin - 20) / 3
      const boxHeight = 20

      // Total Ingresos
      pdf.setFillColor(232, 245, 232)
      pdf.rect(margin, currentY, boxWidth, boxHeight, "F")
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      pdf.text("Total Ingresos", margin + boxWidth / 2, currentY + 6, { align: "center" })
      pdf.setFontSize(12)
      pdf.text(formatCurrency(resumenCajaChica.totalIngresos), margin + boxWidth / 2, currentY + 14, {
        align: "center",
      })

      // Total Gastos
      pdf.setFillColor(255, 232, 232)
      pdf.rect(margin + boxWidth + 10, currentY, boxWidth, boxHeight, "F")
      pdf.setFontSize(10)
      pdf.text("Total Gastos", margin + boxWidth + 10 + boxWidth / 2, currentY + 6, { align: "center" })
      pdf.setFontSize(12)
      pdf.text(formatCurrency(resumenCajaChica.totalGastos), margin + boxWidth + 10 + boxWidth / 2, currentY + 14, {
        align: "center",
      })

      // Utilidad
      pdf.setFillColor(245, 245, 245)
      pdf.rect(margin + 2 * boxWidth + 20, currentY, boxWidth, boxHeight, "F")
      pdf.setFontSize(10)
      pdf.text("Saldo", margin + 2 * boxWidth + 20 + boxWidth / 2, currentY + 6, { align: "center" })
      pdf.setFontSize(12)
      pdf.text(
        formatCurrency(resumenCajaChica.utilidadPerdida),
        margin + 2 * boxWidth + 20 + boxWidth / 2,
        currentY + 14,
        { align: "center" },
      )

      currentY += boxHeight + 20

      // Función para crear tabla de transacciones en PDF
      const crearTablaTransacciones = (datos, titulo, isLastTable = false) => {
        if (!datos || datos.length === 0) {
          checkPageBreak(30)
          pdf.setFontSize(14)
          pdf.setFont("helvetica", "bold")
          pdf.text(titulo, margin, currentY)
          currentY += 10

          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.text("No hay transacciones en efectivo registradas", margin, currentY)
          currentY += 15
          return
        }

        checkPageBreak(20)
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.text(titulo, margin, currentY)
        currentY += 10

        // Configurar tabla
        const headers = ["Fecha", "Cuenta", "Nota", "Gastos", "Ingresos", "Saldo"]
        const colWidths = [20, 30, 50, 22, 22, 22] // Anchos de columna en mm
        const rowHeightBase = 8
        const splitText = (text, maxWidth) => {
          return pdf.splitTextToSize(text, maxWidth)
        }

        // Headers
        checkPageBreak(rowHeightBase + 5)
        pdf.setFillColor(245, 245, 245)
        pdf.rect(margin, currentY, pageWidth - 2 * margin, rowHeightBase, "F")

        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        let xPosition = margin
        headers.forEach((header, index) => {
          pdf.text(header, xPosition + 2, currentY + 5)
          xPosition += colWidths[index]
        })
        currentY += rowHeightBase

        // Datos
        pdf.setFont("helvetica", "normal")
        datos.forEach((fila, index) => {
          const valores = [fila.fecha, fila.cuenta, fila.nota, fila.gastos, fila.ingresos, fila.saldo]

          let rowHeight = rowHeightBase
          let lineasNota = []
          if (valores[2] !== "-") {
            lineasNota = splitText(valores[2], colWidths[2] - 4)
            rowHeight = Math.max(rowHeightBase, lineasNota.length * 4 + 4)
          }

          checkPageBreak(rowHeight)

          if (index % 2 === 1) {
            pdf.setFillColor(249, 249, 249)
            pdf.rect(margin, currentY, pageWidth - 2 * margin, rowHeight, "F")
          }

          xPosition = margin

          valores.forEach((valor, colIndex) => {
            if (colIndex === 3 && valor !== "-") {
              pdf.setTextColor(139, 38, 53)
            } else if (colIndex === 4 && valor !== "-") {
              pdf.setTextColor(45, 90, 45)
            } else if (colIndex === 5) {
              pdf.setFont("helvetica", "bold")
            } else {
              pdf.setTextColor(0, 0, 0)
              pdf.setFont("helvetica", "normal")
            }
            if (colIndex >= 3) {
              pdf.text(valor.toString(), xPosition + colWidths[colIndex] - 2, currentY + 5, { align: "right" })
            } else if (colIndex === 2) {
              if (valor !== "-" && lineasNota.length > 0) {
                lineasNota.forEach((linea, i) => {
                  pdf.text(linea, xPosition + 2, currentY + 5 + (i * 4))
                })
              } else {
                pdf.text(valor.toString(), xPosition + 2, currentY + 5)
              }
            } else {
              pdf.text(valor.toString(), xPosition + 2, currentY + 5)
            }

            xPosition += colWidths[colIndex]
          })

          pdf.setTextColor(0, 0, 0)
          pdf.setFont("helvetica", "normal")
          currentY += rowHeight
        })

        if (!isLastTable) {
          currentY += 10
        }
      }

      // Agregar tablas de transacciones
      if (chunksTransacciones.length > 0) {
        chunksTransacciones.forEach((chunk, index) => {
          const titulo =
            index === 0 ? "DETALLE DE TRANSACCIONES" : `DETALLE DE TRANSACCIONES (Continuación ${index + 1})`
          const isLast = index === chunksTransacciones.length - 1
          crearTablaTransacciones(chunk, titulo, isLast)
        })
      } else {
        crearTablaTransacciones([], "DETALLE DE TRANSACCIONES", true)
      }

      const fechaArchivo = new Date().toISOString().split("T")[0]
      const nombreArchivo = `Caja_Chica_${fechaArchivo}.pdf`
      const blobUrl = pdf.output('bloburl');
      Swal.close();

      setPdfPreview({
        isOpen: true,
        url: blobUrl,
        filename: nombreArchivo
      });

    } catch (error) {
      console.error("Error al generar el reporte:", error)
      Swal.fire({
        icon: "error",
        title: "Error al generar reporte",
        text: "Ocurrió un error al generar el PDF. Por favor, inténtelo nuevamente.",
      })
    }
  }

  const handleDownloadFromPreview = () => {
    if (pdfPreview.url) {
      const link = document.createElement('a');
      link.href = pdfPreview.url;
      link.download = pdfPreview.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.fire({
        icon: "success",
        title: "Reporte descargado",
        text: `El archivo ${pdfPreview.filename} se ha guardado correctamente`,
        timer: 3000,
        showConfirmButton: false,
      });
    }
  };

  const handleClosePreview = () => {
    if (pdfPreview.url) {
      window.URL.revokeObjectURL(pdfPreview.url);
    }
    setPdfPreview({ isOpen: false, url: null, filename: "" });
  };

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="cajachica-loading">
            <div className="spinner"></div>
            <p>Cargando datos de caja chica...</p>
          </div>
        )}
        <main className="cajachica-main-content">
          <div className="cajachica-container">
            <section className="cajachica-sidebar">
              <div className="cajachica-sidebar-header">
                <h3 className="cajachica-sidebar-title">Administración</h3>
              </div>
              <div className="cajachica-sidebar-menu">
                {userRol === "ADMINISTRADOR" && modulosActivos.balance && (
                  <div className="cajachica-menu-item" onClick={() => handleMenuNavigation("balance")}>
                    Balance
                  </div>
                )}

                {modulosActivos.transacciones && (
                  <div className="cajachica-menu-item" onClick={() => handleMenuNavigation("transacciones")}>
                    Transacciones
                  </div>
                )}

                {modulosActivos.cotizaciones && (
                  <div className="cajachica-menu-item" onClick={() => handleMenuNavigation("cotizaciones")}>
                    Cotizaciones
                  </div>
                )}

                {modulosActivos.facturacion && (
                  <div className="cajachica-menu-item" onClick={() => handleMenuNavigation("facturacion")}>
                    Facturas/Notas
                  </div>
                )}

                {modulosActivos.cxc && (
                  <div className="cajachica-menu-item" onClick={() => handleMenuNavigation("cuentas-cobrar")}>
                    Cuentas por Cobrar
                  </div>
                )}

                {modulosActivos.cxp && (
                  <div className="cajachica-menu-item" onClick={() => handleMenuNavigation("cuentas-pagar")}>
                    Cuentas por Pagar
                  </div>
                )}

                {modulosActivos.transacciones && (
                  <div
                    className="cajachica-menu-item cajachica-menu-item-active"
                    onClick={() => handleMenuNavigation("caja-chica")}
                  >
                    Caja chica
                  </div>
                )}

                {modulosActivos.comisiones && (
                  <div className="transacciones-menu-item" onClick={() => handleMenuNavigation("comisiones")}>
                    Comisiones
                  </div>
                )}
              </div>
            </section>
            <section className="cajachica-content-panel">
              <div className="cajachica-header">
                <div className="cajachica-header-info">
                  <h3 className="cajachica-page-title">Caja Chica</h3>
                  <p className="cajachica-subtitle">Gestión de transacciones en Efectivo</p>
                </div>
              </div>
              <div className="cajachica-resumen-grid">
                <div className="cajachica-resumen-card cajachica-ingresos">
                  <h4 className="cajachica-resumen-titulo">Total Ingresos</h4>
                  <p className="cajachica-resumen-monto">{formatCurrency(resumenCajaChica.totalIngresos)}</p>
                </div>
                <div className="cajachica-resumen-card cajachica-gastos">
                  <h4 className="cajachica-resumen-titulo">Total Gastos</h4>
                  <p className="cajachica-resumen-monto">{formatCurrency(resumenCajaChica.totalGastos)}</p>
                </div>
                <div className="cajachica-resumen-card cajachica-utilidad">
                  <h4 className="cajachica-resumen-titulo">Saldo</h4>
                  <p className="cajachica-resumen-monto">{formatCurrency(resumenCajaChica.utilidadPerdida)}</p>
                </div>
              </div>
              <div className="cajachica-filtros-fecha">
                <div className="cajachica-filtro-grupo">
                  <label>Filtrar por cuenta:</label>
                  <select
                    value={filtroCuenta}
                    onChange={(e) => setFiltroCuenta(e.target.value)}
                    className="cajachica-select-filter"
                  >
                    <option value="">Todas las cuentas</option>
                    {cuentas.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cajachica-filtro-grupo">
                  <label>Filtro por fecha:</label>
                  <DatePicker
                    selectsRange={true}
                    startDate={fechaInicio}
                    endDate={fechaFin}
                    onChange={(update) => {
                      setRangoFechas(update);
                    }}
                    isClearable={true}
                    placeholderText="Seleccione fecha o rango"
                    dateFormat="dd/MM/yyyy"
                    customInput={<CustomDatePickerInput />}
                    locale="es"
                  />
                </div>

                <button
                  className="cajachica-btn cajachica-btn-filtro"
                  onClick={() => setRangoFechas(obtenerRangoMesActual())}
                >
                  Mes actual
                </button>

                <button
                  className="cajachica-btn cajachica-btn-filtro cajachica-btn-orden"
                  onClick={toggleOrdenFecha}
                  title={`Cambiar a orden ${ordenFecha === 'desc' ? 'ascendente' : 'descendente'}`}
                >
                  {ordenFecha === 'desc' ? '📅 ↓ Recientes primero' : '📅 ↑ Antiguas primero'}
                </button>
              </div>
              <div className="cajachica-table-card">
                <h4 className="cajachica-table-title">Transacciones en Efectivo</h4>
                <div className="cajachica-table-container">
                  <table className="cajachica-table">
                    <thead className="cajachica-table-header-fixed">
                      <tr>
                        <th>Fecha</th>
                        <th>Cuenta</th>
                        <th>Nota</th>
                        <th>Gastos</th>
                        <th>Ingresos</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transaccionesConSaldo.length > 0 ? (
                        transaccionesConSaldo.map((transaccion) => (
                          <tr key={transaccion.id}>
                            <td>{transaccion.fechaPago}</td>
                            <td>{transaccion.cuenta.nombre}</td>
                            <td>{transaccion.notas || "-"}</td>
                            <td className="cajachica-gasto">
                              {transaccion.tipo === "GASTO" ? formatCurrency(transaccion.monto) : "-"}
                            </td>
                            <td className="cajachica-ingreso">
                              {transaccion.tipo === "INGRESO" ? formatCurrency(transaccion.monto) : "-"}
                            </td>
                            <td className="cajachica-saldo">{formatCurrency(transaccion.saldoAcumulado)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="cajachica-no-data">
                            No hay transacciones en efectivo registradas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="cajachica-reporte-button-container">
                <button className="cajachica-btn cajachica-btn-reporte" onClick={handleGenerarReporte}>
                  Visualizar Reporte
                </button>
              </div>
              <PdfPreviewModal
                isOpen={pdfPreview.isOpen}
                onClose={handleClosePreview}
                pdfUrl={pdfPreview.url}
                onDownload={handleDownloadFromPreview}
              />
            </section>
          </div>
        </main>
      </div>
    </>
  )
}

export default AdminCajaChica
