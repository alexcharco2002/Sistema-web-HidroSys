# routes/geolocation.py
# ============================================================================
# ROUTER EXCLUSIVO DE GEOLOCALIZACIÓN — HidroSys
# Prefijo: /geo  |  Tag: geolocalización
#
# Endpoints:
#   GET  /geo/medidores              → Lista ligera solo con coords (caché HTTP)
#   GET  /geo/medidores/mis-medidores → Medidores del usuario autenticado
#   GET  /geo/medidores/cercanos     → Medidores en radio X km (Haversine)
#   GET  /geo/sectores               → Sectores disponibles para el mapa
#   GET  /geo/estadisticas           → Stats geográficas calculadas en DB
#   POST /geo/validar-ubicacion      → Valida coords contra límite geográfico
#   PUT  /geo/medidores/{id}/coordenadas → Actualiza SOLO latitud/longitud/altitud
# ============================================================================

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session, joinedload

from db.session import SessionLocal
from models.affiliate import UsuarioAfiliado
from models.limite_geografico import LimiteGeografico
from models.meter import Medidor
from models.sector import Sector
from models.user import UsuarioSistema
from schemas.limite_geografico import CoordenadaValidacion, CoordenadaValidacionResponse
from security.jwt import verify_token
from utils.audit_logger import registrar_auditoria
from utils.geo_utils import GeoUtils
from utils.notifications import registrar_notificacion

router = APIRouter(prefix="/geo", tags=["geolocalización"])


# ============================================================================
# SCHEMAS LOCALES (solo para este router)
# ============================================================================

class CoordenadasUpdate(BaseModel):
    """Payload para actualizar únicamente las coordenadas de un medidor."""
    latitud: float = Field(..., ge=-90, le=90, description="Latitud decimal")
    longitud: float = Field(..., ge=-180, le=180, description="Longitud decimal")
    altitud: Optional[float] = Field(None, description="Altitud en metros (opcional)")


# ============================================================================
# DB SESSION
# ============================================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# HELPERS DE PERMISOS (mismo patrón que meters.py)
# ============================================================================

def get_current_user(payload: dict, db: Session) -> UsuarioSistema:
    user = db.query(UsuarioSistema).filter(
        UsuarioSistema.usuario == payload["sub"]
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    return user


def check_permission(
    user: UsuarioSistema, db: Session, module: str, action: str = None
) -> bool:
    from models.role import RolAccion

    module = module.lower().strip()
    action = action.lower().strip() if action else None

    permisos = db.query(RolAccion).filter(
        RolAccion.id_rol == user.id_rol,
        RolAccion.activo == True,
    ).all()

    acciones_usuario = set()
    for permiso in permisos:
        if not permiso.nombre_accion:
            continue
        perm_module = permiso.nombre_accion.lower().strip()
        perm_action = (permiso.tipo_accion or "").lower().strip()
        if perm_module != module:
            continue
        if perm_action in ["crud", "operaciones crud"]:
            return True
        acciones_usuario.add(perm_action)

    if action is None:
        return bool(acciones_usuario)
    if action in ["leer", "lectura"]:
        if any(a in acciones_usuario for a in ["lectura", "leer", "crear", "actualizar", "eliminar"]):
            return True
    return action in acciones_usuario


def require_permission(
    user: UsuarioSistema, db: Session, module: str, action: str = None
):
    if not check_permission(user, db, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tienes permisos para {action or 'acceder a'} {module}",
        )


def require_any_permission(
    user: UsuarioSistema,
    db: Session,
    permissions: list[tuple[str, str | None]],
):
    for module, action in permissions:
        if check_permission(user, db, module, action):
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tienes permisos para acceder a este recurso",
    )


# ============================================================================
# HELPER INTERNO: construir fila de medidor para respuestas geo
# ============================================================================

def _build_query_geo(db: Session):
    """
    Query base compartida por los endpoints de listado geo.
    Devuelve únicamente los campos necesarios para el mapa.
    """
    return (
        db.query(
            Medidor.id_medidor,
            Medidor.num_medidor,
            Medidor.latitud,
            Medidor.longitud,
            Medidor.altitud,
            Medidor.activo,
            Medidor.id_sector,
            Medidor.id_usuario_afi,
            Sector.nombre_sector.label("nombre_sector"),
            UsuarioAfiliado.cod_usuario_afi,
            func.concat(
                UsuarioSistema.nombres, " ", UsuarioSistema.apellidos
            ).label("nombre_afiliado"),
        )
        .outerjoin(Sector, Sector.id_sector == Medidor.id_sector)
        .outerjoin(UsuarioAfiliado, UsuarioAfiliado.id_usuario_afi == Medidor.id_usuario_afi)
        .outerjoin(
            UsuarioSistema,
            UsuarioSistema.id_usuario_sistema == UsuarioAfiliado.id_usuario_sistema,
        )
    )


def _row_to_dict(m) -> dict:
    """Convierte una fila de _build_query_geo a dict serializable."""
    return {
        "id_medidor":     m.id_medidor,
        "num_medidor":    m.num_medidor,
        "latitud":        float(m.latitud),
        "longitud":       float(m.longitud),
        "altitud":        float(m.altitud) if m.altitud is not None else None,
        "activo":         m.activo,
        "id_sector":      m.id_sector,
        "nombre_sector":  m.nombre_sector,
        "id_usuario_afi": m.id_usuario_afi,
        "cod_usuario_afi": m.cod_usuario_afi,
        "nombre_afiliado": (m.nombre_afiliado or "").strip() or None,
    }


# ============================================================================
# HELPER HAVERSINE — distancia entre dos puntos geográficos (km)
# ============================================================================

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    la1, lo1, la2, lo2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = sin(dlat / 2) ** 2 + cos(la1) * cos(la2) * sin(dlon / 2) ** 2
    return R * 2 * asin(sqrt(a))


# ============================================================================
# ENDPOINT 1: GET /geo/medidores
# Lista ligera de TODOS los medidores con coordenadas — para el mapa principal
# Cache-Control: private, max-age=300 (5 minutos) → reduce cuota Google Maps
# ============================================================================

@router.get("/medidores")
def listar_medidores_geo(
    id_sector: Optional[int] = Query(None, description="Filtrar por sector"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado"),
    asignado: Optional[bool] = Query(None, description="Filtrar por asignación"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    """
    Lista ligera de medidores con coordenadas válidas.
    Solo devuelve campos geográficos — payload mínimo para el mapa.

    Requiere permiso: medidores.lectura  o  geolocalizacion.lectura
    Riesgo R03: Cache-Control de 5 minutos reduce las llamadas repetidas al backend.
    """
    current_user = get_current_user(payload, db)
    require_any_permission(
        current_user, db,
        [("medidores", "lectura"), ("geolocalizacion", "lectura")],
    )

    query = _build_query_geo(db).filter(
        Medidor.latitud.isnot(None),
        Medidor.longitud.isnot(None),
    )

    if id_sector is not None:
        query = query.filter(Medidor.id_sector == id_sector)
    if activo is not None:
        query = query.filter(Medidor.activo == activo)
    if asignado is not None:
        query = query.filter(
            Medidor.id_usuario_afi.isnot(None) if asignado
            else Medidor.id_usuario_afi.is_(None)
        )

    medidores = query.all()
    data = [_row_to_dict(m) for m in medidores]

    return JSONResponse(
        content=data,
        headers={
            # R03 — el cliente puede reutilizar la respuesta 5 min
            "Cache-Control": "private, max-age=300",
            "X-Total-Count": str(len(data)),
            "X-Generated-At": datetime.now(timezone.utc).isoformat(),
        },
    )


# ============================================================================
# ENDPOINT 2: GET /geo/medidores/mis-medidores
# Medidores del afiliado autenticado (para marcar "tu medidor" en el mapa)
# Cache-Control: 10 minutos — cambia poco
# ============================================================================

@router.get("/medidores/mis-medidores")
def mis_medidores_geo(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    """
    Retorna los medidores del afiliado autenticado.
    Si el usuario no es afiliado devuelve lista vacía (no es error).
    Usado para resaltar "tu medidor" en el mapa.

    Cache-Control: 10 minutos.
    """
    current_user = get_current_user(payload, db)

    afiliado = (
        db.query(UsuarioAfiliado)
        .filter(UsuarioAfiliado.id_usuario_sistema == current_user.id_usuario_sistema)
        .first()
    )

    if not afiliado:
        return JSONResponse(
            content=[],
            headers={"Cache-Control": "private, max-age=600"},
        )

    medidores = (
        _build_query_geo(db)
        .filter(Medidor.id_usuario_afi == afiliado.id_usuario_afi)
        .all()
    )

    # Incluir medidores sin coordenadas (el front decide si los muestra)
    data = []
    for m in medidores:
        row = {
            "id_medidor":     m.id_medidor,
            "num_medidor":    m.num_medidor,
            "latitud":        float(m.latitud) if m.latitud is not None else None,
            "longitud":       float(m.longitud) if m.longitud is not None else None,
            "altitud":        float(m.altitud) if m.altitud is not None else None,
            "activo":         m.activo,
            "id_sector":      m.id_sector,
            "nombre_sector":  m.nombre_sector,
            "id_usuario_afi": m.id_usuario_afi,
            "cod_usuario_afi": m.cod_usuario_afi,
            "nombre_afiliado": (m.nombre_afiliado or "").strip() or None,
        }
        data.append(row)

    return JSONResponse(
        content=data,
        headers={"Cache-Control": "private, max-age=600"},
    )


# ============================================================================
# ENDPOINT 3: GET /geo/medidores/cercanos
# Medidores en un radio dado (Haversine — cálculo en Python, 0 llamadas externas)
# ============================================================================

@router.get("/medidores/cercanos")
def medidores_cercanos(
    lat: float = Query(..., ge=-90, le=90, description="Latitud del punto de referencia"),
    lng: float = Query(..., ge=-180, le=180, description="Longitud del punto de referencia"),
    radio_km: float = Query(1.0, gt=0, le=50, description="Radio de búsqueda en km"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    """
    Retorna los medidores dentro de un radio (km) de un punto dado.
    Cálculo Haversine en Python — no consume ninguna API externa.

    Requiere permiso: medidores.lectura  o  geolocalizacion.lectura
    """
    current_user = get_current_user(payload, db)
    require_any_permission(
        current_user, db,
        [("medidores", "lectura"), ("geolocalizacion", "lectura")],
    )

    query = _build_query_geo(db).filter(
        Medidor.latitud.isnot(None),
        Medidor.longitud.isnot(None),
    )
    if activo is not None:
        query = query.filter(Medidor.activo == activo)

    medidores = query.all()

    resultado = []
    for m in medidores:
        distancia = _haversine_km(lat, lng, float(m.latitud), float(m.longitud))
        if distancia <= radio_km:
            row = _row_to_dict(m)
            row["distancia_km"] = round(distancia, 4)
            resultado.append(row)

    resultado.sort(key=lambda x: x["distancia_km"])

    return {
        "punto_referencia": {"latitud": lat, "longitud": lng},
        "radio_km": radio_km,
        "total": len(resultado),
        "medidores": resultado,
    }


# ============================================================================
# ENDPOINT 4: GET /geo/sectores
# Sectores activos para los selectores del mapa — caché 30 min
# ============================================================================

@router.get("/sectores")
def listar_sectores_geo(
    activo: Optional[bool] = Query(True, description="Solo sectores activos"),
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    """
    Lista sectores disponibles para los filtros del mapa.
    Requiere permiso: medidores.lectura  o  geolocalizacion.lectura
    Cache-Control: 30 minutos (los sectores cambian muy poco).
    """
    current_user = get_current_user(payload, db)
    require_any_permission(
        current_user, db,
        [("medidores", "lectura"), ("geolocalizacion", "lectura")],
    )

    query = db.query(
        Sector.id_sector,
        Sector.nombre_sector,
        Sector.descripcion,
    )
    if activo is not None:
        query = query.filter(Sector.activo == activo)

    sectores = query.order_by(Sector.nombre_sector).all()
    data = [
        {
            "id_sector":      s.id_sector,
            "nombre_sector":  s.nombre_sector,
            "descripcion":    s.descripcion,
        }
        for s in sectores
    ]

    return JSONResponse(
        content=data,
        headers={"Cache-Control": "private, max-age=1800"},
    )


# ============================================================================
# ENDPOINT 5: GET /geo/estadisticas
# Estadísticas geográficas calculadas en la DB — sin llamadas a APIs externas
# ============================================================================

@router.get("/estadisticas")
def estadisticas_geo(
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    """
    Estadísticas geográficas del sistema:
    - total de medidores con/sin coordenadas
    - cobertura geográfica %
    - distribución por sector
    - conteo activos / inactivos / asignados

    Requiere permiso: medidores.lectura  o  geolocalizacion.lectura
    """
    current_user = get_current_user(payload, db)
    require_any_permission(
        current_user, db,
        [("medidores", "lectura"), ("geolocalizacion", "lectura")],
    )

    total = db.query(Medidor).count()
    con_geo = db.query(Medidor).filter(
        Medidor.latitud.isnot(None),
        Medidor.longitud.isnot(None),
    ).count()
    sin_geo  = total - con_geo
    activos  = db.query(Medidor).filter(Medidor.activo == True).count()
    inactivos = total - activos
    asignados = db.query(Medidor).filter(Medidor.id_usuario_afi.isnot(None)).count()

    # Distribución por sector — 1 sola query con GROUP BY
    por_sector_rows = (
        db.query(
            Sector.nombre_sector,
            func.count(Medidor.id_medidor).label("total"),
            func.sum(
                cast(
                    Medidor.latitud.isnot(None) & Medidor.longitud.isnot(None),
                    Integer,
                )
            ).label("con_geo"),
        )
        .outerjoin(Medidor, Sector.id_sector == Medidor.id_sector)
        .group_by(Sector.nombre_sector)
        .all()
    )

    por_sector = [
        {
            "nombre_sector": row.nombre_sector,
            "total":         row.total,
            "con_geo":       int(row.con_geo or 0),
            "sin_geo":       row.total - int(row.con_geo or 0),
        }
        for row in por_sector_rows
    ]

    cobertura = round((con_geo / total * 100), 1) if total > 0 else 0.0

    return {
        "total_medidores":    total,
        "medidores_con_geo":  con_geo,
        "medidores_sin_geo":  sin_geo,
        "cobertura_geo_pct":  cobertura,
        "medidores_activos":  activos,
        "medidores_inactivos": inactivos,
        "medidores_asignados": asignados,
        "por_sector":         por_sector,
        "generado_en":        datetime.now(timezone.utc).isoformat(),
    }


# ============================================================================
# ENDPOINT 6: POST /geo/validar-ubicacion
# Valida coordenadas contra el límite geográfico configurado
# ============================================================================

@router.post("/validar-ubicacion", response_model=CoordenadaValidacionResponse)
def validar_ubicacion(
    coordenada: CoordenadaValidacion,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    """
    Valida si unas coordenadas están dentro del límite geográfico configurado.
    Útil para validación en tiempo real desde el formulario del mapa.

    Requiere permiso: medidores.lectura  o  geolocalizacion.lectura
    """
    current_user = get_current_user(payload, db)
    require_any_permission(
        current_user, db,
        [("medidores", "lectura"), ("geolocalizacion", "lectura")],
    )

    es_valida, nombre_limite, mensaje = GeoUtils.validar_coordenadas_contra_limite(
        db, coordenada.latitud, coordenada.longitud
    )

    if es_valida:
        mensaje_final = (
            f"✓ Ubicación válida dentro del área '{nombre_limite}'"
            if nombre_limite
            else "✓ Ubicación válida (no hay límite geográfico configurado)"
        )
    else:
        mensaje_final = f"✗ {mensaje}"

    return CoordenadaValidacionResponse(
        valida=es_valida,
        latitud=coordenada.latitud,
        longitud=coordenada.longitud,
        limite_aplicado=nombre_limite,
        mensaje=mensaje_final,
    )


# ============================================================================
# ENDPOINT 7: PUT /geo/medidores/{id_medidor}/coordenadas
# Actualiza SOLO las coordenadas de un medidor e invalida el caché del cliente
# ============================================================================

@router.put("/medidores/{id_medidor}/coordenadas")
def actualizar_coordenadas(
    id_medidor: int,
    datos: CoordenadasUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(verify_token),
):
    """
    Actualiza únicamente latitud, longitud y altitud de un medidor.
    Endpoint dedicado para el mapa — no modifica otros campos del medidor.

    Valida el formato y el límite geográfico antes de guardar.
    Requiere permiso: medidores.actualizar  o  geolocalizacion.crud
    """
    current_user = get_current_user(payload, db)
    require_any_permission(
        current_user, db,
        [("medidores", "actualizar"), ("geolocalizacion", "crud")],
    )

    medidor = (
        db.query(Medidor)
        .options(
            joinedload(Medidor.sector),
            joinedload(Medidor.usuario_afiliado).joinedload(
                UsuarioAfiliado.usuario_sistema
            ),
        )
        .filter(Medidor.id_medidor == id_medidor)
        .first()
    )

    if not medidor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medidor no encontrado",
        )

    # ── Validación de formato ────────────────────────────────────────────
    es_valida_formato, mensaje_formato = GeoUtils.validar_coordenadas_formato(
        datos.latitud, datos.longitud, datos.altitud
    )
    if not es_valida_formato:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Formato de coordenadas inválido", "mensaje": mensaje_formato},
        )

    # ── Validación contra límite geográfico ──────────────────────────────
    es_valida, nombre_limite, mensaje = GeoUtils.validar_coordenadas_contra_limite(
        db, datos.latitud, datos.longitud, datos.altitud
    )
    if not es_valida:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error":    "Coordenadas fuera del límite geográfico permitido",
                "limite":   nombre_limite,
                "latitud":  datos.latitud,
                "longitud": datos.longitud,
                "altitud":  datos.altitud,
                "mensaje":  mensaje,
            },
        )

    # ── Guardar ──────────────────────────────────────────────────────────
    medidor.latitud  = datos.latitud
    medidor.longitud = datos.longitud
    medidor.altitud  = datos.altitud

    try:
        db.commit()
        db.refresh(medidor)

        registrar_auditoria(
            db=db,
            accion="UPDATE",
            descripcion=(
                f"Coordenadas del medidor '{medidor.num_medidor}' actualizadas "
                f"por '{payload['sub']}' → ({datos.latitud}, {datos.longitud})"
            ),
            id_usuario=current_user.id_usuario_sistema,
        )
        registrar_notificacion(
            db=db,
            id_usuario=current_user.id_usuario_sistema,
            titulo="Coordenadas actualizadas",
            mensaje=f"Las coordenadas del medidor '{medidor.num_medidor}' fueron actualizadas.",
            tipo="info",
        )

        return JSONResponse(
            content={
                "success":    True,
                "id_medidor": medidor.id_medidor,
                "num_medidor": medidor.num_medidor,
                "latitud":    float(medidor.latitud),
                "longitud":   float(medidor.longitud),
                "altitud":    float(medidor.altitud) if medidor.altitud else None,
                "message":    "Coordenadas actualizadas correctamente",
            },
            # R03 — forzar al cliente a refrescar su caché tras una escritura
            headers={"Cache-Control": "no-store"},
        )

    except Exception as e:
        db.rollback()
        print(f"❌ Error al actualizar coordenadas del medidor {id_medidor}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar las coordenadas",
        )
    
# funcion para obtener los limites configurados de la comunidad 
@router.get("/limites")
def obtener_limites_geograficos(db: Session = Depends(get_db)):
    try:
        limites = (
            db.query(LimiteGeografico)
            .filter(LimiteGeografico.activo == True)
            .order_by(LimiteGeografico.id.asc())
            .all()
        )

        return {
            "success": True,
            "data": [limite.to_dict() for limite in limites]
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener límites geográficos: {str(e)}"
        )