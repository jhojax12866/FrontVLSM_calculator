const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

// Función equivalente a secret.key.py
function generateSecretKey() {
  try {
    // Generar clave aleatoria (equivalente a Fernet.generate_key())
    const key = crypto.randomBytes(32)

    // Guardar la clave en un archivo
    const keyPath = path.join(__dirname, "../../secret.key")
    fs.writeFileSync(keyPath, key)

    console.log("✅ Clave generada y guardada en 'secret.key'.")
    return key
  } catch (error) {
    console.error("❌ Error al generar la clave:", error)
    return null
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generateSecretKey()
}

module.exports = { generateSecretKey }

