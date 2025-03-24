const { contextBridge, ipcRenderer } = require("electron")

// Exponer API segura para comunicación con el proceso principal
contextBridge.exposeInMainWorld("ipcRenderer", {
  invoke: (channel, ...args) => {
    // Lista blanca de canales permitidos
    const canalesPermitidos = [
      "enviar-configuracion",
      "guardar-configuracion-servidor",
      "obtener-configuracion-servidor",
    ]

    if (canalesPermitidos.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }

    return Promise.reject(new Error(`Canal no permitido: ${channel}`))
  },
})

// Verificar que la API se expone correctamente
console.log("Preload script ejecutado. ipcRenderer expuesto:", !!contextBridge)

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM completamente cargado y analizado")
})

