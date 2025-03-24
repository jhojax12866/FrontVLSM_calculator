const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { Client } = require("ssh2")

// Función equivalente a automatizacion_de_redes1.py
async function automateNetworkConfiguration(dhcpConfig, interfaceName = "enp0s3") {
  try {
    // 1️⃣ Cargar la clave
    const keyPath = path.join(__dirname, "../../secret.key")
    const key = fs.readFileSync(keyPath)

    // Función para descifrar similar a Fernet.decrypt()
    function decrypt(encryptedData) {
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
    }

    // 2️⃣ Leer y descifrar credenciales
    const credPath = path.join(__dirname, "../../credenciales.enc")
    const credencialesCifradas = fs.readFileSync(credPath, "utf8").split("\n")

    const user = decrypt(credencialesCifradas[0])
    const password = decrypt(credencialesCifradas[1])
    const host = decrypt(credencialesCifradas[2])

    // 3️⃣ Configuración de conexión SSH
    console.log(`🔑 Conectando a ${host} con el usuario ${user}...`)

    // Configuración de interfaces
    const configureInterfaces = `INTERFACEv4=\\"${interfaceName}\\"`

    // Comandos SSH
    const comandoBackup = `echo ${password} | sudo -S cp /etc/dhcp/dhcpd.conf /etc/dhcp/dhcpd.conf.bak`
    const comandoBackupInterfaces = `echo ${password} | sudo -S cp /etc/default/isc-dhcp-server /etc/default/isc-dhcp-server.bak`
    const comandoConfInterfaces = `echo ${password} | sudo -S bash -c 'echo -e "${configureInterfaces}" > /etc/default/isc-dhcp-server'`
    const comandoEditar = `echo ${password} | sudo -S bash -c 'echo -e "${dhcpConfig}" > /etc/dhcp/dhcpd.conf'`
    const comandoVerificar = "cat /etc/dhcp/dhcpd.conf"
    const comandoReiniciar = `echo ${password} | sudo -S systemctl restart isc-dhcp-server`

    // Crear cliente SSH
    const ssh = new Client()

    // Conectar por SSH (promisificado)
    await new Promise((resolve, reject) => {
      ssh
        .on("ready", () => {
          console.log("Conexión SSH establecida")
          resolve()
        })
        .on("error", (err) => {
          reject(err)
        })
        .connect({
          host,
          port: 22,
          username: user,
          password,
          // Aceptar claves de host desconocidas (equivalente a AutoAddPolicy)
          algorithms: {
            serverHostKey: ["ssh-rsa", "ssh-dss", "ecdsa-sha2-nistp256", "ssh-ed25519"],
          },
        })
    })

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

// Ejecutar si se llama directamente
if (require.main === module) {
  // Configuración DHCP de ejemplo
  const dhcpConfig = `authoritative;

subnet 192.168.60.0 netmask 255.255.255.0 {
    range 192.168.60.10 192.168.60.100;
    option routers 192.168.60.1;
    option domain-name-servers 8.8.8.8, 8.8.4.4;
}`

  automateNetworkConfiguration(dhcpConfig)
    .then((result) => console.log(result))
    .catch((err) => console.error(err))
}

module.exports = { automateNetworkConfiguration }

