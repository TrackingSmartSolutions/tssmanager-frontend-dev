import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "./Admin_Balance.css"
import Header from "../Header/Header"
import Swal from "sweetalert2"
import { Bar } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
import jsPDF from "jspdf"
import { API_BASE_URL } from "../Config/Config"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

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

const normalizarTexto = (texto) => {
  return texto
    .toLowerCase()
    .normalize("NFD") // Descompone caracteres con acentos
    .replace(/[\u0300-\u036f]/g, "") // Elimina los diacríticos (acentos)
    .trim()
}

// Componente Modal Base
const Modal = ({ isOpen, onClose, title, children, size = "md", closeOnOverlayClick = true }) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050
  };

  let widthStyle = '500px';
  let maxWidthStyle = '95%';

  if (size === 'lg') widthStyle = '800px';
  else if (size === 'xl') widthStyle = '950px';

  const contentStyle = {
    backgroundColor: 'white', borderRadius: '8px', padding: '20px',
    maxHeight: '95vh', overflowY: 'auto', width: widthStyle, maxWidth: maxWidthStyle,
    position: 'relative', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
  };

  return (
    <div style={overlayStyle} onClick={closeOnOverlayClick ? onClose : () => { }}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '10px', borderBottom: '1px solid #dee2e6', paddingBottom: '10px'
        }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6c757d', padding: '0 5px'
          }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Modal de Vista Previa
const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, onDownload }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vista previa" size="xl" closeOnOverlayClick={false}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button
            type="button"
            onClick={onDownload}
            className="adminbalance-btn"
            style={{
              backgroundColor: '#dc3545', color: 'white', padding: '8px 16px', border: 'none',
              borderRadius: '4px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px'
            }}
          >
            Descargar PDF
          </button>
        </div>

        <div style={{
          border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden',
          height: '75vh'
        }}>
          <iframe
            src={`${pdfUrl}#view=FitH&navpanes=0&toolbar=0`}
            title="Vista Previa"
            width="100%" height="100%" style={{ border: 'none' }}
          />
        </div>
      </div>
    </Modal>
  );
};

const AdminBalance = () => {
  const navigate = useNavigate()
  const modulosActivos = JSON.parse(localStorage.getItem("modulosActivos")) || { balance: true, transacciones: true, cotizaciones: true, facturacion: true, cxc: true, cxp: true, comisiones: true };
  const [balanceData, setBalanceData] = useState({
    resumenContable: { totalIngresos: 0, totalGastos: 0, utilidadPerdida: 0 },
    graficoMensual: [],
    acumuladoCuentas: [],
    equiposVendidos: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    añoSeleccionado: "Todos los años",
    mesSeleccionado: "Todos los meses",
    mostrarFiltroMes: false,
    cuentaSeleccionada: "Todas",
    categoriaSeleccionada: "Todas",
  })
  const [añosDisponibles, setAñosDisponibles] = useState([])
  const [mesesDisponibles] = useState([
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ])
  const [categorias, setCategorias] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [pdfPreview, setPdfPreview] = useState({
    isOpen: false,
    url: null,
    filename: ""
  });
  const CATEGORIA_REPOSICION_NORMALIZADA = normalizarTexto("Reposición")

  const esCategoriaReposicion = (descripcionCategoria) => {
    return normalizarTexto(descripcionCategoria) === CATEGORIA_REPOSICION_NORMALIZADA
  }

  const obtenerAñosConTransacciones = (transacciones) => {
    const años = transacciones
      .map(t => parseLocalDate(t.fechaPago)?.getFullYear())
      .filter(año => año !== null && año !== undefined)
      .filter((año, index, array) => array.indexOf(año) === index)
      .sort((a, b) => a - b)

    return años
  }

  const obtenerRangoFechas = (añoSeleccionado, mesSeleccionado) => {
    if (añoSeleccionado === "Todos los años") {
      // Mostrar por años desde el primer registro
      return {
        tipo: "años",
        labels: añosDisponibles.map(año => año.toString())
      }
    } else if (mesSeleccionado === "Todos los meses") {
      // Mostrar por meses del año seleccionado
      const año = parseInt(añoSeleccionado)
      return {
        tipo: "meses",
        año: año,
        labels: Array.from({ length: 12 }, (_, i) => {
          return new Date(año, i, 1).toLocaleString("es-MX", { month: "long" })
        })
      }
    } else {
      // Mostrar por días del mes seleccionado
      const año = parseInt(añoSeleccionado)
      const mesIndex = mesesDisponibles.indexOf(mesSeleccionado)
      const diasEnMes = new Date(año, mesIndex + 1, 0).getDate()

      return {
        tipo: "días",
        año: año,
        mes: mesIndex,
        labels: Array.from({ length: diasEnMes }, (_, i) => `${i + 1}`)
      }
    }
  }

  const parseLocalDate = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const filtrarTransaccionesPorFecha = (transacciones, añoSeleccionado, mesSeleccionado) => {
    return transacciones.filter(t => {
      const fechaTransaccion = parseLocalDate(t.fechaPago)
      if (!fechaTransaccion) return false

      if (añoSeleccionado === "Todos los años") {
        return true // No filtrar por fecha
      }

      const año = parseInt(añoSeleccionado)
      if (fechaTransaccion.getFullYear() !== año) {
        return false
      }

      if (mesSeleccionado === "Todos los meses") {
        return true // Solo filtrar por año
      }

      const mesIndex = mesesDisponibles.indexOf(mesSeleccionado)
      return fechaTransaccion.getMonth() === mesIndex
    })
  }

  const generarDatosGrafico = (transacciones, añoSeleccionado, mesSeleccionado) => {
    const { tipo, labels, año, mes } = obtenerRangoFechas(añoSeleccionado, mesSeleccionado)

    if (tipo === "años") {
      return añosDisponibles.map(añoActual => {
        const ingresos = transacciones
          .filter(t => t.tipo === "INGRESO")
          .filter(t => parseLocalDate(t.fechaPago)?.getFullYear() === añoActual)
          .reduce((sum, t) => sum + t.monto, 0)

        const gastos = transacciones
          .filter(t => t.tipo === "GASTO" && t.notas?.includes("Transacción generada desde Cuentas por Pagar"))
          .filter(t => parseLocalDate(t.fechaPago)?.getFullYear() === añoActual)
          .reduce((sum, t) => sum + t.monto, 0)

        return { mes: añoActual.toString(), ingresos, gastos }
      })
    }

    if (tipo === "meses") {
      return Array.from({ length: 12 }, (_, i) => {
        const ingresos = transacciones
          .filter(t => t.tipo === "INGRESO")
          .filter(t => {
            const fechaTransaccion = parseLocalDate(t.fechaPago)
            return fechaTransaccion?.getMonth() === i && fechaTransaccion?.getFullYear() === año
          })
          .reduce((sum, t) => sum + t.monto, 0)

        const gastos = transacciones
          .filter(t => t.tipo === "GASTO" && t.notas?.includes("Transacción generada desde Cuentas por Pagar"))
          .filter(t => {
            const fechaTransaccion = parseLocalDate(t.fechaPago)
            return fechaTransaccion?.getMonth() === i && fechaTransaccion?.getFullYear() === año
          })
          .reduce((sum, t) => sum + t.monto, 0)

        return { mes: labels[i], ingresos, gastos }
      })
    }

    if (tipo === "días") {
      const diasEnMes = new Date(año, mes + 1, 0).getDate()
      return Array.from({ length: diasEnMes }, (_, i) => {
        const dia = i + 1
        const ingresos = transacciones
          .filter(t => t.tipo === "INGRESO")
          .filter(t => {
            const fechaTransaccion = parseLocalDate(t.fechaPago)
            return fechaTransaccion?.getDate() === dia &&
              fechaTransaccion?.getMonth() === mes &&
              fechaTransaccion?.getFullYear() === año
          })
          .reduce((sum, t) => sum + t.monto, 0)

        const gastos = transacciones
          .filter(t => t.tipo === "GASTO" && t.notas?.includes("Transacción generada desde Cuentas por Pagar"))
          .filter(t => {
            const fechaTransaccion = parseLocalDate(t.fechaPago)
            return fechaTransaccion?.getDate() === dia &&
              fechaTransaccion?.getMonth() === mes &&
              fechaTransaccion?.getFullYear() === año
          })
          .reduce((sum, t) => sum + t.monto, 0)

        return { mes: dia.toString(), ingresos, gastos }
      })
    }

    return []
  }

  const fetchData = async () => {
    setIsLoading(true)
    try {
      let params = new URLSearchParams();

      if (filtros.añoSeleccionado !== "Todos los años") {
        params.append("anio", filtros.añoSeleccionado);
      }

      if (filtros.mostrarFiltroMes && filtros.mesSeleccionado !== "Todos los meses") {
        const mesNumero = mesesDisponibles.indexOf(filtros.mesSeleccionado) + 1;
        params.append("mes", mesNumero);
      }

      const data = await fetchWithToken(`${API_BASE_URL}/balance/resumen?${params.toString()}`);

      if (filtros.añoSeleccionado === "Todos los años" && data.graficoMensual) {
        data.graficoMensual.sort((a, b) => parseInt(a.mes) - parseInt(b.mes));
      }

      setBalanceData({
        resumenContable: {
          totalIngresos: data.totalIngresos,
          totalGastos: data.totalGastos,
          utilidadPerdida: data.utilidadPerdida
        },
        graficoMensual: data.graficoMensual,
        acumuladoCuentas: data.acumuladoCuentas,
        equiposVendidos: data.equiposVendidos,
      });

      // Actualizamos años solo si es necesario
      if (data.aniosDisponibles && data.aniosDisponibles.length > 0) {
        setAñosDisponibles(data.aniosDisponibles);
      }

      // Cargar categorías y cuentas solo si no se han cargado antes
      if (categorias.length === 0) {
        const [catResp, cuenResp] = await Promise.all([
          fetchWithToken(`${API_BASE_URL}/categorias`),
          fetchWithToken(`${API_BASE_URL}/cuentas`)
        ]);
        setCategorias(catResp);
        setCuentas(cuenResp);
      }

    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los datos optimizados: " + error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (añosDisponibles.length > 0 || (filtros.añoSeleccionado === "Todos los años" && añosDisponibles.length === 0)) {
      fetchData()
    }
  }, [filtros.añoSeleccionado, filtros.mesSeleccionado, añosDisponibles.length])

  const handleAñoChange = (nuevoAño) => {
    if (nuevoAño === "Todos los años") {
      setFiltros(prev => ({
        ...prev,
        añoSeleccionado: nuevoAño,
        mesSeleccionado: "Todos los meses",
        mostrarFiltroMes: false
      }))
    } else {
      setFiltros(prev => ({
        ...prev,
        añoSeleccionado: nuevoAño,
        mesSeleccionado: "Todos los meses",
        mostrarFiltroMes: true
      }))
    }
  }

  const handleMesChange = (nuevoMes) => {
    setFiltros(prev => ({ ...prev, mesSeleccionado: nuevoMes }))
  }

  const handleCuentaChange = (nuevaCuenta) => {
    setFiltros((prev) => ({ ...prev, cuentaSeleccionada: nuevaCuenta }))
  }

  const handleCategoriaChange = (nuevaCategoria) => {
    setFiltros((prev) => ({
      ...prev,
      categoriaSeleccionada: nuevaCategoria,
      cuentaSeleccionada: "Todas"
    }))
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount)
  }

  const dividirTablaEnChunks = (datos, filasPorPagina = 25) => {
    const chunks = []
    for (let i = 0; i < datos.length; i += filasPorPagina) {
      chunks.push(datos.slice(i, i + filasPorPagina))
    }
    return chunks
  }

  const crearTablaHTML = (datos, headers, titulo, esUltimaTabla = false) => {
    if (!datos || datos.length === 0) {
      return `
        <div style="margin-bottom: ${esUltimaTabla ? "20px" : "40px"}; page-break-inside: avoid;">
          <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">${titulo}</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                ${headers.map((header) => `<th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">${header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="${headers.length}" style="border: 1px solid #ddd; padding: 20px; text-align: center; color: #666;">
                  No hay datos disponibles
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `
    }

    return `
      <div style="margin-bottom: ${esUltimaTabla ? "20px" : "40px"}; page-break-inside: avoid;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">${titulo}</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              ${headers.map((header) => `<th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">${header}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${datos
        .map(
          (fila, index) => `
              <tr style="background-color: ${index % 2 === 0 ? "#ffffff" : "#f9f9f9"}; page-break-inside: avoid;">
                ${Object.values(fila)
              .map((valor) => `<td style="border: 1px solid #ddd; padding: 8px;">${valor}</td>`)
              .join("")}
              </tr>
            `,
        )
        .join("")}
          </tbody>
        </table>
      </div>
    `
  }

  const handleGenerarReporte = async () => {
    try {
      Swal.fire({
        title: "Generando reporte...",
        text: "Por favor espere mientras se genera el PDF",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        },
      })

      // Capturar el gráfico primero
      let graficoImageData = ""
      const chartCanvas = document.querySelector(".adminbalance-chart-container canvas")
      if (chartCanvas) {
        graficoImageData = chartCanvas.toDataURL("image/png", 1.0)
      }

      const acumuladoFiltrado = balanceData.acumuladoCuentas
        .filter((ac) => filtros.categoriaSeleccionada === "Todas" || ac.categoria === filtros.categoriaSeleccionada)
        .filter((ac) => filtros.cuentaSeleccionada === "Todas" || ac.cuenta === filtros.cuentaSeleccionada)
        .sort((a, b) => {
          const comparacionCategoria = a.categoria.localeCompare(b.categoria);
          if (comparacionCategoria !== 0) return comparacionCategoria;

          return a.cuenta.localeCompare(b.cuenta);
        })
        .map((ac) => ({
          categoria: ac.categoria,
          cuenta: ac.cuenta,
          monto: formatCurrency(ac.monto),
        }))

      const equiposRealesParaPDF = balanceData.equiposVendidos.filter((equipo) => {
        return equipo.numeroEquipos > 0;
      });

      const equiposFormateados = equiposRealesParaPDF.map((equipo) => ({
        cliente: equipo.cliente,
        fecha: equipo.fechaPago,
        equipos: equipo.numeroEquipos.toString(),
      }))

      const chunksAcumulado = dividirTablaEnChunks(acumuladoFiltrado, 20)
      const chunksEquipos = dividirTablaEnChunks(equiposFormateados, 20)

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
      pdf.text("REPORTE DE BALANCE", pageWidth / 2, currentY, { align: "center" })
      currentY += 10

      pdf.setFontSize(12)
      pdf.setFont("helvetica", "normal")
      pdf.text(`Fecha de generación: ${fechaActual}`, pageWidth / 2, currentY, { align: "center" })
      currentY += 6
      pdf.text(`Período: ${obtenerTituloGrafico()}`, pageWidth / 2, currentY, { align: "center" })
      currentY += 15

      // Resumen contable
      checkPageBreak(40)
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("RESUMEN CONTABLE", margin, currentY)
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
      pdf.text(formatCurrency(balanceData.resumenContable.totalIngresos), margin + boxWidth / 2, currentY + 14, {
        align: "center",
      })

      // Total Gastos
      pdf.setFillColor(255, 232, 232)
      pdf.rect(margin + boxWidth + 10, currentY, boxWidth, boxHeight, "F")
      pdf.setFontSize(10)
      pdf.text("Total Gastos", margin + boxWidth + 10 + boxWidth / 2, currentY + 6, { align: "center" })
      pdf.setFontSize(12)
      pdf.text(
        formatCurrency(balanceData.resumenContable.totalGastos),
        margin + boxWidth + 10 + boxWidth / 2,
        currentY + 14,
        { align: "center" },
      )

      // Utilidad
      pdf.setFillColor(245, 245, 245)
      pdf.rect(margin + 2 * boxWidth + 20, currentY, boxWidth, boxHeight, "F")
      pdf.setFontSize(10)
      pdf.text("Utilidad", margin + 2 * boxWidth + 20 + boxWidth / 2, currentY + 6, { align: "center" })
      pdf.setFontSize(12)
      pdf.text(
        formatCurrency(balanceData.resumenContable.utilidadPerdida),
        margin + 2 * boxWidth + 20 + boxWidth / 2,
        currentY + 14,
        { align: "center" },
      )

      currentY += boxHeight + 20

      // Agregar gráfico si existe
      if (graficoImageData) {
        checkPageBreak(80)
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.text(obtenerTituloGrafico().toUpperCase(), margin, currentY)
        currentY += 10

        const imgWidth = pageWidth - 2 * margin
        const imgHeight = 60
        checkPageBreak(imgHeight)

        pdf.addImage(graficoImageData, "PNG", margin, currentY, imgWidth, imgHeight)
        currentY += imgHeight + 15
      }

      // Función para crear tabla en PDF
      const crearTablaPDF = (datos, headers, titulo, isLastTable = false, mostrarContinuacion = false) => {
        if (!datos || datos.length === 0) {
          checkPageBreak(30)
          pdf.setFontSize(14)
          pdf.setFont("helvetica", "bold")
          pdf.text(titulo, margin, currentY)
          currentY += 10

          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.text("No hay datos disponibles", margin, currentY)
          currentY += 15
          return false
        }

        const nuevaPagina = checkPageBreak(20)

        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        const tituloFinal = (mostrarContinuacion && nuevaPagina) ? `${titulo} (Continuación)` : titulo
        pdf.text(tituloFinal, margin, currentY)
        currentY += 10

        const colWidth = (pageWidth - 2 * margin) / headers.length
        const rowHeight = 8

        checkPageBreak(rowHeight + 5)
        pdf.setFillColor(245, 245, 245)
        pdf.rect(margin, currentY, pageWidth - 2 * margin, rowHeight, "F")

        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        headers.forEach((header, index) => {
          pdf.text(header, margin + index * colWidth + 2, currentY + 5)
        })
        currentY += rowHeight

        pdf.setFont("helvetica", "normal")
        datos.forEach((fila, index) => {
          checkPageBreak(rowHeight)

          if (index % 2 === 1) {
            pdf.setFillColor(249, 249, 249)
            pdf.rect(margin, currentY, pageWidth - 2 * margin, rowHeight, "F")
          }

          Object.values(fila).forEach((valor, colIndex) => {
            pdf.text(valor.toString(), margin + colIndex * colWidth + 2, currentY + 5)
          })
          currentY += rowHeight
        })

        if (!isLastTable) {
          currentY += 10
        }

        return nuevaPagina
      }

      if (acumuladoFiltrado.length > 0) {
        crearTablaPDF(acumuladoFiltrado, ["Categoría", "Cuenta", "Monto"], "ACUMULADO DE CUENTAS")
      } else {
        crearTablaPDF([], ["Categoría", "Cuenta", "Monto"], "ACUMULADO DE CUENTAS")
      }

      if (equiposFormateados.length > 0) {
        crearTablaPDF(equiposFormateados, ["Cliente", "Fecha", "N° Equipos"], "EQUIPOS VENDIDOS", true)
      } else {
        crearTablaPDF([], ["Cliente", "Fecha", "N° Equipos"], "EQUIPOS VENDIDOS", true)
      }

      const fechaArchivo = new Date().toISOString().split("T")[0]
      const nombreArchivo = `Balance_${fechaArchivo}.pdf`

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

  const obtenerTituloGrafico = () => {
    if (filtros.añoSeleccionado === "Todos los años") {
      return "Balance por años"
    } else if (filtros.mesSeleccionado === "Todos los meses") {
      return `Balance del año ${filtros.añoSeleccionado}`
    } else {
      return `Balance de ${filtros.mesSeleccionado} ${filtros.añoSeleccionado}`
    }
  }

  const graficoBalanceData =
    balanceData.graficoMensual.length > 0
      ? {
        labels: balanceData.graficoMensual.map((item) => item.mes),
        datasets: [
          {
            label: "Ingresos",
            data: balanceData.graficoMensual.map((item) => item.ingresos),
            backgroundColor: "#4CAF50",
            borderColor: "#4CAF50",
            borderWidth: 1,
          },
          {
            label: "Gastos",
            data: balanceData.graficoMensual.map((item) => item.gastos),
            backgroundColor: "#f44336",
            borderColor: "#f44336",
            borderWidth: 1,
          },
        ],
      }
      : { labels: [], datasets: [] }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { usePointStyle: true, padding: 20, font: { size: 12 } } },
    },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 500 } } },
  }

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
      case "facturas-notas":
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

  const cuentasPorCategoria = categorias
    .filter(cat => !esCategoriaReposicion(cat.descripcion))
    .reduce(
      (acc, cat) => {
        acc[cat.descripcion] = [
          "Todas",
          ...cuentas.filter((c) => c.categoria.id === cat.id && !esCategoriaReposicion(c.categoria.descripcion)).map((c) => c.nombre),
        ]
        return acc
      },
      { Todas: ["Todas"] },
    )

  const categoriasExcluidas = ['renta mensual', 'renta anual', 'revisiones', 'revision'];

  const equiposVendidosReales = balanceData.equiposVendidos.filter((equipo) => {
    return equipo.numeroEquipos > 0;
  });

  return (
    <>
      <div className="page-with-header">
        <Header />
        {isLoading && (
          <div className="adminbalance-loading">
            <div className="spinner"></div>
            <p>Cargando datos del balance...</p>
          </div>
        )}
        <main className="adminbalance-main-content">
          <div className="adminbalance-container">
            <section className="adminbalance-sidebar">
              <div className="adminbalance-sidebar-header">
                <h3 className="adminbalance-sidebar-title">Administración</h3>
              </div>
              <div className="adminbalance-sidebar-menu">
                {modulosActivos.balance && (
                  <div className="adminbalance-menu-item adminbalance-menu-item-active" onClick={() => handleMenuNavigation("balance")}>
                    Balance
                  </div>
                )}

                {modulosActivos.transacciones && (
                  <div className="adminbalance-menu-item" onClick={() => handleMenuNavigation("transacciones")}>
                    Transacciones
                  </div>
                )}

                {modulosActivos.cotizaciones && (
                  <div className="adminbalance-menu-item" onClick={() => handleMenuNavigation("cotizaciones")}>
                    Cotizaciones
                  </div>
                )}

                {modulosActivos.facturacion && (
                  <div className="adminbalance-menu-item" onClick={() => handleMenuNavigation("facturas-notas")}>
                    Facturas/Notas
                  </div>
                )}

                {modulosActivos.cxc && (
                  <div className="adminbalance-menu-item" onClick={() => handleMenuNavigation("cuentas-cobrar")}>
                    Cuentas por Cobrar
                  </div>
                )}

                {modulosActivos.cxp && (
                  <div className="adminbalance-menu-item" onClick={() => handleMenuNavigation("cuentas-pagar")}>
                    Cuentas por Pagar
                  </div>
                )}

                {modulosActivos.transacciones && (
                  <div className="adminbalance-menu-item" onClick={() => handleMenuNavigation("caja-chica")}>
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
            <section className="adminbalance-content-panel">
              <div className="adminbalance-header">
                <h3 className="adminbalance-page-title">Balance</h3>
                <div className="adminbalance-header-actions">
                  <div className="adminbalance-filtros-tiempo">
                    <div className="adminbalance-filtro-año">
                      <select
                        value={filtros.añoSeleccionado}
                        onChange={(e) => handleAñoChange(e.target.value)}
                        className="adminbalance-filtro-select"
                      >
                        <option value="Todos los años">Todos los años</option>
                        {añosDisponibles.map((año) => (
                          <option key={año} value={año.toString()}>
                            {año}
                          </option>
                        ))}
                      </select>
                    </div>
                    {filtros.mostrarFiltroMes && (
                      <div className="adminbalance-filtro-mes">
                        <select
                          value={filtros.mesSeleccionado}
                          onChange={(e) => handleMesChange(e.target.value)}
                          className="adminbalance-filtro-select"
                        >
                          <option value="Todos los meses">Todos los meses</option>
                          {mesesDisponibles.map((mes) => (
                            <option key={mes} value={mes}>
                              {mes}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="adminbalance-subtitle">Gestión de ingresos y generación de reportes contables</p>
              <div className="adminbalance-resumen-grid">
                <div className="adminbalance-resumen-card adminbalance-ingresos">
                  <h4 className="adminbalance-resumen-titulo">Total Ingresos</h4>
                  <p className="adminbalance-resumen-monto">
                    ${balanceData.resumenContable.totalIngresos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="adminbalance-resumen-card adminbalance-gastos">
                  <h4 className="adminbalance-resumen-titulo">Total Gastos</h4>
                  <p className="adminbalance-resumen-monto">
                    ${balanceData.resumenContable.totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="adminbalance-resumen-card adminbalance-utilidad">
                  <h4 className="adminbalance-resumen-titulo">Utilidad o Pérdida</h4>
                  <p className="adminbalance-resumen-monto">
                    ${balanceData.resumenContable.utilidadPerdida.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {balanceData.graficoMensual.length > 0 && (
                <div className="adminbalance-chart-card">
                  <h4 className="adminbalance-chart-title">{obtenerTituloGrafico()}</h4>
                  <div className="adminbalance-chart-container">
                    <Bar data={graficoBalanceData} options={chartOptions} />
                  </div>
                </div>
              )}
              <div className="adminbalance-tables-grid">
                <div className="adminbalance-table-card">
                  <h4 className="adminbalance-table-title">Acumulado de Cuentas</h4>
                  <div className="adminbalance-table-filters">
                    <select
                      value={filtros.categoriaSeleccionada}
                      onChange={(e) => handleCategoriaChange(e.target.value)}
                      className="adminbalance-table-select"
                    >
                      <option value="Todas">Todas</option>
                      {categorias
                        .filter((cat) => !esCategoriaReposicion(cat.descripcion))
                        .map((cat) => (
                          <option key={cat.id} value={cat.descripcion}>
                            {cat.descripcion}
                          </option>
                        ))}
                    </select>
                    <select
                      value={filtros.cuentaSeleccionada}
                      onChange={(e) => handleCuentaChange(e.target.value)}
                      className="adminbalance-table-select"
                    >
                      {cuentasPorCategoria[filtros.categoriaSeleccionada || "Todas"].map((cuenta) => (
                        <option key={cuenta} value={cuenta}>
                          {cuenta}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="adminbalance-table-container">
                    <table className="adminbalance-table">
                      <thead>
                        <tr>
                          <th>Categoría</th>
                          <th>Cuenta</th>
                          <th>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceData.acumuladoCuentas.length > 0 ? (
                          balanceData.acumuladoCuentas
                            .filter((ac) =>
                              filtros.categoriaSeleccionada === "Todas" ||
                              ac.categoria === filtros.categoriaSeleccionada
                            )
                            .filter((ac) =>
                              filtros.cuentaSeleccionada === "Todas" ||
                              ac.cuenta === filtros.cuentaSeleccionada
                            )
                            .sort((a, b) => {
                              const catCompare = a.categoria.localeCompare(b.categoria);
                              if (catCompare !== 0) return catCompare;

                              return a.cuenta.localeCompare(b.cuenta);
                            })
                            .map((ac, index) => (
                              <tr key={index}>
                                <td>{ac.categoria}</td>
                                <td>{ac.cuenta}</td>
                                <td>${Number(ac.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="adminbalance-no-data">
                              No hay datos disponibles
                            </td>
                          </tr>
                        )}

                        {balanceData.acumuladoCuentas.length > 0 && (
                          <tr className="adminbalance-total-row" style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                            <td colSpan="2" style={{ textAlign: 'right', paddingRight: '10px' }}>TOTAL FILTRADO:</td>
                            <td>
                              ${balanceData.acumuladoCuentas
                                .filter((ac) => filtros.categoriaSeleccionada === "Todas" || ac.categoria === filtros.categoriaSeleccionada)
                                .filter((ac) => filtros.cuentaSeleccionada === "Todas" || ac.cuenta === filtros.cuentaSeleccionada)
                                .reduce((sum, item) => sum + Number(item.monto), 0)
                                .toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="adminbalance-table-card">
                  <h4 className="adminbalance-table-title">Equipos vendidos</h4>
                  <div className="adminbalance-table-container">
                    <table className="adminbalance-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Fecha</th>
                          <th>N° Equipos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equiposVendidosReales.length > 0 ? (
                          equiposVendidosReales.map((equipo, index) => (
                            <tr key={index}>
                              <td>{equipo.cliente}</td>
                              <td>{equipo.fechaPago}</td>
                              <td>{equipo.numeroEquipos}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="adminbalance-no-data">
                              No hay equipos vendidos
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="adminbalance-reporte-button-container">
                <button className="adminbalance-btn adminbalance-btn-reporte" onClick={handleGenerarReporte}>
                  Visualizar reporte
                </button>
              </div>
            </section>
          </div>
          <PdfPreviewModal
            isOpen={pdfPreview.isOpen}
            onClose={handleClosePreview}
            pdfUrl={pdfPreview.url}
            onDownload={handleDownloadFromPreview}
          />
        </main>
      </div>
    </>
  )
}

export default AdminBalance
