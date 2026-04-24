const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("adminStock", {
  request: async ({ path, method, apiKey, body }) => {
    return ipcRenderer.invoke("admin-stock:request", {
      path,
      method,
      apiKey,
      body,
    });
  },
});

