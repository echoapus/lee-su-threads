# Lee-Su-Threads 你是誰

在 Threads 貼文旁顯示作者所在地與帳號標記，減少逐一開啟個人檔案查詢的步驟。

[English](#english)

![Threads 動態中的地點標籤](screenshots/feed-badge.png)

## 功能

- **動態地點標籤**：貼文進入畫面後自動查詢作者資料；已有快取時直接顯示。
- **追蹤清單查詢**：在粉絲與追蹤中清單點擊 📍，手動取得地點。
- **新帳號標記**：依加入月份標示本月及前兩個月加入的帳號；Meta 驗證帳號不顯示此標記。
- **預設格式帳號標記**：辨識字典中的英文動物名稱、半形句點與 6–8 位數字組合，例如 `camel.253044`。符合格式不代表是假帳號或機器人，也無法證明使用者從未改名。
- **本機快取**：重複瀏覽時減少請求，同一帳號、相同逾時設定的同時查詢共用一次請求。
- **限流保護**：查詢依序送出；收到 HTTP 429 時，暫停該頁面的自動查詢 1 小時並顯示提醒。
- **多語系**：繁體中文、簡體中文、英文、日文與韓文。

地點與加入時間來自 Threads 回傳的個人資料，不是 GPS 定位。查詢需要登入 Threads；沒有提供地點的帳號會顯示無地點資料。

## 安裝與使用

| 瀏覽器 | 安裝方式 |
| --- | --- |
| Chrome／Edge | [Chrome Web Store](https://chromewebstore.google.com/detail/lee-su-threads/cciaoflecmmomchcjndagcnfpdaanhol) |
| Firefox／Firefox for Android | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/lee-su-threads-%E4%BD%A0%E6%98%AF%E8%AA%B0/) |
| Safari（macOS／iOS） | 從原始碼建置並透過 Xcode 執行，見下方開發說明 |

安裝後，開啟並登入 [www.threads.com](https://www.threads.com)，重新整理頁面即可使用。動態會自動顯示標籤；粉絲與追蹤中清單採手動查詢。

商店版本的功能可能與此儲存庫中的原始碼不同。

## 資料與隱私

擴充功能在 Threads 頁面讀取相關 API 回應，並向 Threads 查詢個人資料。快取儲存在瀏覽器本機，沒有分析追蹤服務，也不會將快取上傳至開發者伺服器。

| 快取資料 | 有效期限 |
| --- | --- |
| 有地點的個人資料 | 21 天 |
| 無地點的個人資料 | 1 天 |
| 使用者名稱與帳號 ID 對照 | 60 天 |

重新讀取本機快取時會排除過期資料；瀏覽器啟動時會清理過期項目。已開啟頁面中的記憶體快取會保留到頁面重新載入。移除擴充功能會刪除其本機儲存資料。

權限僅包含本機儲存與 `https://www.threads.com/*` 網站存取。完整說明見 [隱私權政策](PRIVACY.md)。

## 從原始碼開發

使用 Node.js 24 與 npm，與 CI 環境一致。

```bash
npm ci
npm run build:watch
```

watch 模式不需要 Git 版本標籤，會在 JavaScript 變更後重建並同步瀏覽器輸出。首次建置完成後，依下表載入擴充功能；每次重建後仍需在瀏覽器重新載入擴充功能及 Threads 頁面。修改 manifest、樣式、語系或資料檔後，請重新啟動建置。

| 瀏覽器 | 載入位置 |
| --- | --- |
| Chrome／Edge | 開啟 `chrome://extensions/` 或 `edge://extensions/`，啟用開發人員模式，載入未封裝項目 `dist/chrome/` |
| Firefox | 開啟 `about:debugging#/runtime/this-firefox`，載入臨時附加元件 `dist/firefox/manifest.json` |
| Safari | 使用 `dist/safari/` 與 Xcode 專案；參閱 [Safari 開發流程](docs/SAFARI_WORKFLOW.md) |

不持續監看的一次性開發建置：

```bash
NODE_ENV=development npm run build
```

以上環境變數語法適用於 Bash／zsh。Safari 專案首次建立時可使用 `NODE_ENV=development npm run setup:safari`，避免沒有版本標籤時觸發正式建置保護。

### 測試與建置

```bash
npm test                              # 執行全部測試
npm run test:watch                    # 持續執行測試
npm run generate:mapper               # 重新產生地點與國旗對照資料
npm run build                        # 正式建置：Chrome、Firefox、Safari
npm run build:firefox-amo             # Firefox 商店變體：dist/firefox-amo/
npm run build:firefox-self-hosted     # Firefox 自行發佈變體：dist/firefox-direct/
node scripts/check-versions.js --web  # 檢查網頁擴充功能產物版本
```

正式版本以 Git 標籤 `vX.Y.Z` 為準；開發版本使用該版本加一個 patch，沒有標籤時使用 `0.0.1`。原始 manifest 的 `0.0.0` 是佔位值，不能用來發布。若 checkout 缺少標籤，請先取得發行標籤；不要為了本機開發建立或推送發行標籤。

Firefox 自行發佈變體使用獨立的附加元件 ID 與更新網址；本機建置不包含簽署。Safari 建置產生網頁擴充功能檔案，原生 App 的執行、簽署與封存仍需要 macOS 和 Xcode。

### 程式結構

```text
src/content.js             頁面初始化、事件與動態監看
src/injected.js            Threads 頁面中的網路攔截與資料查詢
src/background.js          本機快取讀寫與過期清理
src/lib/                   解析、通訊、排程、標籤與 DOM 工具
src/manifest*.json         各瀏覽器的擴充功能設定
_locales/                  介面翻譯
data/                     地點與帳號格式字典
test/                     Vitest 測試
scripts/                  資料產生、版本檢查與封裝工具
```

貢獻與發布流程見 [CONTRIBUTING.md](CONTRIBUTING.md)，地點資料維護見 [data/README.md](data/README.md)。

## 限制

- 依賴 Threads 的頁面結構與非公開 API，網站更新可能造成查詢或標籤失效。
- 尚未從頁面回應取得帳號 ID 時，查詢可能失敗；可先捲動、開啟該帳號個人檔案，再重試。
- 新帳號標記只有月份精度；預設格式標記只比對名稱格式。這些資訊不應用來判定帳號是否可信。
- 自動查詢的冷卻狀態以頁面為單位，不會在分頁之間共用。

## English

Lee-Su-Threads adds author location badges to Threads posts. It fetches profiles for visible posts and offers manual location lookup in follower and following lists.

### Features

- Location badges with country flags where a matching location is available.
- New-account labels for the current month and the two preceding months, excluding Meta-verified accounts.
- A label for handles matching a known animal word followed by a dot and 6–8 digits. This is a format match, not evidence of a fake account or an unchanged username.
- Local caching, shared concurrent profile requests with matching timeouts, and serialized requests.
- A one-hour pause in the current page's automatic lookups after an HTTP 429 response.
- Traditional Chinese, Simplified Chinese, English, Japanese, and Korean interfaces.

Location and join dates come from Threads profile responses, not GPS. Profile lookup requires signing in to Threads.

### Install

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/lee-su-threads/cciaoflecmmomchcjndagcnfpdaanhol) or [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/lee-su-threads-%E4%BD%A0%E6%98%AF%E8%AA%B0/), then reload [www.threads.com](https://www.threads.com). The Firefox listing also supports Firefox for Android. Store releases may differ from this source tree.

Safari development requires macOS and Xcode. See the [Safari workflow](docs/SAFARI_WORKFLOW.md).

### Develop

Use Node.js 24 and npm:

```bash
npm ci
npm run build:watch
```

Load `dist/chrome/` as an unpacked Chrome extension or `dist/firefox/manifest.json` as a temporary Firefox add-on. Watch mode copies JavaScript rebuilds into the browser directories; reload the extension and Threads page to use changes. Restart the build after changing static assets, manifests, locales, or data files.

For a one-off development build, run `NODE_ENV=development npm run build` in Bash or zsh. Run `npm test` for the test suite.

Production builds use a reachable Git version tag. A tagless checkout with placeholder manifests will fail production builds; use development mode for local work. Firefox signing and Safari native app builds are separate steps. See [CONTRIBUTING.md](CONTRIBUTING.md) for release tooling.

### Privacy and limits

Profile requests go to Threads. Cached profiles and username-to-ID mappings stay in local browser storage; there is no analytics service or upload to a developer server.

Profiles with a location are valid for 21 days, profiles without one for 1 day, and ID mappings for 60 days. Expired entries are excluded when reading persistent caches and cleaned on browser startup. An open page retains its in-memory cache until reload. See the [privacy policy](PRIVACY.md).

Threads can change its page structure or private APIs. Month-based account labels and handle-format matches do not establish whether an account is trustworthy. Automatic lookup cooldowns apply per page, not across tabs.

## License

[MIT](LICENSE)
