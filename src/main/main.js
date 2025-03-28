const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const { Client } = require("ssh2")
const { cleanPreviousConfigs } = require("../utils/clean-dhcp-config")

// Mantener una referencia global del objeto window
let mainWindow

function createWindow() {
  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  })

  // Cargar el archivo index.html
  const indexPath = path.join(__dirname, "../renderer/index.html")
  console.log("Cargando archivo desde:", indexPath)
  mainWindow.loadFile(indexPath)

  // Abrir DevTools para depuración (opcional)
  // mainWindow.webContents.openDevTools();
}

// Este método se llamará cuando Electron haya terminado
// la inicialización y esté listo para crear ventanas del navegador.
app.whenReady().then(createWindow)

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Función para generar una clave secreta
function generateSecretKey() {
  try {
    // Generar clave aleatoria
    const key = crypto.randomBytes(32)

    // Guardar la clave en un archivo en el directorio de datos de la aplicación
    const keyPath = path.join(app.getPath("userData"), "secret.key")
    fs.writeFileSync(keyPath, key)

    console.log("✅ Clave generada y guardada en:", keyPath)
    return key
  } catch (error) {
    console.error("❌ Error al generar la clave:", error)
    return null
  }
}

// Función para cifrar credenciales
function encryptCredentials(user, password, ipDirection) {
  try {
    // Verificar si existe la clave, si no, generarla
    const keyPath = path.join(app.getPath("userData"), "secret.key")
    let key

    if (fs.existsSync(keyPath)) {
      key = fs.readFileSync(keyPath)
    } else {
      key = generateSecretKey()
      if (!key) throw new Error("No se pudo generar la clave")
    }

    // Crear función de cifrado
    function encrypt(text) {
      // Generar IV aleatorio
      const iv = crypto.randomBytes(16)

      // Crear cifrador
      const cipher = crypto.createCipheriv("aes-256-cbc", key.slice(0, 32), iv)

      // Cifrar datos
      let encrypted = cipher.update(text, "utf8", "base64")
      encrypted += cipher.final("base64")

      // Combinar IV y datos cifrados
      return Buffer.concat([iv, Buffer.from(encrypted, "base64")]).toString("base64")
    }

    // Cifrar credenciales
    const userEncrypted = encrypt(user)
    const passwordEncrypted = encrypt(password)
    const ipEncrypted = encrypt(ipDirection)

    // Guardar datos cifrados en el directorio de datos de la aplicación
    const credPath = path.join(app.getPath("userData"), "credenciales.enc")
    fs.writeFileSync(credPath, userEncrypted + "\n" + passwordEncrypted + "\n" + ipEncrypted)

    console.log("✅ Credenciales cifradas y guardadas en:", credPath)
    return true
  } catch (error) {
    console.error("❌ Error al cifrar credenciales:", error)
    return false
  }
}

// Función para descifrar datos
function decryptData(encryptedData, key) {
  try {
    // Convertir de base64 a buffer
    const data = Buffer.from(encryptedData, "base64")

    // Extraer IV (primeros 16 bytes)
    const iv = data.slice(0, 16)
    const encryptedText = data.slice(16).toString("base64")

    // Crear descifrador
    const decipher = crypto.createDecipheriv("aes-256-cbc", key.slice(0, 32), iv)

    // Descifrar datos
    let decrypted = decipher.update(encryptedText, "base64", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  } catch (error) {
    console.error("Error al descifrar:", error)
    return null
  }
}

// Función para automatizar la configuración de red
async function automateNetworkConfiguration(dhcpConfig) {
  try {
    // Verificar si existen los archivos necesarios
    const keyPath = path.join(app.getPath("userData"), "secret.key")
    const credPath = path.join(app.getPath("userData"), "credenciales.enc")

    if (!fs.existsSync(keyPath) || !fs.existsSync(credPath)) {
      throw new Error("No se encontraron credenciales. Por favor, configura el servidor primero.")
    }

    // Leer la clave
    const key = fs.readFileSync(keyPath)

    // Leer y descifrar credenciales
    const credencialesCifradas = fs.readFileSync(credPath, "utf8").split("\n")

    const user = decryptData(credencialesCifradas[0], key)
    const password = decryptData(credencialesCifradas[1], key)
    const host = decryptData(credencialesCifradas[2], key)

    if (!user || !password || !host) {
      throw new Error("Error al descifrar las credenciales")
    }

    // Configuración de interfaces (valor predeterminado)
    const interfaceName = "enp0s3"
    const configureInterfaces = `INTERFACEv4=\\"${interfaceName}\\"`

    // Comandos SSH
    const comandoBackup = `echo ${password} | sudo -S cp /etc/dhcp/dhcpd.conf /etc/dhcp/dhcpd.conf.bak`
    const comandoBackupInterfaces = `echo ${password} | sudo -S cp /etc/default/isc-dhcp-server /etc/default/isc-dhcp-server.bak`
    const comandoConfInterfaces = `echo ${password} | sudo -S bash -c 'echo -e "${configureInterfaces}" > /etc/default/isc-dhcp-server'`
    const comandoEditar = `echo ${password} | sudo -S bash -c 'echo -e "\n# Configuración añadida por VLSM Calculator\n${dhcpConfig}" >> /etc/dhcp/dhcpd.conf'`
    const comandoVerificar = "cat /etc/dhcp/dhcpd.conf"
    const comandoReiniciar = `echo ${password} | sudo -S systemctl restart isc-dhcp-server`

    // Crear cliente SSH
    const ssh = new Client()

    // Agregar más eventos para depuración
    ssh.on("banner", (message) => {
      console.log("Banner SSH:", message)
    })

    ssh.on("handshake", () => {
      console.log("Handshake SSH completado")
    })

    ssh.on("error", (err) => {
      console.error("Error SSH detallado:", err)
    })

    // Conectar por SSH con timeout más largo y más información
    await new Promise((resolve, reject) => {
      console.log(`Intentando conectar a ${host}:22 con usuario ${user}...`)

      ssh
        .on("ready", () => {
          console.log("Conexión SSH establecida correctamente")
          resolve()
        })
        .connect({
          host,
          port: 22,
          username: user,
          password,
          readyTimeout: 30000, // Aumentar timeout a 30 segundos
          debug: (message) => console.log("SSH Debug:", message),
          // Aceptar claves de host desconocidas
          algorithms: {
            serverHostKey: ["ssh-rsa", "ssh-dss", "ecdsa-sha2-nistp256", "ssh-ed25519"],
          },
        })
    })

    // Limpiar configuraciones anteriores para evitar duplicados
    console.log("🧹 Limpiando configuraciones anteriores...")
    await cleanPreviousConfigs(ssh, password)

    // Función para ejecutar comandos SSH
    const ejecutarComando = (comando) => {
      return new Promise((resolve, reject) => {
        ssh.exec(comando, (err, stream) => {
          if (err) return reject(err)

          let salida = ""
          let error = ""

          stream
            .on("close", (code) => {
              if (code !== 0) {
                console.error(`Error en comando (código ${code}):`, error)
                // No rechazamos para continuar con el proceso
              }
              resolve(salida)
            })
            .on("data", (data) => {
              salida += data.toString()
            })
            .stderr.on("data", (data) => {
              error += data.toString()
            })
        })
      })
    }

    // 1️⃣ Hacer un backup antes de modificar el archivo
    console.log("📌 Creando backup del archivo DHCP...")
    await ejecutarComando(comandoBackup)
    await ejecutarComando(comandoBackupInterfaces)

    // 2️⃣ Modificar el archivo DHCP
    console.log("✍️ Escribiendo nueva configuración...")
    await ejecutarComando(comandoEditar)
    await ejecutarComando(comandoConfInterfaces)

    // 3️⃣ Verificar que el archivo realmente cambió
    console.log("🔍 Verificando contenido del archivo...")
    const contenidoActual = await ejecutarComando(comandoVerificar)
    console.log(contenidoActual)

    // 4️⃣ Reiniciar el servicio DHCP
    console.log("🔄 Reiniciando el servicio DHCP...")
    await ejecutarComando(comandoReiniciar)

    console.log("✅ Archivo DHCP modificado y servicio reiniciado correctamente.")

    // Cerrar conexión SSH
    ssh.end()

    return {
      success: true,
      message: "Configuración aplicada correctamente",
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    return {
      success: false,
      message: error.message,
    }
  }
}

// Manejar la solicitud para guardar configuración del servidor
ipcMain.handle("guardar-configuracion-servidor", async (event, configuracion) => {
  try {
    // Aquí es donde se reciben los datos del formulario HTML
    const { ip, usuario, contrasena } = configuracion
    console.log("Recibiendo datos del formulario:", { ip, usuario, contrasena: "***" })

    // Cifrar y guardar credenciales con los datos del formulario
    const resultado = encryptCredentials(usuario, contrasena, ip)

    if (resultado) {
      return { exito: true, mensaje: "Configuración guardada correctamente" }
    } else {
      return { exito: false, mensaje: "Error al guardar la configuración" }
    }
  } catch (error) {
    console.error("Error al guardar configuración:", error)
    return { exito: false, mensaje: error.message }
  }
})

// Manejar la solicitud para obtener configuración del servidor
ipcMain.handle("obtener-configuracion-servidor", async (event) => {
  try {
    // Verificar si existen los archivos necesarios
    const keyPath = path.join(app.getPath("userData"), "secret.key")
    const credPath = path.join(app.getPath("userData"), "credenciales.enc")

    if (!fs.existsSync(keyPath) || !fs.existsSync(credPath)) {
      return null
    }

    // Leer la clave
    const key = fs.readFileSync(keyPath)

    // Leer y descifrar credenciales
    const credencialesCifradas = fs.readFileSync(credPath, "utf8").split("\n")

    const usuario = decryptData(credencialesCifradas[0], key)
    const ip = decryptData(credencialesCifradas[2], key)

    if (!usuario || !ip) {
      return null
    }

    return {
      ip,
      usuario,
      // No devolver la contraseña por seguridad
    }
  } catch (error) {
    console.error("Error al obtener configuración:", error)
    return null
  }
})

// Manejar la solicitud para enviar configuración al servidor
ipcMain.handle("enviar-configuracion", async (event, configuracion) => {
  try {
    // Usar la función de automatización
    const resultado = await automateNetworkConfiguration(configuracion)

    if (resultado.success) {
      return { exito: true, mensaje: resultado.message }
    } else {
      return { exito: false, mensaje: resultado.message }
    }
  } catch (error) {
    console.error("Error al enviar configuración:", error)
    return { exito: false, mensaje: error.message }
  }
})

