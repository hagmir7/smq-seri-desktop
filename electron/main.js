const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

const { default: createLoginWindow } = require("./windows/loginWindow");
const { createShowWindow } = require("./windows/showWindow");
const { checkNotifications } = require("./notificationService");
const { saveSession, loadSession, clearSession } = require("./session");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV === "development";
const NOTIFICATION_INTERVAL_MS = 30 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Must match the appId used to build/package the app (electron-builder config).
const APP_ID = "com.intercocina.smq-seri";
const APP_NAME = "SMQ-PRO";

// Path to a tray icon. Use a small (16x16 / 32x32) png, ideally with an
// @2x variant next to it for retina displays.
const TRAY_ICON_PATH = path.join(__dirname, "assets", "trayIcon.png");

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

log.transports.file.level = "info";
autoUpdater.logger = log;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let mainWindow = null;
let loginWindow = null;
let showWindow = null;
let tray = null;

// True once the user (or the OS) has actually asked to quit, as opposed to
// just closing the window. Closing the window should hide it, not quit.
let isQuitting = false;

let currentSession = loadSession();

let notificationInterval = null;
let notificationCheckRunning = false;

// ---------------------------------------------------------------------------
// Single instance lock
// ---------------------------------------------------------------------------
//
// Without this, launching the app again while it's already running in the
// tray (e.g. double-clicking the desktop icon) spawns a whole new process
// with its own tray icon, instead of reopening the existing window.
//
// requestSingleInstanceLock() returns false in the SECOND process (the one
// that just got launched) — that process should just quit. It returns true
// in the FIRST/original process, which is where we listen for
// "second-instance" so we can bring the existing window to front instead.

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to launch a second instance (e.g. double-clicked the
    // icon again). Bring the existing window/login window to front instead
    // of letting a new one spawn.
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else if (currentSession?.access_token) {
      mainWindow = createWindow();
    } else if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.show();
      loginWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Windows-only: fixes notifications showing "Electron" as the app name.
// Must be set before app.whenReady().
// ---------------------------------------------------------------------------

if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, "assets", "icon.png"),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.once("ready-to-show", () => {
    if (win && !win.isDestroyed()) win.show();
  });

  // Intercept the close button: hide to tray instead of quitting, so
  // notification polling keeps running in the background. Only let the
  // window actually close when the app is genuinely quitting.
  win.on("close", (event) => {
    if (isQuitting) return;

    event.preventDefault();
    win.hide();
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

function createTray() {
  if (tray) return tray;

  const icon = nativeImage.createFromPath(TRAY_ICON_PATH);
  tray = new Tray(icon);

  tray.setToolTip(APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Open ${APP_NAME}`,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
        } else {
          mainWindow = createWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click / single click on the tray icon reopens the window.
  tray.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    } else {
      mainWindow = createWindow();
    }
  });

  return tray;
}

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

async function closeWindowIfOpen(win) {
  if (win && !win.isDestroyed()) {
    await new Promise((resolve) => {
      win.once("closed", resolve);
      win.close();
    });
  }
}

// ---------------------------------------------------------------------------
// Auto updater
// ---------------------------------------------------------------------------

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info.version);
    sendToRenderer("update:available", info);
  });

  autoUpdater.on("download-progress", (progress) => {
    sendToRenderer("update:download-progress", progress);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info.version);
    sendToRenderer("update:downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    log.error("AutoUpdater error:", err);
    sendToRenderer(
      "update:error",
      err == null ? "unknown error" : err.stack || err.message
    );
  });

  ipcMain.handle("update:quit-and-install", () => {
    autoUpdater.quitAndInstall();
  });

  if (isDev) return;

  const checkForUpdates = () =>
    autoUpdater.checkForUpdates().catch((error) => log.error(error));

  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Notification polling
// ---------------------------------------------------------------------------

async function checkNotificationsNow() {
  // Don't run two requests at the same time.
  if (notificationCheckRunning) return;

  // No authenticated user.
  if (!currentSession?.access_token) return;

  notificationCheckRunning = true;

  try {
    const result = await checkNotifications(currentSession.access_token);

    if (result?.unauthorized) {
      log.warn("Stopping notifications because authentication expired.");
      stopNotificationChecker();
    }
  } catch (error) {
    log.error("Notification check error:", error);
  } finally {
    notificationCheckRunning = false;
  }
}

function startNotificationChecker() {
  // Don't create multiple intervals.
  if (notificationInterval) return;

  log.info("Starting notification checker.");

  checkNotificationsNow();
  notificationInterval = setInterval(
    checkNotificationsNow,
    NOTIFICATION_INTERVAL_MS
  );
}

function stopNotificationChecker() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }

  log.info("Notification checker stopped.");
}

// ---------------------------------------------------------------------------
// Session lifecycle helpers
// ---------------------------------------------------------------------------

function handleLoginSuccess(data) {
  currentSession = data;
  saveSession(data);

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
    loginWindow = null;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
  } else {
    mainWindow.show();
  }

  createTray();
  startNotificationChecker();
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("login", async (event, data) => {
  try {
    if (!data?.access_token) {
      return { success: false, error: "Access token missing." };
    }

    handleLoginSuccess(data);
    log.info("User logged in successfully.");

    return { success: true };
  } catch (error) {
    log.error("Login error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("logout", async () => {
  try {
    stopNotificationChecker();

    currentSession = null;
    clearSession();

    if (tray) {
      tray.destroy();
      tray = null;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      isQuitting = true; // allow this specific close to go through
      mainWindow.close();
      mainWindow = null;
      isQuitting = false; // restore hide-to-tray behavior for the next window
    }

    if (!loginWindow || loginWindow.isDestroyed()) {
      loginWindow = createLoginWindow();
    } else {
      loginWindow.show();
    }

    log.info("User logged out.");

    return { success: true };
  } catch (error) {
    log.error("Logout error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-session", () => currentSession);

// Legacy handler — kept for renderers that still call "user" instead of "login".
ipcMain.handle("user", async (event, data) => {
  try {
    if (!data?.access_token) return null;

    handleLoginSuccess(data);
    return true;
  } catch (error) {
    log.error("User login error:", error);
    return null;
  }
});

ipcMain.on("openShow", async (event, preload) => {
  try {
    await closeWindowIfOpen(showWindow);

    showWindow = createShowWindow(preload);
    showWindow.show();

    event.reply("openShow-response", { success: true });
  } catch (error) {
    log.error("openShow error:", error);
    event.reply("openShow-response", { success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  log.info("Electron application ready.");

  setupAutoUpdater();

  if (currentSession?.access_token) {
    log.info("Saved session found.");
    mainWindow = createWindow();
    createTray();
    startNotificationChecker();
  } else {
    loginWindow = createLoginWindow();
  }
});

// The window now hides instead of closing (see the "close" handler in
// createWindow), so this only fires in edge cases — e.g. the login window
// closing before a session exists. Do NOT quit here, since the tray icon
// is what keeps the app (and notification polling) alive in the background.
app.on("window-all-closed", () => {
  if (mainWindow || currentSession?.access_token) return;

  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Fired by Cmd+Q / Quit menu item / app.quit(). Make sure the "close"
// handler on the window lets it close instead of hiding it again.
app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  } else if (currentSession?.access_token) {
    mainWindow = createWindow();
  }
});