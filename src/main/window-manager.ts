import type { ClusterId } from "../common/cluster-store";
import { makeObservable, observable } from "mobx";
import { app, BrowserWindow, dialog, shell, webContents } from "electron";
import windowStateKeeper from "electron-window-state";
import { appEventBus } from "../common/event-bus";
import { subscribeToBroadcast } from "../common/ipc";
import { initMenu } from "./menu";
import { initTray } from "./tray";
import { Singleton } from "../common/utils";
import { ClusterFrameInfo, clusterFrameMap } from "../common/cluster-frames";
import { IpcRendererNavigationEvents } from "../renderer/navigation/events";
import logger from "./logger";
import { isDevelopment, productName } from "../common/vars";
import { LensProxy } from "./proxy/lens-proxy";

export class WindowManager extends Singleton {
  protected mainWindow: BrowserWindow;
  protected splashWindow: BrowserWindow;
  protected windowState: windowStateKeeper.State;
  protected disposers: Record<string, Function> = {};

  @observable activeClusterId: ClusterId;

  constructor() {
    super();
    makeObservable(this);

    this.bindEvents();
    this.initMenu();
    this.initTray();
  }

  get mainUrl() {
    return `http://localhost:${LensProxy.getInstance().port}`;
  }

  async initMainWindow(showSplash = true) {
    // Manage main window size and position with state persistence
    if (!this.windowState) {
      this.windowState = windowStateKeeper({
        defaultHeight: 900,
        defaultWidth: 1440,
      });
    }

    if (!this.mainWindow) {
      // show icon in dock (mac-os only)
      app.dock?.show();

      const { width, height, x, y } = this.windowState;

      this.mainWindow = new BrowserWindow({
        x, y, width, height,
        title: productName,
        show: false,
        minWidth: 700,  // accommodate 800 x 600 display minimum
        minHeight: 500, // accommodate 800 x 600 display minimum
        titleBarStyle: "hidden",
        backgroundColor: "#1e2124",
        webPreferences: {
          nodeIntegration: true,
          nodeIntegrationInSubFrames: true,
          enableRemoteModule: true,
        }
      });
      this.windowState.manage(this.mainWindow);

      // open external links in default browser (target=_blank, window.open)
      this.mainWindow
        .on("focus", () => {
          appEventBus.emit({ name: "app", action: "focus" });
        })
        .on("blur", () => {
          appEventBus.emit({ name: "app", action: "blur" });
        })
        .on("closed", () => {
          // clean up
          this.windowState.unmanage();
          this.mainWindow = null;
          this.splashWindow = null;
          app.dock?.hide(); // hide icon in dock (mac-os)
        })
        .webContents
        .on("new-window", (event, url) => {
          event.preventDefault();
          shell.openExternal(url);
        })
        .on("dom-ready", () => {
          this.mainWindow.webContents.openDevTools({ mode: "right", activate: isDevelopment });
          appEventBus.emit({ name: "app", action: "dom-ready" });
        })
        .on("did-fail-load", (_event, code, desc) => {
          logger.error(`[WINDOW-MANAGER]: Failed to load Main window`, { code, desc });
        })
        .on("did-finish-load", () => {
          logger.info("[WINDOW-MANAGER]: Main window loaded");
        });
    }

    try {
      if (showSplash) await this.showSplash();
      logger.info(`[WINDOW-MANAGER]: Loading Main window from url: ${this.mainUrl} ...`);
      await this.mainWindow.loadURL(this.mainUrl);
      this.mainWindow.show();
      this.splashWindow?.close();
      setTimeout(() => {
        appEventBus.emit({ name: "app", action: "start" });
      }, 1000);
    } catch (error) {
      logger.error("Showing main window failed", { error });
      dialog.showErrorBox("ERROR!", error.toString());
    }
  }

  protected async initMenu() {
    this.disposers.menuAutoUpdater = initMenu(this);
  }

  protected initTray() {
    this.disposers.trayAutoUpdater = initTray(this);
  }

  protected bindEvents() {
    // track visible cluster from ui
    subscribeToBroadcast(IpcRendererNavigationEvents.CLUSTER_VIEW_CURRENT_ID, (event, clusterId: ClusterId) => {
      this.activeClusterId = clusterId;
    });
  }

  async ensureMainWindow(): Promise<BrowserWindow> {
    if (!this.mainWindow) await this.initMainWindow();
    this.mainWindow.show();

    return this.mainWindow;
  }

  sendToView({ channel, frameInfo, data = [] }: { channel: string, frameInfo?: ClusterFrameInfo, data?: any[] }) {
    if (frameInfo) {
      this.mainWindow.webContents.sendToFrame([frameInfo.processId, frameInfo.frameId], channel, ...data);
    } else {
      this.mainWindow.webContents.send(channel, ...data);
    }
  }

  async navigate(url: string, frameId?: number) {
    await this.ensureMainWindow();

    const frameInfo = Array.from(clusterFrameMap.values()).find((frameInfo) => frameInfo.frameId === frameId);
    const channel = frameInfo
      ? IpcRendererNavigationEvents.NAVIGATE_IN_CLUSTER
      : IpcRendererNavigationEvents.NAVIGATE_IN_APP;

    this.sendToView({
      channel,
      frameInfo,
      data: [url],
    });
  }

  reload() {
    const frameInfo = clusterFrameMap.get(this.activeClusterId);

    if (frameInfo) {
      this.sendToView({ channel: IpcRendererNavigationEvents.RELOAD_PAGE, frameInfo });
    } else {
      webContents.getFocusedWebContents()?.reload();
    }
  }

  async showSplash() {
    if (!this.splashWindow) {
      this.splashWindow = new BrowserWindow({
        width: 500,
        height: 300,
        backgroundColor: "#1e2124",
        center: true,
        frame: false,
        resizable: false,
        show: false,
        webPreferences: {
          nodeIntegration: true
        }
      });
      await this.splashWindow.loadURL("static://splash.html");
    }
    this.splashWindow.show();
  }

  hide() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.hide();
    if (this.splashWindow && !this.splashWindow.isDestroyed()) this.splashWindow.hide();
  }

  destroy() {
    this.mainWindow.destroy();
    this.splashWindow.destroy();
    this.mainWindow = null;
    this.splashWindow = null;
    Object.entries(this.disposers).forEach(([name, dispose]) => {
      dispose();
      delete this.disposers[name];
    });
  }
}
