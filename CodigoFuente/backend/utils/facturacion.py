# utils/facturacion.py

import re
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models.factura import Factura
from models.detalle_factura import DetalleFactura
from models.multa import TipoMulta
from models.tarifa import Tarifa
from models.lectura import Lectura
from models.meter import Medidor
from models.servicio import Servicio
from models.multa_afiliado import MultaAfiliado
from decimal import Decimal
from datetime import date
from typing import Dict, Optional, Tuple, List



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
    id_tarifa_seleccionada: int,
    tipo_descuento: str = 'ninguno',  # 🆕 NUEVO
    valor_descuento: float = 0.0,  # 🆕 NUEVO
    aplicar_servicios: bool = True,
    aplicar_multas: bool = True
) -> Tuple[bool, str, Optional[Factura]]:
    """
    Genera factura con LA TARIFA SELECCIONADA + exceso si aplica
    """
    try:
        # ============================================
        # 1. VALIDACIONES BÁSICAS
        # ============================================
        medidor = db.query(Medidor).filter(
            Medidor.id_medidor == lectura.id_medidor
        ).first()
        
        if not medidor or not medidor.id_usuario_afi:
            return False, "Medidor sin afiliado asociado", None
        
        id_usuario_afi = medidor.id_usuario_afi
        periodo = f"{lectura.fecha_lectura.year}-{str(lectura.fecha_lectura.month).zfill(2)}"
        
        # Verificar factura duplicada
        factura_existente = db.query(Factura).filter(
            Factura.id_usuario_afi == id_usuario_afi,
            Factura.periodo == periodo
        ).first()
        
        if factura_existente:
            return False, f"Ya existe factura para el periodo {periodo}", None
        
        # ============================================
        # 2. OBTENER LA TARIFA SELECCIONADA
        # ============================================
        tarifa = db.query(Tarifa).filter(
            Tarifa.id_tarifa == id_tarifa_seleccionada,
            Tarifa.activo == True
        ).first()
        
        if not tarifa:
            return False, "Tarifa no encontrada", None
        
        consumo_total = Decimal(str(lectura.consumo_m3))
        
        print(f"\n{'='*60}")
        print(f"💰 CALCULANDO FACTURA")
        print(f"{'='*60}")
        print(f"📊 Consumo total: {consumo_total} m³")
        print(f"📅 Periodo: {periodo}")
        print(f"👤 Afiliado ID: {id_usuario_afi}")
        print(f"🎯 Tarifa aplicada: {tarifa.nombre} (ID: {tarifa.id_tarifa})")
        print(f"   Rango: {tarifa.limite_min_m3}-{tarifa.limite_max_m3} m³")
        print(f"   Precio: ${tarifa.precio_por_m3}/m³")
        
        # ============================================
        # 3. CALCULAR CONSUMO BÁSICO + EXCESO
        # ============================================
        limite_max = Decimal(str(tarifa.limite_max_m3)) if tarifa.limite_max_m3 else None
        precio_base = Decimal(str(tarifa.precio_por_m3))
        
        # Inicializar variables
        valor_consumo_basico = Decimal('0.00')
        valor_exceso = Decimal('0.00')
        exceso_m3 = Decimal('0.00')
        consumo_basico_m3 = Decimal('0.00')
        
        if limite_max is None:
            # Sin límite (tarifa abierta) - multiplicar todo
            valor_consumo_basico = consumo_total * precio_base
            consumo_basico_m3 = consumo_total
            
            print(f"\n💵 TARIFA SIN LÍMITE:")
            print(f"   {consumo_total} m³ × ${precio_base}/m³ = ${valor_consumo_basico}")
        
        elif consumo_total <= limite_max:
            # Consumo dentro del rango básico - PRECIO FIJO
            valor_consumo_basico = precio_base  # ✅ NO MULTIPLICAR
            consumo_basico_m3 = consumo_total
            
            print(f"\n💵 CONSUMO BÁSICO (0-{limite_max} m³):")
            print(f"   Precio FIJO: ${precio_base}")
            print(f"   Consumo: {consumo_total} m³ (dentro del rango)")
            print(f"   ✅ Valor: ${valor_consumo_basico}")
        
        else:
            # Consumo SUPERA el límite básico
            valor_consumo_basico = precio_base  # ✅ FIJO hasta el límite
            consumo_basico_m3 = limite_max
            exceso_m3 = consumo_total - limite_max
            
            # Buscar tarifa de exceso
            tarifa_exceso = db.query(Tarifa).filter(
                Tarifa.tipo_tarifa == 'exceso',
                Tarifa.activo == True,
                Tarifa.es_vigente == True
            ).first()
            
            if tarifa_exceso:
                precio_exceso = Decimal(str(tarifa_exceso.precio_por_m3))
                valor_exceso = exceso_m3 * precio_exceso  # ✅ AQUÍ SÍ MULTIPLICAR
                
                print(f"\n💵 CONSUMO BÁSICO (0-{limite_max} m³):")
                print(f"   Precio FIJO: ${precio_base}")
                print(f"   ✅ Valor: ${valor_consumo_basico}")
                print(f"\n💵 EXCESO (>{limite_max} m³):")
                print(f"   m³ de exceso: {exceso_m3}")
                print(f"   Precio: ${precio_exceso}/m³")
                print(f"   ✅ Valor: ${valor_exceso}")
            else:
                print(f"\n⚠️ No se encontró tarifa de exceso, solo se cobrará consumo básico")
        
        print(f"\n📊 TOTALES:")
        print(f"   Valor consumo básico: ${valor_consumo_basico}")
        print(f"   Valor exceso: ${valor_exceso}")
        print(f"   Exceso m³: {exceso_m3}")
        
        # ============================================
        # 4. CALCULAR TOTALES DE FACTURA
        # ============================================
        subtotal_inicial = valor_consumo_basico + valor_exceso
        
        # 🆕 CALCULAR DESCUENTO DINÁMICAMENTE
        valor_descuento_decimal = Decimal(str(valor_descuento))
        descuento, subtotal_con_descuento = calcular_descuento(
            subtotal=subtotal_inicial,
            tipo_descuento=tipo_descuento,
            valor_descuento=valor_descuento_decimal
        )
        
        # IVA fijo al 12% (por ahora)
        impuesto = subtotal_con_descuento * Decimal('0.12')
        total_final = subtotal_con_descuento + impuesto
        
        print(f"\n{'='*60}")
        print(f"💰 RESUMEN DE CÁLCULO")
        print(f"{'='*60}")
        print(f"   Consumo básico: ${valor_consumo_basico}")
        print(f"   Exceso: ${valor_exceso}")
        print(f"   Subtotal: ${subtotal_inicial}")
        
        if tipo_descuento != 'ninguno' and descuento > 0:
            if tipo_descuento == 'porcentaje':
                print(f"   Descuento ({valor_descuento}%): -${descuento}")
            else:
                print(f"   Descuento (valor fijo): -${descuento}")
        else:
            print(f"   Descuento: $0.00 (sin descuento)")
        
        print(f"   Subtotal con descuento: ${subtotal_con_descuento}")
        print(f"   IVA (12%): ${impuesto}")
        print(f"   ✅ TOTAL FINAL: ${total_final}")
        print(f"{'='*60}\n")
        
        # ============================================
        # 5. GENERAR FACTURA
        # ============================================
        num_factura = generar_numero_factura(db, periodo)
        
        nueva_factura = Factura(
            num_factura=num_factura,
            id_usuario_afi=id_usuario_afi,
            id_lectura=lectura.id_lectura,
            id_tarifa=tarifa.id_tarifa,
            consumo_m3=lectura.consumo_m3,
            exceso_m3=float(exceso_m3),
            valor_consumo=valor_consumo_basico,
            valor_exceso=valor_exceso,
            descuento=descuento,  # ✅ Dinámico
            subtotal=subtotal_con_descuento,  # ✅ Ya con descuento aplicado
            impuesto=impuesto,
            total=total_final,  # ✅ Total correcto
            fecha_emision=date.today(),
            periodo=periodo,
            estado_factura='pendiente'
        )
        
        db.add(nueva_factura)
        db.flush()
        
        print(f"\n✅ Factura creada: {num_factura}")
        
        # ============================================
        # 6. CREAR DETALLES
        # ============================================
        
        # Detalle 1: Consumo básico
        detalle_basico = DetalleFactura(
            id_factura=nueva_factura.id_factura,
            tipo_detalle='consumo',
            id_servicio=None,
            subtotal_detalle=valor_consumo_basico,
            descripcion=f"{tarifa.nombre}: 0-{tarifa.limite_max_m3} m³ = ${float(valor_consumo_basico):.2f} (consumo: {float(consumo_basico_m3):.2f} m³)"
        )
        db.add(detalle_basico)
        print(f"   📝 Detalle 1: {detalle_basico.descripcion}")
        
        # Detalle 2: Exceso (si aplica)
        if exceso_m3 > 0 and tarifa_exceso:
            detalle_exceso = DetalleFactura(
                id_factura=nueva_factura.id_factura,
                tipo_detalle='consumo',
                id_servicio=None,
                subtotal_detalle=valor_exceso,
                descripcion=f"EXCESO: {float(exceso_m3):.2f} m³ × ${float(precio_exceso):.2f}/m³ = ${float(valor_exceso):.2f}"
            )
            db.add(detalle_exceso)
            print(f"   📝 Detalle 2: {detalle_exceso.descripcion}")
        
        # ============================================
        # 7. AGREGAR MULTAS PENDIENTES
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
                # Recalcular totales con multas
                recalcular_totales_factura(db, nueva_factura)
        
        # ============================================
        # 8. COMMIT FINAL
        # ============================================
        db.commit()
        db.refresh(nueva_factura)
        
        print(f"\n{'='*60}")
        print(f"✅ FACTURA GENERADA EXITOSAMENTE")
        print(f"   Número: {num_factura}")
        print(f"   Total: ${nueva_factura.total}")
        print(f"{'='*60}\n")
        
        return True, f"Factura {num_factura} generada exitosamente", nueva_factura
    
    except Exception as e:
        db.rollback()
        print(f"❌ Error generando factura: {e}")
        import traceback
        traceback.print_exc()
        return False, f"Error al generar factura: {str(e)}", None


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
        
        # Calcular impuesto (12%)
        impuesto_nuevo = subtotal_final * Decimal('0.12')
        
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

# squemas para agregar servicos masivo a datelles 
class AplicarServiciosMasivoRequest(BaseModel):
    id_servicios: List[int] = Field(
        ..., 
        description="IDs de servicios a aplicar"
    )
    periodo: str = Field(
        ..., 
        description="Período de facturas (YYYY-MM)"
    )
    aplicar_a_todos: bool = Field(
        False, 
        description="True para aplicar a todos los usuarios del período"
    )
    id_usuarios: Optional[List[int]] = Field(
        None, 
        description="IDs de usuarios específicos (si aplicar_a_todos=False)"
    )
