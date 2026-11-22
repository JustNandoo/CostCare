/* CostCare — penyimpanan data dummy (localStorage) & aturan bisnis.
   Semua data di sini adalah DATA DEMO. Tidak ada backend; ganti modul ini
   dengan pemanggilan API ketika backend tersedia. */
(function (global) {
  'use strict';

  var KEY = 'costcare.data.v1';
  var SESSION_KEY = 'costcare.session.v1';
  var MIN = 60 * 1000;
  var HOUR = 60 * MIN;
  var DAY = 24 * HOUR;

  var DEFAULT_SETTINGS = {
    site: 'RAM Harapan',
    city: 'Dumai',
    basis: 'berat',      // potongan dikenakan pada: 'berat' | 'harga'
    wround: 'none',      // pembulatan berat dibayar: 'none' | '1' | '10'
    rround: 1,           // pembulatan total rupiah: 1 | 100 | 1000
    stabTol: 10,         // toleransi stabil (kg)
    stabSec: 3,          // lama stabil (detik)
    reviewPot: 4,        // review bila potongan total > (%)
    reviewTara: 5        // review bila tara menyimpang > (%)
  };

  var DEDUCTION_TYPES = [
    { id: 'mentah', name: 'Buah mentah', desc: 'Brondolan belum lepas, warna hitam/ungu', active: true },
    { id: 'tangkai', name: 'Tangkai panjang', desc: 'Tangkai lebih dari 2,5 cm', active: true },
    { id: 'busuk', name: 'Buah busuk', desc: 'Berjamur atau lewat 48 jam', active: true },
    { id: 'kosong', name: 'Janjang kosong', desc: 'Tandan tanpa buah', active: true },
    { id: 'sampah', name: 'Sampah & kotoran', desc: 'Tanah, batu, pasir', active: true }
  ];

  var USERS = [
    { id: 'U1', name: 'H. Hasan Basri', email: 'hasan@costcare.id', role: 'pemilik', initials: 'HB', active: true },
    { id: 'U2', name: 'Maya Sari', email: 'maya@costcare.id', role: 'admin', initials: 'MS', active: true },
    { id: 'U3', name: 'Rina Puspita', email: 'rina@costcare.id', role: 'operator', initials: 'RP', active: true },
    { id: 'U4', name: 'Dedi Kurniawan', email: 'dedi@costcare.id', role: 'operator', initials: 'DK', active: true },
    { id: 'U5', name: 'Joko Susilo', email: 'joko@costcare.id', role: 'operator', initials: 'JS', active: true },
    { id: 'U6', name: 'Lestari Audit', email: 'audit@costcare.id', role: 'auditor', initials: 'LA', active: true }
  ];
  var DEMO_PASSWORD = 'demo123';

  var ROLE_LABEL = { pemilik: 'Pemilik', admin: 'Admin & keuangan', operator: 'Operator timbangan', auditor: 'Auditor (baca saja)' };

  // ---------- util ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayCode(ts) { return dayKey(ts).replace(/-/g, ''); }
  function roundTo(v, unit) { unit = Number(unit) || 1; return Math.round(v / unit) * unit; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sumDed(d) { var s = 0; Object.keys(d || {}).forEach(function (k) { s += Number(d[k]) || 0; }); return Math.round(s * 100) / 100; }

  // ---------- perhitungan ----------
  function calc(t) {
    var rules = t.rules || DEFAULT_SETTINGS;
    var pct = sumDed(t.deductions);
    var out = { pct: pct, price: t.price, netto: null, potKg: null, bayar: null, priceNet: t.price, total: null };
    if (t.gross == null || t.tare == null) return out;
    var netto = t.gross - t.tare;
    out.netto = netto;
    if (rules.basis === 'harga') {
      out.potKg = 0;
      out.bayar = netto;
      out.priceNet = t.price * (100 - pct) / 100;
      out.total = roundTo(Math.round(netto * out.priceNet * 10) / 10, rules.rround);
    } else {
      var raw = r1(netto - netto * pct / 100);
      var bayar = rules.wround === '1' ? Math.round(raw) : rules.wround === '10' ? Math.round(raw / 10) * 10 : raw;
      out.potKg = r1(netto - raw);
      out.bayar = bayar;
      out.total = roundTo(Math.round(bayar * t.price * 10) / 10, rules.rround);
    }
    return out;
  }

  // ---------- data generator ----------
  var FEATURED_SUPPLIERS = [
    { id: 'SUP-00281', name: 'Budi Santoso', status: 'ok', phone: '0812-3341-4471', pay: 'Transfer BRI', rfid: 'RF-0A3F-8812', origin: 'Bukit Kapur, Dumai', since: -292 },
    { id: 'SUP-00017', name: 'Koperasi Tani Makmur', status: 'ok', phone: '0813-6602-1180', pay: 'Transfer Bank Riau Kepri', rfid: 'RF-71C0-0017', origin: 'Kandis, Siak', since: -314, contact: 'Pak Sutrisno (pengurus)' },
    { id: 'SUP-00092', name: 'Hendra Wijaya', status: 'ok', phone: '0813-7781-2290', pay: 'Tunai', rfid: 'RF-11C2-0457', origin: 'Mandau, Bengkalis', since: -306 },
    { id: 'SUP-00145', name: 'Siti Rahmawati', status: 'ok', phone: '0852-6640-1108', pay: 'Transfer BRI', rfid: 'RF-77D0-1934', origin: 'Pinggir, Bengkalis', since: -262 },
    { id: 'SUP-00198', name: 'Dewi Lestari', status: 'ok', phone: '0821-7015-6650', pay: 'Transfer BNI', rfid: 'RF-2B9E-5521', origin: 'Mandau, Bengkalis', since: -249 },
    { id: 'SUP-00233', name: 'Rudi Hartono', status: 'ok', phone: '0812-7740-5512', pay: 'Tunai', rfid: 'RF-3C11-7720', origin: 'Bukit Kapur, Dumai', since: -230 },
    { id: 'SUP-00310', name: 'Ahmad Fauzi', status: 'ok', phone: '0853-6511-0923', pay: 'Transfer BRI', rfid: 'RF-48AA-1102', origin: 'Pinggir, Bengkalis', since: -201 },
    { id: 'SUP-00412', name: 'Yanti Marlina', status: 'baru', phone: '0822-8810-3017', pay: '', rfid: '', origin: 'Kandis, Siak', since: -31,
      note: 'Supplier baru — lengkapi metode pembayaran dan pasang kartu RFID sebelum transaksi berikutnya.' },
    { id: 'SUP-00419', name: 'Budi Santosa', status: 'review', phone: '0812-3341-4471', pay: 'Transfer BRI', rfid: 'RF-5E41-0090', origin: 'Bukit Kapur, Dumai', since: -2, dupOf: 'SUP-00281',
      note: 'Kemungkinan duplikat dari SUP-00281 Budi Santoso: nama mirip, nomor WA dan kebun asal sama.' },
    { id: 'SUP-00055', name: 'Agus Salim', status: 'blokir', phone: '0811-7612-7742', pay: 'Tunai', rfid: 'RF-90AA-3376', origin: 'Bathin Solapan, Bengkalis', since: -317,
      note: 'Kartu dilaporkan hilang dan diblokir oleh Maya Sari. Tap kartu ini ditolak di Timbang.' },
    { id: 'SUP-00438', name: 'Yusuf Hamdani', status: 'ok', phone: '0852-7124-6610', pay: 'Transfer BRI', rfid: 'RF-6D20-4381', origin: 'Talang Muandau, Bengkalis', since: -150 }
  ];
  var EXTRA_NAMES = ['Sri Wahyuni', 'Joko Prasetyo', 'Rahmat Hidayat', 'Nurhayati', 'Bambang Sutrisno', 'Eko Saputra', 'Lina Marlina', 'Wahyu Nugroho',
    'Fitri Handayani', 'Darmawan', 'Suryadi', 'Ratna Sari', 'Hasanuddin', 'Teguh Santoso', 'KUD Sawit Jaya', 'Imam Syafii'];
  var ORIGINS = ['Bukit Kapur, Dumai', 'Mandau, Bengkalis', 'Pinggir, Bengkalis', 'Kandis, Siak', 'Bathin Solapan, Bengkalis', 'Talang Muandau, Bengkalis', 'Sungai Sembilan, Dumai'];
  var TYPES = [['Colt Diesel', 3050, 3450], ['Fuso', 3950, 4150], ['Dump truck kecil', 3350, 3500], ['Pikap', 1450, 1650]];
  var LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

  function seed() {
    var now = Date.now();
    var today = startOfDay(now);
    var R = rng(20261023);
    var pick = function (arr) { return arr[Math.floor(R() * arr.length)]; };
    var between = function (a, b) { return a + R() * (b - a); };

    var state = {
      version: 1,
      seededAt: now,
      settings: clone(DEFAULT_SETTINGS),
      users: clone(USERS),
      deductionTypes: clone(DEDUCTION_TYPES),
      suppliers: [],
      vehicles: [],
      prices: [],
      transactions: [],
      invoices: [],
      corrections: [],
      audit: [],
      queue: [],
      devices: [
        { id: 't1', name: 'Timbangan 01', where: 'Pintu masuk · kapasitas 40 t', adapter: 'Simulator demo', status: 'ok', last: now },
        { id: 't2', name: 'Timbangan 02', where: 'Sisi gudang · kapasitas 30 t', adapter: 'Simulator demo', status: 'off', last: now - 130 * MIN },
        { id: 'rf', name: 'Pembaca RFID', where: 'Pintu masuk', adapter: 'Simulator demo', status: 'ok', last: now - 3 * MIN },
        { id: 'pr', name: 'Printer tiket', where: 'Ruang timbang', adapter: 'Printer browser', status: 'ok', last: now - 40 * MIN }
      ],
      demoRequests: []
    };

    // supplier & kendaraan
    var featuredPlates = {
      'SUP-00281': [['BM 8123 XX', 'Colt Diesel', 3195, 3230], ['BM 8790 XY', 'Dump truck kecil', 3410, 3460]],
      'SUP-00017': [['BM 8771 RB', 'Fuso', 3990, 4050], ['BM 8702 RB', 'Fuso', 4010, 4060]],
      'SUP-00092': [['BK 9012 TR', 'Colt Diesel', 3350, 3400]],
      'SUP-00145': [['BM 8456 KA', 'Colt Diesel', 3130, 3170]],
      'SUP-00198': [['BM 8640 QE', 'Colt Diesel', 3080, 3140]],
      'SUP-00233': [['BM 8302 AF', 'Colt Diesel', 2920, 2960]],
      'SUP-00310': [['BM 8915 HC', 'Colt Diesel', 3240, 3280]],
      'SUP-00412': [['BM 8077 TD', 'Pikap', null, null]],
      'SUP-00419': [],
      'SUP-00055': [['BM 8214 KC', 'Colt Diesel', 3220, 3260]],
      'SUP-00438': [['BM 8302 KD', 'Colt Diesel', 3160, 3210]]
    };
    FEATURED_SUPPLIERS.forEach(function (s) {
      state.suppliers.push({ id: s.id, name: s.name, status: s.status, phone: s.phone, pay: s.pay, rfid: s.rfid, origin: s.origin,
        since: today + s.since * DAY, note: s.note || '', dupOf: s.dupOf || '', contact: s.contact || '' });
      (featuredPlates[s.id] || []).forEach(function (v) {
        state.vehicles.push({ plate: v[0], type: v[1], supplierId: s.id, tareMin: v[2], tareMax: v[3], status: s.status === 'blokir' ? 'nonaktif' : (v[2] ? 'aktif' : 'baru') });
      });
    });
    EXTRA_NAMES.forEach(function (name, i) {
      var id = 'SUP-' + pad(500 + i * 7, 5);
      var t = pick(TYPES.slice(0, 3));
      var lo = Math.round(between(t[1], t[2] - 60));
      state.suppliers.push({ id: id, name: name, status: 'ok', phone: '08' + Math.floor(between(11, 59)) + '-' + Math.floor(between(1000, 9999)) + '-' + Math.floor(between(1000, 9999)),
        pay: pick(['Transfer BRI', 'Tunai', 'Transfer BNI', 'Transfer Mandiri']), rfid: 'RF-' + Math.floor(between(4096, 65535)).toString(16).toUpperCase() + '-' + Math.floor(between(1000, 9999)),
        origin: pick(ORIGINS), since: today - Math.floor(between(60, 330)) * DAY, note: '', dupOf: '', contact: '' });
      state.vehicles.push({ plate: 'BM ' + Math.floor(between(8000, 8999)) + ' ' + pick(LETTERS.split('')) + pick(LETTERS.split('')), type: t[0], supplierId: id, tareMin: lo, tareMax: lo + 50, status: 'aktif' });
    });

    // harga TBS
    var approvedBy = 'H. Hasan Basri';
    state.prices = [
      { id: 'PR-1', price: 2760, from: today - 21 * DAY, status: 'disetujui', proposer: 'Maya Sari', approver: approvedBy, reason: 'Harga beli pabrik', at: today - 23 * DAY },
      { id: 'PR-2', price: 2790, from: today - 14 * DAY, status: 'disetujui', proposer: 'Maya Sari', approver: approvedBy, reason: 'Harga beli pabrik naik', at: today - 16 * DAY },
      { id: 'PR-3', price: 2810, from: today - 7 * DAY, status: 'disetujui', proposer: 'Maya Sari', approver: approvedBy, reason: 'Harga penetapan Disbun', at: today - 9 * DAY },
      { id: 'PR-4', price: 2850, from: today, status: 'disetujui', proposer: 'Maya Sari', approver: approvedBy, reason: 'Harga beli pabrik naik', at: today - 2 * DAY },
      { id: 'PR-5', price: 2880, from: today + 7 * DAY, status: 'menunggu', proposer: 'Maya Sari', approver: '', reason: 'Harga beli pabrik naik', at: today - 1 * DAY + 16 * HOUR }
    ];
    var priceAtLocal = function (ts) {
      var p = state.prices.filter(function (x) { return x.status === 'disetujui' && x.from <= ts; }).sort(function (a, b) { return b.from - a.from; })[0];
      return p ? p.price : 2760;
    };

    var regular = state.suppliers.filter(function (s) { return s.status === 'ok'; });
    var weights = regular.map(function (s) { return s.id === 'SUP-00017' ? 6 : (s.id === 'SUP-00092' ? 3 : (FEATURED_SUPPLIERS.some(function (f) { return f.id === s.id; }) ? 2 : 1)); });
    var wsum = weights.reduce(function (a, b) { return a + b; }, 0);
    var pickSupplier = function () { var x = R() * wsum; for (var i = 0; i < regular.length; i++) { x -= weights[i]; if (x <= 0) return regular[i]; } return regular[0]; };
    var operators = ['Rina Puspita', 'Dedi Kurniawan'];
    var rules = { basis: 'berat', wround: 'none', rround: 1 };

    function makeTrx(dayStart, seq, at, extra) {
      var s = extra.supplier || pickSupplier();
      var veh = state.vehicles.filter(function (v) { return v.supplierId === s.id; })[0];
      var tare = extra.tare !== undefined ? extra.tare : (veh && veh.tareMin ? Math.round(between(veh.tareMin, veh.tareMax)) : Math.round(between(3100, 3300)));
      var gross = extra.gross !== undefined ? extra.gross : (tare + Math.round(between(3600, 8200) / 10) * 10);
      var ded = extra.deductions || (function () {
        var d = { mentah: Math.round(between(0.5, 2.2) * 2) / 2 };
        if (R() < .7) d.tangkai = Math.round(between(0.5, 1.2) * 2) / 2;
        if (R() < .25) d.busuk = 0.5;
        if (R() < .08) d.mentah += 1.5;
        return d;
      })();
      var t = {
        id: 'TRX-' + dayCode(dayStart) + '-' + pad(seq, 3), day: dayKey(dayStart), seq: seq, at: at,
        supplierId: s.id, plate: extra.plate || (veh ? veh.plate : 'BM 0000 XX'), origin: s.origin,
        scale: extra.scale || '01', operator: extra.operator || pick(operators),
        gross: gross, grossAt: at + 2 * MIN, grossManual: false,
        tare: tare, tareAt: at + Math.round(between(18, 32)) * MIN, tareManual: !!extra.tareManual,
        deductions: ded, grader: 'Joko Susilo', sortAt: at + Math.round(between(10, 16)) * MIN,
        price: priceAtLocal(at), rules: clone(rules),
        status: extra.status || 'selesai', flags: [], reviewedBy: '', reviewedAt: null,
        cancelReason: '', events: []
      };
      if (t.tare === null) { t.tareAt = null; }
      return t;
    }

    // transaksi 30 hari terakhir (kemarin ke belakang)
    for (var d = 29; d >= 1; d--) {
      var ds = today - d * DAY;
      var dow = new Date(ds).getDay();
      var n = dow === 0 ? 16 + Math.floor(R() * 6) : 34 + Math.floor(R() * 12);
      for (var i = 1; i <= n; i++) {
        var at = ds + 7 * HOUR + Math.round((i / (n + 1)) * 9 * HOUR + between(-8, 8) * MIN);
        state.transactions.push(makeTrx(ds, i, at, {}));
      }
    }
    // transaksi khusus kemarin (nota sebagian & sengketa)
    var yest = today - DAY;
    var yCount = state.transactions.filter(function (t) { return t.day === dayKey(yest); }).length;
    var sup = function (id) { return state.suppliers.filter(function (s) { return s.id === id; })[0]; };
    var tPartial = makeTrx(yest, yCount + 1, yest + 15 * HOUR + 12 * MIN, { supplier: sup('SUP-00017'), plate: 'BM 8702 RB', gross: 12650, tare: 4020, deductions: { mentah: 2 } });
    var tDispute = makeTrx(yest, yCount + 2, yest + 16 * HOUR + 40 * MIN, { supplier: sup('SUP-00092'), plate: 'BK 9012 TR', gross: 9310, tare: 3370, deductions: { mentah: 4 } });
    state.transactions.push(tPartial, tDispute);

    // hari ini: transaksi berjalan normal sebelum yang ditampilkan khusus
    var span = Math.max(now - today - 3 * HOUR, 40 * MIN);
    var bg = 39;
    for (var j = 1; j <= bg; j++) {
      var atj = today + Math.round((j / (bg + 1)) * span);
      state.transactions.push(makeTrx(today, j, atj, {}));
    }
    var F = function (seq, minAgo, opts) { return makeTrx(today, seq, now - minAgo * MIN, opts); };
    var t040 = F(40, 140, { supplier: sup('SUP-00412'), plate: 'BM 8077 TD', gross: 6540, tare: null, deductions: {}, status: 'batal' });
    t040.cancelReason = 'Supplier membatalkan penjualan'; t040.cancelledBy = 'Rina Puspita'; t040.cancelledAt = t040.at + 4 * MIN; t040.sortAt = null;
    var t041 = F(41, 125, { supplier: sup('SUP-00198'), gross: 7320, tare: 3100, deductions: { mentah: 2 }, scale: '02', operator: 'Dedi Kurniawan', tareManual: true, status: 'review' });
    t041.manualNote = 'Indikator terputus — angka dibaca dari layar indikator';
    var t042 = F(42, 100, { supplier: sup('SUP-00310'), gross: 8110, tare: 3260, deductions: { mentah: 2, tangkai: 1 }, operator: 'Rina Puspita' });
    var t043 = F(43, 82, { supplier: sup('SUP-00233'), gross: 6870, tare: 2940, deductions: { mentah: 2 }, operator: 'Rina Puspita' });
    var t044 = F(44, 64, { supplier: sup('SUP-00017'), plate: 'BM 8771 RB', gross: 11250, tare: 4020, deductions: { mentah: 2, tangkai: 1 }, operator: 'Rina Puspita' });
    var t045 = F(45, 52, { supplier: sup('SUP-00092'), gross: 9640, tare: 3380, deductions: { mentah: 3, tangkai: 2 }, operator: 'Rina Puspita', status: 'review' });
    var t046 = F(46, 40, { supplier: sup('SUP-00145'), gross: 7980, tare: 3150, deductions: { mentah: 1.5, busuk: 0.5 }, operator: 'Rina Puspita' });
    var t047 = F(47, 30, { supplier: sup('SUP-00281'), plate: 'BM 8123 XX', gross: 8420, tare: null, deductions: { mentah: 2, tangkai: 1 }, operator: 'Rina Puspita', status: 'jalan' });
    t047.events = [{ at: t047.at, what: 'Supplier dikenali lewat kartu RFID', who: 'Rina Puspita' }];
    state.transactions.push(t040, t041, t042, t043, t044, t045, t046, t047);

    // flag & status untuk semua transaksi
    state.transactions.forEach(function (t) {
      if (t.status === 'batal' || t.status === 'jalan') return;
      t.flags = evaluateFlags(state, t);
      if (t.flags.length && t.status === 'selesai' && t.day !== dayKey(today)) {
        t.reviewedBy = 'Maya Sari'; t.reviewedAt = t.tareAt + 25 * MIN; // sudah ditinjau di hari sebelumnya
      } else if (t.flags.length && t.day === dayKey(today) && t.status === 'selesai') {
        t.reviewedBy = 'Maya Sari'; t.reviewedAt = t.tareAt + 10 * MIN;
      }
      if (t.status === 'review') { t.reviewedBy = ''; t.reviewedAt = null; }
    });

    // nota & pembayaran
    var methods = ['Transfer BRI', 'Tunai', 'Transfer BNI', 'Transfer Bank Riau Kepri'];
    state.transactions.forEach(function (t) {
      if (t.status !== 'selesai') return;
      var c = calc(t);
      var inv = { id: 'N-' + t.id.slice(4), trxId: t.id, supplierId: t.supplierId, total: c.total, at: t.tareAt + 3 * MIN, payments: [], dispute: false, disputeNote: '' };
      var paidAt = inv.at + Math.round(between(10, 120)) * MIN;
      var s = sup(t.supplierId);
      if (t.day !== dayKey(today) || R() < .7) {
        inv.payments.push({ at: Math.min(paidAt, now - 2 * MIN), method: s && s.pay ? s.pay : pick(methods), amount: c.total, ref: 'TRF' + Math.floor(between(100000, 999999)), by: 'Maya Sari' });
      }
      state.invoices.push(inv);
    });
    var invOf = function (trx) { return state.invoices.filter(function (x) { return x.trxId === trx.id; })[0]; };
    var iPartial = invOf(tPartial);
    iPartial.payments = [{ at: yest + 16 * HOUR, method: 'Transfer Bank Riau Kepri', amount: 15000000, ref: 'TRF448120', by: 'Maya Sari' }];
    var iDispute = invOf(tDispute);
    iDispute.payments = []; iDispute.dispute = true;
    iDispute.disputeNote = 'Supplier keberatan potongan buah mentah 4%. Foto sampel sortasi sudah dilampirkan; menunggu kesepakatan dengan Pemilik.';
    invOf(t044).payments = [];
    invOf(t042).payments = [{ at: t042.tareAt + 20 * MIN, method: 'Transfer BRI', amount: invOf(t042).total, ref: 'TRF552031', by: 'Maya Sari' }];
    invOf(t043).payments = [{ at: t043.tareAt + 12 * MIN, method: 'Tunai', amount: invOf(t043).total, ref: 'KWT-0431', by: 'Maya Sari' }];
    invOf(t046).payments = [{ at: t046.tareAt + 9 * MIN, method: 'Transfer BRI', amount: invOf(t046).total, ref: 'TRF552087', by: 'Maya Sari' }];

    // antrian di gerbang
    state.queue = [
      { id: 'Q1', supplierId: 'SUP-00438', plate: 'BM 8302 KD', at: now - 3 * MIN, rfid: true },
      { id: 'Q2', supplierId: null, plate: 'BK 8820 MN', at: now - 1 * MIN, rfid: false }
    ];

    // audit awal
    state.audit = [
      { at: today - 14 * DAY + 9 * HOUR + 20 * MIN, cat: 'Aturan', what: 'Batas review potongan 5% → 4%', who: 'H. Hasan Basri' },
      { at: today - 2 * DAY + 18 * HOUR + 30 * MIN, cat: 'Harga', what: 'Disetujui Rp2.850/kg mulai hari ini', who: 'H. Hasan Basri' },
      { at: today - DAY + 16 * HOUR + 5 * MIN, cat: 'Harga', what: 'Diajukan Rp2.880/kg mulai ' + new Date(today + 7 * DAY).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), who: 'Maya Sari' },
      { at: now - 130 * MIN, cat: 'Perangkat', what: 'Timbangan 02 terputus · 3 kali coba ulang gagal', who: 'Sistem' },
      { at: t041.tareAt, cat: 'Transaksi', what: t041.id + ' · tara 3.100 kg diinput MANUAL', who: 'Dedi Kurniawan' },
      { at: t045.tareAt, cat: 'Transaksi', what: t045.id + ' ditandai review (R-02 potongan 5%)', who: 'Sistem' },
      { at: now - 95 * MIN, cat: 'Pengguna', what: 'Masuk dari perangkat baru (Chrome, Android)', who: 'Maya Sari' }
    ];
    return state;
  }

  // ---------- aturan penandaan ----------
  function evaluateFlags(state, t) {
    var flags = [];
    var s = state.settings;
    var c = calc(t);
    if (c.pct > s.reviewPot) flags.push('R-02');
    if (t.tareManual || t.grossManual) flags.push('R-01');
    var v = state.vehicles.filter(function (x) { return x.plate === t.plate; })[0];
    if (v && v.tareMin && t.tare != null) {
      var lo = v.tareMin * (1 - s.reviewTara / 100), hi = v.tareMax * (1 + s.reviewTara / 100);
      if (t.tare < lo || t.tare > hi) flags.push('R-03');
    }
    var dup = state.transactions.some(function (o) { return o.id !== t.id && o.plate === t.plate && o.status !== 'batal' && Math.abs(o.at - t.at) < 30 * MIN; });
    if (dup) flags.push('R-04');
    return flags;
  }
  var FLAG_TEXT = {
    'R-01': ['Berat diinput manual', 'Indikator terputus, angka diinput petugas'],
    'R-02': ['Potongan di atas batas', 'Total potongan melebihi batas review'],
    'R-03': ['Tara menyimpang', 'Tara berbeda jauh dari riwayat kendaraan'],
    'R-04': ['Dugaan transaksi ganda', 'Plat sama tercatat < 30 menit']
  };

  // ---------- muat & simpan ----------
  var state = null;
  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); if (state && state.version === 1) return state; }
    } catch (e) { /* abaikan, buat ulang */ }
    state = seed();
    save();
    return state;
  }
  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Gagal menyimpan data demo', e); }
  }
  function reset() { state = seed(); save(); return state; }

  // ---------- akses data ----------
  var api = {
    MIN: MIN, HOUR: HOUR, DAY: DAY,
    ROLE_LABEL: ROLE_LABEL, FLAG_TEXT: FLAG_TEXT, DEMO_PASSWORD: DEMO_PASSWORD,
    get state() { return state || load(); },
    load: load, save: save, reset: reset,
    calc: calc, sumDed: sumDed, dayKey: dayKey, startOfDay: startOfDay, pad: pad, roundTo: roundTo,
    evaluateFlags: function (t) { return evaluateFlags(api.state, t); },

    supplier: function (id) { return api.state.suppliers.filter(function (s) { return s.id === id; })[0] || null; },
    supplierName: function (id) { var s = api.supplier(id); return s ? s.name : 'Tanpa identitas'; },
    vehicle: function (plate) { return api.state.vehicles.filter(function (v) { return v.plate === plate; })[0] || null; },
    vehiclesOf: function (sid) { return api.state.vehicles.filter(function (v) { return v.supplierId === sid; }); },
    trx: function (id) { return api.state.transactions.filter(function (t) { return t.id === id; })[0] || null; },
    invoice: function (id) { return api.state.invoices.filter(function (i) { return i.id === id; })[0] || null; },
    invoiceOfTrx: function (trxId) { return api.state.invoices.filter(function (i) { return i.trxId === trxId; })[0] || null; },
    paidOf: function (inv) { return inv.payments.reduce(function (a, p) { return a + p.amount; }, 0); },
    invoiceStatus: function (inv) {
      if (inv.dispute) return 'sengketa';
      var paid = api.paidOf(inv);
      return paid >= inv.total ? 'lunas' : (paid > 0 ? 'sebagian' : 'belum');
    },
    user: function (id) { return api.state.users.filter(function (u) { return u.id === id; })[0] || null; },

    priceAt: function (ts) {
      var p = api.state.prices.filter(function (x) { return x.status === 'disetujui' && x.from <= ts; }).sort(function (a, b) { return b.from - a.from; })[0];
      return p || null;
    },
    activePrice: function () { return api.priceAt(Date.now()); },
    previousPrice: function () {
      var list = api.state.prices.filter(function (x) { return x.status === 'disetujui' && x.from <= Date.now(); }).sort(function (a, b) { return b.from - a.from; });
      return list[1] || null;
    },
    scheduledPrices: function () { return api.state.prices.filter(function (x) { return x.from > Date.now() && (x.status === 'menunggu' || x.status === 'disetujui'); }).sort(function (a, b) { return a.from - b.from; }); },

    periodRange: function (p) {
      var now = Date.now(), today = startOfDay(now), d = new Date(now);
      if (p === '7') return { from: today - 6 * DAY, to: today + DAY, label: '7 hari terakhir' };
      if (p === '30') return { from: today - 29 * DAY, to: today + DAY, label: '30 hari terakhir' };
      if (p === 'kemarin') return { from: today - DAY, to: today, label: 'kemarin' };
      if (p === 'bulan') return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: today + DAY, label: 'bulan ini' };
      if (p === 'bulan-lalu') return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), label: 'bulan lalu' };
      return { from: today, to: today + DAY, label: 'hari ini' };
    },
    aggregate: function (list) {
      var a = { count: 0, netto: 0, value: 0, potKg: 0, selesai: 0, review: 0, jalan: 0, batal: 0 };
      list.forEach(function (t) {
        a[t.status] = (a[t.status] || 0) + 1;
        if (t.status === 'batal') return;
        a.count++;
        if (t.status === 'jalan' || t.tare == null) return;
        var c = calc(t);
        a.netto += c.netto || 0; a.value += c.total || 0; a.potKg += (c.netto - c.bayar) || 0;
      });
      return a;
    },
    openInvoices: function () { return api.state.invoices.filter(function (i) { var s = api.invoiceStatus(i); return s === 'belum' || s === 'sebagian'; }); },
    todayKey: function () { return dayKey(Date.now()); },
    trxOnDay: function (key) { return api.state.transactions.filter(function (t) { return t.day === key; }); },
    trxBetween: function (fromTs, toTs) { return api.state.transactions.filter(function (t) { return t.at >= fromTs && t.at < toTs; }); },
    nextTrxId: function () {
      var key = dayKey(Date.now());
      var max = 0;
      api.state.transactions.forEach(function (t) { if (t.day === key && t.seq > max) max = t.seq; });
      return { id: 'TRX-' + key.replace(/-/g, '') + '-' + pad(max + 1, 3), seq: max + 1, day: key };
    },
    activeDeductionTypes: function () { return api.state.deductionTypes.filter(function (d) { return d.active; }); },
    deductionName: function (id) { var d = api.state.deductionTypes.filter(function (x) { return x.id === id; })[0]; return d ? d.name : id; },

    audit: function (cat, what, who) {
      api.state.audit.unshift({ at: Date.now(), cat: cat, what: what, who: who || 'Sistem' });
      if (api.state.audit.length > 500) api.state.audit.length = 500;
    },
    commit: function () { save(); },

    // ---------- sesi ----------
    login: function (email, password) {
      var u = api.state.users.filter(function (x) { return x.email.toLowerCase() === String(email || '').trim().toLowerCase() && x.active; })[0];
      if (!u || password !== DEMO_PASSWORD) return null;
      try { global.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, at: Date.now() })); } catch (e) {}
      api.audit('Pengguna', 'Masuk ke aplikasi', u.name);
      save();
      return u;
    },
    loginAs: function (userId) {
      var u = api.user(userId);
      if (!u) return null;
      try { global.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, at: Date.now() })); } catch (e) {}
      return u;
    },
    logout: function () { try { global.localStorage.removeItem(SESSION_KEY); } catch (e) {} },
    currentUser: function () {
      try {
        var s = JSON.parse(global.localStorage.getItem(SESSION_KEY) || 'null');
        return s ? api.user(s.userId) : null;
      } catch (e) { return null; }
    }
  };

  load();
  global.CC = global.CC || {};
  global.CC.store = api;
})(window);
