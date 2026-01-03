"""
utils/mora_utils.py
Funciones auxiliares para el cálculo y aplicación de mora
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
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
        print(f"✅ Configuración de mora activa encontrada: {config_mora.nombre}")
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
# CALCULAR DÍAS DE MORA
# ========================================

def calcular_dias_mora(factura: Factura, fecha_pago: datetime) -> int:
    """
    Calcula los días de mora desde la fecha de emisión de la factura.
    
    Args:
        factura: Objeto Factura
        fecha_pago: Fecha en que se registra el pago
    
    Returns:
        Número de días transcurridos desde la emisión
    """
    fecha_pago_date = fecha_pago.date() if isinstance(fecha_pago, datetime) else fecha_pago
    fecha_emision_date = factura.fecha_emision.date() if isinstance(factura.fecha_emision, datetime) else factura.fecha_emision
    
    dias_transcurridos = (fecha_pago_date - fecha_emision_date).days
    
    print(f"📅 Fecha emisión: {fecha_emision_date}")
    print(f"📅 Fecha pago: {fecha_pago_date}")
    print(f"📊 Días transcurridos: {dias_transcurridos}")
    
    return dias_transcurridos


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
# CALCULAR MONTO DE MORA
# ========================================

def calcular_monto_mora(
    monto_base: Decimal,
    dias_transcurridos: int,
    config_mora: ConfiguracionMora
) -> Tuple[Decimal, str]:
    """
    Calcula el monto de mora según el tipo de cálculo configurado.
    
    Args:
        monto_base: Monto sobre el cual calcular la mora
        dias_transcurridos: Días desde la emisión hasta el pago
        config_mora: Configuración de mora activa
    
    Returns:
        Tuple[monto_mora, detalle_calculo]
    """
    monto_mora = Decimal('0.00')
    detalle = ""
    
    if config_mora.tipo_calculo == 'porcentaje':
        tasa = Decimal(str(config_mora.porcentaje_mora)) / Decimal('100')
        monto_mora = monto_base * tasa
        detalle = f"Mora {config_mora.porcentaje_mora}% sobre ${monto_base}"
        print(f"📊 Cálculo porcentaje: {config_mora.porcentaje_mora}% × ${monto_base} = ${monto_mora}")
        
    elif config_mora.tipo_calculo == 'fijo':
        monto_mora = Decimal(str(config_mora.valor_fijo))
        detalle = f"Mora fija de ${config_mora.valor_fijo}"
        print(f"📊 Cálculo fijo: ${monto_mora}")
        
    elif config_mora.tipo_calculo == 'interes_diario':
        tasa_diaria = Decimal(str(config_mora.interes_diario))
        dias_efectivos = max(0, dias_transcurridos - config_mora.dias_gracia)
        
        if dias_efectivos > 0:
            # Fórmula: Deuda × (días_mora/365) × tasa_interes_anual
            factor_dias = Decimal(str(dias_efectivos)) / Decimal('365')
            monto_mora = monto_base * factor_dias * (tasa_diaria / Decimal('100'))
            detalle = f"Interés diario {config_mora.interes_diario}% × {dias_efectivos} días sobre ${monto_base}"
            print(f"📊 Cálculo interés diario: ${monto_base} × ({dias_efectivos}/365) × {config_mora.interes_diario}% = ${monto_mora}")
        else:
            detalle = f"Sin mora (dentro de {config_mora.dias_gracia} días de gracia)"
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
# CALCULAR MORA COMPLETA PARA FACTURA
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
    print(f"   Configuración: {config_mora.nombre}")
    print(f"   Tipo: {config_mora.tipo_calculo}")
    print(f"   Días de gracia: {config_mora.dias_gracia}")
    
    # 1. Calcular días transcurridos desde la emisión
    dias_transcurridos = calcular_dias_mora(factura, fecha_pago)
    
    # 2. Verificar días de gracia
    dias_efectivos = dias_transcurridos - config_mora.dias_gracia
    
    if dias_efectivos <= 0:
        print(f"   ✅ NO aplica mora (dentro del período de gracia)")
        print(f"{'='*60}\n")
        return Decimal('0.00'), dias_transcurridos, "Pago dentro del período de gracia"
    
    print(f"   ⚠️ Días efectivos de mora: {dias_efectivos}")
    
    # 3. Obtener monto base
    monto_base = obtener_monto_base_mora(factura, config_mora, db)
    
    # 4. Calcular mora
    monto_mora, detalle = calcular_monto_mora(monto_base, dias_transcurridos, config_mora)
    
    print(f"   💰 MORA CALCULADA: ${monto_mora}")
    print(f"{'='*60}\n")
    
    return monto_mora, dias_efectivos, detalle


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

