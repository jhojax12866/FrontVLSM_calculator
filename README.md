# VLSM Calculator - Aplicación Electron

Una aplicación de escritorio construida con Electron para calcular subredes de longitud variable (VLSM) y aplicar configuraciones automáticamente a servidores Ubuntu.

## Descripción

VLSM Calculator permite:
- Calcular subredes de longitud variable (VLSM) a partir de una dirección de red
- Visualizar la información detallada de cada subred
- Enviar configuraciones DHCP automáticamente a un servidor Ubuntu
- Guardar y gestionar credenciales de servidores de forma segura

## Requisitos Previos

Antes de instalar y ejecutar esta aplicación, necesitas tener instalado:

- [Node.js](https://nodejs.org/) (v14.0.0 o superior)
- [npm](https://www.npmjs.com/) (normalmente viene con Node.js)
- [Git](https://git-scm.com/) (opcional, para clonar el repositorio)

Para la funcionalidad completa:
- Un servidor Ubuntu con acceso SSH
- El paquete `isc-dhcp-server` instalado en el servidor Ubuntu

## Instalación

### Opción 1: Descargar el código fuente y ejecutarlo

1. Clona o descarga este repositorio:
   ```bash
   git clone https://github.com/tu-usuario/vlsm-calculator.git
   cd vlsm-calculator
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia la aplicación en modo desarrollo:
   ```bash
   npm start
   ```

### Opción 2: Instalar desde un paquete preconstruido

1. Descarga el instalador desde la [sección de releases](https://github.com/tu-usuario/vlsm-calculator/releases).
2. Ejecuta el instalador y sigue las instrucciones en pantalla.

## Configuración de `package.json`

```json
{
  "name": "vlsm-electron",
  "version": "1.0.0",
  "private": true,
  "description": "Aplicación Electron para consumir API VLSM y configurar servidor",
  "main": "src/main/main.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "electron .",
    "dist": "electron-builder",
    "pack": "electron-builder --dir",
    "lint": "next lint"
  },
  "dependencies": {
    "ssh2": "^1.15.0",
    "vlsm-electron": "file:"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "electron": "^26.0.0",
    "electron-builder": "^24.13.3",
    "postcss": "^8",
    "tailwindcss": "^3.4.17",
    "typescript": "^5"
  },
  "build": {
    "appId": "com.vlsm.calculator",
    "productName": "VLSM Calculator",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": "nsis"
    },
    "mac": {
      "target": "dmg"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

## Uso de la Aplicación

### Calculadora VLSM

1. Ingresa la dirección de red (por ejemplo, 192.168.1.0)
2. Especifica el número de subredes
3. Ingresa el número de hosts requeridos para cada subred
4. Haz clic en "Calcular VLSM"
5. Los resultados se mostrarán en la sección inferior

### Configuración del Servidor

1. Ve a la pestaña "Configuración del Servidor"
2. Ingresa la dirección IP, usuario y contraseña del servidor Ubuntu
3. Haz clic en "Guardar Configuración"
4. Regresa a la pestaña "Calculadora"
5. Después de calcular VLSM, haz clic en "Enviar al Servidor" para aplicar la configuración

## Construcción del Instalador

Para crear un instalador para Windows:

```bash
npm run dist
```

El instalador se generará en la carpeta `dist`.

## Solución de Problemas

### Problemas de Construcción

Si encuentras problemas al construir el instalador:

```bash
npx electron-builder --win --config.npmRebuild=false
```

### Problemas de Conexión SSH

Si tienes problemas para conectar con el servidor:

1. Verifica que el servidor esté encendido y accesible en la red
2. Asegúrate de que el servicio SSH esté activo en el servidor
3. Comprueba que no haya firewalls bloqueando la conexión
4. Verifica que las credenciales sean correctas

## Licencia

Este proyecto está bajo la licencia MIT. Para más información, consulta el archivo LICENSE.

---

Si necesitas más modificaciones, dime. 🚀

