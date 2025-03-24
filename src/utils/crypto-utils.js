const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

// Función para generar una clave secreta
function generarClave() {
  const key = crypto.randomBytes(32)

  // Guardar la clave en un archivo
  fs.writeFileSync(path.join(__dirname, "../../secret.key"), key)

  console.log('✅ Clave generada y guardada en "secret.key".')

  return key
}

// Función para cifrar credenciales
function cifrarCredenciales(usuario, contraseña, direccionIp, clave) {
  // Si no se proporciona una clave, intentar leerla del archivo
  if (!clave) {
    try {
      clave = fs.readFileSync(path.join(__dirname, "../../secret.key"))
    } catch (error) {
      console.error("Error al leer la clave:", error)
      return false
    }
  }

  // Crear cifrador
  const iv = clave.slice(0, 16)
  const cipher = crypto.createCipheriv("aes-256-cbc", clave.slice(0, 32), iv)

  // Cifrar datos
  const usuarioCifrado = Buffer.from(cipher.update(usuario, "utf8", "base64") + cipher.final("base64")).toString(
    "base64",
  )

  // Reiniciar cifrador para cada valor
  const cipher2 = crypto.createCipheriv("aes-256-cbc", clave.slice(0, 32), iv)
  const contraseñaCifrada = Buffer.from(
    cipher2.update(contraseña, "utf8", "base64") + cipher2.final("base64"),
  ).toString("base64")

  // Reiniciar cifrador para cada valor
  const cipher3 = crypto.createCipheriv("aes-256-cbc", clave.slice(0, 32), iv)
  const ipCifrada = Buffer.from(cipher3.update(direccionIp, "utf8", "base64") + cipher3.final("base64")).toString(
    "base64",
  )

  // Guardar datos cifrados
  fs.writeFileSync(
    path.join(__dirname, "../../credenciales.enc"),
    usuarioCifrado + "\n" + contraseñaCifrada + "\n" + ipCifrada,
  )

  console.log('✅ Usuario, contraseña e IP cifrados y guardados en "credenciales.enc".')

  return true
}

module.exports = {
  generarClave,
  cifrarCredenciales,
}

