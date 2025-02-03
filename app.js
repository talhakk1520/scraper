require("electron-tabs");
const { ipcRenderer } = require('electron');
const tabGroup = document.querySelector("tab-group");

ipcRenderer.on('set-default-tab', (event, isLoggedIn) => {
  if (isLoggedIn) {
    tabGroup.setDefaultTab({
      title: "Vendor Scraper",
      src: "ui/index.html",
      active: true,
      webviewAttributes: {
        preload: "./preload.js",
      }
    });
  } else {
    tabGroup.setDefaultTab({
      title: "Vendor Scraper",
      src: "login.html",
      active: true,
      webviewAttributes: {
        preload: "./preload.js",
      }
    });
  }
});

tabGroup.addTab({
  title: "Vendor Scraper",
  src: "login.html",
  active: true,
  webviewAttributes: {
    preload: "./preload.js"
  }
});

ipcRenderer.on('add-tab', (event, title, url) => {
    tabGroup.addTab({
        title: title,
        src: url,
        active: true
    });
});

ipcRenderer.on('update-tab', (event, url) => {
  const allTabs = tabGroup.getTabs();
  allTabs.forEach(tab => {
    tab.webview.src = url;
    tab.webview.preload = "./preload.js";
  });
});

window.onload = async () => {
  const userName = await ipcRenderer.invoke('get-user-name');
  if(userName) {
    const activeTab = tabGroup.getActiveTab();
    if (activeTab) {
      activeTab.webview.src = 'ui/index.html';
      activeTab.webview.preload = "./preload.js";
    }
  } else {
    const activeTab = tabGroup.getActiveTab();
    if (activeTab) {
      activeTab.webview.src = 'login.html';
      activeTab.webview.preload = "./preload.js";
    }
  }
}