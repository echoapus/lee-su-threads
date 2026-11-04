# Lee-Su-Threads

Chrome／Firefox 擴充功能，在 Threads 動態旁顯示作者地點、加入時間與帳號標記。資料直接取自 Threads，查詢結果保存在瀏覽器本機。

## 目前功能

- **動態自動查詢**：貼文進入可見範圍後，取得作者資料並在時間旁顯示標籤。
- **追蹤清單手動查詢**：在粉絲與追蹤中清單點擊 📍 查詢地點。
- **加入時間提示**：將滑鼠移到標籤上，可查看取得的加入時間。
- **新帳號標記**：以加入月份判斷，標示本月及前兩個月加入的帳號；Meta 驗證帳號不顯示此標記。
- **帳號格式標記**：比對動物名稱、句點與 6–8 位數字的組合，例如 `camel.253044`。這只是格式判斷，不能用來認定是假帳號或機器人。
- **請求管理**：依序查詢，同帳號且逾時設定相同的並行請求會共用結果；收到 HTTP 429 時，暫停該頁面的自動查詢 1 小時。
- **多語系介面**：繁體中文、簡體中文、英文、日文、韓文。

## 建置與安裝

需要 Node.js 與 npm。CI 使用 Node.js 24。

```bash
git clone https://github.com/echoapus/lee-su-threads.git
cd lee-su-threads
npm ci
npm run build:watch
```

等待首次建置完成，再載入瀏覽器。watch 模式不需要版本標籤。

### Chrome／Edge

1. 開啟 `chrome://extensions/` 或 `edge://extensions/`。
2. 啟用「開發人員模式」。
3. 點「載入未封裝項目」，選擇 `dist/chrome/`。
4. 若已安裝其他版本，先停用，避免重複執行。
5. 開啟並登入 `https://www.threads.com`，重新整理頁面。

### Firefox

1. 開啟 `about:debugging#/runtime/this-firefox`。
2. 點「載入臨時附加元件」。
3. 選擇 `dist/firefox/manifest.json`。
4. 登入 Threads 並重新整理頁面。

## 開發與測試

完整測試包含實際封裝驗證，需要 Git、Bash、`zip` 與 `unzip`。

```bash
npm test                           # 執行測試
npm run test:watch                 # 持續執行測試
npm run build:watch                # 監看 JavaScript 並同步瀏覽器輸出
NODE_ENV=development npm run build # 一次性開發建置，適用 Bash／zsh
npm run generate:mapper           # 重新產生地點與國旗對照資料
```

修改 JavaScript 後，watch 會重建檔案；仍需在擴充功能管理頁重新載入擴充功能，再重新整理 Threads。修改 manifest、樣式、語系或資料檔後，請重新啟動建置。

手動測試可依序確認：

1. 緩慢捲動動態，確認地點標籤或「無地點資料」出現。
2. 開啟粉絲／追蹤中清單，點 📍 確認查詢結果。
3. 重新整理頁面，確認快取能載入，標籤不會重複插入。
4. 若沒有反應，查看擴充功能管理頁的錯誤，以及 Threads 頁面開發者工具中的 Console。

### 版本與打包

`npm run build` 是正式建置，會從可取得的 Git 版本標籤解析版本。沒有有效標籤、且 manifest 仍為 `0.0.0` 佔位值時，建置會中止。

本機測試使用開發建置即可：有標籤時使用下一個 patch 版本，無標籤時使用 `0.0.1`。不需要為了測試建立或推送發行標籤。

`dist/` 和 `dist-zip/` 都是本機產物，不隨 Git 提交。測試時可直接載入 `dist/chrome/`，或將其內容壓成 ZIP，解壓後再載入。儲存庫目前沒有 CRX 自動打包指令。

## 資料儲存

擴充功能讀取 Threads 頁面的相關 API 回應，並向 Threads 發送個人資料查詢。地點不是 GPS 定位；未提供地點的帳號會顯示無地點資料。

| 本機快取 | 有效期限 |
| --- | --- |
| 有地點的個人資料 | 21 天 |
| 無地點的個人資料 | 1 天 |
| 使用者名稱與帳號 ID 對照 | 60 天 |

讀取本機儲存時會排除過期資料，瀏覽器啟動時清理過期項目。已開啟頁面的記憶體快取會保留至重新載入。

資料不會上傳到開發者伺服器，也沒有分析追蹤服務。使用權限為本機儲存與 `https://www.threads.com/*` 網站存取。

## 程式結構

| 路徑 | 用途 |
| --- | --- |
| `src/content.js` | 頁面初始化、事件與 DOM 監看 |
| `src/injected.js` | 頁面中的 API 攔截、帳號 ID 擷取與查詢 |
| `src/background.js` | 循序處理本機快取讀寫及過期清理 |
| `src/lib/` | 通訊、解析、排程與標籤顯示 |
| `src/manifest*.json` | 各瀏覽器設定 |
| `_locales/` | 介面翻譯 |
| `data/` | 地點對照與帳號格式字典 |
| `test/` | Vitest 測試與 API 回應樣本 |
| `scripts/` | 資料產生、版本檢查與建置輔助工具 |

## 使用限制

查詢需要登入 Threads，且依賴網站頁面結構與非公開 API。Threads 更新後，可能需要調整解析或標籤插入邏輯。

尚未取得帳號 ID 時，查詢可能失敗；可先捲動或開啟該帳號的個人檔案，再重試。加入時間只有月份精度，帳號格式標記也不代表帳號可信度。

限流冷卻以頁面為單位，各分頁不共用狀態。自動化測試與開發建置已通過，實際登入瀏覽器仍需手動驗證。

## 授權

[MIT](LICENSE)
