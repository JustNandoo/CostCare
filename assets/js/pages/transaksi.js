/* CostCare — Transaksi: daftar, filter, detail, review, koreksi, cetak & ekspor. */
(function () {
  'use strict';
  var S = CC.store, U = CC.ui, f = U.fmt, esc = U.esc, $ = U.$;
  var user = U.boot('transaksi');
  if (!user) return;

  var PAGE = 15;
  var params = new URLSearchParams(location.search);
  var st = {
    q: '', range: 'hari', op: '', tab: params.get('status') || 'semua', page: 1,
    sel: params.get('id') || null
  };
  if (st.sel) {
    var t0 = S.trx(st.sel);
    if (t0) { var age = (S.startOfDay(Date.now()) - S.startOfDay(t0.at)) / S.DAY; st.range = age === 0 ? 'hari' : age === 1 ? 'kemarin' : age < 7 ? '7' : '30'; }
  }
  if (st.tab === 'review') st.range = '30';
  if (params.get('q')) { st.q = params.get('q'); st.range = '30'; $('#q').value = st.q; }
  $('#range').value = st.range;

  // operator
  var ops = {};
  S.state.transactions.forEach(function (t) { ops[t.operator] = 1; });
  $('#op').innerHTML += Object.keys(ops).sort().map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('');

  function filtered(ignoreTab) {
    var r = S.periodRange(st.range);
    var q = st.q.trim().toLowerCase();
    return S.state.transactions.filter(function (t) {
      if (t.at < r.from || t.at >= r.to) return false;
      if (st.op && t.operator !== st.op) return false;
      if (!ignoreTab && st.tab !== 'semua' && t.status !== st.tab) return false;
      if (q) {
        var s = S.supplier(t.supplierId);
        var hay = [t.id, t.plate, s ? s.name : '', s ? s.id : ''].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return b.at - a.at; });
  }

  function renderTabs() {
    var all = filtered(true);
    var n = { semua: all.length, review: 0, jalan: 0, selesai: 0, batal: 0 };
    all.forEach(function (t) { n[t.status]++; });
    var tabs = [['semua', 'Semua'], ['review', 'Perlu review'], ['jalan', 'Berjalan'], ['selesai', 'Selesai'], ['batal', 'Dibatalkan']];
    $('#tabs').innerHTML = tabs.map(function (x) {
      return '<button type="button" role="tab" class="pilltab' + (x[0] === 'review' ? ' warn' : '') + '" data-tab="' + x[0] + '" aria-selected="' + (st.tab === x[0]) + '">' + x[1] + '<span class="n">' + n[x[0]] + '</span></button>';
    }).join('');
  }

  function renderList() {
    var list = filtered(false);
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (st.page > pages) st.page = pages;
    var slice = list.slice((st.page - 1) * PAGE, st.page * PAGE);
    if (!st.sel && list.length) st.sel = list[0].id;
    $('#subtitle').textContent = S.periodRange(st.range).label.replace(/^./, function (c) { return c.toUpperCase(); }) + ' · ' + list.length + ' transaksi';
    if (!list.length) {
      $('#list').innerHTML = U.emptyState('Tidak ada transaksi yang cocok', 'Coba kata kunci lain, ganti periode, atau ganti status.', '<button type="button" class="btn btn-teal btn-pill" id="clear-btn" style="margin-top:4px">Hapus filter</button>');
    } else {
      $('#list').innerHTML = slice.map(function (t) {
        var c = S.calc(t);
        var sel = t.id === st.sel;
        var flag = t.status === 'review' && t.flags.length ? ' <span class="chip chip-sm chip-warn" style="margin-left:4px">' + esc(t.flags.join(' · ')) + '</span>' : '';
        return '<button type="button" class="list-row" data-id="' + t.id + '" aria-pressed="' + sel + '">' +
          '<span class="c-time"><b style="font-size:15px;font-weight:600">' + f.time(t.at) + '</b><span class="mono xs muted">' + esc(t.id.slice(-7)) + '</span></span>' +
          '<span class="c-main"><b style="font-size:14.5px;font-weight:600">' + esc(S.supplierName(t.supplierId)) + flag + '</b><span style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' + U.plate(t.plate, true) + '<span class="xs muted">' + esc((t.origin || '').split(',')[0]) + ' · Timb. ' + esc(t.scale) + ' · ' + esc(t.operator) + '</span></span></span>' +
          '<span class="c-amt"><b style="font-size:15px;font-weight:600">' + f.rp(c.total) + '</b><span class="xs muted">netto ' + f.kg(c.netto) + '</span></span>' +
          '<span class="c-st">' + U.trxChip(t) + '</span></button>';
      }).join('');
    }
    $('#count').textContent = list.length ? 'Menampilkan ' + ((st.page - 1) * PAGE + 1) + '–' + Math.min(st.page * PAGE, list.length) + ' dari ' + list.length : '';
    $('#pager').innerHTML = pages > 1 ? '<button type="button" class="btn btn-sm btn-outline" data-page="' + (st.page - 1) + '"' + (st.page === 1 ? ' disabled' : '') + ' aria-label="Halaman sebelumnya">‹</button><span class="small">Hal. ' + st.page + ' / ' + pages + '</span><button type="button" class="btn btn-sm btn-outline" data-page="' + (st.page + 1) + '"' + (st.page === pages ? ' disabled' : '') + ' aria-label="Halaman berikutnya">›</button>' : '';
  }

  function timeline(t) {
    var ev = (t.events || []).slice();
    var hasCore = ev.some(function (e) { return /^Bruto/.test(e.what); });
    var out = [];
    if (!hasCore) {
      out.push({ at: t.at, what: 'Supplier dikenali lewat kartu RFID', who: t.operator });
      if (t.gross != null) out.push({ at: t.grossAt, what: 'Bruto ' + f.kg(t.gross) + (t.grossManual ? ' diinput MANUAL' : ' diambil otomatis · Timbangan ' + t.scale), who: t.operator, kind: t.grossManual ? 'warn' : '' });
      if (t.sortAt) out.push({ at: t.sortAt, what: 'Sortasi dicatat · potongan ' + f.pct(S.sumDed(t.deductions)), who: t.grader || 'Grader' });
      if (t.tare != null) out.push({ at: t.tareAt, what: 'Tara ' + f.kg(t.tare) + (t.tareManual ? ' diinput MANUAL' : ' diambil otomatis'), who: t.operator, kind: t.tareManual ? 'warn' : '' });
      if (t.flags.length && t.tareAt) out.push({ at: t.tareAt + 1000, what: 'Ditandai perlu review (' + t.flags.join(', ') + ')', who: 'Sistem', kind: 'warn' });
      if (t.status === 'selesai' && !t.flags.length && t.tareAt) out.push({ at: t.tareAt + 2000, what: 'Lolos aturan otomatis · tiket siap', who: 'Sistem', kind: 'ok' });
      if (t.status === 'selesai' && t.reviewedBy && !ev.some(function (e) { return /Disetujui/.test(e.what); })) out.push({ at: t.reviewedAt, what: 'Disetujui setelah review', who: t.reviewedBy, kind: 'ok' });
      if (t.status === 'batal' && !ev.some(function (e) { return /Dibatalkan/.test(e.what); })) out.push({ at: t.cancelledAt || t.at, what: 'Dibatalkan — ' + t.cancelReason, who: t.cancelledBy || t.operator, kind: 'bad' });
      ev = ev.filter(function (e) { return !/kartu RFID|diidentifikasi manual/.test(e.what); });
    }
    var inv = S.invoiceOfTrx(t.id);
    if (inv) inv.payments.forEach(function (p) { out.push({ at: p.at, what: 'Pembayaran ' + f.rp(p.amount) + ' · ' + p.method, who: p.by, kind: 'ok' }); });
    if (t.status === 'jalan') out.push({ at: Date.now(), what: t.gross == null ? 'Menunggu berat bruto' : !t.sortAt ? 'Menunggu sortasi' : 'Menunggu berat tara', who: 'Timbang Langsung', kind: 'info' });
    return out.concat(ev).filter(function (e) { return e.at; }).sort(function (a, b) { return a.at - b.at; });
  }

  function renderDetail() {
    var box = $('#detail');
    var t = st.sel ? S.trx(st.sel) : null;
    if (!t) { box.innerHTML = '<div class="card">' + U.emptyState('Pilih transaksi', 'Klik salah satu transaksi untuk melihat rincian.') + '</div>'; return; }
    var s = S.supplier(t.supplierId);
    var inv = S.invoiceOfTrx(t.id);
    var pend = S.state.corrections.filter(function (c) { return c.trxId === t.id && c.status === 'menunggu'; });
    var paid = inv ? S.paidOf(inv) : 0;
    var html = '<div class="card" style="gap:16px">' +
      '<div class="card-head" style="align-items:flex-start"><div style="display:flex;flex-direction:column;gap:4px"><span class="mono small muted">' + esc(t.id) + '</span>' +
      '<h2 style="font-size:22px;letter-spacing:-.01em">' + esc(s ? s.name : '—') + '</h2>' +
      '<span class="small muted-2">' + esc((s ? s.id : '') + ' · ' + t.plate + ' · kebun ' + (t.origin || '—')) + '</span></div>' + U.trxChip(t) + '</div>';

    if (t.status === 'review') {
      html += t.flags.map(function (fl) {
        var tx = S.FLAG_TEXT[fl] || ['Perlu review', ''];
        var extra = fl === 'R-02' ? ' Total ' + f.pct(S.sumDed(t.deductions)) + ', batas ' + S.state.settings.reviewPot + '%.' : fl === 'R-01' && t.manualNote ? ' ' + t.manualNote + '.' : '';
        return '<div class="notice warn" role="note"><span class="ic">!</span><span><strong>' + esc(tx[0]) + ' (' + fl + ')</strong>' + esc(tx[1] + '.' + extra) + '</span></div>';
      }).join('');
    }
    if (t.status === 'batal') html += '<div class="notice bad"><span class="ic">×</span><span><strong>Dibatalkan</strong>' + esc(t.cancelReason + (t.cancelledBy ? ' · oleh ' + t.cancelledBy : '')) + '</span></div>';
    pend.forEach(function (c) {
      html += '<div class="notice info"><span class="ic">i</span><span style="flex:1"><strong>Koreksi menunggu persetujuan</strong>' + esc(c.label + ': ' + c.fromText + ' → ' + c.toText + ' · ' + c.reason + ' (oleh ' + c.by + ')') +
        (U.allowed('approveCorrection', user) ? '<span style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn btn-sm btn-primary" data-corr-ok="' + c.id + '">Setujui koreksi</button><button type="button" class="btn btn-sm btn-outline" data-corr-no="' + c.id + '">Tolak</button></span>' : '') + '</span></div>';
    });

    html += '<div class="panel" style="--cut-bg:#fff">' + U.ticketHTML(t, { badge: inv ? U.invChip(inv) : '' }) + '</div>';

    // aksi
    var acts = [];
    if (t.status === 'review' && U.allowed('approveTrx', user)) acts.push('<button type="button" class="btn btn-primary btn-lg" id="approve-btn" style="flex:1 1 200px">Setujui transaksi</button>');
    if ((t.status === 'review' || (t.status === 'selesai' && paid === 0)) && U.allowed('requestCorrection', user) && !pend.length) acts.push('<button type="button" class="btn btn-outline btn-lg" id="correct-btn" style="flex:1 1 160px">Ajukan koreksi</button>');
    if (t.status === 'selesai' || t.status === 'review') acts.push('<button type="button" class="btn ' + (t.status === 'selesai' ? 'btn-dark' : 'btn-outline') + ' btn-lg" id="print-btn" style="flex:1 1 160px">Cetak tiket</button>');
    if (t.status === 'selesai' && inv && U.can(user, 'pembayaran')) acts.push('<a class="btn btn-outline btn-lg" href="pembayaran.html?id=' + encodeURIComponent(inv.id) + '" style="flex:1 1 160px">Nota &amp; pembayaran</a>');
    if (t.status === 'jalan' && U.can(user, 'timbang')) acts.push('<a class="btn btn-primary btn-lg" href="timbang.html" style="flex:1 1 200px">Lanjutkan di Timbang →</a>');
    if (acts.length) html += '<div style="display:flex;flex-wrap:wrap;gap:10px">' + acts.join('') + '</div>';
    if ((t.status === 'review' || t.status === 'jalan') && U.allowed('cancelTrx', user) && user.role !== 'operator') html += '<button type="button" class="btn-link danger" id="cancel-btn" style="align-self:flex-start">Batalkan transaksi</button>';
    if (user.role === 'auditor') html += '<p class="xs muted">Mode baca saja — peran Auditor tidak dapat mengubah transaksi.</p>';
    if (t.status === 'selesai' && paid > 0) html += '<p class="xs muted">Sudah ada pembayaran — koreksi hanya bisa lewat nota penyesuaian (di luar demo).</p>';
    html += '</div>';

    html += '<div class="card"><h3 style="font-size:16px;font-weight:600">Jejak audit</h3><ol class="timeline">' + timeline(t).map(function (e) {
      return '<li class="k-' + (e.kind || '') + '"><span class="rail"><i></i><b></b></span><span class="body"><span>' + esc(e.what) + '</span><small>' + (e.at > Date.now() - 5000 && e.kind === 'info' ? 'sekarang' : f.dateTime(e.at)) + ' · ' + esc(e.who || '') + '</small></span></li>';
    }).join('') + '</ol></div>';
    box.innerHTML = html;
  }

  function renderAll() { renderTabs(); renderList(); renderDetail(); U.refreshNavBadge(); }

  // ---------- aksi ----------
  function approve(t) {
    U.confirm({ title: 'Setujui ' + t.id + '?', text: 'Transaksi menjadi Selesai, nota dibuat dan tiket bisa dicetak. Persetujuan tercatat atas nama Anda.', confirmLabel: 'Setujui' }).then(function (ok) {
      if (!ok) return;
      t.status = 'selesai'; t.reviewedBy = user.name; t.reviewedAt = Date.now();
      t.events = t.events || []; t.events.push({ at: Date.now(), what: 'Disetujui setelah review', who: user.name, kind: 'ok' });
      if (!S.invoiceOfTrx(t.id)) S.state.invoices.push({ id: 'N-' + t.id.slice(4), trxId: t.id, supplierId: t.supplierId, total: S.calc(t).total, at: Date.now(), payments: [], dispute: false, disputeNote: '' });
      S.audit('Transaksi', t.id + ' disetujui setelah review', user.name);
      S.commit(); U.toast(t.id + ' disetujui · nota dibuat'); renderAll();
    });
  }

  function correction(t) {
    U.confirm({
      title: 'Ajukan koreksi',
      html: '<p>Nilai lama tetap tersimpan. Koreksi berlaku setelah disetujui Pemilik.</p>' +
        '<div class="form-grid"><div class="field"><label for="k-field">Data dikoreksi</label><select class="input" id="k-field"><option value="pct">Potongan total (%)</option><option value="tare">Berat tara (kg)</option></select></div>' +
        '<div class="field"><label for="k-val">Nilai baru</label><input class="input" id="k-val" inputmode="decimal" placeholder="cth. 4"></div></div>' +
        '<div class="field"><label for="k-reason">Alasan (wajib)</label><textarea class="input" id="k-reason" rows="2"></textarea></div><p class="field-error" id="k-err" hidden></p>',
      confirmLabel: 'Kirim koreksi',
      validate: function (box) {
        var field = box.querySelector('#k-field').value, v = U.parseNum(box.querySelector('#k-val').value), reason = box.querySelector('#k-reason').value.trim();
        var err = '';
        if (isNaN(v)) err = 'Isi nilai baru berupa angka.';
        else if (field === 'pct' && (v < 0 || v > 30)) err = 'Potongan harus 0–30%.';
        else if (field === 'tare' && (v < 500 || v >= t.gross)) err = 'Tara harus di antara 500 kg dan bruto (' + f.kg(t.gross) + ').';
        else if (reason.length < 5) err = 'Tulis alasan minimal 5 karakter.';
        var e = box.querySelector('#k-err'); e.hidden = !err; e.textContent = err;
        return !err;
      },
      collect: function (box) { return { field: box.querySelector('#k-field').value, v: U.parseNum(box.querySelector('#k-val').value), reason: box.querySelector('#k-reason').value.trim() }; }
    }).then(function (r) {
      if (!r) return;
      var c = { id: 'K' + Date.now(), trxId: t.id, field: r.field, value: r.v, reason: r.reason, by: user.name, at: Date.now(), status: 'menunggu',
        label: r.field === 'pct' ? 'Potongan' : 'Tara', fromText: r.field === 'pct' ? f.pct(S.sumDed(t.deductions)) : f.kg(t.tare), toText: r.field === 'pct' ? f.pct(r.v) : f.kg(r.v) };
      S.state.corrections.push(c);
      t.events = t.events || []; t.events.push({ at: Date.now(), what: 'Koreksi diajukan · ' + c.label + ' ' + c.fromText + ' → ' + c.toText, who: user.name, kind: 'info' });
      S.audit('Transaksi', t.id + ' · koreksi diajukan (' + c.label + ')', user.name);
      S.commit(); U.toast('Koreksi diajukan ke Pemilik'); renderDetail();
    });
  }

  function decideCorrection(id, ok) {
    var c = S.state.corrections.filter(function (x) { return x.id === id; })[0];
    var t = S.trx(c.trxId);
    c.status = ok ? 'disetujui' : 'ditolak'; c.decidedBy = user.name; c.decidedAt = Date.now();
    if (ok) {
      if (c.field === 'pct') {
        var cur = S.sumDed(t.deductions);
        if (cur > 0) { var k = c.value / cur; Object.keys(t.deductions).forEach(function (d) { t.deductions[d] = Math.round(t.deductions[d] * k * 100) / 100; }); }
        else t.deductions = { mentah: c.value };
      } else { t.tare = c.value; t.tareManual = false; }
      t.flags = S.evaluateFlags(t).filter(function (x) { return x !== 'R-01'; });
      var inv = S.invoiceOfTrx(t.id);
      if (inv && !inv.payments.length) inv.total = S.calc(t).total;
    }
    t.events = t.events || []; t.events.push({ at: Date.now(), what: 'Koreksi ' + (ok ? 'disetujui' : 'ditolak') + ' · ' + c.label + ' ' + c.fromText + ' → ' + c.toText, who: user.name, kind: ok ? 'ok' : 'bad' });
    S.audit('Transaksi', t.id + ' · koreksi ' + (ok ? 'disetujui' : 'ditolak'), user.name);
    S.commit(); U.toast('Koreksi ' + (ok ? 'disetujui · total dihitung ulang' : 'ditolak')); renderAll();
  }

  function cancel(t) {
    U.confirm({
      title: 'Batalkan ' + t.id + '?', danger: true, confirmLabel: 'Batalkan transaksi', cancelLabel: 'Kembali',
      html: '<p>Transaksi tidak dihapus. Statusnya menjadi Dibatalkan dan alasannya tercatat.</p><div class="field"><label for="x-reason">Alasan</label><select class="input" id="x-reason"><option>Supplier membatalkan penjualan</option><option>Salah identifikasi supplier/kendaraan</option><option>Transaksi ganda</option><option>Lainnya</option></select></div>',
      collect: function (box) { return box.querySelector('#x-reason').value; }
    }).then(function (reason) {
      if (!reason) return;
      t.status = 'batal'; t.cancelReason = reason; t.cancelledBy = user.name; t.cancelledAt = Date.now();
      t.events = t.events || []; t.events.push({ at: Date.now(), what: 'Dibatalkan — ' + reason, who: user.name, kind: 'bad' });
      S.audit('Transaksi', t.id + ' dibatalkan · ' + reason, user.name);
      S.commit(); U.toast(t.id + ' dibatalkan', 'warn'); renderAll();
    });
  }

  function exportCSV() {
    var list = filtered(false);
    var rows = [['No. transaksi', 'Tanggal', 'Jam', 'Supplier', 'ID supplier', 'Plat', 'Timbangan', 'Operator', 'Bruto (kg)', 'Tara (kg)', 'Netto (kg)', 'Potongan (%)', 'Berat dibayar (kg)', 'Harga (Rp/kg)', 'Total (Rp)', 'Status', 'Tanda']];
    list.forEach(function (t) {
      var c = S.calc(t);
      rows.push([t.id, t.day, f.time(t.at), S.supplierName(t.supplierId), t.supplierId, t.plate, t.scale, t.operator, t.gross, t.tare, c.netto, c.pct, c.bayar, t.price, c.total, U.TRX_STATUS[t.status][0], t.flags.join(' ')]);
    });
    U.downloadCSV('costcare-transaksi-' + st.range + '-' + S.todayKey() + '.csv', rows);
    U.toast(list.length + ' transaksi diekspor');
  }

  // ---------- event ----------
  var main = $('#main');
  var qTimer;
  $('#q').addEventListener('input', function () { clearTimeout(qTimer); var v = this.value; qTimer = setTimeout(function () { st.q = v; st.page = 1; st.sel = null; renderAll(); }, 150); });
  $('#range').addEventListener('change', function () { st.range = this.value; st.page = 1; st.sel = null; renderAll(); });
  $('#op').addEventListener('change', function () { st.op = this.value; st.page = 1; st.sel = null; renderAll(); });
  $('#export-btn').addEventListener('click', exportCSV);
  U.on(main, 'click', '[data-tab]', function (e, el) { st.tab = el.getAttribute('data-tab'); st.page = 1; st.sel = null; renderAll(); });
  U.on(main, 'click', '[data-page]', function (e, el) { st.page = +el.getAttribute('data-page'); renderList(); });
  U.on(main, 'click', '.list-row', function (e, el) {
    st.sel = el.getAttribute('data-id');
    renderList(); renderDetail();
    history.replaceState(null, '', '?id=' + encodeURIComponent(st.sel));
    if (window.innerWidth < 900) $('#detail').scrollIntoView({ behavior: 'smooth' });
  });
  U.on(main, 'click', '#clear-btn', function () { st.q = ''; $('#q').value = ''; st.tab = 'semua'; st.op = ''; $('#op').value = ''; st.range = '30'; $('#range').value = '30'; renderAll(); });
  U.on(main, 'click', '#approve-btn', function () { approve(S.trx(st.sel)); });
  U.on(main, 'click', '#correct-btn', function () { correction(S.trx(st.sel)); });
  U.on(main, 'click', '#print-btn', function () { U.printTicket(S.trx(st.sel)); });
  U.on(main, 'click', '#cancel-btn', function () { cancel(S.trx(st.sel)); });
  U.on(main, 'click', '[data-corr-ok]', function (e, el) { decideCorrection(el.getAttribute('data-corr-ok'), true); });
  U.on(main, 'click', '[data-corr-no]', function (e, el) { decideCorrection(el.getAttribute('data-corr-no'), false); });

  renderAll();
})();
