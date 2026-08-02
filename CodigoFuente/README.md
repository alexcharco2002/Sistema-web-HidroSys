# 💧 Sistema de Facturación - Junta de Agua de Sanjapamba (TecniCobro)

![React](https://img.shields.io/badge/Frontend-React-blue?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)

## 📖 Descripción del Proyecto

Este proyecto es un **sistema web de facturación integral** diseñado específicamente para la Junta de Agua de la Comunidad de Sanjapamba. Su objetivo principal es automatizar y optimizar la gestión operativa y financiera de la junta.

El sistema permite gestionar de manera eficiente:
- 👥 Usuarios y afiliados
- 🚰 Medidores y sectores
- 💰 Tarifas y servicios adicionales
- 📊 Registro de lecturas de consumo
- 🧾 Facturación y control de pagos

---

## 🚀 Características Principales

El sistema está diseñado para cumplir con **45 requisitos funcionales**, destacando:

*   **Gestión de Usuarios y Roles:** Control de acceso seguro y administración de afiliados.
*   **Lectura y Facturación Automática:** Cálculo preciso basado en el consumo y tarifas vigentes.
*   **Gestión de Infraestructura:** Control de medidores, sectores y asignaciones.
*   **Control de Pagos y Multas:** Registro detallado del estado de cuenta de cada usuario.
*   **Reportes y Estadísticas:** Generación de información clave para la toma de decisiones.
*   **Seguridad:** Autenticación y protección de datos mediante FastAPI Security.

---

## 🛠️ Arquitectura y Tecnologías

El proyecto sigue una arquitectura Cliente-Servidor moderna:

*   **Frontend:** Desarrollado con **React**, organizado por componentes modulares y vistas.
*   **Backend:** Construido con **FastAPI (Python)**, ofreciendo una API RESTful rápida y segura.
*   **Base de Datos:** Motor relacional **PostgreSQL**, diseñado para mantener la integridad referencial de los datos.

### Estructura del Proyecto

```text
Sistema-web-HidroSys/
├── backend/            # Lógica del servidor / API REST
│   ├── db/             # Configuración de base de datos
│   ├── models/         # Modelos ORM
│   ├── routes/         # Endpoints (Controladores)
│   ├── schemas/        # Validadores de datos (Pydantic)
│   ├── security/       # Módulos de autenticación
│   └── services/       # Lógica de negocio
└── frontend/           # Interfaz de Usuario
    ├── public/         # Assets estáticos
    └── src/            # Código fuente React
        ├── componentes/# Componentes UI reutilizables
        ├── pages/      # Vistas de la aplicación
        └── services/   # Consumo de la API backend
```

---

## ⚙️ Configuración del Entorno de Desarrollo

Sigue estos pasos para levantar el proyecto en tu máquina local.

### 1. Clonar el repositorio

```bash
git clone https://github.com/alexcharco2002/Sistema-web-de-facturaci-n-TecniCobro-.git
cd Sistema-web-de-facturaci-n-TecniCobro-
```

### 2. Configuración del Backend (FastAPI)

```bash
cd CodigoFuente/backend

# Crear y activar entorno virtual
python -m venv venv
# En Windows:
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

**Variables de Entorno (`.env`):**
Crea un archivo `.env` en la carpeta `backend` con las siguientes credenciales (ajusta según tu configuración de PostgreSQL):

```env
DATABASE_URL=postgresql://usuario:clave@localhost:5432/jaap_sanjapamba
SECRET_KEY=TuClaveSecretaSuperSegura
```

**Ejecutar el servidor:**
```bash
uvicorn main:app --reload
```
*La API estará disponible en `http://localhost:8000` (Swagger UI en `/docs`).*

### 3. Configuración del Frontend (React)

En una nueva terminal:

```bash
cd CodigoFuente/frontend

# Instalar dependencias
npm install

# Iniciar la aplicación
npm start
```
*La aplicación web estará disponible en `http://localhost:3000`.*

---

## 🗄️ Estructura de la Base de Datos

El motor principal es **PostgreSQL**. A continuación se describen las tablas principales del modelo relacional:

| Tabla | Descripción |
| :--- | :--- |
| `t_usuario_sistema` | Usuarios administradores del sistema y sus roles. |
| `t_usuario_afiliado` | Información personal de los socios/afiliados a la junta. |
| `t_medidor` | Medidores físicos instalados, asignados a sectores y usuarios. |
| `t_sector` | Zonas o sectores geográficos de la comunidad. |
| `t_tarifa` | Estructura de costos según rangos de consumo. |
| `t_servicios` | Catálogo de servicios adicionales (reconexión, mantenimiento, etc). |
| `t_lecturas` | Registros mensuales del consumo marcado por los medidores. |
| `t_factura` | Documentos de cobro generados para los usuarios. |
| `t_pagos` | Transacciones y abonos realizados para cancelar facturas. |
| `t_multa` | Tipos de penalizaciones y multas aplicables. |

---

## 📚 Documentación Adicional

*   **Diagrama Entidad-Relación (ER):** Disponible en `/docs/ER_diagram.png`
*   **Documentación de la API:** Disponible en `/docs/api_documentation.md` (o accediendo a `/docs` al correr el backend).