/* CostCare — Timbang Langsung: simulator timbangan + alur transaksi. */
(function () {
  'use strict';
  var S = CC.store, U = CC.ui, f = U.fmt, esc = U.esc, $ = U.$;
  var user = U.boot('timbang');
  if (!user) return;

  var ACTIVE_KEY = 'costcare.activeTrx';
  var ui = {
    scale: 't1',
    mode: { t1: 'stabil', t2: S.state.devices.filter(function (d) { return d.id === 't2'; })[0].status === 'ok' ? 'stabil' : 'terputus' },
    activeId: sessionStorage.getItem(ACTIVE_KEY) || null,
    resultId: null,
    target: 0,
    targetFor: '',
    reading: 0,
    stableMs: 0,
    settleMs: 0,
    lastData: Date.now(),
    reconnecting: false,
    manualOpen: false,
    renderedKey: ''
  };
  var TICK = 250;

  function settings() { return S.state.settings; }
  function active() { var t = ui.activeId ? S.trx(ui.activeId) : null; return t && t.status === 'jalan' ? t : null; }
  function resultTrx() { return ui.resultId ? S.trx(ui.resultId) : null; }
  function phase() {
    var t = active();
    if (!t) return resultTrx() ? 'hasil' : 'idle';
    if (t.gross == null) return 'bruto';
    if (!t.sortAt) return 'sortasi';
    return 'tara';
  }
  function setActive(id) { ui.activeId = id; if (id) sessionStorage.setItem(ACTIVE_KEY, id); else sessionStorage.removeItem(ACTIVE_KEY); }
  function mode() { return ui.mode[ui.scale]; }
  function addEvent(t, what, kind) { t.events = t.events || []; t.events.push({ at: Date.now(), what: what, who: user.name, kind: kind || '' }); }

  // ---------- target berat simulasi ----------
  function targetWeight() {
    var p = phase(), t = active();
    if (p === 'bruto' && t) {
      var key = 'g:' + t.id;
      if (ui.targetFor !== key) {
        var v = S.vehicle(t.plate);
        var tare = v && v.tareMin ? (v.tareMin + v.tareMax) / 2 : 3200;
        ui.target = Math.round((tare + 3800 + Math.random() * 4600) / 10) * 10;
        ui.targetFor = key; ui.stableMs = 0; ui.settleMs = 1800;
      }
    } else if (p === 'tara' && t) {
      var k2 = 't:' + t.id;
      if (ui.targetFor !== k2) {
        var v2 = S.vehicle(t.plate);
        ui.target = v2 && v2.tareMin ? Math.round((v2.tareMin + Math.random() * (v2.tareMax - v2.tareMin)) / 5) * 5 : 3200;
        if (t.id.slice(-3) === '047' && t.supplierId === 'SUP-00281') ui.target = 3210;
        ui.targetFor = k2; ui.stableMs = 0; ui.settleMs = 1800;
      }
    } else if (ui.targetFor !== 'empty') {
      ui.target = 0; ui.targetFor = 'empty'; ui.stableMs = 0; ui.settleMs = 600;
    }
    return ui.target;
  }

  // ---------- loop simulasi ----------
  function tick() {
    var target = targetWeight();
    var m = mode();
    var tol = settings().stabTol;
    if (m === 'terputus') {
      ui.reading = null; ui.stableMs = 0;
    } else {
      ui.lastData = Date.now();
      var prev = ui.reading == null ? target : ui.reading;
      var next;
      if (m === 'goyang') {
        next = target + Math.round((Math.random() - .5) * 80);
        ui.stableMs = 0;
      } else if (ui.settleMs > 0) {
        ui.settleMs -= TICK;
        next = Math.round(prev + (target - prev) * .55 + (Math.random() - .5) * 30);
        ui.stableMs = 0;
      } else {
        next = target + (Math.random() < .3 ? (Math.random() < .5 ? -1 : 1) * Math.round(Math.random() * Math.min(tol / 3, 4)) : 0);
        if (Math.abs(next - target) <= tol) ui.stableMs += TICK; else ui.stableMs = 0;
      }
      ui.reading = Math.max(0, next);
    }
    paintReadout();
  }

  function isStable() { return mode() === 'stabil' && ui.reading != null && ui.stableMs >= settings().stabSec * 1000; }
  function canCapture() { var p = phase(); return (p === 'bruto' || p === 'tara') && isStable() && ui.reading > 0; }

  function paintReadout() {
    var m = mode(), p = phase();
    var chip = $('#scale-chip'), readout = $('#readout'), fill = $('#stab-fill'), bar = $('#stab-bar');
    var stab = isStable();
    var secReq = settings().stabSec;
    var label, cls, chipText;
    if (m === 'terputus') { cls = 'off'; chipText = 'TERPUTUS'; label = 'Tidak ada sinyal dari indikator'; }
    else if (m === 'goyang') { cls = 'shaky'; chipText = 'TIDAK STABIL'; label = 'Masih bergerak — tunggu truk diam & sopir turun'; }
    else if (ui.settleMs > 0 || !stab) { cls = 'shaky'; chipText = 'MENSTABILKAN'; label = 'Menunggu stabil ' + (ui.stableMs / 1000).toFixed(1).replace('.', ',') + ' / ' + secReq + ' detik'; }
    else { cls = ''; chipText = 'STABIL'; label = 'Stabil ' + (ui.stableMs / 1000).toFixed(1).replace('.', ',') + ' detik'; }
    if (p === 'idle' || p === 'hasil' || p === 'sortasi') { if (m === 'stabil') { cls = 'idle'; chipText = p === 'sortasi' ? 'MENUNGGU BONGKAR' : 'JEMBATAN KOSONG'; } }
    chip.className = 'scale-chip ' + cls;
    $('#scale-chip-text').textContent = chipText;
    readout.className = 'readout ' + (m === 'terputus' ? 'off' : (m === 'goyang' || cls === 'shaky' ? 'shaky' : ''));
    $('#reading').textContent = ui.reading == null ? '– – – –' : f.num(ui.reading);
    var pct = m === 'terputus' ? 0 : Math.min(100, Math.round(ui.stableMs / (secReq * 1000) * 100));
    fill.style.width = pct + '%';
    bar.className = 'stab-bar' + (m !== 'stabil' || pct < 100 ? ' shaky' : '');
    bar.setAttribute('aria-valuenow', String(pct));
    $('#stab-label').textContent = (p === 'bruto' || p === 'tara') ? label : (m === 'terputus' ? label : 'Tidak ada pengambilan berat di tahap ini');
    $('#scale-meta').textContent = m === 'terputus' ? 'data terakhir ' + f.timeSec(ui.lastData) : 'data 0,2 dtk lalu · simulator demo';
    var btn = $('#capture-btn');
    if (btn) {
      var ok = canCapture();
      btn.disabled = !ok;
      var lbl = btn.querySelector('.lbl');
      if (lbl) lbl.textContent = (p === 'bruto' ? 'Kunci berat bruto' : 'Kunci berat tara') + (ok ? ' · ' + f.num(ui.reading) + ' kg' : '');
      var reason = $('#capture-reason');
      if (reason) {
        reason.className = 'scale-reason ' + (m === 'terputus' ? 'bad' : (ok ? '' : 'warn'));
        reason.textContent = m === 'terputus' ? 'Nonaktif — indikator tidak terhubung. Hubungkan ulang atau ajukan input manual.'
          : m === 'goyang' ? 'Tombol aktif otomatis setelah angka stabil.'
          : ok ? 'Siap. Berat dikunci bersama waktu, perangkat dan operator.'
          : 'Menunggu angka stabil selama ' + secReq + ' detik (±' + settings().stabTol + ' kg).';
      }
    }
    var man = $('#manual-btn');
    if (man) man.disabled = m !== 'terputus';
    if (p === 'tara') paintTicket();
  }

  // ---------- render bagian-bagian ----------
  function renderScaleSelect() {
    var devs = S.state.devices;
    ['t1', 't2'].forEach(function (id) {
      var b = document.querySelector('[data-scale="' + id + '"]');
      var d = devs.filter(function (x) { return x.id === id; })[0];
      var m = ui.mode[id];
      var dot = m === 'terputus' ? '#D9412F' : '#80B014';
      b.setAttribute('aria-checked', String(ui.scale === id));
      b.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:8px;background:' + dot + '"></span>' + esc(d.name) + ' · ' + (m === 'terputus' ? 'Terputus' : 'Terhubung');
    });
    $('#stab-rule').textContent = 'syarat: ±' + settings().stabTol + ' kg selama ' + settings().stabSec + ' detik';
  }

  function stageText() {
    var p = phase(), t = active();
    return {
      idle: 'Tidak ada truk di jembatan · pilih truk dari antrian atau tap kartu',
      bruto: 'Tahap 2 dari 6 · timbang truk bermuatan',
      sortasi: 'Tahap 3 dari 6 · truk bongkar, grader mencatat sortasi',
      tara: 'Tahap 4 dari 6 · timbang truk kosong setelah bongkar',
      hasil: 'Transaksi selesai ditimbang'
    }[p] + (t ? ' · ' + t.plate : '');
  }

  function renderActions() {
    var p = phase(), box = $('#scale-actions');
    if (p === 'bruto' || p === 'tara') {
      box.innerHTML = '<div class="capture-row">' +
        '<button type="button" class="btn btn-primary btn-xl" id="capture-btn" disabled><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span class="lbl">Kunci berat</span></button>' +
        '<button type="button" class="btn btn-xl btn-ondark" id="manual-btn" style="flex:0 1 auto;font-size:15px" disabled>Input manual</button>' +
        '</div><p class="scale-reason" id="capture-reason"></p>';
    } else if (p === 'hasil') {
      var t = resultTrx();
      var review = t.status === 'review';
      box.innerHTML = '<div class="result-box">' +
        '<span style="display:flex;flex-direction:column;gap:2px"><strong>' + (t.status === 'batal' ? 'Transaksi dibatalkan' : review ? 'Selesai ditimbang · perlu review Admin' : 'Selesai · tiket siap dicetak') + '</strong>' +
        '<span>' + esc(t.id) + ' · ' + esc(S.supplierName(t.supplierId)) + (t.status === 'batal' ? ' · ' + esc(t.cancelReason) : ' · total ' + f.rp(S.calc(t).total)) + '</span></span>' +
        '<span style="display:flex;flex-wrap:wrap;gap:8px">' +
          (t.status !== 'batal' ? '<button type="button" class="btn btn-ghost-dark btn-lg" style="background:transparent;color:#fff;box-shadow:inset 0 0 0 1.5px #4E7D70" id="print-btn">Cetak tiket</button>' : '') +
          '<button type="button" class="btn btn-primary btn-lg" id="next-btn">Truk berikutnya →</button>' +
        '</span></div>';
    } else if (p === 'sortasi') {
      box.innerHTML = '<p class="scale-reason">Bruto ' + f.kg(active().gross) + ' terkunci. Isi hasil sortasi di bawah, lalu timbang tara.</p>';
    } else {
      box.innerHTML = '<p class="scale-reason">Pilih truk dari daftar antrian untuk memulai, atau tekan <b>Tap kartu (simulasi)</b>.</p>';
    }
  }

  function renderPhaseArea() {
    var p = phase(), t = active(), m = mode(), area = $('#phase-area');
    var html = '';
    if (m === 'terputus' && (p === 'bruto' || p === 'tara' || p === 'idle')) {
      html += '<div class="notice bad" role="alert" style="flex-wrap:wrap;align-items:center;border-radius:20px;padding:18px 22px">' +
        '<span class="ic">!</span><span style="flex:1 1 320px"><strong>' + (ui.scale === 't1' ? 'Timbangan 01' : 'Timbangan 02') + ' berhenti mengirim data</strong>' +
        'Cek kabel data &amp; daya indikator → pastikan layar indikator menyala → tekan Hubungkan ulang. Masih gagal? Gunakan input manual (perlu review Admin).</span>' +
        '<button type="button" class="btn btn-danger btn-lg" id="reconnect-btn"' + (ui.reconnecting ? ' disabled' : '') + '>' + (ui.reconnecting ? 'Menghubungkan…' : 'Hubungkan ulang') + '</button></div>';
    }
    if (ui.manualOpen && m === 'terputus' && (p === 'bruto' || p === 'tara')) {
      html += '<form class="card" id="manual-form" novalidate style="box-shadow:inset 0 0 0 2px #F3C979">' +
        '<div class="card-head"><h2>Input berat ' + (p === 'bruto' ? 'bruto' : 'tara') + ' manual</h2><span class="chip chip-warn">DITANDAI MANUAL</span></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label for="m-val">Berat (kg)</label><input class="input input-lg" id="m-val" inputmode="numeric" placeholder="cth. ' + (p === 'bruto' ? '8420' : '3210') + '"><span class="field-error" id="m-val-err" hidden></span></div>' +
          '<div class="field"><label for="m-reason">Alasan</label><select class="input" id="m-reason"><option>Indikator terputus</option><option>Indikator rusak / error</option><option>Lainnya</option></select></div>' +
        '</div>' +
        '<div class="field"><label for="m-note">Catatan &amp; bukti</label><textarea class="input" id="m-note" rows="2" placeholder="cth. Angka dibaca dari layar indikator, foto terlampir"></textarea></div>' +
        '<p class="small muted-2">Transaksi dengan berat manual otomatis masuk antrian review Admin/Pemilik dan tiket diberi label MANUAL.</p>' +
        '<div class="form-actions"><button type="button" class="btn btn-outline" id="manual-close">Tutup</button><button type="submit" class="btn btn-dark">Simpan berat manual</button></div>' +
      '</form>';
    }
    if (p === 'sortasi' && t) {
      var types = S.activeDeductionTypes();
      html += '<form class="card" id="sort-form" novalidate>' +
        '<div class="card-head"><h2>Hasil sortasi · ' + esc(t.plate) + '</h2><span class="chip chip-info"><span class="dot"></span>Truk sedang bongkar</span></div>' +
        '<p class="card-sub">Isi persen potongan per jenis. Kosongkan bila tidak ada. Batas review total: ' + settings().reviewPot + '%.</p>' +
        '<div class="ded-grid">' + types.map(function (d) {
          var v = t.deductions && t.deductions[d.id] ? t.deductions[d.id] : '';
          return '<div class="field"><label for="d-' + d.id + '">' + esc(d.name) + ' (%)</label><input class="input" id="d-' + d.id + '" data-ded="' + d.id + '" inputmode="decimal" placeholder="0" value="' + esc(v === '' ? '' : String(v).replace('.', ',')) + '"></div>';
        }).join('') + '</div>' +
        '<div class="form-grid"><div class="field"><label for="grader">Grader</label><select class="input" id="grader">' +
          S.state.users.filter(function (u2) { return u2.role === 'operator'; }).map(function (u2) { return '<option' + (u2.name === 'Joko Susilo' ? ' selected' : '') + '>' + esc(u2.name) + '</option>'; }).join('') +
        '</select></div><div class="field"><span class="field-label">Total potongan</span><div class="input" style="display:flex;align-items:center;font-weight:600" id="ded-total">0%</div></div></div>' +
        '<p class="field-error" id="sort-err" hidden></p>' +
        '<div class="form-actions"><button type="button" class="btn btn-outline" id="park-btn">Tunda · timbang truk lain</button><button type="submit" class="btn btn-primary btn-lg">Simpan sortasi &amp; lanjut tara</button></div>' +
      '</form>';
    }
    area.innerHTML = html;
    area.style.display = html ? '' : 'none';
    if (p === 'sortasi') updateDedTotal();
  }

  function renderJourney() {
    var t = active() || resultTrx();
    var p = phase();
    $('#journey-title').textContent = t ? 'Perjalanan truk ' + t.plate : 'Perjalanan truk';
    $('#cancel-btn').hidden = !active();
    var steps = [['Gerbang', ''], ['Bruto', ''], ['Sortasi', ''], ['Tara', ''], ['Review', ''], ['Nota', '']];
    var st = ['', '', '', '', '', ''];
    if (t) {
      st[0] = 'done'; steps[0][1] = 'RFID ' + f.time(t.at);
      if (t.gross != null) { st[1] = 'done'; steps[1][1] = f.kg(t.gross) + ' · ' + f.time(t.grossAt); } else if (t.status === 'jalan') { st[1] = 'current'; steps[1][1] = 'sekarang'; }
      if (t.sortAt) { st[2] = 'done'; steps[2][1] = 'potongan ' + f.pct(S.sumDed(t.deductions)); } else if (p === 'sortasi') { st[2] = 'current'; steps[2][1] = 'sekarang'; }
      if (t.tare != null) { st[3] = 'done'; steps[3][1] = f.kg(t.tare) + ' · ' + f.time(t.tareAt); } else if (p === 'tara') { st[3] = 'current'; steps[3][1] = 'sekarang'; }
      if (t.status === 'selesai') { st[4] = 'done'; steps[4][1] = t.flags && t.flags.length ? 'disetujui' : 'lolos otomatis'; st[5] = 'current'; steps[5][1] = 'cetak & bayar'; }
      if (t.status === 'review') { st[4] = 'current'; steps[4][1] = 'menunggu Admin'; }
      if (t.status === 'batal') { st[3] = st[3] || 'bad'; steps[3][1] = steps[3][1] || 'dibatalkan'; }
    }
    $('#journey').innerHTML = steps.map(function (s, i) {
      var mark = st[i] === 'done' ? '✓' : st[i] === 'current' && i >= 1 && i <= 3 ? '<svg width="22" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 6h12v10H1z"/><path d="M13 9h4l4 4v3h-8"/><circle cx="5" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>' : st[i] === 'bad' ? '×' : String(i + 1);
      return '<li class="' + st[i] + '"><span class="node">' + mark + '</span><span class="t">' + s[0] + '</span><span class="d">' + esc(s[1] || (st[i] ? '' : 'belum')) + '</span></li>';
    }).join('');
  }

  function renderRfid() {
    var t = active() || resultTrx();
    var box = $('#rfid'), info = $('#vinfo');
    if (!t) {
      box.innerHTML = '<div class="rfid-card empty-card"><img class="watermark" src="../assets/img/costcare-mark.png" alt="" style="right:-36px;top:-40px;width:170px;opacity:.12">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><span class="label">KARTU SUPPLIER · RFID</span></div>' +
        '<div><div class="name">Menunggu kartu</div><div class="ids">Tap kartu di pembaca, atau pilih dari antrian</div></div><span></span></div>';
      info.innerHTML = '<div><dt>Harga TBS aktif</dt><dd>' + f.rp(S.activePrice().price) + '/kg</dd></div><div><dt>Transaksi hari ini</dt><dd>' + S.trxOnDay(S.todayKey()).filter(function (x) { return x.status !== 'batal'; }).length + '</dd></div>';
      return;
    }
    var s = S.supplier(t.supplierId);
    var v = S.vehicle(t.plate);
    var st = s ? s.status : 'baru';
    box.innerHTML = '<div class="rfid-card st-' + st + '"><img class="watermark" src="../assets/img/costcare-mark.png" alt="" style="right:-36px;top:-40px;width:170px;opacity:.16">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><span class="label">KARTU SUPPLIER · RFID</span>' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CFE3DB" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8.5 8a6 6 0 0 1 0 8"/><path d="M12 5a10 10 0 0 1 0 14"/><path d="M5 10.5a2.5 2.5 0 0 1 0 3"/></svg></div>' +
      '<div style="display:flex;align-items:center;gap:14px"><span class="chipcard" aria-hidden="true"></span><span><div class="name">' + esc(s ? s.name : 'Tanpa identitas') + '</div><div class="ids">' + esc((s ? s.id : '—') + ' · ' + (s && s.rfid ? s.rfid : 'identifikasi manual')) + '</div></span></div>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px">' + U.plate(t.plate) +
      '<span class="chip chip-lime">✓ ' + (s && s.rfid ? 'Terverifikasi · tap ' + f.time(t.at) : 'Diidentifikasi operator') + '</span></div></div>';
    var range = v && v.tareMin ? f.num(v.tareMin) + ' – ' + f.num(v.tareMax) + ' kg' : 'belum ada riwayat';
    var check = '';
    if (v && v.tareMin && (t.tare != null || (phase() === 'tara' && ui.reading))) {
      var tv = t.tare != null ? t.tare : ui.reading;
      var dev = S.state.settings.reviewTara / 100;
      var ok = tv >= v.tareMin * (1 - dev) && tv <= v.tareMax * (1 + dev);
      check = '<dd class="xs ' + (ok ? 'ok-text' : 'warn-text') + '" style="font-weight:500">' + (ok ? '✓ tara dalam rentang' : '! tara di luar rentang') + '</dd>';
    }
    info.innerHTML = '<div><dt>Asal kebun</dt><dd>' + esc(t.origin || '—') + '</dd></div><div><dt>Tara riwayat truk</dt><dd>' + range + '</dd>' + check + '</div>';
  }

  function paintTicket() {
    var t = active() || resultTrx();
    var card = $('#ticket-card');
    if (!t) {
      card.innerHTML = '<span class="ticket-title">TIKET TIMBANG</span>' + U.emptyState('Belum ada transaksi', 'Tiket muncul setelah truk diidentifikasi.');
      return;
    }
    var p = phase();
    var preview = t;
    var badge = '';
    if (p === 'tara') {
      preview = JSON.parse(JSON.stringify(t));
      if (isStable()) { preview.tare = ui.reading; badge = U.chip('Pratinjau', 'chip-info'); }
      else badge = U.chip('Menunggu tara', 'chip-warn');
    } else if (p === 'bruto' || p === 'sortasi') badge = U.chip('Berjalan', 'chip-info');
    else badge = U.trxChip(t);
    if (!preview.rules) preview.rules = S.state.settings;
    card.innerHTML = U.ticketHTML(preview, { badge: badge });
  }

  function renderQueue() {
    var q = S.state.queue;
    var waiting = S.state.transactions.filter(function (t) { return t.status === 'jalan' && t.id !== ui.activeId; });
    $('#queue-chip').textContent = 'Antrian: ' + q.length + ' truk';
    var html = '';
    if (waiting.length) {
      html += '<span class="xs muted" style="font-weight:600;letter-spacing:.04em">SEDANG BONGKAR · MENUNGGU TARA</span>' + waiting.map(function (t) {
        return '<div class="queue-item"><span class="who">' + U.plate(t.plate) + '<span class="small"><b>' + esc(S.supplierName(t.supplierId)) + '</b><br><span class="muted xs">' + esc(t.id) + (t.gross != null ? ' · bruto ' + f.kg(t.gross) : '') + '</span></span></span>' +
          '<button type="button" class="btn btn-sm btn-primary" data-resume="' + t.id + '">Lanjutkan</button></div>';
      }).join('');
    }
    html += '<span class="xs muted" style="font-weight:600;letter-spacing:.04em;margin-top:4px">ANTRIAN GERBANG</span>';
    if (!q.length) html += '<p class="small muted-2" style="padding:6px 2px">Tidak ada truk di gerbang.</p>';
    html += q.map(function (it) {
      var s = it.supplierId ? S.supplier(it.supplierId) : null;
      return '<div class="queue-item"><span class="who">' + U.plate(it.plate) + '<span class="small">' + (s ? '<b>' + esc(s.name) + '</b>' : '<b class="warn-text">Belum tap kartu</b>') + '<br><span class="muted xs">tiba ' + f.time(it.at) + '</span></span></span>' +
        '<button type="button" class="btn btn-sm ' + (s ? 'btn-dark' : 'btn-outline') + '" data-start="' + it.id + '">' + (s ? 'Mulai timbang' : 'Identifikasi') + '</button></div>';
    }).join('');
    html += '<button type="button" class="btn btn-sm btn-outline" id="arrive-btn" style="align-self:flex-start;margin-top:4px">+ Truk tiba (simulasi)</button>';
    $('#queue').innerHTML = html;
  }

  function renderHeader() {
    var t = active() || resultTrx();
    $('#trx-meta').textContent = t ? t.id : 'Belum ada transaksi aktif';
    $('#stage-text').textContent = stageText();
  }

  function renderAll() {
    renderScaleSelect();
    renderHeader();
    renderActions();
    renderPhaseArea();
    renderJourney();
    renderRfid();
    paintTicket();
    renderQueue();
    document.querySelectorAll('[data-sim]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sim') === mode())); });
    paintReadout();
    U.refreshNavBadge();
  }

  // ---------- aksi ----------
  function startFromQueue(item, supplierId, plateVal) {
    if (active()) { U.toast('Selesaikan atau tunda transaksi aktif dulu.', 'warn'); return; }
    var s = S.supplier(supplierId);
    if (s && s.status === 'blokir') { U.toast('Kartu ' + s.rfid + ' diblokir — transaksi ditolak.', 'bad'); S.audit('Transaksi', 'Tap kartu diblokir ditolak: ' + s.name, user.name); S.commit(); return; }
    var nid = S.nextTrxId();
    var price = S.activePrice();
    var t = {
      id: nid.id, day: nid.day, seq: nid.seq, at: Date.now(), supplierId: supplierId, plate: plateVal, origin: s ? s.origin : '',
      scale: ui.scale === 't1' ? '01' : '02', operator: user.name,
      gross: null, grossAt: null, grossManual: false, tare: null, tareAt: null, tareManual: false,
      deductions: {}, grader: '', sortAt: null, price: price ? price.price : 0,
      rules: { basis: S.state.settings.basis, wround: S.state.settings.wround, rround: S.state.settings.rround },
      status: 'jalan', flags: [], reviewedBy: '', reviewedAt: null, cancelReason: '', events: []
    };
    addEvent(t, s && s.rfid && item && item.rfid ? 'Supplier dikenali lewat kartu RFID' : 'Supplier diidentifikasi manual oleh operator');
    S.state.transactions.push(t);
    if (item) S.state.queue = S.state.queue.filter(function (x) { return x.id !== item.id; });
    if (s && !S.vehicle(plateVal)) S.state.vehicles.push({ plate: plateVal, type: 'Belum diisi', supplierId: s.id, tareMin: null, tareMax: null, status: 'baru' });
    S.audit('Transaksi', t.id + ' dibuat · ' + (s ? s.name : '') + ' · ' + plateVal, user.name);
    S.commit();
    ui.resultId = null; ui.manualOpen = false;
    setActive(t.id);
    U.toast(t.id + ' dimulai · timbang bruto');
    renderAll();
  }

  function identifyDialog(item) {
    var opts = S.state.suppliers.filter(function (s) { return s.status !== 'blokir'; }).sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (s) { return '<option value="' + s.id + '">' + esc(s.name + ' · ' + s.id) + '</option>'; }).join('');
    U.confirm({
      title: 'Identifikasi supplier',
      html: '<p>Truk ' + esc(item ? item.plate : '') + ' belum tap kartu. Pilih supplier secara manual — tercatat di audit.</p>' +
        '<div class="field"><label for="idf-sup">Supplier</label><select class="input" id="idf-sup">' + opts + '</select></div>' +
        '<div class="field"><label for="idf-plate">Plat nomor</label><input class="input" id="idf-plate" value="' + esc(item ? item.plate : '') + '"><span class="field-error" id="idf-err" hidden>Isi plat nomor.</span></div>',
      confirmLabel: 'Mulai timbang',
      validate: function (box) { var ok = box.querySelector('#idf-plate').value.trim().length >= 3; box.querySelector('#idf-err').hidden = ok; return ok; },
      collect: function (box) { return { sid: box.querySelector('#idf-sup').value, plate: box.querySelector('#idf-plate').value.trim().toUpperCase() }; }
    }).then(function (r) { if (r) startFromQueue(item, r.sid, r.plate); });
  }

  function tapDialog() {
    var list = S.state.suppliers.filter(function (s) { return s.rfid; });
    U.confirm({
      title: 'Simulasi tap kartu RFID',
      html: '<p>Pilih kartu yang ditempel di pembaca. Kartu yang diblokir akan ditolak.</p>' +
        '<div class="field"><label for="tap-card">Kartu</label><select class="input" id="tap-card">' + list.map(function (s) {
          return '<option value="' + s.id + '">' + esc(s.rfid + ' · ' + s.name + (s.status === 'blokir' ? ' (diblokir)' : '')) + '</option>';
        }).join('') + '</select></div>',
      confirmLabel: 'Tap',
      collect: function (box) { return box.querySelector('#tap-card').value; }
    }).then(function (sid) {
      if (!sid) return;
      var s = S.supplier(sid);
      if (s.status === 'blokir') { U.toast('Kartu ' + s.rfid + ' diblokir — tidak bisa dipakai.', 'bad'); S.audit('Perangkat', 'Tap kartu diblokir ditolak: ' + s.rfid, 'Pembaca RFID'); S.commit(); return; }
      var v = S.vehiclesOf(sid)[0];
      S.state.queue.push({ id: 'Q' + Date.now(), supplierId: sid, plate: v ? v.plate : 'BM 0000 ' + U.initials(s.name), at: Date.now(), rfid: true });
      S.commit();
      U.toast(s.name + ' masuk antrian');
      renderQueue();
      $('#queue-chip').textContent = 'Antrian: ' + S.state.queue.length + ' truk';
    });
  }

  function lockWeight(value, manual, note) {
    var t = active(); if (!t) return;
    var p = phase();
    if (p === 'bruto') {
      t.gross = value; t.grossAt = Date.now(); t.grossManual = !!manual;
      addEvent(t, 'Bruto ' + f.kg(value) + (manual ? ' diinput MANUAL' : ' diambil otomatis · Timbangan ' + t.scale), manual ? 'warn' : '');
      if (manual) t.manualNote = note;
      S.audit('Transaksi', t.id + ' · bruto ' + f.kg(value) + (manual ? ' MANUAL' : ''), user.name);
      U.toast('Bruto ' + f.kg(value) + ' terkunci');
    } else if (p === 'tara') {
      t.tare = value; t.tareAt = Date.now(); t.tareManual = !!manual;
      if (manual) t.manualNote = note;
      addEvent(t, 'Tara ' + f.kg(value) + (manual ? ' diinput MANUAL' : ' diambil otomatis · Timbangan ' + t.scale), manual ? 'warn' : '');
      t.flags = S.evaluateFlags(t);
      if (t.flags.length) {
        t.status = 'review';
        addEvent(t, 'Ditandai perlu review (' + t.flags.join(', ') + ')', 'warn');
        S.audit('Transaksi', t.id + ' ditandai review (' + t.flags.join(', ') + ')', 'Sistem');
      } else {
        t.status = 'selesai';
        addEvent(t, 'Lolos aturan otomatis · tiket siap', 'ok');
        var c = S.calc(t);
        S.state.invoices.push({ id: 'N-' + t.id.slice(4), trxId: t.id, supplierId: t.supplierId, total: c.total, at: Date.now(), payments: [], dispute: false, disputeNote: '' });
      }
      var v = S.vehicle(t.plate);
      if (v && !v.tareMin && !manual) { v.tareMin = value - 20; v.tareMax = value + 20; v.status = 'aktif'; }
      S.audit('Transaksi', t.id + ' · tara ' + f.kg(value) + (manual ? ' MANUAL' : '') + ' · ' + (t.status === 'review' ? 'perlu review' : 'selesai'), user.name);
      ui.resultId = t.id;
      setActive(null);
      U.toast(t.status === 'review' ? 'Tara terkunci · diteruskan ke Admin untuk review' : 'Selesai · total ' + f.rp(S.calc(t).total), t.status === 'review' ? 'warn' : '');
    }
    S.commit();
    ui.manualOpen = false;
    renderAll();
  }

  function confirmCapture() {
    if (!canCapture()) return;
    var p = phase(), val = ui.reading, t = active();
    U.confirm({
      title: 'Kunci berat ' + (p === 'bruto' ? 'bruto' : 'tara') + '?',
      html: '<div style="display:flex;align-items:baseline;gap:10px;padding:18px 20px;border-radius:18px;background:var(--forest);color:#fff"><span style="font-size:44px;font-weight:600;letter-spacing:-.03em">' + f.num(val) + '</span><span style="font-size:18px;font-weight:600;color:var(--lime)">kg</span><span style="margin-left:auto;font-size:13px;color:var(--on-dark)">stabil · Timbangan ' + t.scale + '</span></div>' +
        '<p>Disimpan ke ' + esc(t.id) + ' dengan waktu, perangkat dan operator. Setelah dikunci, perubahan hanya lewat koreksi yang disetujui.</p>',
      confirmLabel: 'Ya, kunci'
    }).then(function (ok) { if (ok) lockWeight(val, false); });
  }

  function cancelDialog() {
    var t = active(); if (!t) return;
    U.confirm({
      title: 'Batalkan transaksi ini?',
      html: '<p>' + esc(t.id) + ' tidak dihapus. Statusnya menjadi Dibatalkan dan alasannya tercatat di audit.</p>' +
        '<div class="field"><label for="c-reason">Alasan</label><select class="input" id="c-reason"><option>Supplier membatalkan penjualan</option><option>Salah identifikasi supplier/kendaraan</option><option>Transaksi ganda</option><option>Lainnya</option></select></div>',
      confirmLabel: 'Batalkan transaksi', cancelLabel: 'Kembali', danger: true,
      collect: function (box) { return box.querySelector('#c-reason').value; }
    }).then(function (reason) {
      if (!reason) return;
      t.status = 'batal'; t.cancelReason = reason; t.cancelledBy = user.name; t.cancelledAt = Date.now();
      addEvent(t, 'Dibatalkan — ' + reason, 'bad');
      S.audit('Transaksi', t.id + ' dibatalkan · ' + reason, user.name);
      S.commit();
      ui.resultId = t.id; setActive(null);
      U.toast(t.id + ' dibatalkan', 'warn');
      renderAll();
    });
  }

  function reconnect() {
    ui.reconnecting = true; renderPhaseArea();
    setTimeout(function () {
      ui.reconnecting = false;
      ui.mode[ui.scale] = 'stabil'; ui.stableMs = 0; ui.settleMs = 1200;
      var d = S.state.devices.filter(function (x) { return x.id === ui.scale; })[0];
      d.status = 'ok'; d.last = Date.now();
      S.audit('Perangkat', d.name + ' terhubung kembali', user.name);
      S.commit();
      ui.manualOpen = false;
      U.toast(d.name + ' terhubung kembali');
      renderAll();
    }, 1400);
  }

  function updateDedTotal() {
    var tot = 0;
    document.querySelectorAll('[data-ded]').forEach(function (i) { var v = U.parseNum(i.value); if (!isNaN(v)) tot += v; });
    var el = $('#ded-total'); if (!el) return;
    tot = Math.round(tot * 100) / 100;
    el.textContent = f.pct(tot) + (tot > settings().reviewPot ? ' · akan direview' : '');
    el.style.color = tot > settings().reviewPot ? 'var(--warn)' : '';
  }

  // ---------- event ----------
  var main = $('#main');
  U.on(main, 'click', '[data-scale]', function (e, el) {
    ui.scale = el.getAttribute('data-scale'); ui.stableMs = 0; ui.settleMs = 800; ui.manualOpen = false;
    renderAll();
  });
  U.on(main, 'click', '[data-sim]', function (e, el) {
    var m = el.getAttribute('data-sim');
    if (ui.scale === 't2' && S.state.devices.filter(function (d) { return d.id === 't2'; })[0].status !== 'ok' && m !== 'terputus') { U.toast('Timbangan 02 masih terputus — tekan Hubungkan ulang.', 'warn'); return; }
    ui.mode[ui.scale] = m; ui.stableMs = 0;
    if (m === 'stabil') ui.settleMs = 1000;
    if (m !== 'terputus') ui.manualOpen = false;
    renderAll();
  });
  U.on(main, 'click', '#capture-btn', confirmCapture);
  U.on(main, 'click', '#manual-btn', function () { ui.manualOpen = true; renderPhaseArea(); var i = $('#m-val'); if (i) i.focus(); });
  U.on(main, 'click', '#manual-close', function () { ui.manualOpen = false; renderPhaseArea(); });
  U.on(main, 'click', '#reconnect-btn', reconnect);
  U.on(main, 'click', '#cancel-btn', cancelDialog);
  U.on(main, 'click', '#next-btn', function () { ui.resultId = null; renderAll(); });
  U.on(main, 'click', '#print-btn', function () { var t = resultTrx(); if (t) U.printTicket(t); });
  U.on(main, 'click', '#tap-btn', tapDialog);
  U.on(main, 'click', '#arrive-btn', function () {
    var pool = S.state.suppliers.filter(function (s) { return s.status === 'ok' && !S.state.queue.some(function (q) { return q.supplierId === s.id; }); });
    var s = pool[Math.floor(Math.random() * pool.length)];
    var v = S.vehiclesOf(s.id)[0];
    S.state.queue.push({ id: 'Q' + Date.now(), supplierId: s.id, plate: v ? v.plate : 'BM 0000 XX', at: Date.now(), rfid: true });
    S.commit(); U.toast(s.name + ' tiba di gerbang'); renderQueue();
  });
  U.on(main, 'click', '[data-start]', function (e, el) {
    var item = S.state.queue.filter(function (q) { return q.id === el.getAttribute('data-start'); })[0];
    if (!item) return;
    if (item.supplierId) startFromQueue(item, item.supplierId, item.plate); else identifyDialog(item);
  });
  U.on(main, 'click', '[data-resume]', function (e, el) {
    if (active()) { U.toast('Tunda transaksi aktif dulu.', 'warn'); return; }
    ui.resultId = null; setActive(el.getAttribute('data-resume')); ui.manualOpen = false; renderAll();
  });
  U.on(main, 'click', '#park-btn', function () {
    var t = active(); if (!t) return;
    addEvent(t, 'Ditunda · truk bongkar, timbang tara nanti');
    S.commit(); setActive(null); U.toast(t.plate + ' menunggu tara'); renderAll();
  });
  U.on(main, 'input', '[data-ded]', updateDedTotal);
  U.on(main, 'submit', '#sort-form', function (e) {
    e.preventDefault();
    var t = active(); if (!t) return;
    var ded = {}, bad = false, total = 0;
    document.querySelectorAll('[data-ded]').forEach(function (i) {
      var raw = i.value.trim();
      if (!raw) { i.removeAttribute('aria-invalid'); return; }
      var v = U.parseNum(raw);
      if (isNaN(v) || v < 0 || v > 15) { i.setAttribute('aria-invalid', 'true'); bad = true; return; }
      i.removeAttribute('aria-invalid');
      if (v > 0) { ded[i.getAttribute('data-ded')] = v; total += v; }
    });
    var err = $('#sort-err');
    if (bad || total > 30) { err.hidden = false; err.textContent = bad ? 'Persen potongan harus angka 0–15 per jenis.' : 'Total potongan lebih dari 30% — periksa kembali.'; return; }
    err.hidden = true;
    t.deductions = ded; t.grader = $('#grader').value; t.sortAt = Date.now();
    addEvent(t, 'Sortasi dicatat · potongan ' + f.pct(S.sumDed(ded)) + ' (' + t.grader + ')');
    S.audit('Transaksi', t.id + ' · sortasi ' + f.pct(S.sumDed(ded)), t.grader);
    S.commit();
    U.toast('Sortasi tersimpan · timbang tara');
    renderAll();
  });
  U.on(main, 'submit', '#manual-form', function (e) {
    e.preventDefault();
    var input = $('#m-val'), err = $('#m-val-err');
    var v = U.parseNum(input.value);
    var t = active(); var p = phase();
    var msg = '';
    if (isNaN(v) || v <= 0) msg = 'Isi berat dalam kg.';
    else if (v < 500 || v > 40000) msg = 'Berat harus antara 500 dan 40.000 kg.';
    else if (p === 'tara' && t.gross != null && v >= t.gross) msg = 'Tara harus lebih kecil dari bruto (' + f.kg(t.gross) + ').';
    if (msg) { err.textContent = msg; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    var note = $('#m-reason').value + ($('#m-note').value.trim() ? ' — ' + $('#m-note').value.trim() : '');
    lockWeight(Math.round(v), true, note);
  });

  // jam
  function clock() { $('#clock').textContent = f.dateLong(Date.now()) + ' · ' + f.time(Date.now()) + ' WIB'; }
  clock(); setInterval(clock, 15000);

  if (ui.activeId && !active()) setActive(null);
  renderAll();
  setInterval(tick, TICK);
})();
