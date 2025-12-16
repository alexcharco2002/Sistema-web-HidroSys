"""
utils/geo_utils.py
Utilidades para trabajar con coordenadas geográficas
"""
from typing import Tuple, Optional
from decimal import Decimal
import math


class GeoUtils:
    """Utilidades para operaciones geográficas"""
    
    RADIO_TIERRA_KM = 6371.0  # Radio de la Tierra en kilómetros
    
    @staticmethod
    def calcular_distancia_haversine(
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """
        Calcula la distancia entre dos puntos usando la fórmula de Haversine.
        
        Args:
            lat1, lon1: Coordenadas del primer punto
            lat2, lon2: Coordenadas del segundo punto
            
        Returns:
            Distancia en kilómetros
        """
        # Convertir a radianes
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        # Fórmula de Haversine
        a = (
            math.sin(delta_lat / 2) ** 2 +
            math.cos(lat1_rad) * math.cos(lat2_rad) *
            math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return GeoUtils.RADIO_TIERRA_KM * c
    
    @staticmethod
    def validar_coordenadas_formato(
        latitud: Optional[Decimal],
        longitud: Optional[Decimal],
        altitud: Optional[Decimal] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Valida que las coordenadas tengan formato correcto.
        
        Returns:
            Tupla (es_valida, mensaje_error)
        """
        if latitud is None or longitud is None:
            return True, None  # Coordenadas opcionales
        
        # Validar rango de latitud
        if latitud < -90 or latitud > 90:
            return False, "La latitud debe estar entre -90 y 90 grados"
        
        # Validar rango de longitud
        if longitud < -180 or longitud > 180:
            return False, "La longitud debe estar entre -180 y 180 grados"
        
        # Validar altitud si se proporciona
        if altitud is not None:
            if altitud < -500:  # Mínimo razonable (bajo el nivel del mar)
                return False, "La altitud no puede ser menor a -500 metros"
            if altitud > 9000:  # Máximo razonable para Ecuador
                return False, "La altitud no puede ser mayor a 9000 metros"
        
        return True, None
    
    @staticmethod
    def obtener_centro_rectangulo(
        norte: Decimal,
        sur: Decimal,
        este: Decimal,
        oeste: Decimal
    ) -> Tuple[float, float]:
        """
        Calcula el centro de un rectángulo definido por sus límites.
        
        Returns:
            Tupla (latitud_centro, longitud_centro)
        """
        lat_centro = float(norte + sur) / 2
        lon_centro = float(este + oeste) / 2
        return lat_centro, lon_centro
    
    @staticmethod
    def formatear_coordenadas(
        latitud: Decimal,
        longitud: Decimal,
        formato: str = "decimal",
        altitud: Optional[Decimal] = None
    ) -> str:
        """
        Formatea coordenadas en diferentes estilos.
        
        Args:
            formato: "decimal" o "dms" (grados, minutos, segundos)
            altitud: Altitud opcional en metros
        """
        if formato == "decimal":
            coords = f"{float(latitud):.7f}, {float(longitud):.7f}"
            if altitud is not None:
                coords += f", {float(altitud):.2f}m"
            return coords
        
        elif formato == "dms":
            def decimal_a_dms(decimal: float, es_latitud: bool) -> str:
                direccion = ""
                if es_latitud:
                    direccion = "N" if decimal >= 0 else "S"
                else:
                    direccion = "E" if decimal >= 0 else "O"
                
                decimal_abs = abs(decimal)
                grados = int(decimal_abs)
                minutos_decimal = (decimal_abs - grados) * 60
                minutos = int(minutos_decimal)
                segundos = (minutos_decimal - minutos) * 60
                
                return f"{grados}°{minutos}'{segundos:.2f}\"{direccion}"
            
            lat_dms = decimal_a_dms(float(latitud), True)
            lon_dms = decimal_a_dms(float(longitud), False)
            coords = f"{lat_dms} {lon_dms}"
            if altitud is not None:
                coords += f" {float(altitud):.2f}m"
            return coords
        
        coords = f"{latitud}, {longitud}"
        if altitud is not None:
            coords += f", {altitud}m"
        return coords
    
    @staticmethod
    def punto_dentro_de_rectangulo(
        lat: float,
        lon: float,
        norte: float,
        sur: float,
        este: float,
        oeste: float
    ) -> bool:
        """
        Verifica si un punto está dentro de un rectángulo geográfico.
        """
        return sur <= lat <= norte and oeste <= lon <= este
    
    @staticmethod
    def validar_coordenadas_contra_limite(
        db,
        latitud: Decimal,
        longitud: Decimal,
        altitud: Optional[Decimal] = None
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Valida coordenadas (incluyendo altitud) contra el límite geográfico activo.
        
        Args:
            db: Sesión de base de datos
            latitud: Latitud a validar
            longitud: Longitud a validar
            altitud: Altitud opcional a validar (en metros)
            
        Returns:
            Tupla (es_valida, nombre_limite, mensaje)
        """
        from models.limite_geografico import LimiteGeografico
        
        # Si no hay coordenadas, permitir
        if latitud is None or longitud is None:
            return True, None, None
        
        # Obtener límite activo
        limite_activo = db.query(LimiteGeografico).filter(
            LimiteGeografico.activo == True
        ).first()
        
        # Si no hay límite activo, permitir cualquier coordenada
        if not limite_activo:
            return True, None, "No hay límite geográfico configurado"
        
        # Validar coordenadas geográficas (lat/lon)
        es_valida = limite_activo.contiene_coordenada(
            float(latitud),
            float(longitud)
        )
        
        if not es_valida:
            mensaje = (
                f"Coordenadas fuera del límite geográfico '{limite_activo.nombre}'. "
                f"Área permitida: Norte {limite_activo.norte}°, Sur {limite_activo.sur}°, "
                f"Este {limite_activo.este}°, Oeste {limite_activo.oeste}°"
            )
            return False, limite_activo.nombre, mensaje
        
        # Validar altitud si se proporciona y el límite tiene restricciones de altitud
        if altitud is not None:
            if not limite_activo.contiene_altitud(float(altitud)):
                mensaje = (
                    f"Altitud fuera del rango permitido en '{limite_activo.nombre}'. "
                    f"Rango permitido: {limite_activo.altitud_min}m - {limite_activo.altitud_max}m. "
                    f"Altitud ingresada: {float(altitud)}m"
                )
                return False, limite_activo.nombre, mensaje
        
        # Todo válido
        mensaje_partes = [f"Coordenadas válidas dentro del límite '{limite_activo.nombre}'"]
        if altitud is not None and limite_activo.altitud_min is not None:
            mensaje_partes.append(f"(altitud {float(altitud)}m dentro del rango permitido)")
        
        mensaje = " ".join(mensaje_partes)
        return True, limite_activo.nombre, mensaje
    
    @staticmethod
    def obtener_datos_pais_ecuador() -> dict:
        """
        Retorna los límites geográficos aproximados de Ecuador.
        Útil para configuración inicial.
        """
        return {
            "nombre": "Ecuador",
            "norte": Decimal("1.67"),      # Punto más al norte
            "sur": Decimal("-5.01"),       # Punto más al sur
            "este": Decimal("-75.19"),     # Punto más al este
            "oeste": Decimal("-91.66"),    # Punto más al oeste (incluyendo Galápagos)
            "altitud_min": Decimal("0"),   # Nivel del mar
            "altitud_max": Decimal("6310"), # Chimborazo
            "descripcion": "Límites continentales e insulares de Ecuador"
        }
