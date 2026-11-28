// Googleカレンダー権限の強制承認用関数（try-catchなしで呼ぶことで確実に承認画面を出します）
function authorizeCalendar() {
  var cal = CalendarApp.getDefaultCalendar();
  Logger.log("認証成功！カレンダー名: " + cal.getName());
}

// シフト表スプレッドシート権限の強制承認＆初期化用関数（初回のみ実行してアクセス許可）
function authorizeShiftSpreadsheet() {
  var shiftSs = SpreadsheetApp.openById("18FFiUQSJ_JOLpsienHUfN2Ql06pXrNTFAWlvVo_CG5E");
  Logger.log("シフト表スプレッドシート接続成功！ファイル名: " + shiftSs.getName());
  var now = new Date();
  var sheet = getOrCreateMonthlyShiftSheet(shiftSs, now.getFullYear(), now.getMonth() + 1);
  Logger.log("今月のシフトシート確認/作成完了: " + sheet.getName());
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;

  // 個別スタッフの月間シフト取得リクエスト
  if (e && e.parameter && e.parameter.action === 'getStaffMonthShift') {
    var staffName = e.parameter.staffName || "";
    var year = parseInt(e.parameter.year, 10) || (new Date()).getFullYear();
    var month = parseInt(e.parameter.month, 10) || ((new Date()).getMonth() + 1);
    var monthShiftData = loadStaffMonthShift(ss, staffName, year, month);
    var shiftJson = JSON.stringify({ success: true, data: monthShiftData });

    if (callback) {
      return ContentService.createTextOutput(callback + '(' + shiftJson + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(shiftJson)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 月間全体シフト取得リクエスト（ガントチャート用）
  if (e && e.parameter && e.parameter.action === 'getMonthFullShift') {
    var gYear = parseInt(e.parameter.year, 10) || (new Date()).getFullYear();
    var gMonth = parseInt(e.parameter.month, 10) || ((new Date()).getMonth() + 1);
    var fullShiftData = loadMonthFullShift(ss, gYear, gMonth);
    var fullJson = JSON.stringify({ success: true, data: fullShiftData });

    if (callback) {
      return ContentService.createTextOutput(callback + '(' + fullJson + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(fullJson)
      .setMimeType(ContentService.MimeType.JSON);
  }

  var calendarId = (e && e.parameter && e.parameter.calendarId) ? e.parameter.calendarId : "honmachifc@gmail.com";
  var allData = loadAllData(ss, calendarId);
  var json = JSON.stringify({ success: true, data: allData });
  
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // データの取り出し
  var rawData = "";
  if (e && e.postData && e.postData.contents) {
    rawData = e.postData.contents;
  } else if (e && e.parameter && e.parameter.data) {
    rawData = e.parameter.data;
  }

  var postData = parseJson(rawData);

  if (postData) {
    // 個別スタッフの月間シフト保存リクエスト
    if (postData.action === 'saveStaffShift' || postData.staffShiftData) {
      var sName = postData.staffName;
      var sYear = parseInt(postData.year, 10);
      var sMonth = parseInt(postData.month, 10);
      var sShifts = postData.shifts || {};
      saveStaffMonthShift(ss, sName, sYear, sMonth, sShifts);
    }

    if (postData.records && postData.records.length > 0) {
      saveRecords(ss, postData.records);
    }
    if (postData.pointLedger) {
      savePointLedger(ss, postData.pointLedger);
    }
    if (postData.pointLogs && postData.pointLogs.length > 0) {
      savePointLogs(ss, postData.pointLogs);
    }
    if (postData.correctionRequests && postData.correctionRequests.length > 0) {
      saveRequests(ss, postData.correctionRequests);
    }

    var calendarId = postData.calendarId || "honmachifc@gmail.com";
    var currentData = loadAllData(ss, calendarId);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "OK", data: currentData }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "OK" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e1) {
    try {
      return JSON.parse(decodeURIComponent(str));
    } catch (e2) {
      return null;
    }
  }
}

function loadAllData(ss, calendarId) {
  var calData = getTodayCalendarEvents(calendarId);
  var shiftData = loadTodayShift(ss);
  var now = new Date();
  var monthFull = loadMonthFullShift(ss, now.getFullYear(), now.getMonth() + 1);
  return {
    records: loadRecords(ss),
    pointLedger: loadPointLedger(ss),
    pointLogs: loadPointLogs(ss),
    correctionRequests: loadRequests(ss),
    calendarEvents: calData.events,
    calendarStatus: calData.status,
    todayShift: shiftData,
    monthFullShift: monthFull
  };
}

function getTodayCalendarEvents(calendarId) {
  var targetId = calendarId || "honmachifc@gmail.com";
  var debugStatus = {
    targetId: targetId,
    foundTargetCal: false,
    usedDefaultCal: false,
    eventCount: 0,
    error: null
  };

  try {
    var cal = CalendarApp.getCalendarById(targetId);
    if (cal) {
      debugStatus.foundTargetCal = true;
    } else {
      // ターゲットカレンダーが見つからない場合はデフォルトを試みる
      cal = CalendarApp.getDefaultCalendar();
      if (cal) {
        debugStatus.usedDefaultCal = true;
      }
    }

    if (!cal) {
      debugStatus.error = "カレンダーにアクセスできませんでした。Googleアカウントの共有設定をご確認ください。";
      return { events: [], status: debugStatus };
    }

    // 本日の 00:00:00 〜 23:59:59 までの範囲でイベントを取得
    var now = new Date();
    var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    var endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    var events = cal.getEvents(startOfDay, endOfDay);
    debugStatus.eventCount = events.length;

    var result = [];

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var isAllDay = ev.isAllDayEvent();
      var startStr = "";
      var endStr = "";

      if (isAllDay) {
        startStr = "終日";
      } else {
        var start = ev.getStartTime();
        var end = ev.getEndTime();
        startStr = Utilities.formatDate(start, Session.getScriptTimeZone(), 'HH:mm');
        endStr = Utilities.formatDate(end, Session.getScriptTimeZone(), 'HH:mm');
      }

      result.push({
        id: ev.getId(),
        title: ev.getTitle() || "（タイトルなし）",
        isAllDay: isAllDay,
        startTime: startStr,
        endTime: endStr,
        timeDisplay: isAllDay ? "終日" : (startStr + (endStr ? "〜" + endStr : "")),
        location: ev.getLocation() || "",
        description: ev.getDescription() || ""
      });
    }

    return { events: result, status: debugStatus };
  } catch (err) {
    debugStatus.error = err.toString();
    return { events: [], status: debugStatus };
  }
}

function loadRecords(ss) {
  var sheet = ss.getSheetByName('打刻履歴');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  var records = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    records.push({
      id: String(r[0]),
      date: formatDate(r[1]),
      staffId: String(r[2]),
      staffName: String(r[3]),
      checkin: r[4] ? formatTime(r[4]) : null,
      breakStart: r[5] ? formatTime(r[5]) : null,
      breakEnd: r[6] ? formatTime(r[6]) : null,
      checkout: r[7] ? formatTime(r[7]) : null,
      duration: Number(r[8]) || 0,
      overtimeReason: r[9] ? String(r[9]) : null,
      points: Number(r[10]) || 0,
      peerReceiverId: r[11] ? String(r[11]) : null,
      peerReceiverName: r[12] ? String(r[12]) : null,
      peerPoints: Number(r[13]) || 0,
      isCorrected: r[14] === true || r[14] === "TRUE",
      correctionReason: r[15] ? String(r[15]) : null
    });
  }
  return records;
}

function loadPointLedger(ss) {
  var sheet = ss.getSheetByName('ポイント残高');
  if (!sheet) return {};
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return {};

  var ledger = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    ledger[String(r[0])] = {
      current: Number(r[2]) || 0,
      lifetime: Number(r[3]) || 0
    };
  }
  return ledger;
}

function loadPointLogs(ss) {
  var sheet = ss.getSheetByName('ポイント履歴');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  var logs = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    logs.push({
      id: String(r[0]),
      timestamp: String(r[1]),
      staffId: String(r[2]),
      staffName: String(r[3]),
      action: String(r[4]),
      points: Number(r[5]) || 0,
      reason: r[6] ? String(r[6]) : ''
    });
  }
  return logs;
}

function loadRequests(ss) {
  var sheet = ss.getSheetByName('修正申請');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  var requests = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    requests.push({
      id: String(r[0]),
      createdAt: String(r[1]),
      staffId: String(r[2]),
      staffName: String(r[3]),
      date: formatDate(r[4]),
      checkin: r[5] ? formatTime(r[5]) : null,
      checkout: r[6] ? formatTime(r[6]) : null,
      reason: r[7] ? String(r[7]) : '',
      status: String(r[8]) || 'pending',
      processedAt: r[9] ? String(r[9]) : null
    });
  }
  return requests;
}

function saveRecords(ss, records) {
  var sheet = getOrCreateSheet(ss, '打刻履歴', [
    'ID', '日付', 'スタッフID', 'スタッフ名', '出勤', '休憩開始', '休憩終了', '退勤', 
    '実働(分)', '残業理由', '獲得pt', '贈呈先ID', '贈呈先名', '贈呈pt', '修正済フラグ', '修正理由'
  ]);
  
  if (!records || records.length === 0) return;

  var existingValues = sheet.getDataRange().getValues();
  var idToRowIndex = {};
  for (var i = 1; i < existingValues.length; i++) {
    if (existingValues[i][0]) {
      idToRowIndex[String(existingValues[i][0])] = i + 1;
    }
  }

  var newRows = [];
  records.forEach(function(r) {
    var recordId = r.id || ('rec-' + r.date + '-' + r.staffId);
    var row = [
      recordId,
      r.date,
      r.staffId,
      r.staffName,
      r.checkin || '',
      r.breakStart || '',
      r.breakEnd || '',
      r.checkout || '',
      r.duration || 0,
      r.overtimeReason || '',
      r.points || 0,
      r.peerReceiverId || '',
      r.peerReceiverName || '',
      r.peerPoints || 0,
      r.isCorrected ? true : false,
      r.correctionReason || ''
    ];

    if (idToRowIndex[recordId]) {
      sheet.getRange(idToRowIndex[recordId], 1, 1, row.length).setValues([row]);
    } else {
      newRows.push(row);
      idToRowIndex[recordId] = true;
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

function savePointLedger(ss, ledger) {
  var sheet = getOrCreateSheet(ss, 'ポイント残高', ['スタッフID', 'スタッフ名', '現在保有pt', '累計獲得pt']);
  var rows = [];
  for (var staffId in ledger) {
    rows.push([staffId, '', ledger[staffId].current || 0, ledger[staffId].lifetime || 0]);
  }
  if (rows.length > 0) {
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
    }
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }
}

function savePointLogs(ss, logs) {
  var sheet = getOrCreateSheet(ss, 'ポイント履歴', ['ID', '日時', 'スタッフID', 'スタッフ名', '種別', 'ポイント', '理由']);
  if (!logs || logs.length === 0) return;

  var existingValues = sheet.getDataRange().getValues();
  var existingIds = {};
  for (var i = 1; i < existingValues.length; i++) {
    if (existingValues[i][0]) existingIds[String(existingValues[i][0])] = true;
  }

  var newRows = [];
  logs.forEach(function(l) {
    if (!existingIds[String(l.id)]) {
      newRows.push([l.id, l.timestamp, l.staffId, l.staffName, l.action, l.points, l.reason]);
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

function saveRequests(ss, requests) {
  var sheet = getOrCreateSheet(ss, '修正申請', [
    'ID', '申請日時', 'スタッフID', 'スタッフ名', '対象日付', '修正出勤', '修正退勤', '申請理由', '状態', '処理日時'
  ]);
  if (!requests || requests.length === 0) return;

  var existingValues = sheet.getDataRange().getValues();
  var idToRowIndex = {};
  for (var i = 1; i < existingValues.length; i++) {
    if (existingValues[i][0]) idToRowIndex[String(existingValues[i][0])] = i + 1;
  }

  var newRows = [];
  requests.forEach(function(q) {
    var row = [
      q.id,
      q.createdAt,
      q.staffId,
      q.staffName,
      q.date,
      q.checkin || '',
      q.checkout || '',
      q.reason || '',
      q.status || 'pending',
      q.processedAt || ''
    ];
    if (idToRowIndex[q.id]) {
      sheet.getRange(idToRowIndex[q.id], 1, 1, row.length).setValues([row]);
    } else {
      newRows.push(row);
      idToRowIndex[q.id] = true;
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e2e8f0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function formatDate(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function formatTime(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm:ss');
  }
  return String(val);
}

// ==========================================================================
// シフト表（月別シート）連携＆自動生成モジュール
// ==========================================================================

// ★シフト表を「出勤記録とは別のスプレッドシート」で管理したい場合は、
// そのシフト表スプレッドシートのID（URLの /d/〇〇〇/edit の部分）をここに記入してください。
// 空文字 "" の場合は、この出勤記録スプレッドシート内に作成されます。
var SHIFT_SPREADSHEET_ID = "18FFiUQSJ_JOLpsienHUfN2Ql06pXrNTFAWlvVo_CG5E";

function getShiftSpreadsheet(ss) {
  if (SHIFT_SPREADSHEET_ID && SHIFT_SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(SHIFT_SPREADSHEET_ID.trim());
    } catch (e) {
      Logger.log("指定されたシフト表スプレッドシートが開けませんでした（アクセス権限等をご確認ください）: " + e.message);
      return ss;
    }
  }
  return ss;
}

var DEFAULT_SHIFT_STAFFS = [
  '河合 茂明', '河合 朋子', 'マックアリース 温子', '千葉 幸夫', '尾崎 昭太',
  '木村 哲子', '末廣 綾乃', '北口 愛美', '寺西 真名美', '植西 順子',
  '千原 由佳菜', 'HELP Ns. 1', 'HELP Ns. 2', 'HELP St. 1', 'HELP St. 2'
];

var DEFAULT_SHIFT_OPTIONS = [
  '10:00〜19:00',
  '10:00〜13:00',
  '17:00〜19:00',
  '10:00〜13:00, 17:00〜19:00',
  '休'
];

/**
 * 本日のシフト情報を取得する
 * 今月シート（例: シフト_2026-11）から本日の行を読み取り、各スタッフの出勤予定を返す
 */
function loadTodayShift(ss) {
  var targetSs = getShiftSpreadsheet(ss);
  var now = new Date();
  var tz = Session.getScriptTimeZone();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var day = now.getDate();
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  var sheet = findMonthlyShiftSheet(targetSs, year, month);
  if (!sheet) {
    // なければ今月のシフトシートを自動生成
    sheet = getOrCreateMonthlyShiftSheet(targetSs, year, month);
  }

  var result = {
    sheetName: sheet ? sheet.getName() : null,
    date: todayStr,
    shifts: {}
  };

  if (!sheet) return result;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 3) return result;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // 本日の行を探す
  var todayRow = null;
  for (var i = 0; i < rows.length; i++) {
    var cellDate = rows[i][0];
    var rowDay = null;

    if (cellDate instanceof Date) {
      rowDay = cellDate.getDate();
    } else if (typeof cellDate === 'number') {
      rowDay = cellDate;
    } else if (typeof cellDate === 'string') {
      var m = cellDate.match(/(\d{1,2})$/);
      if (m) rowDay = parseInt(m[1], 10);
      else if (cellDate.indexOf(todayStr) !== -1) rowDay = day;
    }

    if (rowDay === day) {
      todayRow = rows[i];
      break;
    }
  }

  if (todayRow) {
    // 各スタッフ列のシフト値を取得
    for (var col = 2; col < headers.length; col++) {
      var staffName = String(headers[col] || '').trim();
      if (!staffName) continue;
      var val = String(todayRow[col] || '').trim();

      // 空白や「休」でなければ出勤シフトありと判定
      if (val && val !== '休' && val !== '×' && val !== '-') {
        result.shifts[staffName] = val;
      }
    }
  }

  return result;
}

/**
 * 指定年月の月間全体シフトデータを一括取得する（ガントチャート用）
 */
function loadMonthFullShift(ss, year, month) {
  var targetSs = getShiftSpreadsheet(ss);
  var sheet = findMonthlyShiftSheet(targetSs, year, month);
  if (!sheet) {
    sheet = getOrCreateMonthlyShiftSheet(targetSs, year, month);
  }
  var result = {
    year: year,
    month: month,
    sheetName: sheet ? sheet.getName() : null,
    days: {}
  };
  if (!sheet) return result;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 3) return result;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var staffColMap = [];
  for (var c = 2; c < headers.length; c++) {
    var hName = String(headers[c] || '').trim();
    if (hName) {
      staffColMap.push({ name: hName, colIdx: c });
    }
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < rows.length; i++) {
    var cellDate = rows[i][0];
    var dayNum = null;
    if (cellDate instanceof Date) {
      dayNum = cellDate.getDate();
    } else if (typeof cellDate === 'number') {
      dayNum = cellDate;
    } else if (typeof cellDate === 'string') {
      var m = cellDate.match(/(\d{1,2})$/);
      if (m) dayNum = parseInt(m[1], 10);
    }
    if (dayNum !== null && dayNum >= 1 && dayNum <= 31) {
      var dayShifts = {};
      for (var s = 0; s < staffColMap.length; s++) {
        var sInfo = staffColMap[s];
        var val = rows[i][sInfo.colIdx];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          dayShifts[sInfo.name] = String(val).trim();
        }
      }
      result.days[String(dayNum)] = dayShifts;
    }
  }
  return result;
}

/**
 * 月別シフトシートを検索する
 */
function findMonthlyShiftSheet(ss, year, month) {
  var mStr = String(month).padStart(2, '0');
  var candidates = [
    'シフト_' + year + '-' + mStr,
    'シフト_' + year + mStr,
    year + '年' + month + '月シフト',
    year + '年' + mStr + '月シフト',
    'シフト_' + year + '年' + month + '月',
    'シフト_' + year + '/' + mStr
  ];

  for (var i = 0; i < candidates.length; i++) {
    var s = ss.getSheetByName(candidates[i]);
    if (s) return s;
  }

  // あいまい検索（シート名に 年月 が含まれているもの）
  var sheets = ss.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    var name = sheets[j].getName();
    if (name.indexOf(year + '-' + mStr) !== -1 || name.indexOf(year + '年' + month + '月') !== -1) {
      return sheets[j];
    }
  }
  return null;
}

/**
 * 月別シフトシートを作成・初期化する（ドロップダウン付き、土日色付け、自由入力可）
 */
function getOrCreateMonthlyShiftSheet(ss, year, month) {
  var mStr = String(month).padStart(2, '0');
  var sheetName = 'シフト_' + year + '-' + mStr;
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);

  var headers = ['日付', '曜日'].concat(DEFAULT_SHIFT_STAFFS);
  var daysInMonth = new Date(year, month, 0).getDate();
  var daysOfWeekJp = ['日', '月', '火', '水', '木', '金', '土'];

  var rows = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var curDate = new Date(year, month - 1, d);
    var dayOfWeek = daysOfWeekJp[curDate.getDay()];
    var row = [d, dayOfWeek];
    for (var s = 0; s < DEFAULT_SHIFT_STAFFS.length; s++) {
      row.push('');
    }
    rows.push(row);
  }

  // ヘッダー書き込み
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // データ行書き込み
  var dataRange = sheet.getRange(2, 1, rows.length, headers.length);
  dataRange.setValues(rows);
  dataRange.setHorizontalAlignment('center');

  // 1行目固定
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  // 列幅の調整
  sheet.setColumnWidth(1, 55); // 日付
  sheet.setColumnWidth(2, 45); // 曜日
  for (var c = 3; c <= headers.length; c++) {
    sheet.setColumnWidth(c, 160); // スタッフ列（時間帯が入るため少し広め）
  }

  // ドロップダウンリスト（入力規則）を設定
  // setAllowInvalid(true) により、リストからの選択も、手入力（別時間や2コマ中抜けなど）も両方可能！
  var shiftRange = sheet.getRange(2, 3, rows.length, DEFAULT_SHIFT_STAFFS.length);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(DEFAULT_SHIFT_OPTIONS, true)
    .setAllowInvalid(true)
    .setHelpText('リストから選択するか、「10:00〜13:00, 17:00〜19:00」のように自由に手入力もできます。')
    .build();
  shiftRange.setDataValidation(rule);

  // 土日の行にやさしい背景色を設定
  for (var r = 0; r < rows.length; r++) {
    var dow = rows[r][1];
    var rowIndex = r + 2;
    if (dow === '日') {
      sheet.getRange(rowIndex, 1, 1, headers.length).setBackground('#fff1f2'); // 淡い赤
      sheet.getRange(rowIndex, 2).setFontColor('#e11d48').setFontWeight('bold');
    } else if (dow === '土') {
      sheet.getRange(rowIndex, 1, 1, headers.length).setBackground('#f0f9ff'); // 淡い青
      sheet.getRange(rowIndex, 2).setFontColor('#0284c7').setFontWeight('bold');
    }
  }

  return sheet;
}

/**
 * 手動で翌月などのシフトシートを作成したい時のテスト/呼び出し用関数
 */
function createNextMonthShiftSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetSs = getShiftSpreadsheet(ss);
  var now = new Date();
  var nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  var s = getOrCreateMonthlyShiftSheet(targetSs, nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1);
  Logger.log('作成完了: ' + s.getName());
}

/**
 * 特定スタッフの月間シフト（1日〜末日）を取得する
 */
function loadStaffMonthShift(ss, staffName, year, month) {
  var targetSs = getShiftSpreadsheet(ss);
  var sheet = findMonthlyShiftSheet(targetSs, year, month);
  if (!sheet) {
    sheet = getOrCreateMonthlyShiftSheet(targetSs, year, month);
  }
  var result = {
    staffName: staffName,
    year: year,
    month: month,
    sheetName: sheet ? sheet.getName() : null,
    shifts: {}
  };
  if (!sheet || !staffName) return result;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 3) return result;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var staffCol = -1;
  var cleanTarget = String(staffName || '').replace(/\s+/g, '');
  for (var c = 2; c < headers.length; c++) {
    var h = String(headers[c] || '').replace(/\s+/g, '');
    if (h === cleanTarget || h.indexOf(cleanTarget) !== -1 || cleanTarget.indexOf(h) !== -1) {
      staffCol = c + 1; // 1-based index
      break;
    }
  }
  if (staffCol === -1) return result;

  var dateAndShiftValues = sheet.getRange(2, 1, lastRow - 1, staffCol).getValues();
  for (var i = 0; i < dateAndShiftValues.length; i++) {
    var dayVal = dateAndShiftValues[i][0];
    var dayNum = null;
    if (dayVal instanceof Date) dayNum = dayVal.getDate();
    else if (typeof dayVal === 'number') dayNum = dayVal;
    else if (typeof dayVal === 'string') {
      var m = dayVal.match(/(\d{1,2})$/);
      if (m) dayNum = parseInt(m[1], 10);
    }
    if (dayNum !== null) {
      result.shifts[String(dayNum)] = String(dateAndShiftValues[i][staffCol - 1] || '').trim();
    }
  }
  return result;
}

/**
 * 特定スタッフの月間シフトを総合シートの該当列に保存する
 * （他の人の列には一切触れず、そのスタッフの列だけをピンポイント更新）
 */
function saveStaffMonthShift(ss, staffName, year, month, shiftsObj) {
  var targetSs = getShiftSpreadsheet(ss);
  var sheet = findMonthlyShiftSheet(targetSs, year, month);
  if (!sheet) {
    sheet = getOrCreateMonthlyShiftSheet(targetSs, year, month);
  }
  if (!sheet || !staffName || !shiftsObj) return false;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return false;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var staffCol = -1;
  var cleanTarget = String(staffName).replace(/\s+/g, '');
  for (var c = 2; c < headers.length; c++) {
    var h = String(headers[c] || '').replace(/\s+/g, '');
    if (h === cleanTarget || h.indexOf(cleanTarget) !== -1 || cleanTarget.indexOf(h) !== -1) {
      staffCol = c + 1;
      break;
    }
  }

  // もしそのスタッフの列がまだ無ければ、末尾に新規列を追加！
  if (staffCol === -1) {
    staffCol = lastCol + 1;
    sheet.getRange(1, staffCol)
      .setValue(staffName)
      .setFontWeight('bold')
      .setBackground('#0f172a')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setColumnWidth(staffCol, 160);

    var shiftRange = sheet.getRange(2, staffCol, lastRow - 1, 1);
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(DEFAULT_SHIFT_OPTIONS, true)
      .setAllowInvalid(true)
      .build();
    shiftRange.setDataValidation(rule);
  }

  // 各日付の行を探して、そのスタッフの列のセルに値を反映
  var dateValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < dateValues.length; i++) {
    var dayVal = dateValues[i][0];
    var dayNum = null;
    if (dayVal instanceof Date) dayNum = dayVal.getDate();
    else if (typeof dayVal === 'number') dayNum = dayVal;
    else if (typeof dayVal === 'string') {
      var m = dayVal.match(/(\d{1,2})$/);
      if (m) dayNum = parseInt(m[1], 10);
    }

    if (dayNum !== null && shiftsObj.hasOwnProperty(String(dayNum))) {
      var valToSet = shiftsObj[String(dayNum)];
      var rowIndex = i + 2;
      sheet.getRange(rowIndex, staffCol).setValue(valToSet || '');
    }
  }

  Logger.log(staffName + 'さんのシフトを更新完了 (' + year + '-' + month + ')');
  return true;
}
