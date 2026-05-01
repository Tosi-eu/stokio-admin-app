const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

function apiBase() {
  return process.env.ADMIN_STOCK_API_BASE || "http://localhost/api/v1";
}

function safeUrl(pathname) {
  const p = String(pathname || "");
  if (!p.startsWith("/admin/")) throw new Error("Caminho não permitido");
  return `${apiBase()}${p}`;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
    title: "Admin Stock",
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("admin-stock:request", async (_evt, args) => {
    const method = String(args?.method || "GET").toUpperCase();
    const pathname = String(args?.path || "");
    const apiKey = String(args?.apiKey || "").trim();
    if (!apiKey) throw new Error("Chave ausente");

    const url = safeUrl(pathname);
    const headers = { "X-API-Key": apiKey };

    const init = { method, headers };
    if (args?.body != null) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(args.body);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, text };
  });

  ipcMain.handle("admin-stock:upload", async (_evt, args) => {
    const pathname = String(args?.path || "");
    const apiKey = String(args?.apiKey || "").trim();
    const filename = String(args?.filename || "upload.bin");
    const contentType = String(args?.contentType || "application/octet-stream");
    const fieldName = String(args?.fieldName || "file");
    const bytes = args?.bytes;
    if (!apiKey) throw new Error("Chave ausente");
    if (!bytes) throw new Error("Arquivo ausente");

    const url = safeUrl(pathname);
    const form = new FormData();
    const blob = new Blob([new Uint8Array(bytes)], { type: contentType });
    form.append(fieldName, blob, filename);

    const res = await fetch(url, {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: form,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, text };
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
