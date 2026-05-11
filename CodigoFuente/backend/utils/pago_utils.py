"""
utils/pago_utils.py
Funciones auxiliares para procesamiento de pagos
"""

from sqlalchemy.orm import Session
from decimal import Decimal
from typing import List, Tuple
from datetime import datetime
from models.factura import Factura
from models.detalle_factura import DetalleFactura
from models.multa_afiliado import MultaAfiliado
from models.affiliate import UsuarioAfiliado
from models.user import UsuarioSistema
from fastapi import HTTPException, status


# ========================================
# VALIDACIONES
# ========================================

def validar_factura_para_pago(factura_id: int, db: Session) -> Factura:
    """Valida que la factura existe y está en estado válido para pago."""
    factura = db.query(Factura).filter(Factura.id_factura == factura_id).first()
    
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada"
        )
    
    if factura.estado_factura not in ['pendiente', 'vencida', 'emitida', 'parcial']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede registrar pago para factura en estado '{factura.estado_factura}'"
        )
    
    return factura


def validar_afiliado(afiliado_id: int, db: Session) -> UsuarioAfiliado:
    """Valida que el afiliado existe."""
    afiliado = db.query(UsuarioAfiliado).filter(
        UsuarioAfiliado.id_usuario_afi == afiliado_id
    ).first()
    
    if not afiliado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Afiliado no encontrado"
        )
    
    return afiliado


def validar_monto_pago(
    monto_pago: Decimal,
    monto_esperado: Decimal,
    incluir_multas: bool
) -> None:
    """Valida que el monto del pago sea correcto."""
    if not incluir_multas and monto_pago > monto_esperado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El monto ${monto_pago} excede el total sin multas ${monto_esperado:.2f}"
        )


# ========================================
# CÁLCULOS DE MONTOS
# ========================================

def calcular_montos_con_multas(
    factura: Factura,
    incluir_multas: bool,
    tasa_impuesto: Decimal,
    db: Session
) -> Tuple[Decimal, List[DetalleFactura], Decimal]:
    """
    Calcula montos con y sin multas.
    
    Returns:
        Tuple[monto_sin_multas, multas_en_factura, total_multas]
    """
    detalles = db.query(DetalleFactura).filter(
        DetalleFactura.id_factura == factura.id_factura
    ).all()
    from utils.facturacion import calcular_iva_sobre_detalles
    
    monto_multas_subtotal = Decimal('0.00')
    subtotal_sin_multas = Decimal('0.00')
    multas_en_factura = []
    detalles_sin_multas = []
    
    for detalle in detalles:
        if detalle.tipo_detalle == 'multa':
            multas_en_factura.append(detalle)
            monto_multas_subtotal += detalle.subtotal_detalle
        else:
            subtotal_sin_multas += detalle.subtotal_detalle
            detalles_sin_multas.append(detalle)
    
    # Calcular descuento proporcional
    descuento_sin_multas = Decimal('0.00')
    if factura.descuento and factura.descuento > 0 and factura.subtotal > 0:
        proporcion = subtotal_sin_multas / factura.subtotal
        descuento_sin_multas = factura.descuento * proporcion
    
    # Calcular total sin multas con IVA dinámico
    base_sin_multas = subtotal_sin_multas - descuento_sin_multas
    _, impuesto_sin_multas = calcular_iva_sobre_detalles(
        detalles_sin_multas,
        tasa_impuesto,
        descuento_sin_multas
    )
    monto_sin_multas = base_sin_multas + impuesto_sin_multas
    
    # Calcular total de multas con IVA
    total_multas = monto_multas_subtotal
    
    print(f"\n📊 ANÁLISIS DE FACTURA {factura.num_factura}")
    print(f"   IVA: {float(tasa_impuesto * 100):.2f}%")
    print(f"   Total factura: ${factura.total}")
    print(f"   Total sin multas: ${monto_sin_multas}")
    print(f"   Total multas: ${total_multas}")
    
    return monto_sin_multas, multas_en_factura, total_multas


# ========================================
# PROCESAMIENTO DE MULTAS
# ========================================

def procesar_multas_pagadas(
    multas_en_factura: List[DetalleFactura],
    db: Session
) -> int:
    """Marca multas como pagadas y retorna cantidad procesada."""
    multas_pagadas = 0
    
    print(f"\n{'='*60}")
    print(f"✅ PROCESANDO PAGO COMPLETO (CON MULTAS)")
    print(f"{'='*60}")
    
    for detalle in multas_en_factura:
        if detalle.id_multa_afiliados:
            multa = db.query(MultaAfiliado).filter(
                MultaAfiliado.id_multa_afi == detalle.id_multa_afiliados
            ).first()
            
            if multa and multa.estado != 'pagada':
                print(f"   Multa #{multa.id_multa_afi} → 'pagada'")
                multa.estado = 'pagada'
                multa.fecha_pago = datetime.now().date()
                multa.facturado = True
                multas_pagadas += 1
                db.flush()
    
    print(f"✅ {multas_pagadas} multa(s) pagada(s)")
    print(f"{'='*60}\n")
    
    return multas_pagadas


def liberar_multas_no_pagadas(
    multas_en_factura: List[DetalleFactura],
    db: Session
) -> int:
    """Libera multas para próxima facturación y retorna cantidad liberada."""
    multas_liberadas = 0
    
    print(f"\n{'='*60}")
    print(f"⚠️ PROCESANDO PAGO PARCIAL (SIN MULTAS)")
    print(f"{'='*60}")
    
    for detalle in multas_en_factura:
        if detalle.id_multa_afiliados:
            multa = db.query(MultaAfiliado).filter(
                MultaAfiliado.id_multa_afi == detalle.id_multa_afiliados
            ).first()
            
            if multa:
                print(f"   Multa #{multa.id_multa_afi} → 'pendiente' (liberada)")
                multa.estado = 'pendiente'
                multa.facturado = False
                multa.fecha_pago = None
                multas_liberadas += 1
                db.flush()
                db.refresh(multa)
    
    print(f"⚠️ {multas_liberadas} multa(s) liberada(s)")
    print(f"{'='*60}\n")
    
    return multas_liberadas
