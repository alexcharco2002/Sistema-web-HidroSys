# schemas/user.py
# se utiliza para definir los esquemas Pydantic relacionados con usuarios
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime, date

# ========================================
# SCHEMA PARA INFORMACIÓN DE ROL
# ========================================
class RolInfo(BaseModel):
    """Información básica del rol"""
    id_rol: int
    nombre_rol: str
    descripcion: Optional[str] = None
    
    class Config:
        from_attributes = True


class PermisoInfo(BaseModel):
    """Información de permiso"""
    nombre_accion: str
    tipo_accion: Optional[str] = None
    
    class Config:
        from_attributes = True


# ========================================
# SCHEMAS DE LOGIN Y AUTH
# ========================================
class UserLogin(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_password_length(cls, v):
        if len(v) < 6:
            raise ValueError('La contraseña debe tener al menos 6 caracteres')
        return v

class ChangePasswordFirstLoginRequest(BaseModel):
    new_password: str

    @validator('new_password')
    def validate_password_length(cls, v):
        if len(v) < 6:
            raise ValueError('La contraseña debe tener al menos 6 caracteres')
        return v
# ========================================
# SCHEMAS DE CREACIÓN
# ========================================
class UserCreate(BaseModel):
    """
    Schema para crear usuario - El backend genera automáticamente:
    - usuario: la cédula completa
    - clave inicial: la cédula completa
    """
    nombres: str
    apellidos: str
    sexo: str  # 'M' o 'F' - OBLIGATORIO
    fecha_nac: date  # OBLIGATORIO
    cedula: str
    email: EmailStr
    telefono: Optional[str] = None
    direccion: Optional[str] = "Sanjapamba"
    id_rol: int 
    activo: bool = True
    
    @validator('nombres', 'apellidos')
    def validate_nombres(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError('El nombre debe tener al menos 2 caracteres')
        if len(v) > 100:
            raise ValueError('El nombre es demasiado largo')
        if not all(c.isalpha() or c.isspace() for c in v):
            raise ValueError('El nombre solo puede contener letras y espacios')
        return v.title()
    
    @validator('sexo')
    def validate_sexo(cls, v):
        v = v.strip().upper()
        if v not in ['M', 'F']:
            raise ValueError('El sexo debe ser M (Masculino) o F (Femenino)')
        return v
    
    @validator('fecha_nac')
    def validate_fecha_nac(cls, v):
        if not v:
            raise ValueError('La fecha de nacimiento es obligatoria')
        
        # Calcular edad
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        
        if age < 0:
            raise ValueError('La fecha de nacimiento no puede ser futura')
        if age < 2:
            raise ValueError('El usuario debe tener al menos 2 años')
        if age > 120:
            raise ValueError('La fecha de nacimiento no es válida')
        
        return v
    
    @validator('cedula')
    def validate_cedula(cls, v):
        if v:
            v = v.strip()
            if len(v) != 10: # validar longitud exacta 10 
                raise ValueError('La cédula debe tener exactamente 10 dígitos')
            if not v.replace('-', '').isdigit():
                raise ValueError('La cédula solo puede contener números y guiones')
        else:
            raise ValueError('La cédula es obligatoria.')
        return v
    
    @validator('telefono')
    def validate_telefono(cls, v):
        if v:
            v = v.strip()
            # Verificar que solo contenga números
            if not v.isdigit():
                raise ValueError('El teléfono solo puede contener números.')
            # Verificar que tenga exactamente 10 dígitos
            if len(v) != 10:
                raise ValueError('El teléfono debe tener exactamente 10 dígitos.')
        else:
            raise ValueError('El teléfono es obligatorio.')
        return v

    
    class Config:
        json_schema_extra = {
            "example": {
                "nombres": "Juan Carlos",
                "apellidos": "Pérez González",
                "sexo": "M",
                "fecha_nac": "1990-05-15",
                "cedula": "1234567890",
                "email": "juan.perez@example.com",
                "telefono": "0987654321",
                "direccion": "Sanjapamba",
                "id_rol": 4,
                "activo": True
            }
        }


# ========================================
# SCHEMAS DE ACTUALIZACIÓN
# ========================================
class UserUpdate(BaseModel):
    usuario: Optional[str] = None
    clave: Optional[str] = None
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    sexo: Optional[str] = None
    fecha_nac: Optional[date] = None
    cedula: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    id_rol: Optional[int] = None 
    activo: Optional[bool] = None
    
    @validator('usuario')
    def validate_usuario(cls, v):
        if v:
            v = v.strip()
            if len(v) < 3:
                raise ValueError('El usuario debe tener al menos 3 caracteres')
            if len(v) > 50:
                raise ValueError('El usuario no puede exceder 50 caracteres')
            if not v.replace('_', '').replace('.', '').isalnum():
                raise ValueError('El usuario solo puede contener letras, números, puntos y guiones bajos')
            return v.lower()
        return v
    
    @validator('clave')
    def validate_clave(cls, v):
        if v:
            if len(v) < 8:
                raise ValueError('La contraseña debe tener al menos 8 caracteres')
            if len(v) > 100:
                raise ValueError('La contraseña es demasiado larga')
        return v
    
    @validator('nombres', 'apellidos')
    def validate_nombres(cls, v):
        if v:
            v = v.strip()
            if len(v) < 2:
                raise ValueError('El nombre debe tener al menos 2 caracteres')
            if len(v) > 100:
                raise ValueError('El nombre es demasiado largo')
            if not all(c.isalpha() or c.isspace() for c in v):
                raise ValueError('El nombre solo puede contener letras y espacios')
            return v.title()
        return v
    
    @validator('sexo')
    def validate_sexo(cls, v):
        if v:
            v = v.strip().upper()
            if v not in ['M', 'F']:
                raise ValueError('El sexo debe ser M o F')
            return v
        return v
    
    @validator('cedula')
    def validate_cedula(cls, v):
        if v:
            v = v.strip()
            if len(v) != 10: # validar longitud exacta 10 
                raise ValueError('La cédula debe tener exactamente 10 dígitos')
            if not v.replace('-', '').isdigit():
                raise ValueError('La cédula solo puede contener números y guiones')
        else:
            raise ValueError('La cédula es obligatoria.')
        return v
    
    @validator('telefono')
    def validate_telefono(cls, v):
        if v:
            v = v.strip()
            # Verificar que solo contenga números
            if not v.isdigit():
                raise ValueError('El teléfono solo puede contener números.')
            # Verificar que tenga exactamente 10 dígitos
            if len(v) != 10:
                raise ValueError('El teléfono debe tener exactamente 10 dígitos.')
        else:
            raise ValueError('El teléfono es obligatorio.')
        return v


# ========================================
# SCHEMAS DE RESPUESTA
# ========================================
class UserResponse(BaseModel):
    """Schema completo para respuestas individuales de usuario"""
    id: int
    usuario: str
    nombres: str
    apellidos: str
    sexo: Optional[str] = None
    fecha_nac: Optional[date] = None
    cedula: str
    email: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    id_rol: int
    rol: Optional[RolInfo] = None  # ✅ Objeto completo del rol
    permisos: Optional[list[PermisoInfo]] = []  # ✅ Lista de permisos
    activo: bool
    fecha_registro: Optional[str] = None
    ultimo_acceso: Optional[datetime] = None
    foto: Optional[str] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            date: lambda v: v.strftime("%Y-%m-%d") if v else None,
            datetime: lambda v: v.isoformat() if v else None
        }


class UserListResponse(BaseModel):
    """Schema simplificado para listados de usuarios"""
    id: int
    usuario: str
    nombres: str
    apellidos: str
    sexo: Optional[str] = None
    fecha_nac: Optional[date] = None
    email: str
    cedula: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    id_rol: int
    rol: Optional[RolInfo] = None  # ✅ Cambiar de str a RolInfo
    permisos: Optional[list[PermisoInfo]] = []  # ✅ Agregar permisos
    activo: bool
    fecha_registro: Optional[datetime] = None
    foto: Optional[str] = None

    bloqueado_permanente: bool
    bloqueado_hasta: Optional[datetime] = None
    intentos_fallidos: int

    class Config:
        from_attributes = True
        json_encoders = {
            date: lambda v: v.strftime("%Y-%m-%d") if v else None,
            datetime: lambda v: v.isoformat() if v else None
        }

# ========================================
# SCHEMAS PARA CARGA MASIVA DESDE EXCEL
# ========================================
class UserBulkCreate(BaseModel):
    """Schema para crear usuario desde Excel - validación mínima"""
    nombres: str
    apellidos: str
    sexo: str
    fecha_nac: date
    cedula: str
    email: EmailStr
    telefono: Optional[str] = None
    direccion: Optional[str] = "Sanjapamba"
    
    @validator('nombres', 'apellidos')
    def validate_nombres(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Debe tener al menos 2 caracteres')
        return v.title()
    
    @validator('sexo')
    def validate_sexo(cls, v):
        v = v.strip().upper()
        if v not in ['M', 'F', 'O']:
            raise ValueError('Debe ser M, F u O')
        return v
    
    @validator('cedula')
    def validate_cedula(cls, v):
        v = v.strip()
        if len(v) != 10:
            raise ValueError('Debe tener 10 dígitos')
        if not v.isdigit():
            raise ValueError('Solo números permitidos')
        return v
    
    @validator('telefono')
    def validate_telefono(cls, v):
        if v:
            v = v.strip()
            if not v.isdigit():
                raise ValueError('Solo números permitidos')
            if len(v) != 10:
                raise ValueError('Debe tener 10 dígitos')
            return v
        return None
    
    class Config:
        json_schema_extra = {
            "example": {
                "nombres": "María",
                "apellidos": "González",
                "sexo": "F",
                "fecha_nac": "1995-03-20",
                "cedula": "0987654321",
                "email": "maria.gonzalez@example.com",
                "telefono": "0999888777",
                "direccion": "Av. Principal"
            }
        }


class UserBulkCreateRequest(BaseModel):
    """Request para crear múltiples usuarios"""
    users: list[UserBulkCreate]
    
    @validator('users')
    def validate_users_list(cls, v):
        if not v or len(v) == 0:
            raise ValueError('La lista de usuarios no puede estar vacía')
        if len(v) > 100:
            raise ValueError('Máximo 100 usuarios por carga')
        return v


class UserBulkResult(BaseModel):
    """Resultado de un usuario creado en masa"""
    fila: int
    usuario: str
    contraseña: str
    nombre: str
    email: str
    cedula: str


class UserBulkError(BaseModel):
    """Error al crear un usuario en masa"""
    fila: int
    nombre: str
    email: Optional[str] = None
    cedula: Optional[str] = None
    error: str


class UserBulkResponse(BaseModel):
    """Respuesta de creación masiva"""
    exitosos: list[UserBulkResult]
    fallidos: list[UserBulkError]
    total_procesados: int
    total_exitosos: int
    total_fallidos: int
