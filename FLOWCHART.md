# Clinic Flow - システム全体フローチャート＆設計仕様書

本ドキュメントは、クリニック向け出勤・360度評価ポイント管理システム **「Clinic Flow」** の全体構造、業務フロー、データ連携、内部ロジックを網羅した包括的なフローチャート集です。

---

## 1. システム全体アーキテクチャ（全体構成図）

Clinic Flow は、月額サーバー費用ゼロ（完全サーバーレス）でありながら、院内複数端末（PC・タブレット）でのリアルタイム同期、Googleカレンダー連携、および給与計算用Excel自動生成を実現しています。

```mermaid
flowchart TB
    subgraph Client["院内端末（PC / iPad / タブレット）"]
        UI["Clinic Flow Web UI (GitHub Pages)"]
        LocalStorage[("ブラウザ LocalStorage\n(高速オフラインキャッシュ)")]
        ExcelEngine["ExcelJS エンジン\n(ブラウザ内エクセル生成)"]
    end

    subgraph GoogleCloud["Google Cloud / Workspace (サーバーレス基盤)"]
        GAS["Google Apps Script (Web App)\ndoGet (JSONP) / doPost"]
        Spreadsheet[("Google スプレッドシート\n・打刻履歴\n・ポイント残高\n・ポイント履歴\n・打刻修正申請")]
        GoogleCalendar["Google カレンダー\n(honmachifc@gmail.com)\n本日の予定スケジュール"]
    end

    subgraph Office["給与計算・労務管理"]
        ExcelFile["時間集計表.xlsx\n(午前/午後振分・4桁打刻・ポイント集計)"]
    end

    UI <-->|"高速ローカル読込/保存"| LocalStorage
    UI <-->|"双方向リアルタイム同期 (15秒毎 / 打刻時)"| GAS
    GAS <-->|"シートデータ読み書き"| Spreadsheet
    GAS <-->|"本日の予定を自動取得"| GoogleCalendar
    UI -->|"テンプレートへ自動転記"| ExcelEngine
    ExcelEngine -->|"ワンクリック自動出力"| ExcelFile
```

---

## 2. スタッフの日次業務フロー（出勤・休憩・退勤・ピアボーナス）

スタッフが1日の中で行う打刻・操作のメインフローです。

```mermaid
flowchart TD
    Start(["スタッフがアプリ画面を開く"]) --> SelectStaff["スタッフカードを選択\n(S. KAWAI, S. OSAKI, S. KIMURA など)"]
    SelectStaff --> CheckStatus{"現在のステータス"}

    %% 出勤フロー
    CheckStatus -->|"未出勤 (offline)"| DoCheckin["「出勤」ボタンをタップ"]
    DoCheckin --> RecCheckin["出勤時刻を記録 & クラウド同期"]
    RecCheckin --> CalendarAlert{"本日のカレンダー予定あり？"}
    CalendarAlert -->|"あり"| MascotEvent["右下からレッサーパンダ院長が登場🐾\n・20秒間、本日の予定を箇条書き一覧で案内\n・タップで詳細モーダル表示"]
    CalendarAlert -->|"なし"| MascotNormal["右下からレッサーパンダ院長が登場🐾\n・20秒間、応援メッセージを案内"]
    MascotEvent --> EndCheckin(["診察・業務開始 (online)"])
    MascotNormal --> EndCheckin

    %% 休憩フロー
    CheckStatus -->|"出勤中 (online)"| BreakChoice{"打刻の選択"}
    BreakChoice -->|"休憩に入る"| DoBreakStart["「休憩」ボタンタップ (休憩開始)"]
    DoBreakStart --> RecBreakStart["休憩開始時刻を記録\n画面上部に「〇〇さんが休憩中」バー点滅"]
    RecBreakStart --> InBreak(["休憩中 (break)"])

    CheckStatus -->|"休憩中 (break)"| DoBreakEnd["「休憩終了」ボタンタップ"]
    DoBreakEnd --> RecBreakEnd["休憩終了時刻を記録\n休憩バー非表示"]
    RecBreakEnd --> EndCheckin

    %% 退勤フロー
    BreakChoice -->|"業務終了 (退勤)"| DoCheckout["「退勤」ボタンタップ"]
    DoCheckout --> OvertimeCheck{"残業基準判定\n(実働8h超 または 18:30以降)?"}
    OvertimeCheck -->|"該当"| InputOvertime["残業理由モーダル表示\n(理由を選択 / 詳細入力)"]
    OvertimeCheck -->|"通常退勤"| CalcWork["実働時間・獲得ポイント自動計算\n・3h以上: 2pt獲得\n・6h以上: 3pt獲得"]
    InputOvertime --> CalcWork

    CalcWork --> PeerModal["🎁 360度感謝ポイント（ピアボーナス）贈呈モーダル"]
    PeerModal --> SplitChoice{"ポイントの分配方法"}
    SplitChoice -->|"手動分配"| AllocCustom["各スタッフの ＋/ー ボタンで配分調整\n(1人1ptずつ等、自由分配)"]
    SplitChoice -->|"一括分配"| AllocQuick["「全員に均等割り」または「特定の人に全額」"]
    SplitChoice -->|"贈らない"| SkipPeer["スキップ (贈らずに退勤)"]
    
    AllocCustom --> AddMessage["感謝のメッセージを入力 (任意)"]
    AllocQuick --> AddMessage
    AddMessage --> SubmitPeer["「ポイントを贈って退勤」タップ"]
    SkipPeer --> FinishCheckout["退勤時刻・ポイント台帳を記録 & クラウド送信"]
    SubmitPeer --> FinishCheckout
    FinishCheckout --> MascotCheckout["レッサーパンダ院長が右下に登場🐾\n「今日もお疲れ様でした！」と12秒間労い"]
    MascotCheckout --> EndDay(["本日の業務終了 (offline)"])
```

---

## 3. Googleカレンダー連携＆予定アナウンスフロー

クリニックのGoogleカレンダー（`honmachifc@gmail.com`）から本日の予定を読み取り、画面上部および出勤時のマスコットに反映する仕組みです。

```mermaid
flowchart LR
    subgraph CalendarSource["Google Workspace"]
        GCal["クリニック Googleカレンダー\n(honmachifc@gmail.com)"]
    end

    subgraph GASLayer["GAS (Google Apps Script)"]
        GetCal["getTodayCalendarEvents()\n・当日 00:00〜23:59 の予定を抽出\n・終日予定 / 時間指定予定の整形"]
    end

    subgraph FrontEnd["フロントエンド (Clinic Flow)"]
        SyncTrigger["15秒毎の自動同期\nまたは 画面読み込み時"]
        Banner["画面上部：本日の予定バナー\n【終日】休診日 / 【09:00】院長：多根..."]
        DetailModal["予定一覧モーダル\n(時間・場所・メモ詳細表示)"]
        LesserPanda["レッサーパンダ院長 吹き出し\n出勤時に最大4件を箇条書き一覧で案内"]
    end

    GCal -->|"OAuth 認証 (共有カレンダー読取)"| GetCal
    GetCal -->|"JSON / JSONP 返却"| SyncTrigger
    SyncTrigger --> Banner
    Banner -->|"「一覧を表示」タップ"| DetailModal
    SyncTrigger --> LesserPanda
    LesserPanda -->|"吹き出しタップ"| DetailModal
```

---

## 4. 複数端末（マルチPC・iPad）リアルタイム同期フロー

院内の受付PC、診察室PC、スタッフルームのiPadなどで同時に打刻が行われても、データの衝突や不整合を起こさずに瞬時に状態を同期するアーキテクチャです。

```mermaid
sequenceDiagram
    autonumber
    actor StaffA as スタッフ (受付PC)
    participant FrontA as 受付PC ブラウザ
    participant Cloud as Google Apps Script + シート
    participant FrontB as 診察室PC ブラウザ
    actor StaffB as スタッフ (診察室PC)

    Note over StaffA,FrontA: 出勤打刻を実行
    FrontA->>FrontA: LocalStorageに即時保存 (表示即時更新)
    FrontA->>Cloud: POST (打刻データ送信)
    Cloud->>Cloud: スプレッドシートに追記・更新

    Note over FrontB: 15秒ごとの自動ポーリング (または画面フォーカス時)
    FrontB->>Cloud: GET (JSONPリクエスト)
    Cloud-->>FrontB: 最新の全データ (Records, Points, Calendar) を返却
    FrontB->>FrontB: mergeCloudData() で差分マージ
    FrontB->>FrontB: normalizeDateStr() で日付・時刻の形式ゆらぎを吸収
    FrontB->>FrontB: reconcileStaffStatusFromRecords() で全員の出勤状態を再計算
    FrontB->>FrontB: 画面カード更新 (出勤中グリーン点灯・パルス波表示)
    Note over StaffB,FrontB: 診察室PCでも受付PCの打刻が即時反映！
```

---

## 5. 打刻ミス・漏れの修正申請＆承認ワークフロー

打刻忘れや急患対応による打刻遅れを、紙メモを使わずにアプリ上で完結させるワークフローです。

```mermaid
flowchart TD
    subgraph StaffSide["スタッフ操作 (メイン画面)"]
        StaffMiss["打刻忘れ・修正の発生"] --> OpenCorrection["「打刻修正・ミスの申請」ボタンをタップ"]
        OpenCorrection --> FillCorrection["申請フォーム入力\n・対象日付\n・正しい出勤/退勤時刻\n・申請理由 (急患対応、押し忘れ、その他)"]
        FillCorrection --> SendCorrection["「申請を送信する」タップ"]
    end

    subgraph CloudQueue["クラウド共有"]
        SendCorrection --> SaveRequest["GAS経由で「打刻修正申請」シートへ保存\nステータス: pending (未承認)"]
    end

    subgraph AdminSide["管理者操作 (管理画面 ⚙️)"]
        SaveRequest --> AdminBadge["管理画面の「申請管理」タブに\n赤丸バッジ (未処理件数) が自動表示"]
        AdminBadge --> ReviewReq["管理者が申請内容を確認"]
        ReviewReq --> Decision{"承認するか？"}
        
        Decision -->|"承認する"| ApproveAction["「承認」ボタンをクリック"]
        ApproveAction --> UpdateRecord["打刻履歴の該当日データを自動修正\n(isCorrected = true, 修正理由を付与)"]
        UpdateRecord --> SyncApprove["クラウドへ送信 & 全端末へ即時同期"]
        
        Decision -->|"却下する"| RejectAction["「却下」ボタンをクリック"]
        RejectAction --> SetRejected["ステータスを rejected に変更"]
    end

    SyncApprove --> Finish["打刻履歴・Excel出力に正しい時刻が反映される"]
```

---

## 6. 給与計算用エクセル（時間集計表）ワンクリック自動出力フロー

月末の給与計算業務をゼロにするため、原本エクセルファイル（`R8.10法人後　時間集計表.xlsx`）の構造をブラウザ内で完全に再現し、打刻データを自動転記して出力するフローです。

```mermaid
flowchart TD
    AdminClick["管理画面で「Excelを出力」をクリック"] --> SelectPeriod["集計対象月度を選択\n(例: 2026年10月度)"]
    SelectPeriod --> AutoDateCalc["締め日期間を自動算出\n(前月16日 〜 当月15日: 9/16〜10/15)"]
    
    AutoDateCalc --> LoadTemplate["原本テンプレートの全数式・書式・行高・列幅をメモリに展開\n(excel-template.js)"]
    
    subgraph Sheet1["1枚目シート (セット)"]
        SetPeriod["期間セル (C1) に『令和〇年〇月16日〜令和〇年〇月15日』を自動設定"]
    end

    subgraph StaffSheets["全スタッフ別シート (木村、植西、末廣、河合 等)"]
        FilterRecords["期間内の該当スタッフの打刻データを抽出"]
        FilterRecords --> LoopDays["16日〜翌月15日の各日付行をループ処理"]
        LoopDays --> CheckAmPm{"打刻時刻の判定"}
        CheckAmPm -->|"出勤が 13:00 前"| WriteAM["午前診察枠 (O列/P列) に 4桁数値 (例: 0900 / 1230) を転記"]
        CheckAmPm -->|"出勤が 13:00 以降"| WritePM["午後診察枠 (U列/V列) に 4桁数値 (例: 1330 / 1830) を転記"]
        WriteAM --> PreserveFormula["原本シート内の労働時間計算式・SUM関数・マクロを完全維持"]
        WritePM --> PreserveFormula
    end

    subgraph PointSheet["新設シート (感謝ポイント一覧)"]
        CalcPoints["期間内のピアボーナスを集計\n・スタッフ別 獲得ポイント／贈呈ポイント\n・感謝メッセージ履歴一覧 (日時、送り主、相手、メッセージ)"]
    end

    LoadTemplate --> SetPeriod
    LoadTemplate --> StaffSheets
    LoadTemplate --> PointSheet

    SetPeriod --> BuildFile["ブラウザ内 (ExcelJS) でエクセルバイナリを構築"]
    StaffSheets --> BuildFile
    PointSheet --> BuildFile

    BuildFile --> Download["『時間集計表_2026年10月度.xlsx』を自動ダウンロード\n(会計事務所・社労士へそのまま提出可能！)"]
```

---

## 7. まとめ（機能と仕様の対応一覧表）

| 領域 | 主要機能 | 動作のポイント |
| :--- | :--- | :--- |
| **打刻・勤怠** | 出勤・休憩・退勤 | 1画面で迷わないカード選択。休憩中は上部バーが点滅。残業時は理由入力必須化。 |
| **スケジュール** | Googleカレンダー連携 | `honmachifc@gmail.com` から当日の全予定を自動読取。上部バナー＆モーダル一覧表示。 |
| **遊び心・演出** | レッサーパンダ院長 | 出勤時に画面右下に登場。20秒間滞在し、本日の予定を箇条書きで案内（×で即閉じ可）。 |
| **評価・文化** | 360度ピアボーナス | 実働時間に応じて原資ポイント獲得。退勤時に同僚へ感謝メッセージとともに自由配分。 |
| **同期・インフラ** | 複数端末リアルタイム同期 | サーバー契約不要（GAS + Sheets）。JSONPによる双方向同期で他端末の打刻も即座に反映。 |
| **労務・修正** | 打刻ミス修正申請 | スタッフがスマホ・PCから修正申請 → 管理者がワンクリックで承認 → データ即時反映。 |
| **給与計算** | Excelワンクリック出力 | 16日〜翌15日判定、午前・午後診察の自動振り分け、4桁時刻入力、ポイント集計シート同梱。 |

