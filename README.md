VLSM Calculator - Aplicación Electron

Descripción

VLSM Calculator es una aplicación de escritorio desarrollada con Electron que permite calcular subredes VLSM (Variable Length Subnet Masking) y aplicar automáticamente la configuración a un servidor Ubuntu mediante SSH.

Requisitos Previos

Node.js (versión 14.0.0 o superior)

npm (normalmente se instala con Node.js)

Sistema operativo: Windows, macOS o Linux

Instalación

1. Clonar o descargar el proyecto

# Crear una carpeta para el proyecto
mkdir VLSM-App
cd VLSM-App

2. Inicializar el proyecto

# Inicializar un nuevo proyecto npm
npm init -y

3. Instalar dependencias

# Instalar Electron, Electron Builder y otras dependencias
npm install

4. Estructura de Archivos

Crea los siguientes archivos en la carpeta src:

main/main.js - Proceso principal de Electron

renderer/index.html - Interfaz de usuario

renderer/renderer.js - Lógica del renderizador

renderer/styles.css - Estilos CSS

utils/ssh-utils.js - Utilidades para SSH

5. Configurar package.json

Tu archivo package.json ya debe contener la siguiente configuración:

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

Ejecución en Modo Desarrollo

Para ejecutar la aplicación en modo desarrollo:

npm start

Construcción del Instalador

Para crear un instalador para Windows:

# Ejecutar como administrador para evitar problemas de permisos
npm run dist

El instalador se generará en la carpeta dist.

Uso de la Aplicación

Calculadora VLSM

Ingresa la dirección de red (por ejemplo, 192.168.1.0)

Especifica el número de subredes

Ingresa el número de hosts requeridos para cada subred

Haz clic en "Calcular VLSM"

Los resultados se mostrarán en la sección inferior

Configuración del Servidor

Ve a la pestaña "Configuración del Servidor"

Ingresa la dirección IP, usuario y contraseña del servidor Ubuntu

Haz clic en "Guardar Configuración"

Regresa a la pestaña "Calculadora"

Después de calcular VLSM, haz clic en "Enviar al Servidor" para aplicar la configuración

Solución de Problemas

Problemas de Construcción

Si encuentras problemas al construir el instalador:

Error de permisos: Ejecuta la línea de comandos como administrador

npx electron-builder --win --config.npmRebuild=false

Problemas con enlaces simbólicos: Usa la configuración simplificada

npx electron-builder --win --config.npmRebuild=false --config.asar=false --config.win.signAndEditExecutable=false

Limpiar caché: Si persisten los problemas, limpia la caché

# En PowerShell
Remove-Item -Recurse -Force $env:USERPROFILE\AppData\Local\electron-builder\Cache

Problemas de Conexión SSH

Si tienes problemas para conectar con el servidor:

Verifica que el servidor esté encendido y accesible en la red

Asegúrate de que el servicio SSH esté activo en el servidor

Comprueba que no haya firewalls bloqueando la conexión

Verifica que las credenciales sean correctas

Requisitos del Servidor

Para que la aplicación pueda configurar el servidor Ubuntu, este debe tener:

Servicio SSH activo

Paquete isc-dhcp-server instalado

El usuario debe tener permisos sudo
