const SHEET_NAME = "Maybi Minigame";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    const phone = normalizePhone(payload.phone);
    const score = Number(payload.score) || 0;

    if (!/^(?:\+84|84|0)\d{9,10}$/.test(phone)) {
      return jsonResponse({ success: false, message: "Invalid phone number" });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      sheet.appendRow(["Thời gian nhận", "Số điện thoại", "Điểm", "Thời gian từ thiết bị", "Thiết bị"]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }

    sheet.appendRow([
      new Date(),
      safeText(phone),
      score,
      safeText(payload.createdAt),
      safeText(payload.userAgent)
    ]);

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, message: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return jsonResponse({ success: true, message: "Maybi Minigame API is running" });
}

function normalizePhone(value) {
  return String(value || "").trim().replace(/[\s.()-]/g, "");
}

function safeText(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
