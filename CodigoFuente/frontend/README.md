# 🖥️ Frontend - Sistema de Facturación web (React)

![React](https://img.shields.io/badge/Frontend-React-blue?style=for-the-badge&logo=react)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![NPM](https://img.shields.io/badge/NPM-CB3837?style=for-the-badge&logo=npm&logoColor=white)

Este directorio contiene todo el código fuente correspondiente a la **Interfaz de Usuario (UI)** del Sistema Web de Facturación para la Junta de Agua de Sanjapamba. 
El proyecto fue inicializado utilizando [Create React App](https://github.com/facebook/create-react-app).

---

## 📂 Estructura de Directorios

El código está organizado modularmente para facilitar la escalabilidad y el mantenimiento:

```text
frontend/
├── public/          # Archivos estáticos accesibles directamente (index.html, favicon, iconos)
└── src/             # Código fuente de la aplicación React
    ├── componentes/ # Elementos reutilizables (Botones, Tablas, Modales, Formularios)
    ├── pages/       # Vistas principales (Login, Dashboard, Facturas, Usuarios)
    ├── services/    # Lógica de conexión con la API del Backend (Fetch/Axios)
    ├── utils/       # Funciones auxiliares y formateadores
    ├── App.js       # Componente raíz y configuración de Rutas
    └── index.js     # Punto de entrada de la aplicación
```

---

## 🚀 Scripts Disponibles

En el directorio del proyecto (`frontend`), puedes ejecutar los siguientes comandos para el desarrollo y despliegue:

### `npm start`

Inicia la aplicación en modo de desarrollo.<br />
Abre [http://localhost:3000](http://localhost:3000) para verla en el navegador.

La página se recargará automáticamente si realizas ediciones en el código. También verás los errores de *linting* (formato) en la consola.

### `npm test`

Lanza el ejecutor de pruebas en modo interactivo.<br />
Consulta la sección sobre [ejecución de pruebas](https://facebook.github.io/create-react-app/docs/running-tests) para obtener más información.

### `npm run build`

Compila la aplicación para producción en la carpeta `build`.<br />
Empaqueta React correctamente en modo de producción y optimiza la compilación para obtener el mejor rendimiento. El código se minimiza y los nombres de archivo incluyen *hashes* de seguridad.

¡Tu aplicación estará lista para ser desplegada en un servidor (como Nginx, Apache, o Vercel)!

### `npm run eject`

**Nota: esta es una operación irreversible. ¡Una vez que ejecutas `eject`, no puedes volver atrás!**

Si no estás satisfecho con las herramientas de compilación y las opciones de configuración predeterminadas, puedes ejecutar este comando. Eliminará la dependencia de compilación única y copiará todos los archivos de configuración (Webpack, Babel, ESLint, etc.) directamente en tu proyecto para que tengas control total sobre ellos.

---

## 📚 Recursos Adicionales

*   Aprende más en la [Documentación de Create React App](https://facebook.github.io/create-react-app/docs/getting-started).
*   Para aprender o repasar React, revisa la [Documentación Oficial de React](https://reactjs.org/).
