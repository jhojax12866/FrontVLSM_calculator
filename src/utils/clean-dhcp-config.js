/**
 * Función para limpiar configuraciones anteriores de VLSM Calculator
 * Esta función elimina las secciones añadidas previamente por la aplicación
 * para evitar duplicados al añadir nuevas configuraciones
 */
async function cleanPreviousConfigs(ssh, password) {
    try {
      console.log("🧹 Limpiando configuraciones anteriores...")
  
      // Comando para crear un archivo temporal sin las configuraciones de VLSM Calculator
      const cleanCommand = `
        echo ${password} | sudo -S bash -c '
          grep -v "# Configuración añadida por VLSM Calculator" /etc/dhcp/dhcpd.conf > /tmp/dhcpd.conf.clean && 
          sudo cp /tmp/dhcpd.conf.clean /etc/dhcp/dhcpd.conf && 
          sudo rm /tmp/dhcpd.conf.clean
        '
      `
  
      // Ejecutar el comando
      return new Promise((resolve, reject) => {
        ssh.exec(cleanCommand, (err, stream) => {
          if (err) return reject(err)
  
          let output = ""
          let error = ""
  
          stream
            .on("close", (code) => {
              if (code !== 0) {
                console.warn(`Comando de limpieza terminó con código ${code}:`, error)
              }
              resolve({ success: true })
            })
            .on("data", (data) => {
              output += data.toString()
            })
            .stderr.on("data", (data) => {
              error += data.toString()
            })
        })
      })
    } catch (error) {
      console.error("Error al limpiar configuraciones anteriores:", error)
      return { success: false, error }
    }
  }
  
  module.exports = { cleanPreviousConfigs }
  
  