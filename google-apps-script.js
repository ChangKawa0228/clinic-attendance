function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calendarId = (e && e.parameter && e.parameter.calendarId) ? e.parameter.calendarId : "honmachifc@gmail.com";
  var allData = loadAllData(ss, calendarId);
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;
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
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: currentData }))
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
  return {
    records: loadRecords(ss),
    pointLedger: loadPointLedger(ss),
    pointLogs: loadPointLogs(ss),
    correctionRequests: loadRequests(ss),
    calendarEvents: calData.events,
    calendarStatus: calData.status
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
