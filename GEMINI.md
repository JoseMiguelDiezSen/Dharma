# Reglas del Proyecto Dharma (Angular + ASP.NET Core)

## Arquitectura de Ejecución en Visual Studio

### 1. Proyecto de Inicio (Startup Project)
- **`Dharma.Server` debe ser el Proyecto de Inicio** (o configurarse en *Varios proyectos de inicio* con `Dharma.Server` + `dharma.client`).
- **NUNCA** seleccionar únicamente `dharma.client` como proyecto de inicio:
  - Si se inicia únicamente `dharma.client`, el backend de C# (`Dharma.Server`) no arranca.
  - Al no ejecutarse el backend, las peticiones HTTP a la API (`/api/Usuarios`, `/api/Barcos`, `/api/Aviones`, `/api/Satelites`) fallan con error de conexión (`ECONNREFUSED`) y la aplicación queda sin datos.

### 2. Comportamiento de SpaProxy
- `Dharma.Server.csproj` contiene:
  ```xml
  <SpaRoot>..\dharma.client</SpaRoot>
  <SpaProxyLaunchCommand>npm start</SpaProxyLaunchCommand>
  <SpaProxyServerUrl>https://localhost:56684</SpaProxyServerUrl>
  ```
- **`<SpaProxyLaunchCommand>` NUNCA debe dejarse vacío (`""`)**:
  - Vaciar esta propiedad provoca que `Microsoft.AspNetCore.SpaProxy.SpaProxyLaunchManager` falle con `System.ArgumentOutOfRangeException: length ('-1') must be a non-negative value`.
- Al iniciar `Dharma.Server`, `Microsoft.AspNetCore.SpaProxy` levanta el servidor de desarrollo de Angular (`dharma.client`) en el puerto `56684` de forma automática.
- En Windows, esto abre una consola de comandos para el proceso de Angular mientras el servidor esté activo.

### 3. Puertos y Proxy
- **Backend (.NET 9):** `https://localhost:7191` / `http://localhost:5135`
- **Frontend (Angular 20):** `https://localhost:56684`
- **Proxy Angular (`proxy.conf.js`):** Redirige el contexto `/api` hacia `https://localhost:7191`.
