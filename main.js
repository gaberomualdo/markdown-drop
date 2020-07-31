/*
    This is the JS entry point file for the application.
    It handles the Node.js and server-side parts of the app,
    such as creation of app windows, and file system actions.
*/

// set constant global variables for application
global.APP_VERSION = '0.1.0';

// get required modules from electron
const { app, Menu, BrowserWindow, ipcMain } = require('electron');

// global window object
let window;

let updateWindowFocus;
function createWindow() {
  // window options
  let windowOptions = {
    width: 900,
    height: 750,
    webPreferences: {
      nodeIntegration: true,
    },
    allowRunningInsecureContent: true,
  };

  if (process.platform === 'darwin') {
    // windowOptions.titleBarStyle = 'hiddenInset';
  }

  // create window with options
  window = new BrowserWindow(windowOptions);

  // load main HTML file into window with platform info
  window.loadFile('index.html');

  // set variable for onblur and onfocus
  updateWindowFocus = () => {
    window.webContents.send('window-focus-change', window.isFocused());
  };

  window.on('focus', () => {
    updateWindowFocus();
  });
  window.on('blur', () => {
    updateWindowFocus();
  });

  ipcMain.on('update-window-focus', (e) => {
    updateWindowFocus();
    e.returnValue = '';
  });
}

// create window
app.on('ready', () => {
  createWindow();

  const isMac = process.platform === 'darwin';
  const isInDevelopment = true; //process.mainModule.filename.indexOf('app.asar') === -1;

  const appMenuTemplate = [
    // { role: 'appMenu' }
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: 'About Markdown Print/PDF' },
              { type: 'separator' },
              { role: 'hide', label: 'Hide Markdown Print/PDF' },
              { role: 'hideothers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: 'Quit Markdown Print/PDF' },
            ],
          },
        ]
      : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' },
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            window.webContents.send('begin-print', '');
            window.webContents.print(
              {
                margins: {
                  marginType: 'printableArea',
                },
              },
              () => {
                window.webContents.send('end-print', '');
              }
            );
          },
        },
      ],
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [{ role: 'startspeaking' }, { role: 'stopspeaking' }],
              },
            ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Developer Tools (only in development mode)
    ...(isInDevelopment
      ? [
          {
            label: 'Developer',
            submenu: [
              { type: 'normal', label: 'Note: this tab will not be displayed in production', enabled: false },
              { role: 'toggledevtools' },
              { role: 'reload' },
            ],
          },
        ]
      : []),
  ];

  const appMenu = Menu.buildFromTemplate(appMenuTemplate);
  Menu.setApplicationMenu(appMenu);
});

// quit when all windows are closed
app.on('window-all-closed', () => {
  // on macOS apps stay open until quit in menu-bar or w/Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// on macOS re-create app window when app icon is clicked
app.on('activate', () => {
  if (window === null) {
    createWindow();
  }
});
