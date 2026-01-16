"""
utils/mora_utils.py
Funciones auxiliares para el cálculo y aplicación de mora
ACTUALIZADO: Soporte para tipo_periodo (dias/meses)
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from typing import Tuple, Optional
from models.mora import ConfiguracionMora, MoraFactura
from models.factura import Factura
from models.detalle_factura import DetalleFactura


# ========================================
# OBTENER CONFIGURACIÓN DE MORA
# ========================================

def obtener_configuracion_mora_activa(db: Session) -> Optional[ConfiguracionMora]:
    """
    Obtiene la configuración de mora activa y aplicable.
    Solo puede haber una activa a la vez.
    
    Returns:
        ConfiguracionMora o None si no hay configuración activa
    """
    hoy = date.today()
    config_mora = db.query(ConfiguracionMora).filter(
        ConfiguracionMora.activo == True,
        ConfiguracionMora.aplicar_mora == True,
        ConfiguracionMora.es_vigente == True,
        ConfiguracionMora.vigencia_desde <= hoy,
        (ConfiguracionMora.vigencia_hasta.is_(None)) | (ConfiguracionMora.vigencia_hasta >= hoy)
    ).first()
    
    if config_mora:
        periodo_info = f"{config_mora.dias_gracia} días" if config_mora.tipo_periodo == 'dias' else f"{config_mora.meses_gracia} meses"
        print(f"✅ Configuración de mora activa encontrada: {config_mora.nombre}")
        print(f"   Tipo de periodo: {config_mora.tipo_periodo} ({periodo_info} de gracia)")
    else:
        print(f"⚠️ No hay configuración de mora activa")
    
    return config_mora


# ========================================
# VERIFICAR SI FACTURA TIENE MORA APLICADA
# ========================================

def factura_tiene_mora_aplicada(factura_id: int, db: Session) -> bool:
    """
    Verifica si una factura ya tiene mora aplicada.
    
    Args:
        factura_id: ID de la factura
        db: Sesión de base de datos
        
    Returns:
        True si ya tiene mora aplicada, False si no
    """
    mora_existente = db.query(MoraFactura).filter(
        MoraFactura.id_factura == factura_id,
        MoraFactura.aplicada == True
    ).first()
    
    return mora_existente is not None


# ========================================
# ✅ NUEVO: CALCULAR FECHA DE INICIO DE MORA
# ========================================

# ========================================
# ✅ ACTUALIZADO: CALCULAR FECHA DE INICIO DE MORA
# ========================================

def calcular_fecha_inicio_mora(
    factura: Factura, 
    config_mora: ConfiguracionMora
) -> date:
    """
    Calcula la fecha en que empieza a aplicar la mora según el tipo de periodo.
    IMPORTANTE: Usa fecha_emision de la factura.
    
    Args:
        factura: Objeto Factura
        config_mora: Configuración de mora activa
        
    Returns:
        Fecha en que empieza a contar la mora
    """
    # ✅ USAR FECHA_EMISION
    fecha_base = factura.fecha_emision
    
    # Convertir a date si es datetime
    if isinstance(fecha_base, datetime):
        fecha_base = fecha_base.date()
    
    if config_mora.tipo_periodo == 'dias':
        # ✅ MODO DÍAS: Sumar días de gracia a la fecha de emisión
        dias_gracia = config_mora.dias_gracia or 0
        from datetime import timedelta
        fecha_inicio = fecha_base + timedelta(days=dias_gracia)
        
        print(f"📅 Tipo: DÍAS")
        print(f"   Fecha emisión: {fecha_base}")
        print(f"   Días de gracia: {dias_gracia}")
        print(f"   Mora aplica desde: {fecha_inicio}")
        
    else:  # tipo_periodo == 'meses'
        # ✅ MODO MESES: Avanzar al primer día del siguiente mes + meses de gracia
        meses_gracia = config_mora.meses_gracia or 0
        
        # Primer día del mes siguiente a la emisión
        if fecha_base.month == 12:
            # Diciembre → Enero del año siguiente
            primer_dia_siguiente = date(fecha_base.year + 1, 1, 1)
        else:
            # Cualquier otro mes
            primer_dia_siguiente = date(fecha_base.year, fecha_base.month + 1, 1)
        
        # Agregar meses de gracia
        fecha_inicio = primer_dia_siguiente + relativedelta(months=meses_gracia)
        
        print(f"📅 Tipo: MESES")
        print(f"   Fecha emisión: {fecha_base}")
        print(f"   Primer día del mes siguiente: {primer_dia_siguiente}")
        print(f"   Meses de gracia: {meses_gracia}")
        print(f"   Mora aplica desde: {fecha_inicio}")
    
    return fecha_inicio


# ========================================
# ✅ ACTUALIZADO: CALCULAR DÍAS DE MORA
# ========================================

def calcular_dias_mora(
    factura: Factura, 
    fecha_pago: datetime,
    config_mora: ConfiguracionMora
) -> Tuple[int, bool]:
    """
    Calcula los días de mora considerando el tipo de periodo.
    
    Args:
        factura: Objeto Factura
        fecha_pago: Fecha en que se registra el pago
        config_mora: Configuración de mora activa
        
    Returns:
        Tuple[dias_mora, aplica_mora]
        - dias_mora: Número de días de mora efectivos
        - aplica_mora: True si aplica mora, False si está dentro del periodo de gracia
    """
    fecha_pago_date = fecha_pago.date() if isinstance(fecha_pago, datetime) else fecha_pago
    
    # Calcular fecha de inicio de mora
    fecha_inicio_mora = calcular_fecha_inicio_mora(factura, config_mora)
    
    # Verificar si aplica mora
    if fecha_pago_date < fecha_inicio_mora:
        # Pago realizado antes de que empiece la mora
        print(f"✅ Pago dentro del periodo de gracia")
        print(f"   Fecha pago: {fecha_pago_date}")
        print(f"   Mora aplica desde: {fecha_inicio_mora}")
        return 0, False
    
    # Calcular días de mora efectivos
    dias_mora = (fecha_pago_date - fecha_inicio_mora).days
    
    print(f"⚠️ FACTURA EN MORA")
    print(f"   Fecha inicio mora: {fecha_inicio_mora}")
    print(f"   Fecha pago: {fecha_pago_date}")
    print(f"   Días de mora: {dias_mora}")
    
    return dias_mora, True


# ========================================
# OBTENER MONTO BASE PARA MORA
# ========================================

def obtener_monto_base_mora(factura: Factura, config_mora: ConfiguracionMora, db: Session) -> Decimal:
    """
    Obtiene el monto base sobre el cual se calculará la mora.
    
    Args:
        factura: Objeto Factura
        config_mora: Configuración de mora activa
        db: Sesión de base de datos
        
    Returns:
        Monto base según configuración (SIEMPRE CON IVA INCLUIDO)
    """
    if config_mora.aplicar_sobre == 'total':
        # Total de la factura (incluye todo: consumo, servicios, multas, IVA)
        monto_base = factura.total
        tipo = "total factura"
        
    elif config_mora.aplicar_sobre == 'consumo':
        # Solo el total de consumo CON IVA (sin multas, sin servicios adicionales)
        detalles = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura.id_factura,
            DetalleFactura.tipo_detalle == 'consumo'
        ).all()
        
        subtotal_consumo = sum(d.subtotal_detalle for d in detalles)
        
        # Aplicar IVA al consumo
        from utils.facturacion import obtener_configuracion_iva
        tasa_impuesto, _ = obtener_configuracion_iva(db)
        monto_base = subtotal_consumo * (1 + tasa_impuesto)
        tipo = "consumo con IVA"
        
    elif config_mora.aplicar_sobre == 'base':
        # Tarifa base o precio base CON IVA
        base = factura.precio_base if factura.precio_base else factura.total
        from utils.facturacion import obtener_configuracion_iva
        tasa_impuesto, _ = obtener_configuracion_iva(db)
        monto_base = base * (1 + tasa_impuesto)
        tipo = "tarifa base con IVA"
        
    else:
        monto_base = factura.total
        tipo = "total factura (default)"
    
    print(f"💵 Monto base para mora ({tipo}): ${monto_base:.2f}")
    return Decimal(str(monto_base))


# ========================================
# ✅ ACTUALIZADO: CALCULAR MONTO DE MORA
# ========================================

def calcular_monto_mora(
    monto_base: Decimal,
    dias_mora: int,
    config_mora: ConfiguracionMora
) -> Tuple[Decimal, str]:
    """
    Calcula el monto de mora según el tipo de cálculo configurado.
    
    Args:
        monto_base: Monto sobre el cual calcular la mora
        dias_mora: Días de mora efectivos (ya calculados con el periodo de gracia)
        config_mora: Configuración de mora activa
        
    Returns:
        Tuple[monto_mora, detalle_calculo]
    """
    monto_mora = Decimal('0.00')
    detalle = ""
    
    # Si no hay días de mora, retornar 0
    if dias_mora <= 0:
        detalle = "Sin mora (pago dentro del periodo de gracia)"
        print(f"✅ Sin mora aplicable")
        return monto_mora, detalle
    
    if config_mora.tipo_calculo == 'porcentaje':
        tasa = Decimal(str(config_mora.porcentaje_mora)) / Decimal('100')
        monto_mora = monto_base * tasa
        detalle = f"Mora {config_mora.porcentaje_mora}% sobre ${monto_base} ({dias_mora} días)"
        print(f"📊 Cálculo porcentaje: {config_mora.porcentaje_mora}% × ${monto_base} = ${monto_mora}")
        
    elif config_mora.tipo_calculo == 'fijo':
        monto_mora = Decimal(str(config_mora.valor_fijo))
        detalle = f"Mora fija de ${config_mora.valor_fijo} ({dias_mora} días)"
        print(f"📊 Cálculo fijo: ${monto_mora}")
        
    elif config_mora.tipo_calculo == 'interes_diario':
        tasa_diaria = Decimal(str(config_mora.interes_diario))
        
        # dias_mora ya viene con el periodo de gracia aplicado
        if dias_mora > 0:
            # Fórmula: Deuda × (días_mora/365) × tasa_interes_anual
            factor_dias = Decimal(str(dias_mora)) / Decimal('365')
            monto_mora = monto_base * factor_dias * (tasa_diaria / Decimal('100'))
            detalle = f"Interés diario {config_mora.interes_diario}% × {dias_mora} días sobre ${monto_base}"
            print(f"📊 Cálculo interés diario: ${monto_base} × ({dias_mora}/365) × {config_mora.interes_diario}% = ${monto_mora}")
        else:
            detalle = "Sin mora (pago dentro del periodo de gracia)"
            print(f"✅ Dentro del período de gracia")
    
    # Aplicar límite máximo si existe
    if config_mora.mora_maxima and monto_mora > Decimal(str(config_mora.mora_maxima)):
        monto_mora_original = monto_mora
        monto_mora = Decimal(str(config_mora.mora_maxima))
        print(f"⚠️ Mora limitada: ${monto_mora_original:.2f} → ${monto_mora:.2f} (máximo)")
        detalle += f" (limitado a ${config_mora.mora_maxima})"
    
    # Redondear a 2 decimales
    monto_mora = monto_mora.quantize(Decimal('0.01'))
    
    return monto_mora, detalle


# ========================================
# ✅ ACTUALIZADO: CALCULAR MORA COMPLETA PARA FACTURA
# ========================================

def calcular_mora_factura(
    factura: Factura,
    fecha_pago: datetime,
    config_mora: ConfiguracionMora,
    db: Session
) -> Tuple[Decimal, int, str]:
    """
    Calcula la mora completa para una factura.
    
    Args:
        factura: Objeto Factura
        fecha_pago: Fecha en que se registra el pago
        config_mora: Configuración de mora activa
        db: Sesión de base de datos
        
    Returns:
        Tuple[monto_mora, dias_mora, detalle]
    """
    print(f"\n{'='*60}")
    print(f"📊 CÁLCULO DE MORA - Factura #{factura.num_factura}")
    print(f"{'='*60}")
    print(f"  Configuración: {config_mora.nombre}")
    print(f"  Tipo: {config_mora.tipo_calculo}")
    
    if config_mora.tipo_periodo == 'dias':
        print(f"  Periodo: {config_mora.dias_gracia} días de gracia")
    else:
        print(f"  Periodo: {config_mora.meses_gracia} meses de gracia")
    
    # 1. Calcular días de mora y verificar si aplica
    dias_mora, aplica_mora = calcular_dias_mora(factura, fecha_pago, config_mora)
    
    if not aplica_mora:
        print(f"  ✅ NO aplica mora (dentro del período de gracia)")
        print(f"{'='*60}\n")
        return Decimal('0.00'), 0, "Pago dentro del período de gracia"
    
    print(f"  ⚠️ Días efectivos de mora: {dias_mora}")
    
    # 2. Obtener monto base
    monto_base = obtener_monto_base_mora(factura, config_mora, db)
    
    # 3. Calcular mora
    monto_mora, detalle = calcular_monto_mora(monto_base, dias_mora, config_mora)
    
    print(f"  💰 MORA CALCULADA: ${monto_mora}")
    print(f"{'='*60}\n")
    
    return monto_mora, dias_mora, detalle


# ========================================
# REGISTRAR MORA EN BASE DE DATOS
# ========================================

def registrar_mora_en_bd(
    factura_id: int,
    config_mora_id: int,
    monto_base: Decimal,
    dias_mora: int,
    tipo_calculo: str,
    tasa_aplicada: Optional[Decimal],
    monto_mora: Decimal,
    observaciones: str,
    db: Session
) -> int:
    """
    Registra la mora aplicada en t_mora_factura.
    
    Args:
        factura_id: ID de la factura
        config_mora_id: ID de la configuración de mora usada
        monto_base: Monto base sobre el que se calculó
        dias_mora: Días de mora efectivos
        tipo_calculo: Tipo de cálculo usado
        tasa_aplicada: Tasa o porcentaje aplicado (si aplica)
        monto_mora: Monto final de mora calculado
        observaciones: Detalles del cálculo
        db: Sesión de base de datos
        
    Returns:
        ID de la mora registrada
    """
    nueva_mora = MoraFactura(
        id_factura=factura_id,
        id_configuracion_mora=config_mora_id,
        monto_base=monto_base,
        dias_mora=dias_mora,
        tipo_calculo=tipo_calculo,
        tasa_aplicada=tasa_aplicada,
        monto_mora=monto_mora,
        fecha_calculo=datetime.now(),
        aplicada=True,
        fecha_aplicacion=datetime.now(),
        observaciones=observaciones
    )
    
    db.add(nueva_mora)
    db.flush()
    
    print(f"✅ Mora registrada en BD: ID={nueva_mora.id_mora}, Monto=${monto_mora}")
    
    return nueva_mora.id_mora


# ========================================
# EVALUAR Y APLICAR MORA (FUNCIÓN PRINCIPAL)
# ========================================

def evaluar_y_aplicar_mora(
    factura: Factura,
    fecha_pago: datetime,
    db: Session
) -> Tuple[Decimal, bool, str]:
    """
    Función principal que evalúa si aplica mora y la registra.
    
    Args:
        factura: Objeto Factura
        fecha_pago: Fecha en que se registra el pago
        db: Sesión de base de datos
        
    Returns:
        Tuple[monto_mora, mora_aplicada, detalle]
    """
    print(f"\n{'='*70}")
    print(f"🔍 EVALUANDO MORA PARA FACTURA #{factura.num_factura}")
    print(f"{'='*70}")
    
    # Verificar si ya tiene mora aplicada
    if factura_tiene_mora_aplicada(factura.id_factura, db):
        print(f"⚠️ Esta factura YA tiene mora aplicada previamente")
        print(f"{'='*70}\n")
        return Decimal('0.00'), False, "Mora ya aplicada anteriormente"
    
    # Buscar configuración activa
    config_mora = obtener_configuracion_mora_activa(db)
    if not config_mora:
        print(f"⚠️ No hay configuración de mora activa")
        print(f"{'='*70}\n")
        return Decimal('0.00'), False, "No hay configuración de mora activa"
    
    # Calcular mora
    monto_mora, dias_efectivos, detalle = calcular_mora_factura(
        factura=factura,
        fecha_pago=fecha_pago,
        config_mora=config_mora,
        db=db
    )
    
    # Si no hay mora, retornar
    if monto_mora <= 0:
        return Decimal('0.00'), False, detalle
    
    # Registrar mora en BD
    tasa_aplicada = None
    if config_mora.tipo_calculo == 'porcentaje':
        tasa_aplicada = config_mora.porcentaje_mora
    elif config_mora.tipo_calculo == 'interes_diario':
        tasa_aplicada = config_mora.interes_diario
    
    monto_base = obtener_monto_base_mora(factura, config_mora, db)
    
    id_mora = registrar_mora_en_bd(
        factura_id=factura.id_factura,
        config_mora_id=config_mora.id_configuracion_mora,
        monto_base=monto_base,
        dias_mora=dias_efectivos,
        tipo_calculo=config_mora.tipo_calculo,
        tasa_aplicada=tasa_aplicada,
        monto_mora=monto_mora,
        observaciones=detalle,
        db=db
    )
    
    print(f"{'='*70}\n")
    
    return monto_mora, True, detalle


# ========================================
# CONSULTAR MORA DE FACTURA
# ========================================

def obtener_mora_de_factura(factura_id: int, db: Session) -> Optional[MoraFactura]:
    """
    Obtiene el registro de mora aplicada a una factura.
    
    Args:
        factura_id: ID de la factura
        db: Sesión de base de datos
        
    Returns:
        MoraFactura o None si no tiene mora
    """
    return db.query(MoraFactura).filter(
        MoraFactura.id_factura == factura_id,
        MoraFactura.aplicada == True
    ).first()
