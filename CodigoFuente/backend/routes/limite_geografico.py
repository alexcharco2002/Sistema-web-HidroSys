# routes/limite_geografico.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from database import get_db
from models.limite_geografico import LimiteGeografico
from schemas.limite_geografico import (
    LimiteGeograficoCreate,
    LimiteGeograficoUpdate,
    LimiteGeograficoResponse,
    CoordenadaValidacion,
    CoordenadaValidacionResponse
)

router = APIRouter(
    prefix="/limites-geograficos",
    tags=["Límites Geográficos"]
)


@router.get("/", response_model=List[LimiteGeograficoResponse])
def listar_limites(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """Lista todos los límites geográficos con filtros opcionales"""
    query = db.query(LimiteGeografico)
    
    if activo is not None:
        query = query.filter(LimiteGeografico.activo == activo)
    
    limites = query.offset(skip).limit(limit).all()
    return limites


@router.get("/activo", response_model=Optional[LimiteGeograficoResponse])
def obtener_limite_activo(db: Session = Depends(get_db)):
    """Obtiene el límite geográfico actualmente activo"""
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.activo == True
    ).first()
    return limite


@router.get("/{limite_id}", response_model=LimiteGeograficoResponse)
def obtener_limite(
    limite_id: int,
    db: Session = Depends(get_db)
):
    """Obtiene un límite geográfico por ID"""
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.id == limite_id
    ).first()
    
    if not limite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Límite geográfico no encontrado"
        )
    return limite


@router.post("/", response_model=LimiteGeograficoResponse, status_code=status.HTTP_201_CREATED)
def crear_limite(
    limite_data: LimiteGeograficoCreate,
    db: Session = Depends(get_db)
):
    """Crea un nuevo límite geográfico"""
    try:
        nuevo_limite = LimiteGeografico(**limite_data.model_dump())
        db.add(nuevo_limite)
        db.commit()
        db.refresh(nuevo_limite)
        return nuevo_limite
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un límite con el nombre '{limite_data.nombre}'"
        )


@router.put("/{limite_id}", response_model=LimiteGeograficoResponse)
def actualizar_limite(
    limite_id: int,
    limite_data: LimiteGeograficoUpdate,
    db: Session = Depends(get_db)
):
    """Actualiza un límite geográfico existente"""
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.id == limite_id
    ).first()
    
    if not limite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Límite geográfico no encontrado"
        )

    # Actualizar solo los campos proporcionados
    datos_actualizacion = limite_data.model_dump(exclude_unset=True)
    for campo, valor in datos_actualizacion.items():
        setattr(limite, campo, valor)

    try:
        db.commit()
        db.refresh(limite)
        return limite
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al actualizar: nombre duplicado o datos inválidos"
        )


@router.delete("/{limite_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_limite(
    limite_id: int,
    db: Session = Depends(get_db)
):
    """Elimina un límite geográfico"""
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.id == limite_id
    ).first()
    
    if not limite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Límite geográfico no encontrado"
        )

    db.delete(limite)
    db.commit()
    return None


@router.post("/{limite_id}/activar", response_model=LimiteGeograficoResponse)
def activar_limite(
    limite_id: int,
    db: Session = Depends(get_db)
):
    """
    Activa un límite geográfico y desactiva todos los demás.
    Solo puede haber un límite activo a la vez.
    """
    # Desactivar todos los límites
    db.query(LimiteGeografico).update({LimiteGeografico.activo: False})
    
    # Activar el límite seleccionado
    limite = db.query(LimiteGeografico).filter(
        LimiteGeografico.id == limite_id
    ).first()
    
    if not limite:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Límite geográfico no encontrado"
        )
    
    limite.activo = True
    db.commit()
    db.refresh(limite)
    return limite


@router.post("/validar-coordenadas", response_model=CoordenadaValidacionResponse)
def validar_coordenadas(
    coordenada: CoordenadaValidacion,
    db: Session = Depends(get_db)
):
    """
    Valida si unas coordenadas están dentro del límite geográfico activo.
    Si no hay límite activo, todas las coordenadas son válidas.
    """
    # Obtener límite activo
    limite_activo = db.query(LimiteGeografico).filter(
        LimiteGeografico.activo == True
    ).first()
    
    if not limite_activo:
        # Si no hay límite activo, permitir cualquier coordenada
        return CoordenadaValidacionResponse(
            valida=True,
            latitud=coordenada.latitud,
            longitud=coordenada.longitud,
            limite_aplicado=None,
            mensaje="Coordenadas válidas (no hay límite geográfico configurado)"
        )
    
    # Validar coordenadas contra el límite activo
    es_valida = limite_activo.contiene_coordenada(
        float(coordenada.latitud),
        float(coordenada.longitud)
    )
    
    if es_valida:
        mensaje = f"Coordenadas válidas dentro del límite '{limite_activo.nombre}'"
    else:
        mensaje = f"Coordenadas fuera del límite geográfico '{limite_activo.nombre}'"
    
    return CoordenadaValidacionResponse(
        valida=es_valida,
        latitud=coordenada.latitud,
        longitud=coordenada.longitud,
        limite_aplicado=limite_activo.nombre,
        mensaje=mensaje
    )