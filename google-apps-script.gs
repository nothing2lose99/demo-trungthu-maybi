const SHEET_NAME = "Maybi Minigame";
const SHEET_HEADERS = [
  "Thời gian nhận",
  "Số điện thoại",
  "Điểm",
  "Thời gian từ thiết bị",
  "Thiết bị",
  "Mã voucher",
  "Tên sản phẩm"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    const phone = normalizePhone(payload.phone);
    const score = Number(payload.score) || 0;
    const voucherCode = score >= 20 && score < 50 ? "MAYBI50K" : "";
    const productName = score >= 50 ? safeText(payload.productName) : "";

    if (!/^(?:\+84|84|0)\d{9,10}$/.test(phone)) {
      return jsonResponse({ success: false, message: "Invalid phone number" });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
    }

    ensureSheetHeaders(sheet);

    sheet.appendRow([
      new Date(),
      safeText(phone),
      score,
      safeText(payload.createdAt),
      safeText(payload.userAgent),
      voucherCode,
      productName
    ]);

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, message: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function ensureSheetHeaders(sheet) {
  sheet.getRange(1, 1, 1, SHEET_HEADERS.length)
    .setValues([SHEET_HEADERS])
    .setFontWeight("bold");
  sheet.setFrozenRows(1);
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
