document.addEventListener("DOMContentLoaded", () => {
  // Verificar que ipcRenderer está disponible
  console.log("ipcRenderer disponible:", !!window.ipcRenderer)

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

  // Elementos de pestañas
  const botonesPestanas = document.querySelectorAll(".tab-btn")
  const contenidosPestanas = document.querySelectorAll(".tab-content")

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
    })
  })

  // Cargar configuración del servidor si existe
  if (window.ipcRenderer) {
    cargarConfiguracionServidor()
  } else {
    console.error("Error: ipcRenderer no está disponible")
  }

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
        .map((input) => input.value.trim())
        .filter(Boolean)

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

  // Enviar configuración al servidor
  botonEnviarServidor.addEventListener("click", async () => {
    try {
      if (!window.ipcRenderer) {
        throw new Error("Error de comunicación con el proceso principal")
      }

      // Verificar si hay configuración del servidor
      const configuracionServidor = await window.ipcRenderer.invoke("obtener-configuracion-servidor")
      if (!configuracionServidor) {
        estadoServidor.innerHTML = `<div class="error">No hay configuración de servidor. Por favor, configura el servidor primero.</div>`
        return
      }

      // Mostrar indicador de carga
      estadoServidor.innerHTML = '<div class="loading">Enviando configuración al servidor...</div>'

      // Convertir la configuración VLSM a formato DHCP
      const configuracionDHCP = convertirAFormatoDHCP(window.configuracionVLSM)

      // Enviar la configuración al proceso principal
      const resultado = await window.ipcRenderer.invoke("enviar-configuracion", configuracionDHCP)

      if (resultado.exito) {
        estadoServidor.innerHTML = '<div class="success">Configuración aplicada correctamente en el servidor</div>'
      } else {
        estadoServidor.innerHTML = `<div class="error">Error al aplicar configuración: ${resultado.mensaje}</div>`
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
      if (!window.ipcRenderer) {
        throw new Error("Error de comunicación con el proceso principal")
      }

      // Obtener valores del formulario HTML
      const ip = document.getElementById("server-ip").value
      const usuario = document.getElementById("server-user").value
      const contrasena = document.getElementById("server-password").value

      console.log("Enviando datos del formulario al proceso principal")

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
      const resultado = await window.ipcRenderer.invoke("guardar-configuracion-servidor", {
        ip,
        usuario,
        contrasena,
      })

      if (resultado.exito) {
        estadoConfigServidor.innerHTML = '<div class="success">Configuración guardada correctamente</div>'

        // Limpiar contraseña por seguridad
        document.getElementById("server-password").value = ""
      } else {
        throw new Error(resultado.mensaje)
      }
    } catch (error) {
      estadoConfigServidor.innerHTML = `<div class="error">${error.message}</div>`
      console.error("Error al guardar configuración:", error)
    }
  })

  // Cargar configuración del servidor si existe
  async function cargarConfiguracionServidor() {
    try {
      if (!window.ipcRenderer) {
        throw new Error("ipcRenderer no está disponible")
      }

      const configuracion = await window.ipcRenderer.invoke("obtener-configuracion-servidor")

      if (configuracion) {
        document.getElementById("server-ip").value = configuracion.ip || ""
        document.getElementById("server-user").value = configuracion.usuario || ""
        // No cargar la contraseña por seguridad
      }
    } catch (error) {
      console.error("Error al cargar configuración del servidor:", error)
    }
  }

  // Convertir la configuración VLSM a formato DHCP
  function convertirAFormatoDHCP(configuracionVLSM) {
    // Analizar la configuración VLSM
    const lineas = configuracionVLSM.split("\n")
    let configuracionDHCP = "authoritative;\n\n"

    // Procesar cada bloque de subred
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i]

      // Buscar líneas que comienzan con "subnet"
      if (linea.trim().startsWith("subnet")) {
        // Extraer información de la subred
        const partes = linea.match(/subnet\s+(\S+)\s+netmask\s+(\S+)/)
        if (partes) {
          const subred = partes[1]
          const mascara = partes[2]

          // Buscar el rango en la siguiente línea
          const rangoLinea = lineas[i + 1]
          const rangoParts = rangoLinea.match(/range\s+(\S+)\s+-\s+(\S+)/)

          if (rangoParts) {
            const rangoInicio = rangoParts[1]
            const rangoFin = rangoParts[2]

            // Buscar el router en la siguiente línea
            const routerLinea = lineas[i + 2]
            const routerParts = routerLinea.match(/option\s+routers\s+(\S+)/)

            if (routerParts) {
              const router = routerParts[1]

              // Agregar la configuración DHCP para esta subred
              configuracionDHCP += `subnet ${subred} netmask ${mascara} {\n`
              configuracionDHCP += `  range ${rangoInicio} ${rangoFin};\n`
              configuracionDHCP += `  option routers ${router};\n`
              configuracionDHCP += `  option domain-name-servers 8.8.8.8, 8.8.4.4;\n`
              configuracionDHCP += `}\n\n`
            }
          }
        }
      }
    }

    return configuracionDHCP
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
})

