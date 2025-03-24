const { generarClave, cifrarCredenciales } = require("./crypto-utils")
const readline = require("readline")
const fs = require("fs")
const path = require("path")

// Crear interfaz para leer entrada del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Función para preguntar al usuario
function pregunta(texto) {
  return new Promise((resolve) => {
    rl.question(texto, (respuesta) => {
      resolve(respuesta)
    })
  })
}

// Función principal
async function configurarCredenciales() {
  console.log("=== Configuración de Credenciales para Servidor ===")

  // Verificar si ya existe una clave
  let clave
  try {
    clave = fs.readFileSync(path.join(__dirname, "../../secret.key"))
    console.log("Se encontró una clave existente.")
  } catch (error) {
    console.log("No se encontró una clave existente. Generando una nueva...")
    clave = generarClave()
  }

  // Solicitar credenciales al usuario
  const usuario = await pregunta("Usuario del servidor: ")
  const contraseña = await pregunta("Contraseña: ")
  const direccionIp = await pregunta("Dirección IP del servidor: ")

  // Cifrar y guardar credenciales
  cifrarCredenciales(usuario, contraseña, direccionIp, clave)

  console.log("Configuración completada. Ya puedes usar la aplicación para enviar configuraciones al servidor.")

  rl.close()
}

// Ejecutar la función principal
configurarCredenciales()

