const { app, BrowserWindow, WebContentsView, ipcMain, session, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const SIDEBAR_WIDTH = 220;
const CONFIG_FILE = path.join(app.getPath('userData'), 'accounts.json');

let win;
const viewMap = {};   // accountId -> WebContentsView
let currentId = null;

// ---------- 設定ファイル ----------
const readAccounts = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}
  return [];
};

const writeAccounts = list =>
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(list, null, 2), 'utf8');

// ---------- ビュー管理 ----------
const viewBounds = () => {
  const [w, h] = win.getContentSize();
  return { x: SIDEBAR_WIDTH, y: 0, width: Math.max(0, w - SIDEBAR_WIDTH), height: h };
};

const getOrCreateView = id => {
  if (!viewMap[id]) {
    const v = new WebContentsView({
      webPreferences: {
        partition: `persist:${id}`,
        nodeIntegration: false,
        contextIsolation: true,
        spellcheck: false,
      },
    });

    // 接続エラー時に自動リトライ（最大3回）
    let retries = 0;
    const load = (url = 'https://note.com') => v.webContents.loadURL(url);

    v.webContents.on('did-fail-load', (_, errorCode, __, url) => {
      if (errorCode === -3) return; // ユーザー操作による中断は無視
      if (retries < 3) {
        retries++;
        setTimeout(() => load(url || 'https://note.com'), 1500 * retries);
      }
    });

    v.webContents.on('did-navigate', (_, url, httpResponseCode) => {
      if (httpResponseCode >= 500 && retries < 3) {
        retries++;
        setTimeout(() => load('https://note.com'), 1500 * retries);
      } else {
        retries = 0; // 正常ロード後はリセット
      }
    });

    load();
    viewMap[id] = v;
  }
  return viewMap[id];
};

const showAccount = id => {
  if (currentId && viewMap[currentId]) {
    try { win.contentView.removeChildView(viewMap[currentId]); } catch {}
  }
  if (!id) { currentId = null; return; }

  const v = getOrCreateView(id);
  win.contentView.addChildView(v);
  v.setBounds(viewBounds());
  currentId = id;
};

// ---------- アプリ起動 ----------
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    title: 'note アカウント切替',
    backgroundColor: '#141414',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('resize', () => {
    if (currentId && viewMap[currentId]) {
      viewMap[currentId].setBounds(viewBounds());
    }
  });

  win.webContents.once('did-finish-load', () => {
    const accounts = readAccounts();
    const firstId = accounts[0]?.id ?? null;
    if (firstId) showAccount(firstId);
    win.webContents.send('init', { accounts, activeId: firstId });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC ----------
ipcMain.handle('accounts:add', (_, name) => {
  const id = `acct_${Date.now()}`;
  const accounts = [...readAccounts(), { id, name, createdAt: Date.now() }];
  writeAccounts(accounts);
  showAccount(id);
  return { accounts, activeId: id };
});

ipcMain.handle('accounts:switch', (_, id) => {
  showAccount(id);
  return id;
});

ipcMain.handle('accounts:delete', async (_, id) => {
  try { await session.fromPartition(`persist:${id}`).clearStorageData(); } catch {}

  if (viewMap[id]) {
    if (currentId === id) {
      try { win.contentView.removeChildView(viewMap[id]); } catch {}
      currentId = null;
    }
    try { viewMap[id].webContents.destroy(); } catch {}
    delete viewMap[id];
  }

  const accounts = readAccounts().filter(a => a.id !== id);
  writeAccounts(accounts);

  const nextId = accounts[0]?.id ?? null;
  if (nextId) showAccount(nextId);
  return { accounts, activeId: nextId };
});

ipcMain.handle('accounts:rename', (_, { id, name }) => {
  const accounts = readAccounts().map(a => a.id === id ? { ...a, name } : a);
  writeAccounts(accounts);
  return accounts;
});

ipcMain.handle('nav', (_, action) => {
  if (!currentId || !viewMap[currentId]) return;
  const wc = viewMap[currentId].webContents;
  if (action === 'back'    && wc.canGoBack())    wc.goBack();
  if (action === 'forward' && wc.canGoForward()) wc.goForward();
  if (action === 'reload')                       wc.reload();
});

ipcMain.handle('copy-url', () => {
  if (!currentId || !viewMap[currentId]) return null;
  const url = viewMap[currentId].webContents.getURL();
  clipboard.writeText(url);
  return url;
});

ipcMain.handle('navigate-to', (_, url) => {
  if (!currentId || !viewMap[currentId]) return;
  viewMap[currentId].webContents.loadURL(url);
});
