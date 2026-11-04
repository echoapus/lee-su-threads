# 開發說明

本專案只維護 Chrome 與 Firefox 擴充功能。使用 Node.js 24 與 npm。

## 本機開發

```bash
npm ci
npm run build:watch
```

- Chrome：在 `chrome://extensions/` 載入未封裝項目 `dist/chrome/`。
- Firefox：在 `about:debugging#/runtime/this-firefox` 載入 `dist/firefox/manifest.json`。
- `npm run start:firefox` 可使用 web-ext 啟動 Firefox 測試。

JavaScript 更新後，重新載入擴充功能及 Threads 頁面。靜態檔案修改後重新啟動建置。

```bash
npm test
npm run test:watch
NODE_ENV=development npm run build
```

環境變數語法適用於 Bash／zsh。開發建置不需要版本標籤。完整測試包含封裝驗證，需要 Git、Bash、`zip` 與 `unzip`。

## 資料與圖示

- 地點資料流程見 [data/README.md](data/README.md)。修改 `data/world-custom.json` 後執行 `npm run generate:mapper`，不要手動編輯產生的 `data/location-flags.json`。
- `icons/icon.svg` 是工具列圖示來源。安裝 Python 套件 `cairosvg` 後，執行 `npm run icons` 產生透明背景的 16、48、128 像素圖示。
- 介面字串放在 `_locales/`，程式透過 `browserAPI.i18n.getMessage()` 讀取。

## 發布

正式版本以 `vX.Y.Z` Git 標籤為準，manifest 中的 `0.0.0` 是佔位值，不要手動調整。

在本機準備好有效標籤後執行：

```bash
bash scripts/package.sh
npm run check:versions
```

封裝腳本會清理 `dist/`，建置 Chrome 與 Firefox，驗證版本並產生：

- `dist-zip/lee-su-threads-chrome-vX.Y.Z.zip`
- `dist-zip/lee-su-threads-firefox-vX.Y.Z-amo.zip`

推送 `vX.Y.Z` 標籤會觸發 `.github/workflows/release.yml`，建立 GitHub Release。

### Firefox 發布變體

`npm run build:firefox-amo` 使用 `src/manifest.firefox.json`，輸出至 `dist/firefox-amo/`。

`npm run build:firefox-self-hosted` 使用 `src/manifest.firefox-direct.json`，輸出至 `dist/firefox-direct/`。此變體有獨立的附加元件 ID 與更新網址。自行發布前，確認 manifest 與 `updates.json.template` 中的 ID、更新位置符合實際發布設定。

本機建置不包含簽署。CI 的自動簽署需要設定 `ENABLE_FIREFOX_SIGNING=true`，以及 `FIREFOX_API_KEY`、`FIREFOX_API_SECRET` secrets。啟用後會額外產生已簽署的 XPI 與 `updates.json`。
