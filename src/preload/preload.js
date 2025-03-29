const { contextBridge, ipcRenderer } = require("electron")

// Exponer API segura para comunicación con el proceso principal
contextBridge.exposeInMainWorld("electronAPI", {
  sendToMain: async (channel, data) => {
    // Lista blanca de canales permitidos
    const validChannels = [
      "enviar-configuracion",
      "guardar-configuracion-servidor",
      "obtener-configuracion-servidor",
      "aplicar-netplan",
    ]

    if (validChannels.includes(channel)) {
      try {
        console.log(`Enviando mensaje al canal: ${channel}`, data)
        const result = await ipcRenderer.invoke(channel, data)
        console.log(`Resultado del canal ${channel}:`, result)
        return result
      } catch (error) {
        console.error(`Error en el canal ${channel}:`, error)
        throw error
      }
    } else {
      console.error(`Canal no permitido: ${channel}`)
      return null
    }
  },
})

// Verificar que los canales IPC están registrados
ipcRenderer.on("ipc-ready", (event, channels) => {
  console.log("Canales IPC registrados:", channels)
})

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM completamente cargado y analizado")
})

