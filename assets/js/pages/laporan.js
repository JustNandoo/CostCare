/* CostCare — Laporan periode. */
(function () {
  'use strict';
  var S = CC.store, U = CC.ui, f = U.fmt, esc = U.esc, $ = U.$;
  var user = U.boot('laporan');
  if (!user) return;

  var range = 'bulan';
  var COLORS = ['#307464', '#649A8A', '#80B014', '#B3C2B0', '#E39B19', '#3D6FD6', '#7A5BC7'];
  var data = null;

  function compute() {
    var r = S.periodRange(range);
    var list = S.trxBetween(r.from, r.to);
    var a = S.aggregate(list);
    var done = list.filter(function (t) { return t.status !== 'batal' && t.tare != null; });
    // harian
    var days = [];
    for (var d = r.from; d < r.to; d += S.DAY) {
      var dl = done.filter(function (t) { return t.at >= d && t.at < d + S.DAY; });
      days.push({ ts: d, kg: S.aggregate(dl).netto, n: dl.length, value: S.aggregate(dl).value });
    }
    // potongan
    var ded = {}, pctSum = 0;
    done.forEach(function (t) { Object.keys(t.deductions).forEach(function (k) { ded[k] = (ded[k] || 0) + t.deductions[k]; }); pctSum += S.sumDed(t.deductions); });
    var n = done.length || 1;
    // arus kas
    var paid = 0, open = 0, disp = 0;
    S.state.invoices.forEach(function (i) {
      var t = S.trx(i.trxId); if (!t || t.at < r.from || t.at >= r.to) return;
      var p = S.paidOf(i), st = S.invoiceStatus(i);
      paid += p;
      if (st === 'sengketa') disp += i.total - p; else open += i.total - p;
    });
    var revList = done.filter(function (t) { return t.status === 'review'; });
    var review = revList.reduce(function (s, t) { return s + S.calc(t).total; }, 0);
    // flag
    var flags = { 'R-01': [0, 0], 'R-02': [0, 0], 'R-03': [0, 0], 'R-04': [0, 0] };
    done.forEach(function (t) { (t.flags || []).forEach(function (fl) { if (!flags[fl]) return; flags[fl][0]++; if (t.status === 'review') flags[fl][1]++; }); });
    // supplier
    var by = {};
    done.forEach(function (t) {
      var c = S.calc(t);
      var b = by[t.supplierId] = by[t.supplierId] || { n: 0, kg: 0, value: 0, pct: 0 };
      b.n++; b.kg += c.netto; b.value += c.total; b.pct += c.pct;
    });
    var top = Object.keys(by).map(function (k) { return { id: k, n: by[k].n, kg: by[k].kg, value: by[k].value, pct: by[k].pct / by[k].n }; }).sort(function (x, y) { return y.kg - x.kg; }).slice(0, 8);
    data = { r: r, a: a, days: days, ded: ded, avgPct: pctSum / n, n: done.length, paid: paid, open: open, disp: disp, review: review, reviewN: revList.length, flags: flags, top: top };
    return data;
  }

  function render() {
    var d = compute(), a = d.a;
    var monthName = new Date(d.r.from).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    $('#title').textContent = range === 'bulan' || range === 'bulan-lalu' ? 'Laporan ' + monthName : 'Laporan ' + d.r.label;
    $('#subtitle').textContent = f.date(d.r.from) + ' – ' + f.date(Math.min(d.r.to - 1, Date.now())) + (range === 'bulan' ? ' · bulan berjalan' : '');
    $('#kpis').innerHTML =
      '<div class="kpi dark"><span class="label">Tonase netto</span><span class="value">' + f.ton(a.netto) + ' <small>ton</small></span></div>' +
      '<div class="kpi lime"><span class="label">Nilai pembelian</span><span class="value">' + f.short(a.value) + '</span></div>' +
      '<div class="kpi"><span class="label">Transaksi</span><span class="value">' + f.num(a.count) + '</span><span class="sub">' + a.batal + ' dibatalkan</span></div>' +
      '<div class="kpi"><span class="label">Rata-rata per truk</span><span class="value">' + (d.n ? (a.netto / d.n / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—') + ' <small>t netto</small></span></div>' +
      '<div class="kpi"><span class="label">Potongan rata-rata</span><span class="value">' + f.num(d.avgPct, 1) + '%</span><span class="sub">' + f.ton(a.potKg) + ' t tidak dibayar</span></div>';

    var max = Math.max.apply(null, d.days.map(function (x) { return x.kg; }).concat([1]));
    var today = S.startOfDay(Date.now());
    $('#daily').innerHTML = d.days.map(function (x) {
      var h = Math.max(3, Math.round(x.kg / max * 170));
      var many = d.days.length > 10;
      return '<div class="bar' + (x.ts === today ? ' now' : '') + '" title="' + f.dateShort(x.ts) + ': ' + f.ton(x.kg) + ' t · ' + x.n + ' trx"><span class="v"' + (many ? ' style="font-size:10px"' : '') + '>' + (many ? Math.round(x.kg / 1000) : f.ton(x.kg)) + '</span><i style="height:' + h + 'px;border-radius:' + (many ? 6 : 12) + 'px"></i><span class="l"' + (many ? ' style="font-size:10.5px"' : '') + '>' + (many ? new Date(x.ts).getDate() : f.dayName(x.ts)) + '</span></div>';
    }).join('');
    $('#daily').setAttribute('aria-label', 'Tonase harian: ' + d.days.map(function (x) { return f.dateShort(x.ts) + ' ' + f.ton(x.kg) + ' ton'; }).join(', '));
    $('#daily-note').textContent = d.days.length > 10 ? 'angka dalam ton' : '';

    var tot = d.paid + d.open + d.disp + d.review || 1;
    var cash = [['Sudah dibayar', d.paid, '#307464'], ['Belum dibayar', d.open, '#D9412F'], ['Disengketakan', d.disp, '#7A5BC7'], ['Menunggu review (' + d.reviewN + ' trx)', d.review, '#E39B19']];
    $('#cash-stack').innerHTML = cash.filter(function (c) { return c[1] > 0; }).map(function (c) { return '<span style="flex:' + Math.max(c[1] / tot, .012) + ' 1 0;background:' + c[2] + '"></span>'; }).join('');
    $('#cash-stack').setAttribute('aria-label', cash.map(function (c) { return c[0] + ' ' + f.rp(c[1]); }).join(', '));
    $('#cash').innerHTML = '<ul class="legend">' + cash.map(function (c) { return '<li><span class="sw" style="background:' + c[2] + '"></span>' + esc(c[0]) + '<strong class="num">' + f.rp(c[1]) + '</strong></li>'; }).join('') + '</ul>';

    var keys = Object.keys(d.ded).sort(function (x, y) { return d.ded[y] - d.ded[x]; });
    var n = d.n || 1;
    $('#ded-stack').innerHTML = keys.map(function (k, i) { return '<span style="flex:' + d.ded[k] + ' 1 0;background:' + COLORS[i % COLORS.length] + '"></span>'; }).join('');
    $('#ded-stack').setAttribute('aria-label', keys.map(function (k) { return S.deductionName(k) + ' ' + f.num(d.ded[k] / n, 1) + '%'; }).join(', '));
    $('#ded-legend').innerHTML = keys.map(function (k, i) { return '<li style="padding:10px 12px;border-radius:14px;background:var(--subtle)"><span class="sw" style="background:' + COLORS[i % COLORS.length] + '"></span>' + esc(S.deductionName(k)) + '<strong>' + f.num(d.ded[k] / n, 1) + '%</strong></li>'; }).join('');
    $('#t-pot').textContent = 'Komposisi potongan · ' + f.num(d.avgPct, 1) + '% dari netto';
    $('#ded-note').textContent = 'Setara ±' + f.ton(a.potKg) + ' ton TBS yang tidak dibayar di periode ini.';

    var total = 0, open = 0;
    Object.keys(d.flags).forEach(function (k) { total += d.flags[k][0]; open += d.flags[k][1]; });
    $('#flag-sum').innerHTML = '<b style="color:var(--ink)">' + total + '</b> ditandai · ' + (total - open) + ' sudah ditinjau';
    var rule = { 'R-01': 'indikator terputus', 'R-02': 'total potongan > ' + S.state.settings.reviewPot + '%', 'R-03': 'beda > ' + S.state.settings.reviewTara + '% dari riwayat truk', 'R-04': 'plat sama < 30 menit' };
    $('#flags').innerHTML = Object.keys(d.flags).map(function (k) {
      var x = d.flags[k];
      return '<a href="transaksi.html?status=review" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:var(--subtle);color:var(--ink);text-decoration:none">' +
        '<span style="flex:0 0 38px;width:38px;height:38px;border-radius:12px;background:var(--warn-bg);color:var(--warn);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600">' + x[0] + '</span>' +
        '<span style="flex:1 1 auto;display:flex;flex-direction:column"><span class="small strong">' + esc(S.FLAG_TEXT[k][0]) + '</span><span class="xs muted">' + k + ' · ' + esc(rule[k]) + '</span></span>' +
        '<span class="xs strong ' + (x[1] ? 'warn-text' : 'ok-text') + '">' + (x[0] - x[1]) + ' ditinjau' + (x[1] ? ' · ' + x[1] + ' terbuka' : '') + '</span></a>';
    }).join('');

    var maxKg = d.top.length ? d.top[0].kg : 1;
    $('#top').innerHTML = d.top.length ? d.top.map(function (x, i) {
      return '<tr><td class="strong muted">' + (i + 1) + '</td><td class="strong"><a href="supplier.html?id=' + x.id + '" style="color:inherit">' + esc(S.supplierName(x.id)) + '</a></td><td class="right">' + x.n + '</td><td class="right strong">' + f.ton(x.kg) + ' t</td><td class="right">' + f.short(x.value) + '</td><td class="right">' + f.num(x.pct, 1) + '%</td>' +
        '<td><span style="display:flex;align-items:center;gap:10px"><span class="meter" style="flex:1 1 auto"><span style="width:' + Math.round(x.kg / maxKg * 100) + '%"></span></span><span class="xs muted-2" style="flex:0 0 44px">' + f.num(a.netto ? x.kg / a.netto * 100 : 0, 1) + '%</span></span></td></tr>';
    }).join('') : '<tr><td colspan="7">' + U.emptyState('Belum ada data', 'Tidak ada transaksi selesai di periode ini.') + '</td></tr>';
  }

  $('#range').addEventListener('change', function () { range = this.value; render(); });
  $('#csv-btn').addEventListener('click', function () {
    var rows = [['Tanggal', 'Transaksi', 'Netto (kg)', 'Nilai (Rp)']];
    data.days.forEach(function (x) { rows.push([S.dayKey(x.ts), x.n, x.kg, x.value]); });
    rows.push([]); rows.push(['Supplier', 'Transaksi', 'Netto (kg)', 'Nilai (Rp)', 'Rata-rata potongan (%)']);
    data.top.forEach(function (x) { rows.push([S.supplierName(x.id), x.n, x.kg, x.value, Math.round(x.pct * 10) / 10]); });
    U.downloadCSV('costcare-laporan-' + range + '-' + S.todayKey() + '.csv', rows);
    U.toast('Laporan diekspor');
  });
  $('#pdf-btn').addEventListener('click', function () {
    var d = data, a = d.a, st = S.state.settings;
    U.printDoc('<div class="print-doc" style="max-width:none"><img src="../assets/img/costcare-logo.png" alt="CostCare"><h1>' + esc($('#title').textContent) + '</h1><div>' + esc(st.site + ' · ' + st.city + ' · ' + $('#subtitle').textContent) + '</div><br>' +
      '<div class="row"><span>Tonase netto</span><b>' + f.ton(a.netto) + ' ton</b></div><div class="row"><span>Nilai pembelian</span><b>' + f.rp(a.value) + '</b></div>' +
      '<div class="row"><span>Transaksi</span><b>' + a.count + '</b></div><div class="row"><span>Potongan rata-rata</span><b>' + f.num(d.avgPct, 1) + '%</b></div>' +
      '<div class="row"><span>Sudah dibayar</span><b>' + f.rp(d.paid) + '</b></div><div class="row"><span>Belum dibayar</span><b>' + f.rp(d.open) + '</b></div><div class="row"><span>Disengketakan</span><b>' + f.rp(d.disp) + '</b></div><br>' +
      '<h1>Supplier teratas</h1>' + d.top.map(function (x, i) { return '<div class="row"><span>' + (i + 1) + '. ' + esc(S.supplierName(x.id)) + ' (' + x.n + ' trx)</span><span>' + f.ton(x.kg) + ' t · ' + f.rp(x.value) + '</span></div>'; }).join('') +
      '<div class="foot">Dicetak ' + f.dateTime(Date.now()) + ' oleh ' + esc(user.name) + ' · DATA DEMO</div></div>');
  });

  render();
})();
