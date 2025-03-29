document.addEventListener("DOMContentLoaded", () => {
  // Verificar que ipcRenderer está disponible
  console.log("ipcRenderer disponible:", !!window.electronAPI)

  // Elementos de la interfaz
  const formulario = document.getElementById("vlsm-form")
  const resultado = document.getElementById("result")
  const contenedorHosts = document.getElementById("hosts-container")
  const botonCalcular = document.getElementById("calculate-btn")
  const indicadorCarga = document.getElementById("loading-spinner")
  const inputSubredes = document.getElementById("subnets")
  const botonEnviarServidor = document.getElementById("enviar-servidor")
  const estadoServidor = document.getElementById("estado-servidor")
  const formularioServidor = document.getElementById("server-form")
  const estadoConfigServidor = document.getElementById("server-status")

  // Elementos de netplan
  const netplanNoVlsm = document.getElementById("netplan-no-vlsm")
  const netplanConfigSection = document.getElementById("netplan-config-section")
  const subnetSelect = document.getElementById("subnet-select")
  const serverIpInSubnet = document.getElementById("server-ip-in-subnet")
  const netplanPreview = document.getElementById("netplan-preview")
  const netplanForm = document.getElementById("netplan-form")
  const netplanStatus = document.getElementById("netplan-status")
  const primaryInterface = document.getElementById("primary-interface")

  // Elementos de pestañas
  const botonesPestanas = document.querySelectorAll(".tab-btn")
  const contenidosPestanas = document.querySelectorAll(".tab-content")

  // Variables globales para almacenar datos
  window.subredes = []

  // Gestión de pestañas
  botonesPestanas.forEach((boton) => {
    boton.addEventListener("click", () => {
      // Desactivar todas las pestañas
      botonesPestanas.forEach((b) => b.classList.remove("active"))
      contenidosPestanas.forEach((c) => c.classList.remove("active"))

      // Activar la pestaña seleccionada
      boton.classList.add("active")
      const pestanaSeleccionada = boton.getAttribute("data-tab")
      document.getElementById(`${pestanaSeleccionada}-tab`).classList.add("active")

      // Si se selecciona la pestaña de netplan, verificar si hay datos VLSM
      if (pestanaSeleccionada === "netplan-config") {
        if (window.configuracionVLSM) {
          netplanNoVlsm.classList.add("hidden")
          netplanConfigSection.classList.remove("hidden")
          cargarSubredes()
        } else {
          netplanNoVlsm.classList.remove("hidden")
          netplanConfigSection.classList.add("hidden")
        }
      }
    })
  })

  // Escuchar cambios en el campo de número de subredes
  inputSubredes.addEventListener("change", () => {
    generarCamposHost()
  })

  // Generar campos de host basados en el número de subredes
  function generarCamposHost() {
    const numSubredes = Number.parseInt(inputSubredes.value) || 0

    // Limpiar los campos de host existentes
    contenedorHosts.innerHTML = ""

    // Generar nuevos campos de host basados en el número de subredes
    for (let i = 1; i <= numSubredes; i++) {
      const itemHost = document.createElement("div")
      itemHost.className = "host-item"
      itemHost.innerHTML = `
        <label class="subnet-label">Subred ${i}:</label>
        <input type="number" class="host-input" placeholder="Número de hosts" min="1" required>
      `
      contenedorHosts.appendChild(itemHost)
    }

    // Mostrar mensaje si no hay subredes
    if (numSubredes <= 0) {
      contenedorHosts.innerHTML = '<p class="no-subnets">Ingresa el número de subredes primero</p>'
    }
  }

  // Envío del formulario VLSM
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault()

    try {
      // Mostrar indicador de carga
      indicadorCarga.classList.remove("hidden")
      resultado.textContent = ""

      const red = document.getElementById("network").value
      const subredes = document.getElementById("subnets").value

      // Obtener todos los inputs de host
      const inputsHost = document.querySelectorAll(".host-input")
      const hosts = Array.from(inputsHost)
        .map((input) => Number.parseInt(input.value.trim()))
        .filter((value) => !isNaN(value) && value > 0)

      if (!red || !subredes || hosts.length === 0) {
        throw new Error("Por favor, completa todos los campos requeridos")
      }

      // Validar formato de dirección de red (validación simple)
      if (!esDireccionIpValida(red)) {
        throw new Error("Formato de dirección de red inválido")
      }

      // Construir la URL con parámetros de consulta
      const url = new URL("http://localhost:3001/vlsm/calculate")
      url.searchParams.append("network", red)
      url.searchParams.append("subnets", subredes)

      // Agregar cada host como un parámetro 'hosts' separado
      hosts.forEach((host) => {
        url.searchParams.append("hosts", host)
      })

      console.log("Consultando URL:", url.toString())

      const respuesta = await fetch(url.toString())

      if (!respuesta.ok) {
        throw new Error(`Error de API: ${respuesta.status} ${respuesta.statusText}`)
      }

      // Obtener la respuesta como texto ya que la API devuelve texto formateado
      const datos = await respuesta.text()

      // Mostrar el resultado en un bloque preformateado
      resultado.innerHTML = `<pre>${datos}</pre>`

      // Habilitar el botón para enviar al servidor
      botonEnviarServidor.disabled = false

      // Guardar los datos para enviar al servidor
      window.configuracionVLSM = datos

      // Parsear las subredes para la configuración de netplan
      parsearSubredes(datos)
    } catch (error) {
      resultado.innerHTML = `<div class="error">${error.message}</div>`
      console.error("Error:", error)

      // Deshabilitar el botón para enviar al servidor
      botonEnviarServidor.disabled = true
    } finally {
      // Ocultar indicador de carga
      indicadorCarga.classList.add("hidden")
    }
  })

  // Parsear las subredes desde la configuración VLSM
  function parsearSubredes(configuracionVLSM) {
    const subredes = []
    const lineas = configuracionVLSM.split("\n")

    let currentSubnet = null

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim()

      // Buscar líneas que comienzan con "subnet"
      if (linea.startsWith("subnet")) {
        const subnetMatch = linea.match(/subnet\s+(\S+)\s+netmask\s+(\S+)/)
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
      else if (linea.startsWith("range") && currentSubnet) {
        const rangeMatch = linea.match(/range\s+(\S+)\s+(\S+)/)
        if (rangeMatch) {
          currentSubnet.range = {
            start: rangeMatch[1],
            end: rangeMatch[2],
          }
        }
      }
      // Buscar líneas con "routers" (gateway)
      else if (linea.includes("routers") && currentSubnet) {
        const routerMatch = linea.match(/routers\s+(\S+)/)
        if (routerMatch) {
          currentSubnet.gateway = routerMatch[1]

          // Añadir la subred completa al array
          subredes.push({ ...currentSubnet })
          currentSubnet = null
        }
      }
    }

    window.subredes = subredes
    console.log("Subredes parseadas:", subredes)
  }

  // Cargar las subredes en el selector
  function cargarSubredes() {
    // Limpiar opciones existentes
    subnetSelect.innerHTML = ""

    if (!window.subredes || window.subredes.length === 0) {
      subnetSelect.innerHTML = '<option value="">No hay subredes disponibles</option>'
      return
    }

    // Añadir cada subred como una opción
    window.subredes.forEach((subred, index) => {
      const option = document.createElement("option")
      option.value = index
      option.textContent = `Subred ${index + 1}: ${subred.address}/${maskToCidr(subred.mask)} (${subred.range.start} - ${subred.range.end})`
      subnetSelect.appendChild(option)
    })

    // Actualizar la IP del servidor con la primera subred
    actualizarIpServidor()
  }

  // Convertir máscara a formato CIDR
  function maskToCidr(mask) {
    const parts = mask.split(".")
    let cidr = 0

    for (let i = 0; i < 4; i++) {
      const octet = Number.parseInt(parts[i])
      for (let j = 7; j >= 0; j--) {
        if (octet & (1 << j)) {
          cidr++
        } else {
          return cidr
        }
      }
    }

    return cidr
  }

  // Actualizar la IP sugerida del servidor basada en la subred seleccionada
  subnetSelect.addEventListener("change", actualizarIpServidor)

  function actualizarIpServidor() {
    const selectedIndex = subnetSelect.value
    if (selectedIndex === "" || !window.subredes[selectedIndex]) {
      serverIpInSubnet.value = ""
      return
    }

    const subred = window.subredes[selectedIndex]
    // Sugerir la segunda IP disponible en el rango (la primera suele ser el gateway)
    const ipParts = subred.range.start.split(".")
    ipParts[3] = Number.parseInt(ipParts[3]) + 1
    serverIpInSubnet.value = ipParts.join(".")

    // Actualizar la vista previa
    actualizarVistaPrevia()
  }

  // Actualizar la vista previa de la configuración de netplan
  function actualizarVistaPrevia() {
    const selectedIndex = subnetSelect.value
    if (selectedIndex === "" || !window.subredes[selectedIndex]) {
      netplanPreview.textContent = "Selecciona una subred para ver la vista previa"
      return
    }

    const subred = window.subredes[selectedIndex]
    const config = {
      primaryInterface: primaryInterface.value,
      subnetAddress: subred.address,
      subnetMask: subred.mask,
      serverIp: serverIpInSubnet.value,
      gateway: subred.gateway,
    }

    const netplanConfig = generateNetplanConfig(config)
    netplanPreview.textContent = netplanConfig
  }

  // Generar configuración de netplan
  function generateNetplanConfig(config) {
    const { primaryInterface, subnetAddress, subnetMask, serverIp, gateway } = config

    // Convertir máscara de subred a formato CIDR
    const cidrPrefix = maskToCidr(subnetMask)

    // Corregir el punto y coma después del gateway
    const gatewayFixed = gateway.endsWith(";") ? gateway.slice(0, -1) : gateway

    // Crear la configuración de netplan (solo para la interfaz principal)
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
          via: ${gatewayFixed}  # Gateway principal
          metric: 100  # Prioridad alta para esta ruta
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4`

    return netplanConfig
  }
  // Escuchar cambios en los campos para actualizar la vista previa
  if (primaryInterface) {
    primaryInterface.addEventListener("input", actualizarVistaPrevia)
  }

  if (serverIpInSubnet) {
    serverIpInSubnet.addEventListener("input", actualizarVistaPrevia)
  }

  // Enviar formulario de netplan
  netplanForm.addEventListener("submit", async (evento) => {
    evento.preventDefault()

    try {
      if (!window.electronAPI) {
        throw new Error("Error de comunicación con el proceso principal")
      }

      // Obtener la subred seleccionada
      const selectedIndex = subnetSelect.value
      if (selectedIndex === "" || !window.subredes[selectedIndex]) {
        throw new Error("Por favor, selecciona una subred válida")
      }

      const subred = window.subredes[selectedIndex]

      // Validar la IP del servidor
      if (!esDireccionIpValida(serverIpInSubnet.value)) {
        throw new Error("Formato de IP del servidor inválido")
      }

      // Generar la configuración de netplan
      const config = {
        primaryInterface: primaryInterface.value,
        subnetAddress: subred.address,
        subnetMask: subred.mask,
        serverIp: serverIpInSubnet.value,
        gateway: subred.gateway,
      }

      const netplanConfig = generateNetplanConfig(config)

      // Mostrar información de conexión
      netplanStatus.innerHTML = `<div class="loading">
        <p>Aplicando configuración de netplan al servidor...</p>
        <p>Esto puede tardar unos momentos. Por favor, espera...</p>
        <div class="spinner"></div>
      </div>`

      console.log("Enviando configuración de netplan:", netplanConfig)

      // Enviar la configuración al proceso principal
      const resultado = await window.electronAPI.sendToMain("aplicar-netplan", netplanConfig)

      console.log("Resultado de aplicar netplan:", resultado)

      if (resultado && resultado.exito) {
        netplanStatus.innerHTML = '<div class="success">Configuración de netplan aplicada correctamente</div>'
      } else {
        netplanStatus.innerHTML = `<div class="error">
          <p>Error al aplicar configuración de netplan: ${resultado ? resultado.mensaje : "Error desconocido"}</p>
          <p>Verifica que:</p>
          <ul>
            <li>La dirección IP del servidor es correcta</li>
            <li>El servidor está encendido y accesible en la red</li>
            <li>El servicio SSH está activo en el servidor</li>
            <li>El usuario tiene permisos sudo</li>
          </ul>
        </div>`
      }
    } catch (error) {
      console.error("Error al aplicar configuración de netplan:", error)
      netplanStatus.innerHTML = `<div class="error">Error: ${error.message}</div>`
    }
  })

  // Enviar configuración al servidor
  botonEnviarServidor.addEventListener("click", async () => {
    try {
      if (!window.electronAPI) {
        throw new Error("Error de comunicación con el proceso principal")
      }

      // Mostrar información de conexión
      estadoServidor.innerHTML = `<div class="loading">
        <p>Intentando conectar al servidor...</p>
        <p>Esto puede tardar unos momentos. Por favor, espera...</p>
        <div class="spinner"></div>
      </div>`

      // La configuración DHCP ya viene formateada directamente desde la API
      const configuracionDHCP = window.configuracionVLSM

      // Enviar la configuración al proceso principal
      const resultado = await window.electronAPI.sendToMain("enviar-configuracion", configuracionDHCP)

      if (resultado && resultado.exito) {
        estadoServidor.innerHTML = '<div class="success">Configuración aplicada correctamente en el servidor</div>'
      } else {
        estadoServidor.innerHTML = `<div class="error">
          <p>Error al aplicar configuración: ${resultado ? resultado.mensaje : "Error desconocido"}</p>
          <p>Verifica que:</p>
          <ul>
            <li>La dirección IP del servidor es correcta</li>
            <li>El servidor está encendido y accesible en la red</li>
            <li>El servicio SSH está activo en el servidor</li>
            <li>No hay firewalls bloqueando la conexión</li>
          </ul>
        </div>`
      }
    } catch (error) {
      estadoServidor.innerHTML = `<div class="error">Error: ${error.message}</div>`
      console.error("Error al enviar configuración:", error)
    }
  })

  // Guardar configuración del servidor
  formularioServidor.addEventListener("submit", async (evento) => {
    evento.preventDefault()

    try {
      if (!window.electronAPI) {
        throw new Error("Error de comunicación con el proceso principal")
      }

      // Obtener valores del formulario HTML
      const ip = document.getElementById("server-ip").value
      const usuario = document.getElementById("server-user").value
      const contrasena = document.getElementById("server-password").value

      // Validar campos
      if (!ip || !usuario || !contrasena) {
        throw new Error("Por favor, completa todos los campos")
      }

      // Validar formato de IP
      if (!esDireccionIpValida(ip)) {
        throw new Error("Formato de dirección IP inválido")
      }

      // Mostrar indicador de carga
      estadoConfigServidor.innerHTML = '<div class="loading">Guardando configuración...</div>'

      // Enviar datos al proceso principal para cifrar y guardar
      const resultado = await window.electronAPI.sendToMain("guardar-configuracion-servidor", {
        ip,
        usuario,
        contrasena,
      })

      if (resultado && resultado.exito) {
        estadoConfigServidor.innerHTML = '<div class="success">Configuración guardada correctamente</div>'

        // Limpiar contraseña por seguridad
        document.getElementById("server-password").value = ""
      } else {
        throw new Error(resultado ? resultado.mensaje : "Error al guardar la configuración")
      }
    } catch (error) {
      estadoConfigServidor.innerHTML = `<div class="error">${error.message}</div>`
      console.error("Error al guardar configuración:", error)
    }
  })

  // Cargar configuración del servidor si existe
  async function cargarConfiguracionServidor() {
    try {
      if (!window.electronAPI) {
        throw new Error("ipcRenderer no está disponible")
      }

      const configuracion = await window.electronAPI.sendToMain("obtener-configuracion-servidor")

      if (configuracion) {
        document.getElementById("server-ip").value = configuracion.ip || ""
        document.getElementById("server-user").value = configuracion.usuario || ""
        // No cargar la contraseña por seguridad
      }
    } catch (error) {
      console.error("Error al cargar configuración del servidor:", error)
    }
  }

  function esDireccionIpValida(ip) {
    // Validación simple de dirección IP
    const regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    if (!regex.test(ip)) return false

    const partes = ip.split(".")
    return partes.every((parte) => Number.parseInt(parte) >= 0 && Number.parseInt(parte) <= 255)
  }

  // Inicializar con un mensaje de instrucción
  contenedorHosts.innerHTML = '<p class="no-subnets">Ingresa el número de subredes primero</p>'

  // Deshabilitar el botón para enviar al servidor inicialmente
  botonEnviarServidor.disabled = true

  // Cargar configuración del servidor si existe
  cargarConfiguracionServidor()
})

