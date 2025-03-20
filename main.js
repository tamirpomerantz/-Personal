const { app, BrowserWindow, ipcMain, screen, nativeTheme, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');


// Create Personal directory if it doesn't exist
const personalPath = path.join(require('os').homedir(), 'Personal');
console.log('Checking Personal directory:', personalPath);

if (!fs.existsSync(personalPath)) {
    console.log('Creating Personal directory...');
    fs.mkdirSync(personalPath);
}

let mainWindow = null;

// OCR Queue Management
const MAX_CONCURRENT_OCR = 20;
const ocrQueue = [];
let activeOcrProcesses = 0;

async function processOcrQueue() {
    while (activeOcrProcesses < MAX_CONCURRENT_OCR && ocrQueue.length > 0) {
        const { imagePath, resolve, reject } = ocrQueue.shift();
        activeOcrProcesses++;

        try {
            console.log(`Processing OCR: ${imagePath} (Active: ${activeOcrProcesses})`);
            const result = await Tesseract.recognize(imagePath, 'eng', {
                logger: progress => console.log('OCR Progress:', progress)
            });

            console.log(`OCR completed: ${imagePath}`);
            resolve(result.data.text.trim());
        } catch (error) {
            console.error('OCR Error:', error);
            reject(error);
        } finally {
            activeOcrProcesses--;
            processOcrQueue(); // Trigger next in queue
        }
    }
}

// Handle OCR requests
ipcMain.handle('perform-ocr', async (event, imagePath) => {
    return new Promise((resolve, reject) => {
        ocrQueue.push({ imagePath, resolve, reject });
        processOcrQueue();
    });
});

// Handle window closing
ipcMain.on('close-window', () => {
    BrowserWindow.getFocusedWindow()?.close();
});


// Handle theme updates from renderer
ipcMain.on('update-theme', (event, isDarkMode) => {
    nativeTheme.themeSource = isDarkMode ? 'dark' : 'light';
});


// Handle image modal window creation
ipcMain.handle('open-image-modal', (event, imageData) => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;

    const modalWindow = new BrowserWindow({
        width: Math.round(screenWidth * 0.8),
        height: 800,
        parent: mainWindow,
        modal: true,
        show: false,
        transparent: true,
        hasShadow: false,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    modalWindow.loadFile('imageModal.html');

    modalWindow.once('ready-to-show', () => {
        modalWindow.show();
        modalWindow.webContents.send('image-data', imageData);
    });

    return modalWindow.id;
});

// Relay image updates from modal to main window
ipcMain.on('image-updated', (event, updatedImage) => {
    mainWindow.webContents.send('image-updated', updatedImage);
});

// Create Main Window
function createWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        return;
    }

    console.log('Creating main window...');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: screenWidth - 200,
        height: screenHeight,
        transparent: true,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window loaded successfully');
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    ipcMain.on('resize-window', (event, { width }) => {
        const currentSize = mainWindow.getSize();
        mainWindow.setSize(width, currentSize[1]);
    });
}

app.whenReady().then(() => {
    console.log('App is ready, creating window...');
    nativeTheme.themeSource = 'light';

    createWindow();

    // // Register global shortcut
    // globalShortcut.register('Shift+Space', () => {
    //     if (mainWindow && !mainWindow.isDestroyed()) {
    //         if (mainWindow.isVisible()) {
    //             mainWindow.hide();
    //         } else {
    //             mainWindow.show();
    //             mainWindow.focus();
    //         }
    //     } else {
    //         mainWindow = null;
    //         createWindow();
    //     }
    // });

    app.on('activate', () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            createWindow();
        } else {
            mainWindow.show();
        }
    });
});

// Clean up on exit
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});