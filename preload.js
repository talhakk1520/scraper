const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('electron',{
    getVendors: () =>  ipcRenderer.invoke("getVendors"),
    getUpdateVendors: () => ipcRenderer.invoke("getUpdateVendors"),
    loginAndPost: (vendorId, is_update) => ipcRenderer.invoke("loginAndPost", vendorId, is_update),
    setCookiesAndOpen: ({ cookies, postLoginPage }) => ipcRenderer.invoke("setCookiesAndOpen", { cookies, postLoginPage }),
    addTab: (title, url) => ipcRenderer.send('request-add-tab', title, url),
    performLogin: ({username, password}) => ipcRenderer.invoke('perform-login', {username, password}),
    updateTab: (url) => ipcRenderer.send('request-update-tab', url),
    setDefaultTab: (isLoggedIn) => ipcRenderer.invoke('request-set-default-tab', isLoggedIn),
    getUserName: () => ipcRenderer.invoke('get-user-name'),
    logout: (url) => ipcRenderer.send('request-logout', url),
});