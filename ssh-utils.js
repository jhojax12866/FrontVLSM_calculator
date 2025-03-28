const { Client } = require("ssh2")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
// Añadir la importación al principio del archivo
const { cleanPreviousConfigs } = require("./clean-dhcp-config")

// Función para cifrar datos
function encryptData(data, key) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", key.slice(0, 32), iv)
  let encrypted = cipher.update(data, "utf8", "base64")
  encrypted += cipher.final("base64")
  return Buffer.concat([iv, Buffer.from(encrypted, "base64")]).toString("base64")
}

// Función para descifrar datos
function decryptData(encryptedData, key) {
  try {
    const data = Buffer.from(encryptedData, "base64")
    const iv = data.slice(0, 16)
    const encryptedText = data.slice(16).toString("base64")
    const decipher = crypto.createDecipheriv("aes-256-cbc", key.slice(0, 32), iv)
    let decrypted = decipher.update(encryptedText, "base64", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch (error) {
    console.error("Error al descifrar:", error)
    return null
  }
}

// Función para guardar credenciales cifradas
function saveCredentials(user, password, ipAddress, appDataPath) {
  try {
    // Generar o cargar clave
    const keyPath = path.join(appDataPath, "secret.key")
    let key

    if (fs.existsSync(keyPath)) {
      key = fs.readFileSync(keyPath)
    } else {
      key = crypto.randomBytes(32)
      fs.writeFileSync(keyPath, key)
    }

    // Cifrar credenciales
    const userEncrypted = encryptData(user, key)
    const passwordEncrypted = encryptData(password, key)
    const ipEncrypted = encryptData(ipAddress, key)

    // Guardar credenciales cifradas
    const credPath = path.join(appDataPath, "credentials.enc")
    fs.writeFileSync(credPath, userEncrypted + "\n" + passwordEncrypted + "\n" + ipEncrypted)

    return true
  } catch (error) {
    console.error("Error al guardar credenciales:", error)
    return false
  }
}

// Función para cargar credenciales
function loadCredentials(appDataPath) {
  try {
    const keyPath = path.join(appDataPath, "secret.key")
    const credPath = path.join(appDataPath, "credentials.enc")

    if (!fs.existsSync(keyPath) || !fs.existsSync(credPath)) {
      return null
    }

    const key = fs.readFileSync(keyPath)
    const encryptedData = fs.readFileSync(credPath, "utf8").split("\n")

    const user = decryptData(encryptedData[0], key)
    const password = decryptData(encryptedData[1], key)
    const ipAddress = decryptData(encryptedData[2], key)

    return { user, password, ipAddress }
  } catch (error) {
    console.error("Error al cargar credenciales:", error)
    return null
  }
}

// Función para conectar por SSH y ejecutar comandos
async function sshConnect(host, username, password, commands) {
  return new Promise((resolve, reject) => {
    const ssh = new Client()

    ssh.on("ready", async () => {
      console.log("Conexión SSH establecida")

      // Limpiar configuraciones anteriores para evitar duplicados
      try {
        await cleanPreviousConfigs(ssh, password)
      } catch (error) {
        console.warn("No se pudieron limpiar configuraciones anteriores:", error)
        // Continuamos con el proceso aunque falle la limpieza
      }

      try {
        const results = []

        // Ejecutar cada comando secuencialmente
        for (const cmd of commands) {
          const result = await executeCommand(ssh, cmd)
          results.push(result)
        }

        ssh.end()
        resolve({ success: true, results })
      } catch (error) {
        ssh.end()
        reject(error)
      }
    })

    ssh.on("error", (err) => {
      console.error("Error SSH:", err)
      reject(err)
    })

    // Intentar conectar con timeout extendido
    ssh.connect({
      host,
      port: 22,
      username,
      password,
      readyTimeout: 30000,
      algorithms: {
        serverHostKey: ["ssh-rsa", "ssh-dss", "ecdsa-sha2-nistp256", "ssh-ed25519"],
      },
    })
  })
}

// Función auxiliar para ejecutar un comando SSH
function executeCommand(ssh, command) {
  return new Promise((resolve, reject) => {
    ssh.exec(command, (err, stream) => {
      if (err) return reject(err)

      let output = ""
      let errorOutput = ""

      stream
        .on("close", (code) => {
          if (code !== 0) {
            console.warn(`Comando terminó con código ${code}:`, errorOutput)
          }
          resolve({ output, errorOutput, code })
        })
        .on("data", (data) => {
          output += data.toString()
        })
        .stderr.on("data", (data) => {
          errorOutput += data.toString()
        })
    })
  })
}

module.exports = {
  saveCredentials,
  loadCredentials,
  sshConnect,
}

