/* CostCare — Nota & Pembayaran. */
(function () {
  'use strict';
  var S = CC.store, U = CC.ui, f = U.fmt, esc = U.esc, $ = U.$;
  var user = U.boot('pembayaran');
  if (!user) return;

  var params = new URLSearchParams(location.search);
  var st = { q: '', sel: params.get('id') || null, method: 'Transfer bank', amount: null, showAllPaid: false };
  var COL_LIMIT = 10;
  var COLS = [['belum', 'Belum dibayar'], ['sebagian', 'Sebagian'], ['sengketa', 'Disengketakan'], ['lunas', 'Lunas hari ini']];

  function isToday(ts) { return S.dayKey(ts) === S.todayKey(); }
  function lastPay(inv) { return inv.payments[inv.payments.length - 1]; }

  function visible() {
    var q = st.q.trim().toLowerCase();
    return S.state.invoices.filter(function (i) {
      var s = S.invoiceStatus(i);
      if (s === 'lunas' && !isToday(lastPay(i).at)) return false;
      if (!q) return true;
      return [i.id, i.trxId, S.supplierName(i.supplierId)].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return b.at - a.at; });
  }

  function renderKpis() {
    var open = S.openInvoices();
    var openSum = open.reduce(function (s, i) { return s + i.total - S.paidOf(i); }, 0);
    var disp = S.state.invoices.filter(function (i) { return S.invoiceStatus(i) === 'sengketa'; });
    var dispSum = disp.reduce(function (s, i) { return s + i.total - S.paidOf(i); }, 0);
    var paidToday = 0, nPay = 0;
    S.state.invoices.forEach(function (i) { i.payments.forEach(function (p) { if (isToday(p.at)) { paidToday += p.amount; nPay++; } }); });
    var rev = S.state.transactions.filter(function (t) { return t.status === 'review'; });
    var revSum = rev.reduce(function (s, t) { return s + (S.calc(t).total || 0); }, 0);
    $('#kpis').innerHTML =
      '<div class="kpi dark"><span class="label">Belum dibayar</span><span class="value">' + f.rp(openSum) + '</span><span class="sub">' + open.length + ' nota terbuka</span></div>' +
      '<div class="kpi"><span class="label">Disengketakan</span><span class="value">' + f.rp(dispSum) + '</span><span class="sub">' + disp.length + ' nota</span></div>' +
      '<div class="kpi lime"><span class="label">Dibayar hari ini</span><span class="value">' + f.rp(paidToday) + '</span><span class="sub">' + nPay + ' pembayaran tercatat</span></div>' +
      '<a class="kpi warn" href="transaksi.html?status=review"><span class="label">Belum bisa dibuat nota</span><span class="value">' + f.rp(revSum) + '</span><span class="sub">' + rev.length + ' transaksi menunggu review →</span></a>';
  }

  function renderBoard() {
    var list = visible();
    if (!st.sel && list.length) st.sel = (list.filter(function (i) { return S.invoiceStatus(i) === 'belum'; })[0] || list[0]).id;
    $('#board').innerHTML = COLS.map(function (c) {
      var items = list.filter(function (i) { return S.invoiceStatus(i) === c[0]; });
      var sum = items.reduce(function (s, i) { return s + (c[0] === 'lunas' ? i.total : i.total - S.paidOf(i)); }, 0);
      var show = items.slice(0, c[0] === 'lunas' && !st.showAllPaid ? COL_LIMIT : 200);
      return '<div class="board-col"><div class="head"><b><i style="background:' + U.INV_STATUS[c[0]][2] + '"></i>' + c[1] + '</b><span class="count-badge" style="background:var(--ground);color:var(--ink-2)">' + items.length + '</span></div>' +
        '<span class="sum">' + (c[0] === 'lunas' ? 'Total ' : 'Sisa ') + f.rp(sum) + '</span>' +
        (show.length ? show.map(function (i) {
          var paid = S.paidOf(i);
          var headline = c[0] === 'sebagian' ? 'sisa ' + f.rp(i.total - paid) : f.rp(i.total);
          var sub = c[0] === 'lunas' ? lastPay(i).method + ' · ' + f.time(lastPay(i).at) : c[0] === 'sebagian' ? 'dari ' + f.rp(i.total) : c[0] === 'sengketa' ? 'keberatan supplier' : i.trxId;
          return '<button type="button" class="note-card" data-inv="' + i.id + '" aria-pressed="' + (i.id === st.sel) + '"><span class="id">' + esc(i.id) + ' · ' + f.dateShort(i.at) + '</span><span class="who">' + esc(S.supplierName(i.supplierId)) + '</span><span class="amt">' + headline + '</span><span class="sub">' + esc(sub) + '</span></button>';
        }).join('') : '<span class="small muted" style="padding:18px 8px;text-align:center">Kosong</span>') +
        (c[0] === 'lunas' && items.length > COL_LIMIT && !st.showAllPaid ? '<button type="button" class="btn btn-sm btn-outline" id="more-paid">Tampilkan ' + (items.length - COL_LIMIT) + ' lainnya</button>' : '') +
        '</div>';
    }).join('');
  }

  function renderDetail() {
    var i = st.sel ? S.invoice(st.sel) : null;
    var box = $('#detail');
    if (!i) { box.innerHTML = U.emptyState('Pilih nota', 'Klik salah satu nota di papan.'); return; }
    var t = S.trx(i.trxId), c = S.calc(t);
    var s = S.supplier(i.supplierId);
    var status = S.invoiceStatus(i);
    var paid = S.paidOf(i), rest = i.total - paid;
    var canPay = (status === 'belum' || status === 'sebagian') && U.allowed('recordPayment', user);
    if (st.amount === null) st.amount = f.num(rest);
    var html = '<div class="card-head" style="align-items:flex-start"><div style="display:flex;flex-direction:column;gap:3px"><span class="mono small muted">' + esc(i.id) + ' · <a href="transaksi.html?id=' + encodeURIComponent(t.id) + '">' + esc(t.id) + '</a></span>' +
      '<h2 style="font-size:21px">' + esc(s ? s.name : '—') + '</h2><span class="small muted-2">' + esc((s && s.pay ? 'Metode biasa: ' + s.pay : 'Metode bayar belum diisi') + (s ? ' · WA ' + s.phone : '')) + '</span></div>' + U.invChip(i) + '</div>' +
      '<div class="panel col" style="gap:10px;font-variant-numeric:tabular-nums">' +
        '<span class="small muted-2">Netto ' + f.kg(c.netto) + ' · potongan ' + f.pct(c.pct) + ' · ' + f.rp(t.price) + '/kg</span>' +
        '<div style="display:flex;justify-content:space-between"><span>Total nota</span><b>' + f.rp(i.total) + '</b></div>' +
        '<div style="display:flex;justify-content:space-between"><span>Sudah dibayar</span><b>' + f.rp(paid) + '</b></div>' +
        '<div class="meter"><span style="width:' + Math.min(100, Math.round(paid / i.total * 100)) + '%;background:var(--lime)"></span></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:500">Sisa</span><span style="font-size:26px;font-weight:600;letter-spacing:-.02em">' + f.rp(rest) + '</span></div></div>';

    if (status === 'sengketa') {
      html += '<div class="notice" style="background:var(--purple-bg);color:#2E1F5C"><span class="ic" style="background:var(--purple-dot);color:#fff">!</span><span style="flex:1"><strong style="color:var(--purple)">Sengketa terbuka</strong>' + esc(i.disputeNote) +
        (U.allowed('resolveDispute', user) ? '<span style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><button type="button" class="btn btn-sm btn-dark" id="resolve-btn">Selesaikan &amp; buka pembayaran</button>' + (t ? '<a class="btn btn-sm btn-outline" href="transaksi.html?id=' + encodeURIComponent(t.id) + '">Ajukan koreksi potongan</a>' : '') + '</span>' : '<span class="xs" style="display:block;margin-top:6px">Hanya Pemilik yang dapat menyelesaikan sengketa.</span>') + '</span></div>';
    }

    if (canPay) {
      html += '<form class="col" id="pay-form" novalidate style="gap:12px">' +
        '<div class="field"><label for="amount">Jumlah dibayar (Rp)</label><input class="input input-lg num" id="amount" inputmode="numeric" value="' + esc(st.amount) + '" aria-describedby="amount-info"><span class="field-hint" id="amount-info">Sisa ' + f.rp(rest) + '. Jumlah lebih kecil dicatat sebagai pembayaran sebagian.</span></div>' +
        '<div class="segmented soft stretch" role="radiogroup" aria-label="Metode pembayaran">' + ['Tunai', 'Transfer bank'].map(function (m) { return '<button type="button" role="radio" data-method="' + m + '" aria-checked="' + (st.method === m) + '">' + m + '</button>'; }).join('') + '</div>' +
        '<div class="field"><label for="ref">Referensi / no. bukti</label><input class="input" id="ref" placeholder="' + (st.method === 'Tunai' ? 'cth. no. kuitansi' : 'cth. nomor transfer') + '"></div>' +
        '<button type="submit" class="btn btn-primary btn-lg">Catat pembayaran</button></form>';
    }
    var acts = [];
    if (status !== 'sengketa' && status !== 'lunas' && U.allowed('recordPayment', user)) acts.push('<button type="button" class="btn btn-sm btn-outline" id="dispute-btn">Tandai sengketa</button>');
    acts.push('<button type="button" class="btn btn-sm btn-outline" id="print-btn">Cetak nota</button>');
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px">' + acts.join('') + '</div>';

    html += '<div class="col" style="gap:8px"><h3 style="font-size:14px;font-weight:600">Riwayat pembayaran</h3>' +
      (i.payments.length ? i.payments.map(function (p) {
        return '<div style="display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:14px;background:var(--subtle);font-size:13px"><span>' + f.dateTime(p.at) + ' · ' + esc(p.method) + (p.ref ? ' · <span class="mono xs">' + esc(p.ref) + '</span>' : '') + '<br><span class="xs muted">dicatat ' + esc(p.by) + '</span></span><b class="num">' + f.rp(p.amount) + '</b></div>';
      }).join('') : '<span class="small muted">Belum ada pembayaran.</span>') + '</div>';
    box.innerHTML = html;
  }

  function renderAll() { renderKpis(); renderBoard(); renderDetail(); }

  // ---------- event ----------
  var main = $('#main');
  $('#q').addEventListener('input', function () { st.q = this.value; renderBoard(); });
  U.on(main, 'click', '[data-inv]', function (e, el) {
    st.sel = el.getAttribute('data-inv'); st.amount = null;
    renderBoard(); renderDetail();
    history.replaceState(null, '', '?id=' + encodeURIComponent(st.sel));
    if (window.innerWidth < 900) $('#detail').scrollIntoView({ behavior: 'smooth' });
  });
  U.on(main, 'click', '#more-paid', function () { st.showAllPaid = true; renderBoard(); });
  U.on(main, 'click', '[data-method]', function (e, el) { st.method = el.getAttribute('data-method'); var a = $('#amount'); if (a) st.amount = a.value; renderDetail(); });
  U.on(main, 'input', '#amount', function (e, el) { st.amount = el.value; el.removeAttribute('aria-invalid'); var info = $('#amount-info'); info.className = 'field-hint'; });
  U.on(main, 'submit', '#pay-form', function (e) {
    e.preventDefault();
    var i = S.invoice(st.sel), rest = i.total - S.paidOf(i);
    var v = Math.round(U.parseNum($('#amount').value));
    var info = $('#amount-info'), err = '';
    if (isNaN(v) || v <= 0) err = 'Isi jumlah lebih dari Rp0.';
    else if (v > rest) err = 'Melebihi sisa ' + f.rp(rest) + '.';
    if (err) { info.textContent = err; info.className = 'field-error'; $('#amount').setAttribute('aria-invalid', 'true'); $('#amount').focus(); return; }
    var method = st.method === 'Tunai' ? 'Tunai' : (S.supplier(i.supplierId) && /Transfer/.test(S.supplier(i.supplierId).pay) ? S.supplier(i.supplierId).pay : 'Transfer bank');
    i.payments.push({ at: Date.now(), method: method, amount: v, ref: $('#ref').value.trim(), by: user.name });
    S.audit('Pembayaran', i.id + ' · ' + f.rp(v) + ' (' + method + ')' + (v < rest ? ' · sebagian' : ' · lunas'), user.name);
    S.commit();
    st.amount = null;
    U.toast(v < rest ? 'Pembayaran sebagian dicatat · sisa ' + f.rp(rest - v) : i.id + ' lunas');
    renderAll();
  });
  U.on(main, 'click', '#dispute-btn', function () {
    var i = S.invoice(st.sel);
    U.confirm({ title: 'Tandai ' + i.id + ' disengketakan?', html: '<p>Pembayaran ditahan sampai sengketa diselesaikan Pemilik.</p><div class="field"><label for="d-note">Catatan keberatan</label><textarea class="input" id="d-note" rows="3" placeholder="cth. Supplier keberatan potongan buah mentah"></textarea><span class="field-error" id="d-err" hidden>Tulis catatan minimal 10 karakter.</span></div>',
      confirmLabel: 'Tandai sengketa',
      validate: function (box) { var ok = box.querySelector('#d-note').value.trim().length >= 10; box.querySelector('#d-err').hidden = ok; return ok; },
      collect: function (box) { return box.querySelector('#d-note').value.trim(); } }).then(function (note) {
      if (!note) return;
      i.dispute = true; i.disputeNote = note;
      S.audit('Pembayaran', i.id + ' ditandai sengketa', user.name); S.commit();
      U.toast('Nota ditandai sengketa', 'warn'); renderAll();
    });
  });
  U.on(main, 'click', '#resolve-btn', function () {
    var i = S.invoice(st.sel);
    U.confirm({ title: 'Selesaikan sengketa?', text: 'Nota kembali bisa dibayar sesuai total saat ini. Bila potongan perlu diubah, ajukan koreksi di halaman Transaksi lebih dulu.', confirmLabel: 'Selesaikan' }).then(function (ok) {
      if (!ok) return;
      i.dispute = false; i.disputeNote = '';
      S.audit('Pembayaran', i.id + ' · sengketa diselesaikan', user.name); S.commit();
      U.toast('Sengketa diselesaikan'); st.amount = null; renderAll();
    });
  });
  U.on(main, 'click', '#print-btn', function () {
    var i = S.invoice(st.sel), t = S.trx(i.trxId), c = S.calc(t), s = S.supplier(i.supplierId), set = S.state.settings;
    U.printDoc('<div class="print-doc"><img src="../assets/img/costcare-logo.png" alt="CostCare"><h1>Nota Pembelian TBS</h1><div>' + esc(set.site + ' · ' + set.city) + '</div>' +
      '<div class="row"><span>No. nota</span><b>' + esc(i.id) + '</b></div><div class="row"><span>Transaksi</span><span>' + esc(t.id) + '</span></div>' +
      '<div class="row"><span>Supplier</span><span>' + esc(s ? s.name : '') + '</span></div><div class="row"><span>Netto</span><span>' + f.kg(c.netto) + '</span></div>' +
      '<div class="row"><span>Potongan</span><span>' + f.pct(c.pct) + '</span></div><div class="row"><span>Berat dibayar</span><span>' + f.kg(c.bayar) + '</span></div>' +
      '<div class="row"><span>Harga</span><span>' + f.rp(t.price) + '/kg</span></div>' +
      i.payments.map(function (p) { return '<div class="row"><span>Bayar ' + f.dateShort(p.at) + ' (' + esc(p.method) + ')</span><span>' + f.rp(p.amount) + '</span></div>'; }).join('') +
      '<div class="row total"><span>Sisa</span><span>' + f.rp(i.total - S.paidOf(i)) + '</span></div><div class="row total"><span>Total nota</span><span>' + f.rp(i.total) + '</span></div>' +
      '<div class="foot">Status: ' + esc(U.INV_STATUS[S.invoiceStatus(i)][0]) + '<br>Dicetak ' + f.dateTime(Date.now()) + ' · DATA DEMO</div></div>');
  });
  $('#export-btn').addEventListener('click', function () {
    var rows = [['No. nota', 'Transaksi', 'Tanggal', 'Supplier', 'Total (Rp)', 'Dibayar (Rp)', 'Sisa (Rp)', 'Status', 'Pembayaran terakhir']];
    var from = S.startOfDay(Date.now()) - 29 * S.DAY;
    S.state.invoices.filter(function (i) { return i.at >= from; }).forEach(function (i) {
      var p = S.paidOf(i), lp = lastPay(i);
      rows.push([i.id, i.trxId, S.dayKey(i.at), S.supplierName(i.supplierId), i.total, p, i.total - p, U.INV_STATUS[S.invoiceStatus(i)][0], lp ? f.dateTime(lp.at) + ' ' + lp.method : '']);
    });
    U.downloadCSV('costcare-rekap-nota-' + S.todayKey() + '.csv', rows);
    U.toast((rows.length - 1) + ' nota (30 hari) diekspor');
  });

  if (st.sel && !S.invoice(st.sel)) st.sel = null;
  renderAll();
})();
