# 開發說明

MetaThreadsCountryInfo 維護 Chrome／Firefox 擴充功能與 Violentmonkey userscript。三者共用功能程式，分別處理執行環境與持久儲存。

## 環境與指令

CI 使用 Node.js 24。完整測試需要 npm、Git、Bash、`zip` 和 `unzip`；環境變數範例適用於 Bash／zsh。

```bash
npm ci
npm test
```

| 工作 | 指令 | 輸出 |
| --- | --- | --- |
| 外掛開發監看 | `npm run build:watch` | `dist/chrome/`、`dist/firefox/` |
| 外掛一次性開發建置 | `NODE_ENV=development npm run build` | 同上 |
| userscript 開發建置 | `NODE_ENV=development npm run build:userscript` | `dist/userscript/MetaThreadsCountryInfo.user.js` |
| userscript 開發監看 | `npm run build:userscript -- --watch` | 同上 |
| 測試監看 | `npm run test:watch` | 終端測試結果 |

開發建置不需要 Git 版本標籤。外掛重建後，重新載入外掛與 Threads；腳本重建後，重新貼入暴力猴、儲存並重新整理 Threads。watch 不會自動更新瀏覽器中已安裝的程式。

外掛靜態檔案修改後需重新啟動建置。userscript 的 CSS、字型、JSON 字典是打包依賴，可觸發監看重建；改動 LICENSE、NOTICE、metadata 或建置設定後，請重新啟動。

## 共用程式與執行環境

- `src/lib/browserAPI.js` 提供原生擴充功能介面，並載入頁面攔截程式。
- userscript 建置將此模組替換為 `src/userscript/browserAPI.js`，使用 GM 儲存、內嵌字型與語系字典。
- `src/userscript.js` 先安裝攔截程式，再載入共用頁面程式與樣式。腳本以 `page` 模式、`document-start` 執行。
- `src/lib/cachePolicy.js` 是兩種儲存實作共用的期限設定。
- 外掛在背景程式依序處理整份快取；userscript 以 `profile:<username>`、`userId:<username>` 分開儲存。

新增瀏覽器專用功能時，同步處理 userscript 介面。GM 特權 API 不得掛到頁面全域。保留登入檢查、節流、錯誤處理與限流冷卻；動態文字使用 `textContent` 與 DOM 建立方法。

## 驗證範圍

`npm test` 會驗證共用邏輯、兩種快取實作、Chrome／Firefox ZIP、獨立 userscript、授權聲明與版本檢查。封裝測試在暫存 Git 儲存庫建立本機標籤，不修改工作區的版本標籤。

userscript 測試會在沒有擴充功能 API 的模擬頁面中執行產物，驗證請求攔截、快取與標籤。這不能取代真實 Violentmonkey、網站安全政策及 Threads 登入環境的手動測試。

## 資料、語系與圖示

- 地點資料流程見 [data/README.md](data/README.md)。不要手動編輯產生的 `data/location-flags.json`。
- 修改 `data/world-custom.json` 後執行 `npm run generate:mapper`。`npm run build`、`npm run build:userscript` 會先執行此步驟；其他建置入口需視需要手動執行。
- 介面只保留英文，字串放在 `_locales/en/messages.json`。外掛的 `default_locale` 為 `en`，userscript 直接使用同一份字典；地點名稱與日期的多語系解析不受影響。
- `icons/icon.svg` 是工具列圖示來源。安裝 Python 套件 `cairosvg` 後，執行 `npm run icons` 產生透明背景的 16、48、128 像素圖示。

## 正式封裝與發布

正式版本使用 `vX.Y.Z` Git 標籤，來源 manifest 的 `0.0.0` 是佔位值。先在本機準備有效版本，再執行：

```bash
npm test
bash scripts/package.sh
npm run check:versions
```

封裝腳本會清理 `dist/`，建置 Chrome、Firefox 一般／AMO 版本和 userscript。版本檢查同時比對瀏覽器 manifest、腳本 metadata 與 Git 標籤，產生：

- `dist-zip/MetaThreadsCountryInfo-chrome-vX.Y.Z.zip`
- `dist-zip/MetaThreadsCountryInfo-firefox-vX.Y.Z-amo.zip`
- `dist-zip/MetaThreadsCountryInfo.user.js`

推送 `vX.Y.Z` 標籤會觸發 `.github/workflows/release.yml` 並建立 GitHub Release，請完成本機驗證後再推送。

外掛產物包含 `LICENSE` 與 `NOTICE.md`；userscript 以註解內嵌相同聲明。改名或重構時仍需保留原版與第三方版權。打包產物與私鑰留在已忽略的目錄，不加入 Git。

### Firefox 發布變體

| 指令 | Manifest | 輸出 |
| --- | --- | --- |
| `npm run build:firefox-amo` | `src/manifest.firefox.json` | `dist/firefox-amo/` |
| `npm run build:firefox-self-hosted` | `src/manifest.firefox-direct.json` | `dist/firefox-direct/` |

自行發布變體具有獨立 ID 與更新網址。改名不會改動既有 ID；發布前確認 manifest 與 `updates.json.template` 的 ID、網址及檔名相互一致。

本機建置不包含簽署。CI 自動簽署需要 `ENABLE_FIREFOX_SIGNING=true`，以及 `FIREFOX_API_KEY`、`FIREFOX_API_SECRET` secrets。啟用後會額外產生已簽署 XPI 與 `updates.json`。
