# utils/facturacion.py

import re
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models.factura import Factura
from models.detalle_factura import DetalleFactura
from models.iva import IVA
from models.multa import TipoMulta
from models.tarifa import Tarifa
from models.lectura import Lectura
from models.meter import Medidor
from models.servicio import Servicio
from models.multa_afiliado import MultaAfiliado
from decimal import Decimal
from datetime import date
from typing import Dict, Optional, Tuple, List


dias_vencimientos: int = 30  # Días por defecto para vencimiento de facturas

# ============================================
# 1. VALIDACIONES
# ============================================
def validar_datos_facturacion(
    db: Session,
    lectura: Lectura
) -> Tuple[bool, str, Optional[Dict]]:
    """
    Valida que los datos sean correctos para generar factura
    Retorna: (es_valido, mensaje_error, datos_validados)
    """
    medidor = db.query(Medidor).filter(
        Medidor.id_medidor == lectura.id_medidor
    ).first()
    
    if not medidor or not medidor.id_usuario_afi:
        return False, "Medidor sin afiliado asociado", None
    
    periodo = f"{lectura.fecha_lectura.year}-{str(lectura.fecha_lectura.month).zfill(2)}"
    
    # Verificar factura duplicada
    factura_existente = db.query(Factura).filter(
        Factura.id_usuario_afi == medidor.id_usuario_afi,
        Factura.periodo == periodo,
        Factura.estado_factura != 'anulada'  # ✅ Permitir si la anterior está anulada
    ).first()
    
    if factura_existente:
        return False, f"Ya existe factura activa para el periodo {periodo}", None
    
    datos = {
        'id_usuario_afi': medidor.id_usuario_afi,
        'periodo': periodo,
        'consumo_total': Decimal(str(lectura.consumo_m3))
    }
    
    return True, "Validación exitosa", datos


# ============================================
# 2. OBTENER TARIFAS
# ============================================
def obtener_tarifas_vigentes(db: Session) -> Tuple[Optional[Tarifa], Optional[Tarifa]]:
    """
    Obtiene las tarifas básica y de exceso vigentes
    Retorna: (tarifa_basica, tarifa_exceso)
    """
    tarifa_basica = db.query(Tarifa).filter(
        Tarifa.activo == True,
        Tarifa.es_vigente == True,
        Tarifa.tipo_tarifa == 'basico'
    ).first()
    
    tarifa_exceso = db.query(Tarifa).filter(
        Tarifa.activo == True,
        Tarifa.es_vigente == True,
        Tarifa.tipo_tarifa == 'exceso'
    ).first()
    
    return tarifa_basica, tarifa_exceso


# ============================================
# 3. CÁLCULOS DE CONSUMO
# ============================================
def calcular_consumo_basico(tarifa_basica: Tarifa) -> Dict:
    """
    Calcula el valor del consumo básico (precio fijo)
    """
    limite_basico = Decimal(str(tarifa_basica.limite_max_m3))
    precio_fijo = Decimal(str(tarifa_basica.precio_por_m3))
    
    return {
        'valor': precio_fijo,
        'limite_m3': limite_basico,
        'tarifa_id': tarifa_basica.id_tarifa,
        'tarifa_nombre': tarifa_basica.nombre
    }


def calcular_consumo_exceso(
    consumo_total: Decimal,
    limite_basico: Decimal,
    tarifa_exceso: Optional[Tarifa]
) -> Dict:
    """
    Calcula el exceso de consumo si aplica
    """
    if consumo_total <= limite_basico:
        return {
            'aplica': False,
            'exceso_m3': Decimal('0.00'),
            'valor_exceso': Decimal('0.00'),
            'tarifa_nombre': None
        }
    
    exceso_m3 = consumo_total - limite_basico
    
    if not tarifa_exceso:
        print(f"⚠️ No hay tarifa de exceso configurada. Exceso: {exceso_m3} m³")
        return {
            'aplica': False,
            'exceso_m3': exceso_m3,
            'valor_exceso': Decimal('0.00'),
            'tarifa_nombre': None
        }
    
    precio_exceso = Decimal(str(tarifa_exceso.precio_por_m3))
    valor_exceso = exceso_m3 * precio_exceso
    
    return {
        'aplica': True,
        'exceso_m3': exceso_m3,
        'valor_exceso': valor_exceso,
        'precio_unitario': precio_exceso,
        'tarifa_nombre': tarifa_exceso.nombre
    }


# ============================================
# 4. IVA DINÁMICO
# ============================================
def obtener_configuracion_iva(db: Session) -> Tuple[Decimal, Optional[IVA]]:
    """
    Obtiene la configuración de IVA vigente
    Retorna: (porcentaje_decimal, config_iva)
    """
    iva_config = db.query(IVA).filter(
        IVA.activo == True,
        IVA.es_aplicable == True
    ).first()
    
    if iva_config:
        porcentaje = Decimal(str(iva_config.porcentaje)) / Decimal('100')
        return porcentaje, iva_config
    
    return Decimal('0.00'), None


# ============================================
# 5. CALCULAR TOTALES
# ============================================
def calcular_totales_factura(
    valor_basico: Decimal,
    valor_exceso: Decimal,
    tipo_descuento: str,
    valor_descuento: float,
    porcentaje_iva: Decimal
) -> Dict:
    """
    Calcula todos los totales de la factura
    """
    subtotal_inicial = valor_basico + valor_exceso
    
    # Calcular descuento
    valor_descuento_decimal = Decimal(str(valor_descuento))
    descuento, subtotal_con_descuento = calcular_descuento(
        subtotal=subtotal_inicial,
        tipo_descuento=tipo_descuento,
        valor_descuento=valor_descuento_decimal
    )
    
    # Calcular IVA
    impuesto = subtotal_con_descuento * porcentaje_iva
    
    # Total final
    total_final = subtotal_con_descuento + impuesto
    
    return {
        'subtotal_inicial': subtotal_inicial,
        'descuento': descuento,
        'subtotal_con_descuento': subtotal_con_descuento,
        'impuesto': impuesto,
        'total': total_final
    }


# ============================================
# 6. CREAR MODELO FACTURA
# ============================================
def crear_factura_modelo(
    db: Session,
    lectura: Lectura,
    id_usuario_afi: int,
    id_tarifa: int,
    periodo: str,
    consumo_basico: Dict,
    consumo_exceso: Dict,
    totales: Dict
) -> Factura:
    """
    Crea el objeto Factura en la base de datos
    """
    num_factura = generar_numero_factura(db, periodo)
    
    nueva_factura = Factura(
        num_factura=num_factura,
        id_usuario_afi=id_usuario_afi,
        id_lectura=lectura.id_lectura,
        id_tarifa=id_tarifa,
        consumo_m3=lectura.consumo_m3,
        exceso_m3=float(consumo_exceso['exceso_m3']),
        valor_consumo=consumo_basico['valor'],
        valor_exceso=consumo_exceso['valor_exceso'],
        descuento=totales['descuento'],
        subtotal=totales['subtotal_con_descuento'],
        impuesto=totales['impuesto'],
        total=totales['total'],
        fecha_emision=date.today(),
        periodo=periodo,
        estado_factura='pendiente'
    )
    
    db.add(nueva_factura)
    db.flush()
    
    return nueva_factura


# ============================================
# 7. CREAR DETALLES
# ============================================
def crear_detalles_consumo(
    db: Session,
    factura: Factura,
    consumo_total: Decimal,
    consumo_basico: Dict,
    consumo_exceso: Dict
) -> int:
    """
    Crea los detalles de consumo de la factura
    Retorna: cantidad de detalles creados
    """
    detalles_creados = 0
    
    # Detalle 1: Consumo básico (PRECIO FIJO)
    detalle_basico = DetalleFactura(
        id_factura=factura.id_factura,
        tipo_detalle='consumo',
        id_servicio=None,
        subtotal_detalle=consumo_basico['valor'],
        descripcion=f"{consumo_basico['tarifa_nombre']}: Cargo fijo 0-{float(consumo_basico['limite_m3']):.0f} m³ = ${float(consumo_basico['valor']):.2f} (consumo: {float(consumo_total):.2f} m³)"
    )
    db.add(detalle_basico)
    detalles_creados += 1
    print(f"   📝 Detalle básico: {detalle_basico.descripcion}")
    
    # Detalle 2: Exceso (si aplica)
    if consumo_exceso['aplica']:
        detalle_exceso = DetalleFactura(
            id_factura=factura.id_factura,
            tipo_detalle='consumo',
            id_servicio=None,
            subtotal_detalle=consumo_exceso['valor_exceso'],
            descripcion=f"{consumo_exceso['tarifa_nombre']}: {float(consumo_exceso['exceso_m3']):.2f} m³ × ${float(consumo_exceso['precio_unitario']):.2f}/m³ = ${float(consumo_exceso['valor_exceso']):.2f}"
        )
        db.add(detalle_exceso)
        detalles_creados += 1
        print(f"   📝 Detalle exceso: {detalle_exceso.descripcion}")
    
    return detalles_creados


# ============================================
# 8. LOGGING/IMPRESIÓN
# ============================================
def imprimir_resumen_factura(
    consumo_total: Decimal,
    periodo: str,
    consumo_basico: Dict,
    consumo_exceso: Dict,
    totales: Dict,
    iva_config: Optional[IVA],
    tipo_descuento: str,
    valor_descuento: float
):
    """
    Imprime un resumen detallado de la factura generada
    """
    print(f"\n{'='*60}")
    print(f"💰 CALCULANDO FACTURA")
    print(f"{'='*60}")
    print(f"📊 Consumo total: {consumo_total} m³")
    print(f"📅 Periodo: {periodo}")
    
    print(f"\n💵 CONSUMO BÁSICO:")
    print(f"   Tarifa: {consumo_basico['tarifa_nombre']}")
    print(f"   Precio FIJO: ${consumo_basico['valor']}")
    print(f"   (hasta {consumo_basico['limite_m3']} m³)")
    
    if consumo_exceso['aplica']:
        print(f"\n💵 EXCESO:")
        print(f"   Tarifa: {consumo_exceso['tarifa_nombre']}")
        print(f"   m³ de exceso: {consumo_exceso['exceso_m3']}")
        print(f"   Precio por m³: ${consumo_exceso['precio_unitario']}/m³")
        print(f"   ✅ Total exceso: ${consumo_exceso['valor_exceso']}")
    else:
        print(f"\n✅ Consumo dentro del rango básico")
    
    print(f"\n{'='*60}")
    print(f"💰 RESUMEN DE FACTURA")
    print(f"{'='*60}")
    print(f"   📦 Consumo básico: ${consumo_basico['valor']}")
    print(f"   📦 Exceso: ${consumo_exceso['valor_exceso']}")
    print(f"   ➖ Subtotal: ${totales['subtotal_inicial']}")
    
    if tipo_descuento != 'ninguno' and totales['descuento'] > 0:
        if tipo_descuento == 'porcentaje':
            print(f"   💸 Descuento ({valor_descuento}%): -${totales['descuento']}")
        else:
            print(f"   💸 Descuento (fijo): -${totales['descuento']}")
    
    print(f"   ➖ Subtotal con descuento: ${totales['subtotal_con_descuento']}")
    
    if iva_config:
        print(f"   💰 IVA ({iva_config.porcentaje}%): ${totales['impuesto']}")
    else:
        print(f"   💰 IVA: $0.00 (no aplicable)")
    
    print(f"   ✅ TOTAL FINAL: ${totales['total']}")
    print(f"{'='*60}\n")


# ============================================================
# 9. FUNCIÓN PRINCIPAL DE GENERACIÓN DE FACTURA desde LECTURAs
# ===========================================================
def generar_factura_desde_lectura(
    db: Session,
    lectura: Lectura,
    tipo_descuento: str = 'ninguno',
    valor_descuento: float = 0.0,
    aplicar_servicios: bool = True,
    aplicar_multas: bool = True
) -> Tuple[bool, str, Optional[Factura]]:
    """
    Genera factura desde lectura de manera modular y optimizada
    
    Args:
        db: Sesión de base de datos
        lectura: Objeto Lectura
        tipo_descuento: 'ninguno', 'porcentaje', o 'fijo'
        valor_descuento: Valor del descuento
        aplicar_servicios: Incluir servicios adicionales
        aplicar_multas: Incluir multas pendientes
    
    Returns:
        (exito, mensaje, factura_generada)
    """
    try:
        # ============================================
        # PASO 1: VALIDACIONES
        # ============================================
        es_valido, mensaje, datos = validar_datos_facturacion(db, lectura)
        if not es_valido:
            return False, mensaje, None
        
        id_usuario_afi = datos['id_usuario_afi']
        periodo = datos['periodo']
        consumo_total = datos['consumo_total']
        
        # ============================================
        # PASO 2: OBTENER TARIFAS
        # ============================================
        tarifa_basica, tarifa_exceso = obtener_tarifas_vigentes(db)
        
        if not tarifa_basica:
            return False, "No se encontró tarifa básica vigente", None
        
        # ============================================
        # PASO 3: CALCULAR CONSUMOS
        # ============================================
        consumo_basico = calcular_consumo_basico(tarifa_basica)
        
        consumo_exceso = calcular_consumo_exceso(
            consumo_total=consumo_total,
            limite_basico=consumo_basico['limite_m3'],
            tarifa_exceso=tarifa_exceso
        )
        
        # ============================================
        # PASO 4: OBTENER IVA
        # ============================================
        porcentaje_iva, iva_config = obtener_configuracion_iva(db)
        
        # ============================================
        # PASO 5: CALCULAR TOTALES
        # ============================================
        totales = calcular_totales_factura(
            valor_basico=consumo_basico['valor'],
            valor_exceso=consumo_exceso['valor_exceso'],
            tipo_descuento=tipo_descuento,
            valor_descuento=valor_descuento,
            porcentaje_iva=porcentaje_iva
        )
        
        # ============================================
        # PASO 6: IMPRIMIR RESUMEN
        # ============================================
        imprimir_resumen_factura(
            consumo_total=consumo_total,
            periodo=periodo,
            consumo_basico=consumo_basico,
            consumo_exceso=consumo_exceso,
            totales=totales,
            iva_config=iva_config,
            tipo_descuento=tipo_descuento,
            valor_descuento=valor_descuento
        )
        
        # ============================================
        # PASO 7: CREAR FACTURA
        # ============================================
        nueva_factura = crear_factura_modelo(
            db=db,
            lectura=lectura,
            id_usuario_afi=id_usuario_afi,
            id_tarifa=consumo_basico['tarifa_id'],
            periodo=periodo,
            consumo_basico=consumo_basico,
            consumo_exceso=consumo_exceso,
            totales=totales
        )
        
        print(f"✅ Factura creada: {nueva_factura.num_factura}")
        
        # ============================================
        # PASO 8: CREAR DETALLES
        # ============================================
        detalles_creados = crear_detalles_consumo(
            db=db,
            factura=nueva_factura,
            consumo_total=consumo_total,
            consumo_basico=consumo_basico,
            consumo_exceso=consumo_exceso
        )
        
        print(f"   ✅ {detalles_creados} detalle(s) creado(s)")
        
        # ============================================
        # PASO 9: AGREGAR MULTAS (SI APLICA)
        # ============================================
        if aplicar_multas:
            print(f"\n{'='*60}")
            print(f"💸 BUSCANDO MULTAS PENDIENTES")
            print(f"{'='*60}")
            
            multas_agregadas = agregar_multas_a_factura(
                db=db,
                id_factura=nueva_factura.id_factura,
                id_usuario_afi=id_usuario_afi
            )
            
            if multas_agregadas > 0:
                print(f"   ✅ {multas_agregadas} multa(s) agregada(s)")
                recalcular_totales_factura(db, nueva_factura)
        
        # ============================================
        # PASO 10: COMMIT FINAL
        # ============================================
        db.commit()
        db.refresh(nueva_factura)
        
        print(f"\n{'='*60}")
        print(f"✅ FACTURA GENERADA EXITOSAMENTE")
        print(f"   Número: {nueva_factura.num_factura}")
        print(f"   Total: ${nueva_factura.total}")
        print(f"{'='*60}\n")
        
        return True, f"Factura {nueva_factura.num_factura} generada exitosamente", nueva_factura
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error generando factura: {e}")
        import traceback
        traceback.print_exc()
        return False, f"Error al generar factura: {str(e)}", None


# ============================================
# 10. FUNCIÓN SIMPLIFICADA PARA REGENERAR
# ============================================
def regenerar_factura_desde_lectura_anulada(
    db: Session,
    lectura: Lectura
) -> Tuple[bool, str, Optional[Factura]]:
    """
    Versión simplificada para regenerar factura cuando la anterior fue anulada
    No aplica descuentos personalizados, solo genera factura estándar
    """
    return generar_factura_desde_lectura(
        db=db,
        lectura=lectura,
        tipo_descuento='ninguno',
        valor_descuento=0.0,
        aplicar_servicios=True,
        aplicar_multas=True
    )




def agregar_multas_a_factura(
    db: Session,
    id_factura: int,
    id_usuario_afi: int
) -> int:
    """
    Agrega multas pendientes del afiliado como detalles de factura
    
    Condiciones:
    - activo = True
    - estado = 'pendiente'
    - facturado = False
    
    Returns:
        int: Cantidad de multas agregadas
    """
    try:
        print(f"\n{'='*60}")
        print(f"💸 BUSCANDO MULTAS PENDIENTES")
        print(f"{'='*60}")
        
        # 🆕 BUSCAR MULTAS PENDIENTES
        multas_pendientes = db.query(MultaAfiliado).filter(
            MultaAfiliado.id_usuario_afi == id_usuario_afi,
            MultaAfiliado.activo == True,
            MultaAfiliado.estado == 'pendiente',
            MultaAfiliado.facturado == False
        ).all()
        
        if not multas_pendientes:
            print(f"   ℹ️  No hay multas pendientes para el afiliado {id_usuario_afi}")
            return 0
        
        print(f"   📋 Se encontraron {len(multas_pendientes)} multa(s) pendiente(s)")
        
        multas_agregadas = 0
        
        for multa in multas_pendientes:
            # Obtener tipo de multa para descripción
            tipo_multa = db.query(TipoMulta).filter(
                TipoMulta.id_tipo_multa == multa.id_tipo_multa
            ).first()
            
            nombre_multa = tipo_multa.nombre_multa if tipo_multa else "Multa"
            
            # Crear detalle de factura
            detalle_multa = DetalleFactura(
                id_factura=id_factura,
                tipo_detalle='multa',
                id_multa_afiliados=multa.id_multa_afi,
                id_servicio=None,  # Las multas no son servicios
                subtotal_detalle=multa.monto,
                descripcion=f"{nombre_multa} - {multa.observaciones or 'Sin observaciones'}"
            )
            
            db.add(detalle_multa)
            
            # 🆕 MARCAR MULTA COMO FACTURADA
            multa.facturado = True
            multa.estado = 'facturado'
            
            multas_agregadas += 1
            
            print(f"   ✅ Multa #{multa.id_multa_afi}: {nombre_multa} - ${multa.monto}")
        
        db.flush()
        
        print(f"\n   💰 Total multas agregadas: {multas_agregadas}")
        print(f"{'='*60}\n")
        
        return multas_agregadas
    
    except Exception as e:
        print(f"❌ Error agregando multas: {e}")
        return 0
    
def calcular_descuento(
    subtotal: Decimal,
    tipo_descuento: str,
    valor_descuento: Decimal
) -> Tuple[Decimal, Decimal]:
    """
    Calcula el descuento según el tipo
    
    Returns:
        (monto_descuento, total_con_descuento)
    """
    descuento = Decimal('0.00')
    
    if tipo_descuento == 'porcentaje' and valor_descuento > 0:
        # Calcular porcentaje: subtotal * (porcentaje / 100)
        descuento = subtotal * (valor_descuento / Decimal('100'))
        
    elif tipo_descuento == 'valor' and valor_descuento > 0:
        # Aplicar valor fijo, pero no puede ser mayor al subtotal
        descuento = min(valor_descuento, subtotal)
    
    # Total después del descuento
    total_con_descuento = subtotal - descuento
    
    return descuento, total_con_descuento

def recalcular_totales_factura(db: Session, factura: Factura):
    """
    Recalcula subtotal, impuesto y total de la factura
    sumando todos los detalles (consumo + multas + servicios)
    IVA dinámico desde T_IVA
    """
    try:
        print(f"\n🔄 RECALCULANDO TOTALES DE FACTURA {factura.num_factura}")
        
        # Sumar todos los detalles
        detalles = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura.id_factura
        ).all()
        
        subtotal_nuevo = Decimal('0.00')
        for detalle in detalles:
            subtotal_nuevo += detalle.subtotal_detalle
            print(f"   + {detalle.tipo_detalle}: ${detalle.subtotal_detalle}")
        
        # Aplicar descuento
        subtotal_final = subtotal_nuevo - factura.descuento
        
        # ✅ CALCULAR IVA DINÁMICAMENTE DESDE T_IVA
        iva_config = db.query(IVA).filter(
            IVA.activo == True,
            IVA.es_aplicable == True  # ✅ CORREGIDO
        ).first()
        
        if iva_config:
            porcentaje_iva = Decimal(str(iva_config.porcentaje)) / Decimal('100')
            impuesto_nuevo = subtotal_final * porcentaje_iva
            print(f"\n   💰 IVA aplicado: {iva_config.porcentaje}%")
        else:
            impuesto_nuevo = Decimal('0.00')
            print(f"\n   💰 IVA: 0% (no hay config activa y aplicable)")
        
        # Total
        total_nuevo = subtotal_final + impuesto_nuevo
        
        # Actualizar factura
        factura.subtotal = subtotal_final
        factura.impuesto = impuesto_nuevo
        factura.total = total_nuevo
        
        db.flush()
        
        print(f"\n   📊 NUEVOS TOTALES:")
        print(f"      Subtotal: ${subtotal_final}")
        print(f"      Impuesto: ${impuesto_nuevo}")
        print(f"      Total: ${total_nuevo}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"❌ Error recalculando totales: {e}")


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


def marcar_facturas_vencidas(db: Session, dias_vencimiento: int = dias_vencimientos) -> int:
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

# ========================================
# AGREGAR SERVICIOS A UNA FACTURA
# ========================================

def agregar_servicios_a_factura(
    db: Session,
    id_factura: int,
    id_servicios: List[int]
) -> int:
    """
    Agrega servicios adicionales a una factura específica como detalles
    
    Condiciones:
    - servicio.activo = True
    - servicio.es_vigente = True
    - No duplicar servicios ya agregados
    
    Returns:
        int: Cantidad de servicios agregados
    """
    try:
        print(f"\n{'='*60}")
        print(f"💼 AGREGANDO SERVICIOS A FACTURA #{id_factura}")
        print(f"{'='*60}")
        
        # Validar que la factura existe y está pendiente
        factura = db.query(Factura).filter(
            Factura.id_factura == id_factura
        ).first()
        
        if not factura:
            print(f"   ❌ Factura no encontrada")
            return 0
            
        if factura.estado_factura not in ['pendiente', 'vencida']:
            print(f"   ❌ No se pueden agregar servicios a factura en estado '{factura.estado_factura}'")
            return 0
        
        # Buscar servicios activos
        servicios = db.query(Servicio).filter(
            Servicio.id_servicio.in_(id_servicios),
            Servicio.activo == True,
            Servicio.es_vigente == True
        ).all()
        
        if not servicios:
            print(f"   ℹ️  No hay servicios válidos para agregar")
            return 0
        
        print(f"   📋 Se encontraron {len(servicios)} servicio(s) válido(s)")
        
        servicios_agregados = 0
        
        for servicio in servicios:
            # 🔥 VERIFICAR QUE NO EXISTA YA ESTE SERVICIO EN LA FACTURA
            existe = db.query(DetalleFactura).filter(
                DetalleFactura.id_factura == id_factura,
                DetalleFactura.tipo_detalle == 'servicio',
                DetalleFactura.id_servicio == servicio.id_servicio
            ).first()
            
            if existe:
                print(f"   ⚠️  Servicio '{servicio.nombre}' ya existe en la factura")
                continue
            
            # Crear detalle de factura
            detalle_servicio = DetalleFactura(
                id_factura=id_factura,
                tipo_detalle='servicio',
                id_servicio=servicio.id_servicio,
                id_multa_afiliados=None,
                subtotal_detalle=servicio.precio_base,
                descripcion=f"{servicio.nombre} - ${float(servicio.precio_base):.2f}"
            )
            
            db.add(detalle_servicio)
            servicios_agregados += 1
            
            print(f"   ✅ Servicio: {servicio.nombre} - ${servicio.precio_base}")
        
        db.flush()
        
        print(f"\n   💰 Total servicios agregados: {servicios_agregados}")
        print(f"{'='*60}\n")
        
        return servicios_agregados
    
    except Exception as e:
        print(f"❌ Error agregando servicios: {e}")
        return 0


def recalcular_factura(
    db: Session,
    factura: Factura,
    lectura: Lectura
) -> Factura:
    """
    Recalcula una factura existente cuando se actualiza la lectura
    - Elimina SOLO los detalles de consumo (básico y exceso)
    - Mantiene multas y servicios adicionales
    - Recrea los detalles de consumo con nuevos valores
    - Usa recalcular_totales_factura() para actualizar el total final
    
    Args:
        db: Sesión de base de datos
        factura: Factura a recalcular
        lectura: Lectura actualizada
    
    Returns:
        Factura actualizada
    """
    try:
        print(f"\n{'='*60}")
        print(f"🔄 RECALCULANDO FACTURA {factura.num_factura}")
        print(f"{'='*60}")
        
        # ============================================
        # 1. OBTENER TARIFAS VIGENTES
        # ============================================
        tarifa_basica, tarifa_exceso = obtener_tarifas_vigentes(db)
        
        if not tarifa_basica:
            raise ValueError("No se encontró tarifa básica vigente")
        
        # ============================================
        # 2. CALCULAR NUEVOS CONSUMOS
        # ============================================
        consumo_total = Decimal(str(lectura.consumo_m3))
        
        print(f"📊 Nuevo consumo: {consumo_total} m³")
        
        consumo_basico = calcular_consumo_basico(tarifa_basica)
        
        consumo_exceso = calcular_consumo_exceso(
            consumo_total=consumo_total,
            limite_basico=consumo_basico['limite_m3'],
            tarifa_exceso=tarifa_exceso
        )
        
        # ============================================
        # 3. ELIMINAR SOLO DETALLES DE CONSUMO
        # ============================================
        print(f"\n🗑️ Eliminando detalles de consumo antiguos...")
        
        detalles_consumo_antiguos = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura.id_factura,
            DetalleFactura.tipo_detalle == 'consumo'
        ).all()
        
        for detalle in detalles_consumo_antiguos:
            print(f"   ❌ Eliminado: {detalle.descripcion}")
            db.delete(detalle)
        
        db.flush()
        
        # ============================================
        # 4. CREAR NUEVOS DETALLES DE CONSUMO
        # ============================================
        print(f"\n✅ Creando nuevos detalles de consumo...")
        
        detalles_creados = crear_detalles_consumo(
            db=db,
            factura=factura,
            consumo_total=consumo_total,
            consumo_basico=consumo_basico,
            consumo_exceso=consumo_exceso
        )
        
        print(f"   ✅ {detalles_creados} nuevo(s) detalle(s) creado(s)")
        
        # ============================================
        # 5. ACTUALIZAR CAMPOS DE CONSUMO EN FACTURA
        # ============================================
        factura.consumo_m3 = lectura.consumo_m3
        factura.exceso_m3 = float(consumo_exceso['exceso_m3'])
        factura.valor_consumo = consumo_basico['valor']
        factura.valor_exceso = consumo_exceso['valor_exceso']
        factura.id_tarifa = consumo_basico['tarifa_id']
        
        db.flush()
        
        # ============================================
        # 6. RECALCULAR TOTALES (CONSUMO + MULTAS + SERVICIOS)
        # ============================================
        print(f"\n💰 Recalculando totales finales...")
        
        recalcular_totales_factura(db, factura)
        
        db.commit()
        db.refresh(factura)
        
        print(f"\n{'='*60}")
        print(f"✅ FACTURA RECALCULADA EXITOSAMENTE")
        print(f"   Número: {factura.num_factura}")
        print(f"   Consumo anterior → nuevo: {consumo_total} m³")
        print(f"   Total: ${factura.total}")
        print(f"{'='*60}\n")
        
        return factura
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error recalculando factura: {e}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Error al recalcular factura: {str(e)}")


def listar_detalles_no_consumo(db: Session, id_factura: int) -> Dict:
    """
    Lista todos los detalles que NO son de consumo
    Útil para debugging y verificación
    """
    detalles_multas = db.query(DetalleFactura).filter(
        DetalleFactura.id_factura == id_factura,
        DetalleFactura.tipo_detalle == 'multa'
    ).all()
    
    detalles_servicios = db.query(DetalleFactura).filter(
        DetalleFactura.id_factura == id_factura,
        DetalleFactura.tipo_detalle == 'servicio'
    ).all()
    
    return {
        'multas': len(detalles_multas),
        'servicios': len(detalles_servicios),
        'detalles_multas': [d.descripcion for d in detalles_multas],
        'detalles_servicios': [d.descripcion for d in detalles_servicios]
    }


def reactivar_factura_anulada(
    db: Session,
    factura_anulada: Factura,
    lectura: Lectura
) -> Factura:
    """
    Reactiva una factura anulada recalculándola completamente
    - Cambia estado de 'anulada' a 'pendiente'
    - Elimina TODOS los detalles antiguos
    - Recalcula consumo, multas y totales
    - Mantiene el MISMO número de factura
    
    Args:
        db: Sesión de base de datos
        factura_anulada: Factura en estado 'anulada'
        lectura: Lectura actualizada
    
    Returns:
        Factura reactivada
    """
    try:
        print(f"\n{'='*60}")
        print(f"♻️ REACTIVANDO FACTURA ANULADA {factura_anulada.num_factura}")
        print(f"{'='*60}")
        
        # ============================================
        # 1. VALIDAR QUE ESTÉ ANULADA
        # ============================================
        if factura_anulada.estado_factura != 'anulada':
            raise ValueError(f"La factura no está anulada, estado actual: {factura_anulada.estado_factura}")
        
        # ============================================
        # 2. ELIMINAR TODOS LOS DETALLES ANTIGUOS
        # ============================================
        print(f"\n🗑️ Eliminando todos los detalles antiguos...")
        
        detalles_antiguos = db.query(DetalleFactura).filter(
            DetalleFactura.id_factura == factura_anulada.id_factura
        ).all()
        
        for detalle in detalles_antiguos:
            print(f"   ❌ Eliminado: {detalle.tipo_detalle} - {detalle.descripcion[:50]}...")
            db.delete(detalle)
        
        db.flush()
        print(f"   ✅ {len(detalles_antiguos)} detalle(s) eliminado(s)")
        
        # ============================================
        # 3. OBTENER TARIFAS VIGENTES
        # ============================================
        tarifa_basica, tarifa_exceso = obtener_tarifas_vigentes(db)
        
        if not tarifa_basica:
            raise ValueError("No se encontró tarifa básica vigente")
        
        # ============================================
        # 4. CALCULAR NUEVOS CONSUMOS
        # ============================================
        consumo_total = Decimal(str(lectura.consumo_m3))
        
        print(f"\n📊 Recalculando consumo: {consumo_total} m³")
        
        consumo_basico = calcular_consumo_basico(tarifa_basica)
        
        consumo_exceso = calcular_consumo_exceso(
            consumo_total=consumo_total,
            limite_basico=consumo_basico['limite_m3'],
            tarifa_exceso=tarifa_exceso
        )
        
        # ============================================
        # 5. OBTENER IVA
        # ============================================
        porcentaje_iva, iva_config = obtener_configuracion_iva(db)
        
        # ============================================
        # 6. CALCULAR TOTALES (SIN DESCUENTO)
        # ============================================
        totales = calcular_totales_factura(
            valor_basico=consumo_basico['valor'],
            valor_exceso=consumo_exceso['valor_exceso'],
            tipo_descuento='ninguno',
            valor_descuento=0.0,
            porcentaje_iva=porcentaje_iva
        )
        
        # ============================================
        # 7. ACTUALIZAR FACTURA
        # ============================================
        factura_anulada.id_lectura = lectura.id_lectura
        factura_anulada.id_tarifa = consumo_basico['tarifa_id']
        factura_anulada.consumo_m3 = lectura.consumo_m3
        factura_anulada.exceso_m3 = float(consumo_exceso['exceso_m3'])
        factura_anulada.valor_consumo = consumo_basico['valor']
        factura_anulada.valor_exceso = consumo_exceso['valor_exceso']
        factura_anulada.descuento = Decimal('0.00')
        factura_anulada.subtotal = totales['subtotal_con_descuento']
        factura_anulada.impuesto = totales['impuesto']
        factura_anulada.total = totales['total']
        factura_anulada.fecha_emision = date.today()
        factura_anulada.estado_factura = 'pendiente'  # ✅ CAMBIAR ESTADO
        
        db.flush()
        
        print(f"\n✅ Factura actualizada:")
        print(f"   Estado: anulada → pendiente")
        print(f"   Consumo: {consumo_total} m³")
        print(f"   Total: ${totales['total']}")
        
        # ============================================
        # 8. CREAR NUEVOS DETALLES DE CONSUMO
        # ============================================
        print(f"\n✅ Creando nuevos detalles de consumo...")
        
        detalles_creados = crear_detalles_consumo(
            db=db,
            factura=factura_anulada,
            consumo_total=consumo_total,
            consumo_basico=consumo_basico,
            consumo_exceso=consumo_exceso
        )
        
        # ============================================
        # 9. AGREGAR MULTAS PENDIENTES
        # ============================================
        print(f"\n💸 Buscando multas pendientes...")
        
        multas_agregadas = agregar_multas_a_factura(
            db=db,
            id_factura=factura_anulada.id_factura,
            id_usuario_afi=factura_anulada.id_usuario_afi
        )
        
        if multas_agregadas > 0:
            print(f"   ✅ {multas_agregadas} multa(s) agregada(s)")
            recalcular_totales_factura(db, factura_anulada)
        
        # ============================================
        # 10. COMMIT
        # ============================================
        db.commit()
        db.refresh(factura_anulada)
        
        print(f"\n{'='*60}")
        print(f"✅ FACTURA REACTIVADA EXITOSAMENTE")
        print(f"   Número: {factura_anulada.num_factura}")
        print(f"   Estado: pendiente")
        print(f"   Total: ${factura_anulada.total}")
        print(f"{'='*60}\n")
        
        return factura_anulada
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error reactivando factura: {e}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Error al reactivar factura: {str(e)}")

