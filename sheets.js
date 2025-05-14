const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'chatbotakademik-6a2d2a705966.json'), // Sesuaikan dengan filemu
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function getResponses() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'jawaban!A2:C',
  });

  const rows = res.data.values;
  const responses = {};

  if (rows.length) {
    rows.forEach(([key, value, category]) => {
      const normalizedKeyword = key.toLowerCase().trim();
      responses[normalizedKeyword] = {
        response: value,
        triggerType: category || 'direct', // default 'direct' jika kosong
      };
    });
  }

  return responses;
}

async function getDaftarJurusan() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'jurusan!A2:A',
  });

  const rows = res.data.values;
  return rows.map(row => row[0].toLowerCase());
}

async function getDataFromSheet(sheetName, jurusan) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const range = `${sheetName}!A2:B`; // Kolom A: jurusan, B: data
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: range,
  });

  const rows = res.data.values;

  if (!rows || rows.length === 0) return null;

  const found = rows.find(([namaJurusan]) => namaJurusan.toLowerCase() === jurusan.toLowerCase());
  return found ? found[1] : null;
}

module.exports = {
  getResponses,
  getDaftarJurusan,
  getDataFromSheet
};
//       if (jurusan) {