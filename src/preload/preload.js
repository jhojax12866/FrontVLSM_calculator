const { contextBridge, ipcRenderer } = require("electron")

// Exponer API segura para comunicación con el proceso principal
contextBridge.exposeInMainWorld("electronAPI", {
  sendToMain: async (channel, data) => {
    // Lista blanca de canales permitidos
    const validChannels = ["enviar-configuracion", "guardar-configuracion-servidor", "obtener-configuracion-servidor"]
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data)
    }
    return null
  },
})

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM completamente cargado y analizado")
})

