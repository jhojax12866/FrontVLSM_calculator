const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const { saveCredentials, loadCredentials, sshConnect } = require("./ssh-utils")

// Mantener una referencia global del objeto window
let mainWindow

function createWindow() {
  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  })

  // Cargar el archivo index.html
  mainWindow.loadFile("index.html")

  // Abrir DevTools (opcional, para desarrollo)
  // mainWindow.webContents.openDevTools();
}

// Este método se llamará cuando Electron haya terminado
// la inicialización y esté listo para crear ventanas del navegador.
app.whenReady().then(() => {
  createWindow()

  // Configurar manejadores de IPC
  setupIpcHandlers()

  app.on("activate", () => {
    // En macOS es común volver a crear una ventana en la aplicación cuando
    // se hace clic en el icono del dock y no hay otras ventanas abiertas.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// Configurar manejadores de IPC para comunicación con el renderer
function setupIpcHandlers() {
  // Guardar configuración del servidor
  ipcMain.handle("guardar-configuracion-servidor", async (event, config) => {
    try {
      const { ip, usuario, contrasena } = config
      const appDataPath = app.getPath("userData")

      const result = saveCredentials(usuario, contrasena, ip, appDataPath)

      if (result) {
        return { exito: true, mensaje: "Configuración guardada correctamente" }
      } else {
        return { exito: false, mensaje: "Error al guardar la configuración" }
      }
    } catch (error) {
      console.error("Error al guardar configuración:", error)
      return { exito: false, mensaje: error.message }
    }
  })

  // Obtener configuración del servidor
  ipcMain.handle("obtener-configuracion-servidor", async (event) => {
    try {
      const appDataPath = app.getPath("userData")
      const credentials = loadCredentials(appDataPath)

      if (!credentials) {
        return null
      }

      return {
        ip: credentials.ipAddress,
        usuario: credentials.user,
        // No devolver la contraseña por seguridad
      }
    } catch (error) {
      console.error("Error al obtener configuración:", error)
      return null
    }
  })

  // Enviar configuración al servidor
  ipcMain.handle("enviar-configuracion", async (event, dhcpConfig) => {
    try {
      const appDataPath = app.getPath("userData")
      const credentials = loadCredentials(appDataPath)

      if (!credentials) {
        return { exito: false, mensaje: "No hay configuración de servidor guardada" }
      }

      // Comandos para configurar el servidor
      const interfaceName = "enp0s3" // Valor predeterminado
      const configureInterfaces = `INTERFACEv4=\\"${interfaceName}\\"`

      const commands = [
        `echo ${credentials.password} | sudo -S cp /etc/dhcp/dhcpd.conf /etc/dhcp/dhcpd.conf.bak`,
        `echo ${credentials.password} | sudo -S cp /etc/default/isc-dhcp-server /etc/default/isc-dhcp-server.bak`,
        `echo ${credentials.password} | sudo -S bash -c 'echo -e "${configureInterfaces}" > /etc/default/isc-dhcp-server'`,
        `echo ${credentials.password} | sudo -S bash -c 'echo -e "\n# Configuración añadida por VLSM Calculator\n${dhcpConfig}" >> /etc/dhcp/dhcpd.conf'`,
        "cat /etc/dhcp/dhcpd.conf",
        `echo ${credentials.password} | sudo -S systemctl restart isc-dhcp-server`,
      ]

      // Conectar por SSH y ejecutar comandos
      const result = await sshConnect(credentials.ipAddress, credentials.user, credentials.password, commands)

      if (result.success) {
        return { exito: true, mensaje: "Configuración aplicada correctamente" }
      } else {
        return { exito: false, mensaje: "Error al aplicar la configuración" }
      }
    } catch (error) {
      console.error("Error al enviar configuración:", error)
      return { exito: false, mensaje: error.message }
    }
  })
}

