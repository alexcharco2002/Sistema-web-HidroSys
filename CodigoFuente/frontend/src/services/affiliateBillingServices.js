/**
 * src/services/affiliateBillingServices.js
 * Servicio para gestión de facturas y pagos de afiliados
 */

import authService from './authServices';

const API_CONFIG = {
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  endpoints: {
    misFacturas: '/afiliados/mis-facturas',
    periodosFacturasDisponibles: '/afiliados/periodos-facturas-disponibles',
    detalleFactura: '/afiliados/factura',
    estadisticasFacturas: '/afiliados/estadisticas-facturas',

    subirComprobante: '/afiliados/subir-comprobante',
    misPagos: '/afiliados/mis-pagos',
    descargarFactura: '/afiliados/descargar-factura',
    paypalConfig: '/afiliados/paypal/config',
    paypalCrearOrden: '/afiliados/paypal/crear-orden',
    paypalCapturarOrden: '/afiliados/paypal/capturar-orden',
    guardarComprobantePago: '/afiliados/comprobante'
  }
};

class AffiliateBillingServices {
  constructor() {
    this.cachedPeriodosFacturas = null;
  }

  /**
   * Realizar petición HTTPS con configuración común
   */
 async makeRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    const method = options.method || 'GET';

    const defaultOptions = {
        method,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${authService.getToken()}`
        },
        timeout: 50000,
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);

        const response = await fetch(url, {
            ...finalOptions,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let errorMessage = '';

            if (typeof errorData.detail === 'string') {
                errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
                errorMessage = errorData.detail.map(err => err.msg).join(', ');
            } else {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('La petición tardó demasiado tiempo');
        }

        console.error('Error en solicitud de facturas y pagos:', error);

        if (error.message.includes('Failed to fetch')) {
            throw new Error('No se pudo conectar con el servidor');
        }

        throw error;
    }
}

  // ============================================================
  // MÉTODOS DE FACTURAS
  // ============================================================

  /**
   * Obtener años y meses disponibles con facturas
   */
  async getPeriodosFacturasDisponibles() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.periodosFacturasDisponibles);
      this.cachedPeriodosFacturas = data;
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error al obtener periodos de facturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener periodos disponibles'
      };
    }
  }

  /**
   * Obtener facturas filtradas por año y mes
   * @param {number} anio - Año (opcional)
   * @param {number} mes - Mes 1-12 (opcional)
   * @param {object} filtrosAdicionales - Filtros adicionales
   */
  async getMisFacturasPorPeriodo(anio = null, mes = null, filtrosAdicionales = {}) {
    try {
      const params = new URLSearchParams();
      
      if (anio) params.append('anio', anio);
      if (mes) params.append('mes', mes);
      
      // Filtros adicionales
      if (filtrosAdicionales.estado_pago && filtrosAdicionales.estado_pago !== 'todos') {
        params.append('estado_pago', filtrosAdicionales.estado_pago);
      }

      const estadoFactura = filtrosAdicionales.estado_factura || filtrosAdicionales.estadofactura;
      if (estadoFactura && estadoFactura !== 'todos') {
        params.append('estado_factura', estadoFactura);
      }

      if (filtrosAdicionales.monto_min) {
        params.append('monto_min', filtrosAdicionales.monto_min);
      }

      if (filtrosAdicionales.monto_max) {
        params.append('monto_max', filtrosAdicionales.monto_max);
      }
      
      const queryString = params.toString();
      const url = queryString 
        ? `${API_CONFIG.endpoints.misFacturas}?${queryString}`
        : API_CONFIG.endpoints.misFacturas;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error al obtener facturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener tus facturas'
      };
    }
  }

  /**
   * Obtener detalle completo de una factura específica
   * @param {number} idFactura - ID de la factura
   */
  async getDetalleFactura(idFactura) {
    try {
      const url = `${API_CONFIG.endpoints.detalleFactura}/${idFactura}`;
      const data = await this.makeRequest(url);

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error al obtener detalle de factura:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener el detalle de la factura'
      };
    }
  }

  /**
   * Obtener estadísticas generales de facturas del afiliado
   */
  async getEstadisticasFacturas() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.estadisticasFacturas);

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error al obtener estadisticas de facturas:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener estadísticas'
      };
    }
  }

  async getPaypalConfig() {
    try {
      const data = await this.makeRequest(API_CONFIG.endpoints.paypalConfig);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error al obtener configuración de PayPal'
      };
    }
  }

  async crearOrdenPaypal(idFactura) {
    try {
      const data = await this.makeRequest(
        `${API_CONFIG.endpoints.paypalCrearOrden}/${idFactura}`,
        { method: 'POST' }
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error al crear la orden de PayPal'
      };
    }
  }

  async capturarOrdenPaypal(orderId) {
    try {
      const data = await this.makeRequest(
        `${API_CONFIG.endpoints.paypalCapturarOrden}/${orderId}`,
        { method: 'POST' }
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error al capturar el pago de PayPal'
      };
    }
  }

  async guardarComprobantePago(idPago, archivo) {
    try {
      if (!archivo || archivo.type !== 'application/pdf') {
        throw new Error('El comprobante debe ser un PDF');
      }

      const maxSize = 5 * 1024 * 1024;
      if (archivo.size > maxSize) {
        throw new Error('El archivo no debe superar los 5MB');
      }

      const formData = new FormData();
      formData.append('comprobante', archivo);

      const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.guardarComprobantePago}/${idPago}/pdf`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error al guardar comprobante:', error);
      return {
        success: false,
        message: error.message || 'Error al guardar el comprobante'
      };
    }
  }

  /**
   * Descargar PDF de una factura específica
   * @param {number} idFactura - ID de la factura
   */
  async descargarFacturaPDF(idFactura) {
    try {
      const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.descargarFactura}/${idFactura}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `factura_${idFactura}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return {
        success: true,
        filename
      };
      
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      return {
        success: false,
        message: error.message || 'Error al descargar la factura'
      };
    }
  }

  // ============================================================
  // MÉTODOS DE PAGOS
  // ============================================================

  /**
   * Obtener historial de pagos del afiliado
   * @param {number} anio - Año (opcional)
   * @param {number} mes - Mes 1-12 (opcional)
   */
  async getMisPagos(anio = null, mes = null) {
    try {
      const params = new URLSearchParams();
      
      if (anio) params.append('anio', anio);
      if (mes) params.append('mes', mes);
      
      const queryString = params.toString();
      const url = queryString 
        ? `${API_CONFIG.endpoints.misPagos}?${queryString}`
        : API_CONFIG.endpoints.misPagos;

      const data = await this.makeRequest(url);

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error al obtener pagos:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener tus pagos'
      };
    }
  }

  /**
   * Subir comprobante de pago
   * @param {number} idFactura - ID de la factura
   * @param {File} archivo - Archivo del comprobante (imagen o PDF)
   * @param {Function} onProgress - Callback para progreso de subida (opcional)
   * @param {object} datosPago - Información adicional del pago (opcional)
   */
  async subirComprobantePago(idFactura, archivo, onProgress = null, datosPago = {}) {
    try {
      // Validar archivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(archivo.type)) {
        throw new Error('Tipo de archivo no permitido. Solo se aceptan JPG, PNG o PDF');
      }

      // Validar tamaño (5MB máximo)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (archivo.size > maxSize) {
        throw new Error('El archivo no debe superar los 5MB');
      }

      const formData = new FormData();
      formData.append('comprobante', archivo);
      formData.append('id_factura', idFactura);

      // Agregar datos adicionales del pago si existen
      if (datosPago.monto) {
        formData.append('monto', datosPago.monto);
      }
      if (datosPago.fecha_pago) {
        formData.append('fecha_pago', datosPago.fecha_pago);
      }
      if (datosPago.metodo_pago) {
        formData.append('metodo_pago', datosPago.metodo_pago);
      }
      if (datosPago.referencia) {
        formData.append('referencia', datosPago.referencia);
      }
      if (datosPago.observacion) {
        formData.append('observacion', datosPago.observacion);
      }

      const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.subirComprobante}`;
      
      // Usar XMLHttpRequest para tener progreso de subida
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        // Evento de progreso de subida
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            onProgress(percentComplete);
          }
        });

        // Evento de carga completada
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({
                success: true,
                data: response
              });
            } catch (e) {
              reject(new Error('Error al procesar la respuesta del servidor'));
            }
          } else {
            let errorMessage = 'Error al subir el comprobante';
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
              errorMessage = `Error ${xhr.status}: ${xhr.statusText}`;
            }
            reject(new Error(errorMessage));
          }
        });

        // Evento de error de red
        xhr.addEventListener('error', () => {
          reject(new Error('Error de red al subir el comprobante'));
        });

        // Evento de cancelación
        xhr.addEventListener('abort', () => {
          reject(new Error('Subida cancelada'));
        });

        // Configurar y enviar la petición
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${authService.getToken()}`);
        xhr.send(formData);
      });

    } catch (error) {
      console.error('Error al subir comprobante:', error);
      return {
        success: false,
        message: error.message || 'Error al subir el comprobante'
      };
    }
  }

  /**
   * Descargar comprobante de pago
   * @param {number} idPago - ID del pago
   */
  async descargarComprobante(idPago) {
    try {
      const url = `${API_CONFIG.baseURL}/afiliados/comprobante/${idPago}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `comprobante_${idPago}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return {
        success: true,
        filename
      };
      
    } catch (error) {
      console.error('Error al descargar comprobante:', error);
      return {
        success: false,
        message: error.message || 'Error al descargar el comprobante'
      };
    }
  }

  // ============================================================
  // MÉTODOS DE UTILIDAD
  // ============================================================

  /**
   * Obtener nombre del mes en español
   */
  getNombreMes(mes) {
    const meses = {
      1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
      5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
      9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    };
    return meses[mes] || `Mes ${mes}`;
  }

  /**
   * Formatear periodo para mostrar (ej: "Diciembre 2025")
   */
  formatearPeriodo(mes, anio) {
    return `${this.getNombreMes(mes)} ${anio}`;
  }

  /**
   * Formatear moneda en USD
   */
  formatearMoneda(monto) {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(monto || 0);
  }

  /**
   * Formatear fecha en formato largo
   */
  formatearFecha(fechaString) {
    if (!fechaString) return 'N/A';
    return new Date(fechaString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Formatear fecha en formato corto
   */
  formatearFechaCorta(fechaString) {
    if (!fechaString) return 'N/A';
    return new Date(fechaString + 'T00:00:00').toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Determinar si una factura está vencida
   */
  esFacturaVencida(fechaVencimiento, estadoPago) {
    if (estadoPago === 'pagada') return false;
    if (!fechaVencimiento) return false;
    
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento + 'T00:00:00');
    
    return vencimiento < hoy;
  }

  /**
   * Calcular días hasta el vencimiento
   */
  diasHastaVencimiento(fechaVencimiento) {
    if (!fechaVencimiento) return null;
    
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento + 'T00:00:00');
    
    const diferenciaMilisegundos = vencimiento - hoy;
    const dias = Math.ceil(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
    
    return dias;
  }

  /**
   * Obtener texto descriptivo del estado de vencimiento
   */
  getTextoVencimiento(fechaVencimiento, estadoPago) {
    if (estadoPago === 'pagada') return 'Pagada';
    
    const dias = this.diasHastaVencimiento(fechaVencimiento);
    
    if (dias === null) return 'Sin fecha de vencimiento';
    if (dias < 0) return `Vencida hace ${Math.abs(dias)} días`;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    if (dias <= 7) return `Vence en ${dias} días`;
    if (dias <= 30) return `Vence en ${dias} días`;
    
    return this.formatearFechaCorta(fechaVencimiento);
  }

  /**
   * Validar archivo antes de subir
   */
  validarArchivo(archivo) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!archivo) {
      return { valido: false, mensaje: 'Debes seleccionar un archivo' };
    }

    if (!allowedTypes.includes(archivo.type)) {
      return { 
        valido: false, 
        mensaje: 'Tipo de archivo no permitido. Solo se aceptan JPG, PNG o PDF' 
      };
    }

    if (archivo.size > maxSize) {
      return { 
        valido: false, 
        mensaje: 'El archivo no debe superar los 5MB' 
      };
    }

    return { valido: true, mensaje: 'Archivo válido' };
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.cachedPeriodosFacturas = null;
  }
}

const affiliateBillingServices = new AffiliateBillingServices();
export default affiliateBillingServices;
export { AffiliateBillingServices };
