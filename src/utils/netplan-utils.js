/**
 * Utilidades para generar y aplicar configuraciones de Netplan
 */

/**
 * Genera la configuración de Netplan basada en los parámetros proporcionados
 * @param {Object} config - Configuración para generar el archivo netplan
 * @returns {string} - Contenido del archivo netplan
 */
function generateNetplanConfig(config) {
    const {
      primaryInterface,
      secondaryInterface,
      subnetAddress,
      subnetMask,
      serverIp,
      gateway,
      secondaryIp,
      secondaryGateway,
    } = config
  
    // Convertir máscara de subred a formato CIDR
    const cidrPrefix = maskToCidr(subnetMask)
  
    // Crear la configuración de netplan
    const netplanConfig = `network:
    version: 2
    renderer: networkd
    ethernets:
      ${primaryInterface}:
        dhcp4: no
        addresses:
          - ${serverIp}/${cidrPrefix}  # IP fija del servidor en la subred principal
        routes:
          - to: 0.0.0.0/0
            via: ${gateway}  # Gateway principal
            metric: 100  # Prioridad alta para esta ruta
        nameservers:
          addresses:
            - 8.8.8.8
            - 8.8.4.4
      ${secondaryInterface}:
        dhcp4: no
        addresses:
          - ${secondaryIp}  # IP fija para SSH
        routes:
          - to: 0.0.0.0/0
            via: ${secondaryGateway}  # Gateway de la red SSH
            metric: 200  # Menor prioridad para evitar conflictos
        nameservers:
          addresses:
            - 8.8.8.8
            - 8.8.4.4
  `
  
    return netplanConfig
  }
  
  /**
   * Convierte una máscara de subred (255.255.255.0) a notación CIDR (/24)
   * @param {string} mask - Máscara de subred en formato decimal
   * @returns {number} - Prefijo CIDR
   */
  function maskToCidr(mask) {
    const parts = mask.split(".")
    let cidr = 0
  
    for (let i = 0; i < 4; i++) {
      const octet = Number.parseInt(parts[i])
      for (let j = 7; j >= 0; j--) {
        if (octet & (1 << j)) {
          cidr++
        } else {
          // Una vez que encontramos un bit 0, todos los demás bits deben ser 0
          return cidr
        }
      }
    }
  
    return cidr
  }
  
  /**
   * Extrae información de subredes desde la configuración VLSM
   * @param {string} vlsmConfig - Configuración VLSM generada
   * @returns {Array} - Array de objetos con información de cada subred
   */
  function parseVlsmConfig(vlsmConfig) {
    const subnets = []
    const lines = vlsmConfig.split("\n")
  
    let currentSubnet = null
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
  
      // Buscar líneas que comienzan con "subnet"
      if (line.startsWith("subnet")) {
        const subnetMatch = line.match(/subnet\s+(\S+)\s+netmask\s+(\S+)/)
        if (subnetMatch) {
          currentSubnet = {
            address: subnetMatch[1],
            mask: subnetMatch[2],
            range: null,
            gateway: null,
          }
        }
      }
      // Buscar líneas con "range"
      else if (line.startsWith("range") && currentSubnet) {
        const rangeMatch = line.match(/range\s+(\S+)\s+(\S+)/)
        if (rangeMatch) {
          currentSubnet.range = {
            start: rangeMatch[1],
            end: rangeMatch[2],
          }
        }
      }
      // Buscar líneas con "routers" (gateway)
      else if (line.includes("routers") && currentSubnet) {
        const routerMatch = line.match(/routers\s+(\S+)/)
        if (routerMatch) {
          currentSubnet.gateway = routerMatch[1]
  
          // Añadir la subred completa al array
          subnets.push({ ...currentSubnet })
          currentSubnet = null
        }
      }
    }
  
    return subnets
  }
  
  /**
   * Aplica la configuración de netplan al servidor
   * @param {Object} ssh - Cliente SSH conectado
   * @param {string} password - Contraseña del servidor
   * @param {string} netplanConfig - Configuración de netplan a aplicar
   * @returns {Promise} - Promesa que se resuelve cuando se completa la operación
   */
  async function applyNetplanConfig(ssh, password, netplanConfig) {
    // Escapar comillas y caracteres especiales para el comando bash
    const escapedConfig = netplanConfig.replace(/"/g, '\\"').replace(/\$/g, "\\$")
  
    // Comandos a ejecutar
    const comandoBackup = `echo ${password} | sudo -S cp /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.bak`
    const comandoEditar = `echo ${password} | sudo -S bash -c 'echo -e "${escapedConfig}" > /etc/netplan/50-cloud-init.yaml'`
    const comandoAplicar = `echo ${password} | sudo -S netplan apply`
    const comandoVerificar = `cat /etc/netplan/50-cloud-init.yaml`
  
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
  
    try {
      // 1. Hacer backup
      console.log("📌 Creando backup del archivo netplan...")
      await ejecutarComando(comandoBackup)
  
      // 2. Escribir nueva configuración
      console.log("✍️ Escribiendo nueva configuración de netplan...")
      await ejecutarComando(comandoEditar)
  
      // 3. Verificar que el archivo realmente cambió
      console.log("🔍 Verificando contenido del archivo...")
      const contenidoActual = await ejecutarComando(comandoVerificar)
      console.log(contenidoActual)
  
      // 4. Aplicar la configuración
      console.log("🔄 Aplicando configuración de netplan...")
      await ejecutarComando(comandoAplicar)
  
      console.log("✅ Configuración de netplan aplicada correctamente.")
  
      return {
        success: true,
        message: "Configuración de netplan aplicada correctamente",
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`)
      return {
        success: false,
        message: error.message,
      }
    }
  }
  
  module.exports = {
    generateNetplanConfig,
    parseVlsmConfig,
    applyNetplanConfig,
    maskToCidr,
  }
  
  