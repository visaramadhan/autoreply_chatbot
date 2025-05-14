require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { getResponses, getDaftarJurusan, getDataFromSheet } = require('./sheets');
const Fuse = require('fuse.js');  // Impor fuse.js untuk pencocokan fuzzy

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let responses = {};
let daftarJurusan = [];
let userStates = {}; // Menyimpan state per pengguna

// Inisialisasi data di awal
async function initData() {
  try {
    responses = await getResponses();
    daftarJurusan = await getDaftarJurusan();

    // Tambahkan log ini untuk memastikan respons dari sheet sudah benar
    console.log('✅ responses:', responses); 
    console.log('✅ Responses dan daftar jurusan berhasil dimuat');
  } catch (error) {
    console.error('❌ Gagal memuat data:', error);
  }
}

initData();

// Peta sinonim ke keyword utama
const intentSynonyms = {
  'pendaftaran': ['pendaftaran', 'registrasi', 'daftar'],
  'biaya': ['biaya', 'uang kuliah', 'bayar', 'cost'],
  'jadwal': ['jadwal', 'kelas', 'jam kuliah'],
  'jurusan': ['jurusan', 'program studi', 'prodi'],
  // Tambah intent lain sesuai responses
};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase().trim();

  if (!text || text.startsWith('/')) return; // Biar command tetap ditangani secara terpisah

  console.log(`Pesan dari ${chatId}: ${text}`);

  // Handle jika sedang dalam state menunggu input jurusan
  if (userStates[chatId]) {
    const { intent } = userStates[chatId];
    delete userStates[chatId];

    const fuse = new Fuse(daftarJurusan, { threshold: 0.3 });
    const results = fuse.search(text);

    if (results.length > 0) {
      const jurusan = results[0].item;
      const data = await getDataFromSheet(intent, jurusan);
      if (data) {
        bot.sendMessage(chatId, `Berikut ${intent} untuk jurusan ${jurusan}:\n${data}`);
      } else {
        bot.sendMessage(chatId, `Maaf, data ${intent} untuk jurusan ${jurusan} tidak ditemukan.`);
      }
    } else {
      bot.sendMessage(chatId, `Maaf, jurusan tidak dikenali. Pilih dari:\n${daftarJurusan.join(', ')}`);
    }
    return;
  }

  // Flatten semua sinonim jadi satu list untuk Fuse
  const synonymEntries = Object.entries(intentSynonyms).flatMap(([intent, variants]) =>
    variants.map(variant => ({ intent, keyword: variant }))
  );

  const fuseIntent = new Fuse(synonymEntries, {
    keys: ['keyword'],
    threshold: 0.3,
  });

  const result = fuseIntent.search(text);
  if (result.length > 0) {
    const matchedIntent = result[0].item.intent;
    const matches = responses[matchedIntent];
        if (!matches || !Array.isArray(matches) || matches.length === 0) {
        bot.sendMessage(chatId, `Maaf, belum ada respons yang tersedia untuk intent "${matchedIntent}".`);
        return;
        }


    const { response, triggerType } = matches[0];

    // Cek apakah disebutkan jurusan
    const fuseJurusan = new Fuse(daftarJurusan, { threshold: 0.3 });
    const jurusanResults = fuseJurusan.search(text);

    if (triggerType === 'direct') {
      bot.sendMessage(chatId, response);
      return;
    }

    if (triggerType === 'need_detail') {
      if (jurusanResults.length > 0) {
        const jurusan = jurusanResults[0].item;
        const data = await getDataFromSheet(matchedIntent, jurusan);
        if (data) {
          bot.sendMessage(chatId, `Berikut ${matchedIntent} untuk jurusan ${jurusan}:\n${data}`);
        } else {
          bot.sendMessage(chatId, `Maaf, data ${matchedIntent} untuk jurusan ${jurusan} tidak ditemukan.`);
        }
      } else {
        userStates[chatId] = { intent: matchedIntent };
        bot.sendMessage(chatId, `${response}\n\nDaftar jurusan:\n${daftarJurusan.join(', ')}`);
      }
      return;
    }
  }

  // Jika tidak cocok apapun
  bot.sendMessage(chatId, 'Maaf, saya tidak mengerti maksud Anda. Silakan coba pertanyaan lain atau gunakan perintah seperti /help.');
});


// Perintah dasar
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Selamat datang! Silakan ajukan pertanyaan Anda tentang jurusan atau informasi lainnya. Seperti pendaftaran, biaya kuliah, jadwal kelas, dan lainnya. Saya akan membantu Anda.');
});
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Silakan ajukan pertanyaan Anda tentang jurusan atau informasi lainnya. Seperti pendaftaran, biaya kuliah, jadwal kelas, dan lainnya. Saya akan membantu Anda.');
});
bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  delete userStates[chatId];
  bot.sendMessage(chatId, 'State Anda telah direset. Silakan ajukan pertanyaan baru.');
});
bot.onText(/\/jurusan/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Daftar jurusan:\n${daftarJurusan.join(', ')}`);
});
bot.onText(/\/info/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Silakan ajukan pertanyaan Anda tentang jurusan atau informasi lainnya. Seperti pendaftaran, biaya kuliah, jadwal kelas, dan lainnya. Saya akan membantu Anda.');
});
bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Saya adalah chatbot yang siap membantu Anda dengan informasi tentang jurusan dan lainnya. Silakan ajukan pertanyaan Anda.');
});
bot.onText(/\/feedback/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Silakan berikan feedback Anda tentang layanan kami.');
});
bot.onText(/\/contact/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Silakan hubungi kami di:\nEmail: kampus@univ.co.id\nTelepon: 123-456-7890\nWhatsApp: +62 812-3456-7890');
});
bot.onText(/\/location/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Kami berada di:\nJl. Pendidikan No. 123\nKota Belajar, Provinsi Ilmu Pengetahuan\nKode Pos: 12345');
});
bot.onText(/\/jadwal/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Silakan tanyakan jadwal kelas Anda.');
});
bot.onText(/\/mata kuliah/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Silakan tanyakan tentang mata kuliah yang Anda ambil.');
});
bot.onText(/\/pendaftaran/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Silakan tanyakan tentang proses pendaftaran.');
});
bot.onText(/\/biaya/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Silakan tanyakan tentang biaya kuliah.');
});
