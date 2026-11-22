/* CostCare — Ringkasan (pemilik/admin/auditor). */
(function () {
  'use strict';
  var S = CC.store, U = CC.ui, f = U.fmt, esc = U.esc, $ = U.$;
  var user = U.boot('ringkasan');
  if (!user) return;

  var period = sessionStorage.getItem('costcare.period') || 'hari';

  function greet() {
    var h = new Date().getHours();
    var w = h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
    var first = user.name.replace(/^H\.\s*/, '').split(' ')[0];
    $('#greet').textContent = 'Selamat ' + w + ', ' + (user.role === 'pemilik' ? 'Pak ' : '') + first;
    var st = S.state.settings;
    $('#subtitle').textContent = f.dateLong(Date.now()) + ' · ' + st.site + ', ' + st.city + ' · diperbarui ' + f.time(Date.now());
  }

  function render() {
    var r = S.periodRange(period);
    var list = S.trxBetween(r.from, r.to);
    var a = S.aggregate(list);
    document.querySelectorAll('[data-period]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-period') === period)); });
    $('#period-label').textContent = r.label;
    $('#period-label-2').textContent = r.label;

    // tonase & grafik 7 hari
    $('#k-ton').textContent = f.ton(a.netto);
    var today = S.startOfDay(Date.now());
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var ds = today - i * S.DAY;
      days.push({ ts: ds, agg: S.aggregate(S.trxBetween(ds, ds + S.DAY)) });
    }
    var yest = days[5].agg.netto;
    $('#k-ton-sub').textContent = period === 'hari' ? 'Kemarin ' + f.ton(yest) + ' ton · hari ini masih berjalan' : a.count + ' transaksi · rata-rata ' + f.ton(a.count ? a.netto / a.count : 0) + ' t per truk';
    var max = Math.max.apply(null, days.map(function (d) { return d.agg.netto; }).concat([1]));
    $('#bars7').innerHTML = days.map(function (d, i) {
      var h = Math.max(4, Math.round(d.agg.netto / max * 140));
      var now = i === 6;
      return '<div class="bar' + (now ? ' now' : '') + '"><span class="v">' + f.ton(d.agg.netto) + '</span><i style="height:' + h + 'px"></i><span class="l">' + (now ? 'Hari ini' : f.dayName(d.ts)) + '</span></div>';
    }).join('');
    $('#bars7').setAttribute('aria-label', 'Tonase 7 hari: ' + days.map(function (d) { return f.dayName(d.ts) + ' ' + f.ton(d.agg.netto) + ' ton'; }).join(', '));

    // nilai
    $('#k-nilai').textContent = f.short(a.value);
    var paidKg = a.netto - a.potKg;
    $('#k-nilai-sub').textContent = a.netto ? 'Rata-rata ' + f.rp(a.value / a.netto) + '/kg netto setelah potongan' : 'Belum ada transaksi selesai';

    // belum dibayar
    var open = S.openInvoices();
    var openSum = open.reduce(function (s, i) { return s + i.total - S.paidOf(i); }, 0);
    var disp = S.state.invoices.filter(function (i) { return S.invoiceStatus(i) === 'sengketa'; }).length;
    $('#k-unpaid').textContent = f.short(openSum);
    $('#k-unpaid-sub').textContent = open.length + ' nota terbuka' + (disp ? ' · ' + disp + ' disengketakan' : '');

    // jumlah transaksi
    $('#k-count').textContent = f.num(a.count);
    var parts = [['Selesai', a.selesai, '#307464'], ['Berjalan', a.jalan, '#3D6FD6'], ['Perlu review', a.review, '#E39B19'], ['Dibatalkan', a.batal, '#B3C2B0']];
    $('#k-stack').innerHTML = parts.filter(function (p) { return p[1]; }).map(function (p) { return '<span style="flex:' + p[1] + ' 1 0;background:' + p[2] + '"></span>'; }).join('');
    $('#k-stack').setAttribute('aria-label', parts.map(function (p) { return p[1] + ' ' + p[0].toLowerCase(); }).join(', '));
    $('#k-legend').innerHTML = parts.map(function (p, i) {
      var label = i === 2 && p[1] ? '<a href="transaksi.html?status=review">' + p[0] + '</a>' : p[0];
      return '<li><span class="sw" style="background:' + p[2] + '"></span>' + label + '<strong>' + p[1] + '</strong></li>';
    }).join('');

    renderLane();
    renderReview();
    renderPrice();
    renderTop(list);
    renderRecent();
  }

  function renderLane() {
    var running = S.state.transactions.filter(function (t) { return t.status === 'jalan'; }).sort(function (a, b) { return b.at - a.at; });
    var t = running[0];
    var devs = S.state.devices;
    var t1 = devs.filter(function (d) { return d.id === 't1'; })[0], t2 = devs.filter(function (d) { return d.id === 't2'; })[0];
    var stages = ['Gerbang', 'Bruto', 'Sortasi', 'Tara', 'Review', 'Nota'];
    var cur = !t ? -1 : t.gross == null ? 1 : !t.sortAt ? 2 : 3;
    var html = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px 20px;padding:16px 18px;border-radius:20px;background:var(--ground)">' +
      '<div style="flex:0 0 auto"><div class="small strong">' + esc(t1.name) + '</div><div class="xs ' + (t1.status === 'ok' ? 'ok-text' : 'bad-text') + '" style="font-weight:500">● ' + (t1.status === 'ok' ? 'terhubung' : 'terputus') + '</div></div>' +
      '<div class="lane" style="flex:1 1 280px">' + stages.map(function (s, i) {
        var cls = cur < 0 ? '' : i < cur ? 'done' : i === cur ? 'current' : '';
        return '<span class="' + cls + '"><i></i>' + s + '</span>';
      }).join('') + '</div>' +
      (t ? '<div style="display:flex;align-items:center;gap:10px">' + U.plate(t.plate) + '<span class="small"><b>' + esc(S.supplierName(t.supplierId)) + '</b><br><span class="muted xs">' + esc(t.id) + '</span></span></div>'
        : '<span class="small muted-2">Tidak ada truk di jembatan</span>') +
      '</div>';
    if (t2.status !== 'ok') {
      var manual = S.state.transactions.filter(function (x) { return x.status === 'review' && x.tareManual; }).length;
      html += '<div class="notice bad" style="margin-top:10px;align-items:center;flex-wrap:wrap"><span style="flex:1 1 260px"><strong>' + esc(t2.name) + ' terputus sejak ' + f.time(t2.last) + '</strong>' +
        (manual ? manual + ' transaksi memakai berat manual dan menunggu review' : 'Belum ada transaksi terdampak') + '</span>' +
        (U.can(user, 'pengaturan') ? '<a class="btn btn-sm btn-danger-outline" href="pengaturan.html?tab=perangkat">Cek perangkat</a>' : '') + '</div>';
    }
    var q = S.state.queue;
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px"><span class="small muted">Antrian gerbang:</span>' +
      (q.length ? q.map(function (x) { return U.plate(x.plate); }).join('') : '<span class="small muted-2">kosong</span>') +
      (running.length > 1 ? '<span class="small muted-2">· ' + (running.length - 1) + ' truk lain menunggu tara</span>' : '') + '</div>';
    $('#lane').innerHTML = html;
  }

  function renderReview() {
    var list = S.state.transactions.filter(function (t) { return t.status === 'review'; }).sort(function (a, b) { return b.at - a.at; });
    $('#review-count').textContent = list.length;
    if (!list.length) { $('#review-list').innerHTML = U.emptyState('Tidak ada yang perlu diputuskan', 'Semua transaksi sudah ditinjau.'); return; }
    $('#review-list').innerHTML = list.slice(0, 4).map(function (t) {
      var c = S.calc(t);
      var flag = t.flags[0] || 'R-02';
      var txt = S.FLAG_TEXT[flag] || ['Perlu review', ''];
      var badge = flag === 'R-02' ? f.pct(c.pct) : flag === 'R-01' ? 'MAN' : flag === 'R-03' ? 'TARA' : 'DUP';
      return '<a href="transaksi.html?id=' + encodeURIComponent(t.id) + '" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;background:var(--warn-bg);color:var(--ink);text-decoration:none">' +
        '<span aria-hidden="true" style="flex:0 0 44px;width:44px;height:40px;border-radius:12px;background:var(--warn-dot);color:#2A1A00;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:600">' + esc(badge) + '</span>' +
        '<span style="flex:1 1 auto;display:flex;flex-direction:column;gap:2px"><strong style="font-size:14.5px;font-weight:600">' + esc(t.id.slice(-7).replace('-', '')) + ' · ' + esc(S.supplierName(t.supplierId)) + '</strong>' +
        '<span class="small" style="color:#5E3A00">' + esc(txt[0]) + ' · ' + f.rp(c.total) + '</span></span><span aria-hidden="true" class="warn-text">→</span></a>';
    }).join('') + (list.length > 4 ? '<a href="transaksi.html?status=review" class="small strong">+' + (list.length - 4) + ' lainnya</a>' : '');
  }

  function renderPrice() {
    var p = S.activePrice(), prev = S.previousPrice(), sch = S.scheduledPrices()[0];
    var diff = prev ? p.price - prev.price : 0;
    $('#price-card').innerHTML = '<h2 style="font-size:14px;font-weight:500;color:var(--mint-ink)">Harga TBS hari ini</h2>' +
      '<span style="font-size:40px;line-height:1;font-weight:600;letter-spacing:-.03em;color:var(--ink)">' + f.rp(p.price) + '<span style="font-size:16px;font-weight:500;color:var(--mint-ink)">/kg</span></span>' +
      (prev ? '<span class="chip" style="align-self:flex-start;background:#fff;color:var(--teal)">' + (diff >= 0 ? '▲' : '▼') + ' ' + f.rp(Math.abs(diff)) + ' dari harga sebelumnya</span>' : '') +
      '<span class="small" style="margin-top:auto;color:var(--mint-ink)">' + (sch ? 'Terjadwal ' + f.dateShort(sch.from) + ': ' + f.rp(sch.price) + (sch.status === 'menunggu' ? ' — menunggu persetujuan' : ' — disetujui') : 'Tidak ada perubahan terjadwal') + '</span>';
  }

  function renderTop(list) {
    var by = {};
    list.forEach(function (t) {
      if (t.status === 'batal' || t.tare == null) return;
      var c = S.calc(t);
      by[t.supplierId] = by[t.supplierId] || { kg: 0, n: 0 };
      by[t.supplierId].kg += c.netto; by[t.supplierId].n++;
    });
    var arr = Object.keys(by).map(function (k) { return { id: k, kg: by[k].kg, n: by[k].n }; }).sort(function (a, b) { return b.kg - a.kg; }).slice(0, 5);
    if (!arr.length) { $('#top-sup').innerHTML = U.emptyState('Belum ada data', 'Belum ada transaksi selesai di periode ini.'); return; }
    var max = arr[0].kg;
    $('#top-sup').innerHTML = arr.map(function (x, i) {
      return '<div style="display:flex;flex-direction:column;gap:5px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13.5px"><span><b style="font-weight:600">' + esc(S.supplierName(x.id)) + '</b> <span class="muted">· ' + x.n + ' trx</span></span><b class="num" style="font-weight:600">' + f.ton(x.kg) + ' t</b></div>' +
        '<div class="meter"><span style="width:' + Math.round(x.kg / max * 100) + '%;background:' + (i === 0 ? '#307464' : '#649A8A') + '"></span></div></div>';
    }).join('');
  }

  function renderRecent() {
    var list = S.state.transactions.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 8);
    $('#recent').innerHTML = list.map(function (t) {
      var c = S.calc(t);
      return '<tr class="is-clickable" data-href="transaksi.html?id=' + encodeURIComponent(t.id) + '">' +
        '<td class="muted-2">' + f.time(t.at) + (t.day !== S.todayKey() ? '<br><span class="xs muted">' + f.dateShort(t.at) + '</span>' : '') + '</td>' +
        '<td><a href="transaksi.html?id=' + encodeURIComponent(t.id) + '" style="color:inherit;text-decoration:none"><b style="font-weight:600">' + esc(S.supplierName(t.supplierId)) + '</b></a><div class="mono xs muted">' + esc(t.id) + '</div></td>' +
        '<td>' + esc(t.plate) + '</td>' +
        '<td class="right">' + f.kg(c.netto) + '</td>' +
        '<td class="right strong">' + f.rp(c.total) + '</td>' +
        '<td>' + U.trxChip(t) + '</td><td>' + U.payChipForTrx(t) + '</td></tr>';
    }).join('');
  }

  U.on($('#period'), 'click', '[data-period]', function (e, el) {
    period = el.getAttribute('data-period');
    sessionStorage.setItem('costcare.period', period);
    render();
  });
  U.on($('#recent'), 'click', 'tr[data-href]', function (e, el) { if (!e.target.closest('a')) location.href = el.getAttribute('data-href'); });

  greet();
  render();
  setInterval(function () { greet(); renderLane(); }, 30000);
})();
