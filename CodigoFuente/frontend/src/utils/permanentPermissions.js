// src/utils/permanentPermissions.js
/**
 * Permisos permanentes por rol
 * Estos permisos NO se pueden editar, eliminar ni desactivar
 */
export const PERMANENT_PERMISSIONS = {
  'Administrador': [
    { nombre_accion: 'Usuarios', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Roles', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Configuracion', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Medidores', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Sectores', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Facturas', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Afiliados', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Reportes', tipo_accion: 'operaciones crud' },

    { nombre_accion: 'Multas', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'MultasAfiliados', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Tarifas', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Servicios', tipo_accion: 'operaciones crud' },
    
    { nombre_accion: 'Geolocalizacion', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'HistorialConsumo', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Facturas_pagos', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Notificaciones', tipo_accion: 'operaciones crud' },

  ],
  'Lector': [
    { nombre_accion: 'Lecturas', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Medidores', tipo_accion: 'lectura' },
    { nombre_accion: 'Sectores', tipo_accion: 'lectura' },
    { nombre_accion: 'Afiliados', tipo_accion: 'lectura' },

    { nombre_accion: 'Geolocalizacion', tipo_accion: 'lectura' },
    { nombre_accion: 'HistorialConsumo', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Facturas_pagos', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Notificaciones', tipo_accion: 'lectura' },

  ],
  'Cajero': [
    { nombre_accion: 'Pagos', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Facturas', tipo_accion: 'lectura' },
    { nombre_accion: 'Afiliados', tipo_accion: 'lectura' },
    { nombre_accion: 'Lecturas', tipo_accion: 'lectura' },
    { nombre_accion: 'Medidores', tipo_accion: 'lectura' },

    { nombre_accion: 'HistorialConsumo', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Facturas_pagos', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Notificaciones', tipo_accion: 'lectura' },

  ],
  'Afiliado': [
    { nombre_accion: 'Geolocalizacion', tipo_accion: 'lectura' },   
    { nombre_accion: 'HistorialConsumo', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Facturas_pagos', tipo_accion: 'operaciones crud' },
    { nombre_accion: 'Notificaciones', tipo_accion: 'lectura' },
    { nombre_accion: 'Mi_Medidor', tipo_accion: 'lectura' },


  ]
};

/**
 * Verifica si una acción es permanente para un rol específico
 */
export const isPermanentPermission = (roleName, actionName, actionType) => {
  const permissions = PERMANENT_PERMISSIONS[roleName];
  if (!permissions) return false;
  
  return permissions.some(perm => 
    perm.nombre_accion === actionName && 
    perm.tipo_accion === actionType
  );
};

/**
 * Obtiene los permisos permanentes para un rol
 */
export const getPermanentPermissionsForRole = (roleName) => {
  return PERMANENT_PERMISSIONS[roleName] || [];
};
