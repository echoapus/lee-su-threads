# MetaThreadsCountryInfo

在 Threads 動態旁顯示作者地點、加入時間與帳號標記。提供 Chrome／Firefox 擴充功能，以及暴力猴（Violentmonkey）userscript；三者共用解析、排程與標籤程式。

本專案為獨立維護的社群工具，與 Meta／Threads 無隸屬或背書關係。

## 功能

- 貼文進入可見範圍後，自動查詢作者資料並顯示地點標籤。
- 在粉絲與追蹤中清單點擊 📍，手動查詢地點。
- 將滑鼠移到標籤上，查看取得的加入時間。
- 標示本月及前兩個月加入的帳號；Meta 驗證帳號不顯示新帳號標記。
- 比對動物名稱、句點與 6–8 位數字的帳號格式，例如 `camel.253044`。格式相符不代表是假帳號，也無法證明使用者從未改名。
- 使用本機快取、循序請求及同帳號並行查詢合併，減少重複請求。
- 收到 HTTP 429 時，暫停該頁面的自動查詢 1 小時。
- 介面僅提供英文；地點與加入時間仍可解析 Threads 回傳的多語系資料。

查詢需要登入 `https://www.threads.com`。地點來自 Threads 回傳的個人資料，不是 GPS 定位；沒有地點資料時會顯示對應提示。

## 選擇使用方式

| 方式 | 安裝內容 | 本機資料位置 |
| --- | --- | --- |
| Chrome／Edge | 載入 `dist/chrome/` | 擴充功能儲存空間 |
| Firefox | 載入 `dist/firefox/manifest.json` | 擴充功能儲存空間 |
| Violentmonkey | 安裝 `MetaThreadsCountryInfo.user.js` | 暴力猴的腳本儲存空間 |

同一頁面只啟用其中一種，避免重複插入標籤和發送請求。userscript 與外掛的快取不會互相遷移。

## 從原始碼建置

需要 Node.js 與 npm；CI 使用 Node.js 24。下方環境變數範例適用於 Bash／zsh。

```bash
git clone https://github.com/echoapus/lee-su-threads.git
cd lee-su-threads
npm ci
```

### Chrome／Firefox

```bash
npm run build:watch
```

等待首次建置完成，再載入外掛：

- **Chrome／Edge**：開啟 `chrome://extensions/` 或 `edge://extensions/`，啟用開發人員模式，點「載入未封裝項目」，選擇 `dist/chrome/`。
- **Firefox**：開啟 `about:debugging#/runtime/this-firefox`，點「載入臨時附加元件」，選擇 `dist/firefox/manifest.json`。

登入 Threads 並重新整理頁面。watch 重建後，需先在瀏覽器重新載入外掛，再重新整理 Threads。Firefox 臨時附加元件在瀏覽器重新啟動後需再次載入。

一次性開發建置：

```bash
NODE_ENV=development npm run build
```

### 暴力猴（Violentmonkey）

```bash
NODE_ENV=development npm run build:userscript
```

產物為 `dist/userscript/MetaThreadsCountryInfo.user.js`，已內嵌樣式、國旗字型、英文介面字串與完整授權聲明，執行時不需從 CDN 下載依賴。

1. 安裝 Violentmonkey，開啟其管理面板。
2. 新增腳本，將產物的完整內容貼入編輯器，取代預設內容後儲存。
3. 停用獨立外掛版或其他同功能腳本。
4. 登入 Threads 並重新整理頁面。

持續開發可使用：

```bash
npm run build:userscript -- --watch
```

重建後，需把更新後的產物重新貼入暴力猴並儲存，再重新整理 Threads。此腳本沒有設定自動更新網址。

請保留腳本 metadata 中的 `@inject-into page` 與 `@run-at document-start`，以便存取網站的網路請求。網站安全政策或瀏覽器限制可能阻止注入；目前未宣稱支援其他 userscript 管理器。

## 測試

```bash
npm test
npm run test:watch
```

完整測試會實際建置與封裝，需要 Git、Bash、`zip` 與 `unzip`。測試包含資料解析、DOM、節流、快取、授權封裝、userscript 模擬執行及版本一致性。

手動測試時：

1. 緩慢捲動動態，確認地點標籤出現。
2. 開啟粉絲／追蹤中清單，點 📍 確認結果。
3. 重新整理，確認快取載入且標籤沒有重複。
4. 若沒有反應，查看外掛管理頁或暴力猴管理面板的狀態，以及 Threads 頁面的 Console。

自動化測試、建置與監看重建已驗證；真實 Threads 登入環境及 Violentmonkey 的瀏覽器整合仍需手動驗證。回報問題時，請移除 Console 中的帳號資訊與登入相關字串。

## 資料與隱私

| 快取資料 | 有效期限 |
| --- | --- |
| 有地點的個人資料 | 21 天 |
| 無地點的個人資料 | 1 天 |
| 使用者名稱與帳號 ID 對照 | 60 天 |

外掛版讀取時排除過期資料，瀏覽器啟動時清理；userscript 在讀取時排除並刪除過期資料。已開啟頁面的記憶體快取保留至重新載入。

資料請求發送至 Threads，快取不會上傳到開發者伺服器，也沒有分析追蹤服務。權限、登入參數與清除資料方式見 [隱私權政策](PRIVACY.md)。

## 版本與發布

正式建置使用可取得的 Git 版本標籤 `vX.Y.Z`。來源 manifest 中的 `0.0.0` 是佔位值；沒有有效版本時，正式建置會中止。開發建置使用下一個 patch 版本，無標籤時使用 `0.0.1`，不需要為了測試推送標籤。

在有效發行版本下執行 `bash scripts/package.sh`，會清理 `dist/`，建置並驗證：

- Chrome ZIP。
- Firefox AMO ZIP。
- `dist-zip/MetaThreadsCountryInfo.user.js`。

Firefox 自行發布與可選簽署流程見 [開發說明](CONTRIBUTING.md)。GitHub Release 流程會附上 userscript。`dist/`、`dist-zip/`、安裝包與簽署私鑰不隨 Git 提交；目前沒有 CRX 自動打包指令。

## 程式結構

| 路徑 | 用途 |
| --- | --- |
| `src/content.js` | 共用頁面初始化、事件與 DOM 監看 |
| `src/injected.js` | 頁面中的請求攔截、帳號 ID 擷取與個人資料查詢 |
| `src/background.js` | 外掛版的循序快取操作與過期清理 |
| `src/lib/` | 共用解析、通訊、排程、標籤及快取期限 |
| `src/userscript.js` | userscript 入口 |
| `src/userscript/` | GM 儲存、語系與內嵌資源介面 |
| `src/manifest*.json` | Chrome／Firefox 設定 |
| `_locales/en/` | 英文介面字串 |
| `data/` | 地點對照、資料來源及帳號格式字典 |
| `test/` | 測試與 API 回應樣本 |
| `scripts/` | 資料產生、版本檢查與封裝工具 |

## 限制與授權

功能依賴 Threads 的頁面結構與非公開 API。尚未取得帳號 ID 時，查詢可能失敗；可先捲動或開啟該帳號個人檔案，再重試。新帳號標記只有月份精度，格式標記不能判定帳號可信度。冷卻狀態以頁面為單位，不在分頁之間共用。

程式碼採 [MIT](LICENSE)，保留原始版權並另列 fork 修改版權。國旗字型圖像另採 CC BY 4.0；詳見 [NOTICE.md](NOTICE.md)。外掛安裝包包含授權文件，userscript 則內嵌聲明。
