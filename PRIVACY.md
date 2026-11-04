# Privacy Policy / 隱私權政策

Last updated / 最後更新：2026-11-04

## 繁體中文

本政策適用於 MetaThreadsCountryInfo 的 Chrome／Firefox 擴充功能與 Violentmonkey userscript。

### 處理哪些資料

程式在 `https://www.threads.com` 頁面讀取相關 API 回應，擷取帳號名稱與 ID、顯示名稱、個人圖片網址、地點、加入時間及驗證資訊，用來顯示標籤和減少重複查詢。實際欄位取決於 Threads 的回應。

查詢沿用使用者在 Threads 的登入狀態，向 Threads 發送請求。必要的 session／請求參數會暫存在頁面記憶體中，不寫入外掛或 userscript 的持久快取。

MetaThreadsCountryInfo 不會將這些資料上傳至開發者伺服器，不使用分析追蹤、廣告或第三方資料收集服務。Threads 自身對請求與帳號資料的處理依其政策運作。

### 本機儲存與期限

| 資料 | 快取有效期限 |
| --- | --- |
| 有地點的個人資料 | 21 天 |
| 無地點的個人資料 | 1 天 |
| 帳號名稱與 ID 對照 | 60 天 |

外掛版使用瀏覽器的擴充功能儲存空間，讀取時排除過期項目，瀏覽器啟動時清理。userscript 使用 Violentmonkey 的腳本儲存空間，讀取時排除並刪除過期項目。兩者不共用快取，也不會自動互相遷移。

已開啟頁面的記憶體快取保留至頁面重新載入。停用外掛或腳本會停止後續執行，但不等於清除已儲存的快取。

### 清除資料

- **外掛版**：移除擴充功能會刪除其瀏覽器本機儲存；若只是停用，資料仍保留。
- **userscript**：透過 Violentmonkey 的腳本資料／儲存管理功能清除；管理器提供的刪除選項依版本而異。外掛版移除不會清除此處資料。
- 清除持久快取後，重新整理已開啟的 Threads 頁面，才能重置該頁面的記憶體狀態。

### 權限與資源

外掛請求 `storage` 與 `https://www.threads.com/*` 網站存取權限，用來儲存快取及在 Threads 顯示標籤。

userscript 僅匹配 `https://www.threads.com/*`，使用 `unsafeWindow` 存取頁面請求，使用 `GM_getValue`、`GM_setValue`、`GM_listValues`、`GM_deleteValue` 管理快取，並以 `GM_addStyle` 加入樣式。

腳本的程式、樣式、英文介面字串與國旗字型已內嵌，執行時不需從 CDN 載入依賴。Violentmonkey 本身的資料處理不屬於本政策範圍。

### 除錯與聯絡

目前程式會在瀏覽器 Console 輸出除錯資訊，可能包含個人檔案資料、帳號 ID 或部分 session 參數。這些紀錄不會自動傳回開發者；回報問題前，請先移除其中的帳號與登入資訊。

問題請透過 [GitHub Issues](https://github.com/echoapus/lee-su-threads/issues) 回報，請勿提交私鑰、cookie 或 session 參數。

## English

This policy covers the MetaThreadsCountryInfo Chrome/Firefox extension and Violentmonkey userscript.

### Data processing

The software reads relevant API responses on `https://www.threads.com`. Depending on the response, it processes usernames, account IDs, display names, profile image URLs, locations, join dates, and verification details to display badges and avoid repeated requests.

Profile requests are sent to Threads using the user's existing Threads login session. Required session/request parameters are held in page memory and are not written to the extension's or userscript's persistent caches.

The software does not upload these data to a developer server and has no analytics, advertising, or third-party data collection service. Threads handles requests and account data under its own policies.

### Storage and retention

Profiles with locations are valid for 21 days, profiles without locations for 1 day, and username-to-ID mappings for 60 days.

The extension uses browser extension storage. Expired entries are excluded when reading and cleaned on browser startup. The userscript uses Violentmonkey script storage and removes expired entries when reading. The two caches are separate and do not automatically migrate between versions.

Open pages retain their in-memory caches until reload. Disabling the extension or script stops subsequent execution but does not erase stored caches.

### Deletion

Removing the extension deletes its browser-local storage. To clear userscript data, use Violentmonkey's script data/storage controls; available deletion options depend on the manager version. Removing the standalone extension does not clear userscript data. Reload open Threads pages after clearing persistent storage to reset page memory.

### Permissions and resources

The extension requests `storage` and access to `https://www.threads.com/*` for caching and displaying badges.

The userscript matches only that site. It uses `unsafeWindow` for page request access, `GM_getValue`, `GM_setValue`, `GM_listValues`, and `GM_deleteValue` for caching, and `GM_addStyle` for styles. Code, styles, English interface messages, and the flag font are bundled; no CDN dependency is loaded at runtime. Violentmonkey's own data handling is outside this policy.

### Diagnostics and contact

Browser Console diagnostics may contain profile data, account IDs, or partial session parameters. Logs are not automatically sent to the developer. Remove account and authentication information before sharing diagnostics.

Contact the maintainer through [GitHub Issues](https://github.com/echoapus/lee-su-threads/issues). Do not submit private keys, cookies, or session parameters.
