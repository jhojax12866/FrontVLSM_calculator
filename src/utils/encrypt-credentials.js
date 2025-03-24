const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

// Función para cifrar credenciales
function encryptCredentials(user, password, ipDirection) {
  try {
    // Leer la clave
    const keyPath = path.join(__dirname, "../../secret.key")
    const key = fs.readFileSync(keyPath)

    // Crear función de cifrado similar a Fernet
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

    // Guardar datos cifrados
    const credPath = path.join(__dirname, "../../credenciales.enc")
    fs.writeFileSync(credPath, userEncrypted + "\n" + passwordEncrypted + "\n" + ipEncrypted)

    console.log("✅ Usuario, contraseña e IP cifrados y guardados en 'credenciales.enc'.")
    return true
  } catch (error) {
    console.error("❌ Error al cifrar credenciales:", error)
    return false
  }
}

// Esta parte SOLO se ejecuta si el script se llama directamente desde la línea de comandos
// NO se ejecuta cuando se importa desde otro archivo
if (require.main === module) {
  // Valores predeterminados SOLO para pruebas desde línea de comandos
  const user = "admin1"
  const password = "admin"
  const ipDirection = "192.168.101.86"

  encryptCredentials(user, password, ipDirection)
}

module.exports = { encryptCredentials }

