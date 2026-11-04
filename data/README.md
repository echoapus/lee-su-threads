# 資料字典

這個目錄供 Chrome／Firefox 外掛與 Violentmonkey userscript 共用。資料在建置時內嵌，瀏覽頁面時不會另外下載字典。

## 檔案

| 路徑 | 用途 | 維護方式 |
| --- | --- | --- |
| `world-raw/world-*.json` | 五種語系的國家／地區名稱來源 | 下載腳本更新 |
| `world-raw/download-info.json` | 下載時間與 SHA-256 紀錄 | 下載腳本產生 |
| `world-custom.json` | 名稱覆寫、額外地區與別名 | 手動編輯 |
| `location-flags.json` | 國旗與多語系名稱對照，目前 249 個地區 | 產生器輸出，不手動編輯 |
| `handle-words.json` | 帳號格式比對用的動物名稱 | 手動編輯並執行測試 |

原始地點資料來源為 [stefangabos/world_countries](https://github.com/stefangabos/world_countries)。下載工具使用 SHA-256 比較資料內容。

## 更新地點資料

以下指令都從專案根目錄執行：

```bash
npm run download:world
```

只有需要更新來源資料時才執行下載。調整 `world-custom.json` 中的 `overrides`、`additions` 或 `aliases` 後，重新產生對照表：

```bash
npm run generate:mapper
```

`npm run build` 與 `npm run build:userscript` 會透過 prebuild 自動執行產生器；`build:watch` 與 Firefox 專用建置入口沒有這個前置步驟，修改字典後需先手動產生。

開發驗證可選擇：

```bash
NODE_ENV=development npm run build
NODE_ENV=development npm run build:userscript
```

以上環境變數語法適用於 Bash／zsh。不需要為了資料維護建立發行標籤。

來源資料、自訂設定與產生結果都納入 Git。提交時包含有變更的來源檔與 `location-flags.json`，不要只修改產物。

## 地點比對

[locationMapper.js](../src/lib/locationMapper.js) 依瀏覽器語言偏好建立對照，先比對完整名稱，再嘗試部分名稱。國旗是對 API 地點字串的呈現，不是 GPS 定位或身分驗證。

## 帳號格式字典

[disposableHandle.js](../src/lib/disposableHandle.js) 比對以下格式：

```text
<字典中的英文動物名稱>.<6–8 位半形數字>
```

例如 `camel.253044`。動物詞需完整符合字典，其他分隔符號或數字長度不會命中。

`handle-words.json` 的 `animals` 陣列使用小寫英文字母、依字母排序且不重複；[測試](../test/disposableHandle.test.js) 會驗證這些條件。

這是維護中的格式字典，並非 Meta 官方名單。名稱符合格式，不能證明帳號從未改名，也不能判定是否為真人、機器人或假帳號。新增詞條時應附上可核對的格式範例，避免只憑名稱猜測。
