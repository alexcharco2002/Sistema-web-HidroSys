# utils/facturacion.py

import re
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models.factura import Factura
from models.detalle_factura import DetalleFactura
from models.tarifa import Tarifa
from models.lectura import Lectura
from models.meter import Medidor
from models.servicio import Servicio
from models.multa_afiliado import MultaAfiliado
from decimal import Decimal
from datetime import date
from typing import Dict, Optional, Tuple, List

def crear_detalle_factura_multa(
    db: Session,
    id_factura: int,
    multa: MultaAfiliado
):
    """
    Crea un detalle de factura para una multa
    """

    detalle = DetalleFactura(
        id_factura=id_factura,
        id_servicio=None,                     
        id_multa_afiliados=multa.id_multa_afi,
        subtotal_detalle=multa.monto,
        descripcion=f"Multa: {multa.tipo_multa.nombre_multa}",
        tipo_detalle="MULTA"
    )

    db.add(detalle)
    return detalle


def calcular_tarifa_cargo_fijo(
    db: Session,
    consumo_m3: float,
    fecha_referencia: date = None
) -> Tuple[Optional[Tarifa], Optional[Tarifa], Decimal, Decimal, float]:
    """
    Calcula tarifa con cargo fijo básico + exceso
    
    Lógica:
    - De 0 a 15 m³: $2 (tarifa fija)
    - Más de 15 m³: $2 + ($1 × cada m³ adicional)
    
    Returns:
        (tarifa_basica, tarifa_exceso, valor_basico, valor_exceso, m3_exceso)
    """
    if fecha_referencia is None:
        fecha_referencia = date.today()
    
    # 1. Obtener tarifa básica
    tarifa_basica = db.query(Tarifa).filter(
        and_(
            Tarifa.tipo_tarifa == 'basico',
            Tarifa.es_vigente == True,
            Tarifa.activo == True,
            Tarifa.vigencia_desde <= fecha_referencia,
            (Tarifa.vigencia_hasta.is_(None) | (Tarifa.vigencia_hasta >= fecha_referencia))
        )
    ).order_by(Tarifa.vigencia_desde.desc()).first()
    
    if not tarifa_basica:
        return None, None, Decimal('0.00'), Decimal('0.00'), 0
    
    # 2. Valor básico siempre se cobra (incluso si consume 0)
    valor_basico = tarifa_basica.precio_por_m3  # $2.00
    
    # 3. Calcular exceso si pasa del límite
    limite_basico = float(tarifa_basica.limite_max_m3)  # 15 m³
    exceso_m3 = 0
    valor_exceso = Decimal('0.00')
    tarifa_exceso = None
    
    if consumo_m3 > limite_basico:
        exceso_m3 = consumo_m3 - limite_basico
        
        # Obtener tarifa de exceso
        tarifa_exceso = db.query(Tarifa).filter(
            and_(
                Tarifa.tipo_tarifa == 'exceso',
                Tarifa.es_vigente == True,
                Tarifa.activo == True,
                Tarifa.vigencia_desde <= fecha_referencia,
                (Tarifa.vigencia_hasta.is_(None) | (Tarifa.vigencia_hasta >= fecha_referencia))
            )
        ).order_by(Tarifa.vigencia_desde.desc()).first()
        
        if tarifa_exceso:
            valor_exceso = Decimal(str(exceso_m3)) * tarifa_exceso.precio_por_m3
    
    return tarifa_basica, tarifa_exceso, valor_basico, valor_exceso, exceso_m3


def calcular_tarifa_consumo(
    db: Session,
    consumo_m3: float,
    tipo_tarifa: str = "consumo",
    fecha_referencia: date = None
) -> Tuple[Optional[Tarifa], Decimal]:
    """
    Encuentra la tarifa aplicable y calcula el valor
    
    Args:
        db: Sesión de base de datos
        consumo_m3: Consumo en metros cúbicos
        tipo_tarifa: Tipo de tarifa ('consumo', 'exceso', 'residencial', etc.)
        fecha_referencia: Fecha para buscar tarifa vigente (por defecto hoy)
    
    Returns:
        (tarifa_aplicable, valor_calculado)
    """
    if fecha_referencia is None:
        fecha_referencia = date.today()
    
    consumo_decimal = Decimal(str(consumo_m3))
    
    # 1. Buscar tarifa vigente para la fecha y que contenga el consumo en su rango
    tarifa = db.query(Tarifa).filter(
        and_(
            Tarifa.tipo_tarifa == tipo_tarifa,
            Tarifa.es_vigente == True,
            Tarifa.activo == True,
            Tarifa.vigencia_desde <= fecha_referencia,
            # La vigencia_hasta puede ser NULL (vigente indefinidamente)
            (Tarifa.vigencia_hasta.is_(None) | (Tarifa.vigencia_hasta >= fecha_referencia)),
            # El consumo debe estar dentro del rango
            Tarifa.limite_min_m3 <= consumo_m3,
            # limite_max_m3 puede ser NULL (sin límite superior)
            (Tarifa.limite_max_m3.is_(None) | (Tarifa.limite_max_m3 >= consumo_m3))
        )
    ).order_by(
        Tarifa.vigencia_desde.desc()  # La más reciente primero
    ).first()
    
    if not tarifa:
        return None, Decimal('0.00')
    
    # 2. Calcular valor según el consumo
    valor = consumo_decimal * tarifa.precio_por_m3
    
    return tarifa, valor


def generar_factura_desde_lectura(
    db: Session,
    lectura: Lectura,
    aplicar_servicios: bool = True,
    aplicar_multas: bool = True
) -> Tuple[bool, str, Optional[Factura]]:
    """
    Genera automáticamente una factura desde una lectura
    """
    try:
        # 1-3. [Tu código existente hasta aquí]
        medidor = db.query(Medidor).filter(
            Medidor.id_medidor == lectura.id_medidor
        ).first()
        
        if not medidor or not medidor.id_usuario_afi:
            return False, "Medidor sin afiliado asociado", None
        
        id_usuario_afi = medidor.id_usuario_afi
        periodo = f"{lectura.fecha_lectura.year}-{str(lectura.fecha_lectura.month).zfill(2)}"
        
        factura_existente = db.query(Factura).filter(
            Factura.id_usuario_afi == id_usuario_afi,
            Factura.periodo == periodo
        ).first()
        
        if factura_existente:
            return False, f"Ya existe factura para el periodo {periodo}", None
        
        # ============================================
        # 🆕 4. CALCULAR CON CARGO FIJO + EXCESO
        # ============================================
        tarifa_basica, tarifa_exceso, valor_consumo, valor_exceso, exceso_m3 = calcular_tarifa_cargo_fijo(
            db,
            lectura.consumo_m3,
            fecha_referencia=lectura.fecha_lectura
        )
        
        if not tarifa_basica:
            return False, "No se encontró tarifa básica configurada", None
        
        # ============================================
        # 5. CALCULAR TOTALES
        # ============================================
        descuento = Decimal('0.00')
        
        totales = calcular_totales_factura(
            valor_consumo=valor_consumo,
            valor_exceso=valor_exceso,
            descuento=descuento,
            tasa_impuesto=Decimal('0.12')  # IVA 12%
        )
        
        # ============================================
        # 6-7. GENERAR FACTURA
        # ============================================
        num_factura = generar_numero_factura(db, periodo)
        
        nueva_factura = Factura(
            num_factura=num_factura,
            id_usuario_afi=id_usuario_afi,
            id_lectura=lectura.id_lectura,
            id_tarifa=tarifa_basica.id_tarifa,
            consumo_m3=lectura.consumo_m3,
            exceso_m3=exceso_m3,
            valor_consumo=valor_consumo,
            valor_exceso=valor_exceso,
            descuento=descuento,
            subtotal=totales['subtotal'],
            impuesto=totales['impuesto'],
            total=totales['total'],
            fecha_emision=date.today(),
            periodo=periodo,
            estado_factura='pendiente'
        )
        
        db.add(nueva_factura)
        db.flush()
        
        # ============================================
        # 🆕 8. CREAR DETALLE DE CONSUMO BÁSICO
        # ============================================
        # ✅ SOLUCIÓN - CAMBIA 'servicio' POR 'consumo':
        detalle_basico = DetalleFactura(
            id_factura=nueva_factura.id_factura,
            tipo_detalle='consumo',  # ✅ CAMBIAR AQUÍ
            id_servicio=None,
            subtotal_detalle=valor_consumo,
            descripcion=f"Consumo básico (hasta 15 m³): {min(lectura.consumo_m3, 15):.2f} m³"
        )

        
        # ============================================
        # 🆕 9. CREAR DETALLE DE EXCESO SI APLICA
        # ============================================
        # ✅ SOLUCIÓN:
        if exceso_m3 > 0 and tarifa_exceso:
            detalle_exceso = DetalleFactura(
                id_factura=nueva_factura.id_factura,
                tipo_detalle='consumo',  # ✅ CAMBIAR AQUÍ
                id_servicio=None,
                subtotal_detalle=valor_exceso,
                descripcion=f"Exceso sobre 15 m³: {exceso_m3:.2f} m³ × ${float(tarifa_exceso.precio_por_m3):.2f}/m³"
            )

        
        # ============================================
        # 10-11. SERVICIOS Y MULTAS (tu código existente)
        # ============================================
  
        
        if aplicar_multas:
            multas_agregadas = agregar_multas_a_factura(
                db,
                nueva_factura.id_factura,
                id_usuario_afi
            )
            
            if multas_agregadas > 0:
                recalcular_totales_factura(db, nueva_factura)
        
        db.commit()
        db.refresh(nueva_factura)
        
        return True, f"Factura {num_factura} generada exitosamente", nueva_factura
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error generando factura automática: {e}")
        return False, f"Error al generar factura: {str(e)}", None


def agregar_multas_a_factura(
    db: Session,
    id_factura: int,
    id_usuario_afi: int
) -> int:
    """
    Agrega multas pendientes a una factura
    
    Returns:
        Cantidad de multas agregadas
    """
    try:
        # 🆕 Buscar multas pendientes que no han sido facturadas
        multas_pendientes = db.query(MultaAfiliado).filter(
            MultaAfiliado.id_usuario_afi == id_usuario_afi,
            MultaAfiliado.estado == 'pendiente',
            MultaAfiliado.facturado == False,  # ✅ Usar el campo facturado
            MultaAfiliado.activo == True
        ).all()
        
        contador = 0
        
        for multa in multas_pendientes:
            # Crear detalle de multa
            detalle_multa = DetalleFactura(
                id_factura=id_factura,
                tipo_detalle='multa',  # ✅ Tipo correcto
                id_servicio=None,
                id_multa_afiliados=multa.id_multa_afiliado,
                subtotal_detalle=multa.monto,
                descripcion=f"Multa: {multa.motivo or 'Sin especificar'}"
            )
            db.add(detalle_multa)
            
            # 🆕 Marcar multa como facturada
            multa.facturado = True
            
            contador += 1
        
        db.flush()
        return contador
        
    except Exception as e:
        print(f"⚠️ Error agregando multas: {e}")
        return 0


def recalcular_totales_factura(db: Session, factura: Factura):
    """
    Recalcula los totales de una factura según sus detalles
    """
    try:
        # Sumar todos los detalles
        detalles = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura.id_factura
        ).all()
        
        nuevo_subtotal = sum(d.subtotal_detalle for d in detalles)
        
        # Aplicar descuento si existe
        subtotal_con_descuento = nuevo_subtotal - (factura.descuento or Decimal('0.00'))
        
        # Calcular impuesto (12% IVA)
        nuevo_impuesto = subtotal_con_descuento * Decimal('0.12')
        
        # Total
        nuevo_total = subtotal_con_descuento + nuevo_impuesto
        
        # Actualizar factura
        factura.subtotal = nuevo_subtotal
        factura.impuesto = nuevo_impuesto
        factura.total = nuevo_total
        
        db.flush()
        
    except Exception as e:
        print(f"❌ Error recalculando totales: {e}")
        raise


def generar_numero_factura(db: Session, periodo: str) -> str:
    """
    Genera un número de factura único en formato: FACT-YYYYMM-NNNN
    Ejemplo: FACT-202512-0001
    """
    # Extraer año y mes del periodo
    anio, mes = periodo.split('-')
    prefijo = f"FACT-{anio}{mes}"
    
    # Buscar el último número de factura del periodo
    ultima_factura = db.query(Factura).filter(
        Factura.num_factura.like(f"{prefijo}-%")
    ).order_by(Factura.num_factura.desc()).first()
    
    if ultima_factura:
        # Extraer el número secuencial
        ultimo_num = int(ultima_factura.num_factura.split('-')[-1])
        nuevo_num = ultimo_num + 1
    else:
        nuevo_num = 1
    
    return f"{prefijo}-{nuevo_num:04d}"


def validar_periodo_factura(periodo: str) -> Tuple[bool, str]:
    """
    Valida que el periodo sea válido y no sea futuro
    Retorna: (es_valido, mensaje_error)
    """
    if not re.match(r'^\d{4}-\d{2}$', periodo):
        return False, "El periodo debe tener formato YYYY-MM"
    
    anio, mes = periodo.split('-')
    try:
        fecha_periodo = date(int(anio), int(mes), 1)
        fecha_actual = date.today()
        
        if fecha_periodo > fecha_actual:
            return False, "No se pueden crear facturas de periodos futuros"
        
        return True, ""
    except ValueError:
        return False, "Periodo inválido"


def calcular_tarifa_consumo(
    db: Session,
    consumo_m3: int,
    tipo_tarifa: str = "consumo"
) -> Tuple[Optional[Tarifa], Decimal]:
    """
    Calcula la tarifa aplicable según el consumo
    Retorna: (tarifa, valor_calculado)
    """
    tarifa = db.query(Tarifa).filter(
        Tarifa.tipo_tarifa == tipo_tarifa,
        Tarifa.es_vigente == True,
        Tarifa.activo == True,
        Tarifa.limite_min_m3 <= consumo_m3,
        or_(
            Tarifa.limite_max_m3 == None,
            Tarifa.limite_max_m3 >= consumo_m3
        )
    ).first()
    
    if not tarifa:
        return None, Decimal('0.00')
    
    valor = Decimal(str(consumo_m3)) * tarifa.precio_por_m3
    return tarifa, valor


def calcular_exceso(
    consumo_m3: int,
    limite_base: int,
    precio_exceso: Decimal
) -> Tuple[int, Decimal]:
    """
    Calcula el exceso de consumo y su valor
    Retorna: (exceso_m3, valor_exceso)
    """
    if consumo_m3 <= limite_base:
        return 0, Decimal('0.00')
    
    exceso = consumo_m3 - limite_base
    valor_exceso = Decimal(str(exceso)) * precio_exceso
    return exceso, valor_exceso


def calcular_totales_factura(
    valor_consumo: Decimal,
    valor_exceso: Decimal,
    descuento: Decimal,
    tasa_impuesto: Decimal = Decimal('0.12')  # IVA 12% por defecto
) -> Dict[str, Decimal]:
    """
    Calcula los totales de la factura
    Retorna: dict con subtotal, impuesto, total
    """
    subtotal = valor_consumo + valor_exceso - descuento
    impuesto = subtotal * tasa_impuesto
    total = subtotal + impuesto
    
    return {
        'subtotal': round(subtotal, 2),
        'impuesto': round(impuesto, 2),
        'total': round(total, 2)
    }


def validar_unicidad_factura(
    db: Session,
    id_usuario_afi: int,
    periodo: str,
    id_factura_excluir: Optional[int] = None
) -> Tuple[bool, str]:
    """
    Valida que no exista otra factura para el mismo usuario y periodo
    Retorna: (es_valido, mensaje_error)
    """
    query = db.query(Factura).filter(
        Factura.id_usuario_afi == id_usuario_afi,
        Factura.periodo == periodo
    )
    
    if id_factura_excluir:
        query = query.filter(Factura.id_factura != id_factura_excluir)
    
    factura_existente = query.first()
    
    if factura_existente:
        return False, f"Ya existe una factura para el usuario en el periodo {periodo} (Factura #{factura_existente.num_factura})"
    
    return True, ""


def validar_cambio_estado_factura(
    estado_actual: str,
    estado_nuevo: str
) -> Tuple[bool, str]:
    """
    Valida que el cambio de estado sea válido según las reglas de negocio
    Transiciones permitidas:
    - pendiente -> pagada, anulada, vencida
    - vencida -> pagada, anulada
    - pagada -> NO SE PUEDE CAMBIAR
    - anulada -> NO SE PUEDE CAMBIAR
    """
    transiciones_validas = {
        'pendiente': ['pagada', 'anulada', 'vencida'],
        'vencida': ['pagada', 'anulada'],
        'pagada': [],
        'anulada': []
    }
    
    if estado_nuevo not in transiciones_validas.get(estado_actual, []):
        return False, f"No se puede cambiar de '{estado_actual}' a '{estado_nuevo}'"
    
    return True, ""


def calcular_total_detalles(detalles: List[DetalleFactura]) -> Decimal:
    """
    Suma los subtotales de todos los detalles
    """
    return sum(d.subtotal_detalle for d in detalles)


def validar_coherencia_totales_factura(
    factura: Factura,
    db: Session
) -> Tuple[bool, str]:
    """
    Valida que los totales de la factura coincidan con la suma de sus detalles
    """
    detalles = db.query(DetalleFactura).filter(
        DetalleFactura.id_factura == factura.id_factura
    ).all()
    
    if not detalles:
        return True, ""  # Factura sin detalles es válida
    
    total_detalles = calcular_total_detalles(detalles)
    
    # Permitir diferencia de 0.01 por redondeos
    if abs(factura.subtotal - total_detalles) > Decimal('0.01'):
        return False, f"El subtotal de la factura ({factura.subtotal}) no coincide con la suma de detalles ({total_detalles})"
    
    return True, ""


def obtener_estadisticas_facturacion(
    db: Session,
    periodo: Optional[str] = None,
    id_usuario_afi: Optional[int] = None
) -> Dict:
    """
    Obtiene estadísticas de facturación
    """
    query = db.query(Factura)
    
    if periodo:
        query = query.filter(Factura.periodo == periodo)
    
    if id_usuario_afi:
        query = query.filter(Factura.id_usuario_afi == id_usuario_afi)
    
    facturas = query.all()
    
    total = len(facturas)
    pendientes = sum(1 for f in facturas if f.estado_factura == 'pendiente')
    pagadas = sum(1 for f in facturas if f.estado_factura == 'pagada')
    vencidas = sum(1 for f in facturas if f.estado_factura == 'vencida')
    anuladas = sum(1 for f in facturas if f.estado_factura == 'anulada')
    
    monto_total = sum(f.total for f in facturas)
    monto_pendiente = sum(f.total for f in facturas if f.estado_factura in ['pendiente', 'vencida'])
    monto_cobrado = sum(f.total for f in facturas if f.estado_factura == 'pagada')
    
    return {
        'total_facturas': total,
        'facturas_pendientes': pendientes,
        'facturas_pagadas': pagadas,
        'facturas_vencidas': vencidas,
        'facturas_anuladas': anuladas,
        'monto_total': float(monto_total),
        'monto_total_pendiente': float(monto_pendiente),
        'monto_total_cobrado': float(monto_cobrado),
        'periodo': periodo
    }


def marcar_facturas_vencidas(db: Session, dias_vencimiento: int = 30) -> int:
    """
    Marca como vencidas las facturas pendientes que superan los días de vencimiento
    Retorna: cantidad de facturas marcadas
    """
    from datetime import timedelta
    
    fecha_limite = date.today() - timedelta(days=dias_vencimiento)
    
    facturas_vencidas = db.query(Factura).filter(
        Factura.estado_factura == 'pendiente',
        Factura.fecha_emision <= fecha_limite
    ).all()
    
    count = 0
    for factura in facturas_vencidas:
        factura.estado_factura = 'vencida'
        count += 1
    
    if count > 0:
        db.commit()
    
    return count

from datetime import date

def obtener_o_crear_factura_activa(
    db: Session,
    id_usuario_afi: int
):
    """
    Obtiene la factura activa del periodo actual o la crea si no existe --- para multas afiliados 
    """

    hoy = date.today()
    periodo_actual = f"{hoy.year}-{hoy.month:02d}"

    factura = db.query(Factura).filter(
        Factura.id_usuario_afi == id_usuario_afi,
        Factura.periodo == periodo_actual,
        Factura.estado_factura == 'pendiente'
    ).first()

    if factura:
        return factura

    # 🆕 Crear nueva factura del periodo actual
    nueva_factura = Factura(
        id_usuario_afi=id_usuario_afi,
        periodo=periodo_actual,
        fecha_emision=hoy,
        estado_factura='pendiente',
        total=0
    )

    db.add(nueva_factura)
    db.flush()  # 🔥 Obtener id_factura

    return nueva_factura

