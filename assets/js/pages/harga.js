/* CostCare — Harga TBS & jenis potongan. */
(function () {
  'use strict';
  var S = CC.store, U = CC.ui, f = U.fmt, esc = U.esc, $ = U.$;
  var user = U.boot('harga');
  if (!user) return;

  var canPropose = U.allowed('proposePrice', user);
  var canApprove = U.allowed('approvePrice', user);
  var canDed = U.allowed('toggleDeduction', user);
  var P_STATUS = { disetujui: ['Disetujui', 'chip-ok'], menunggu: ['Menunggu persetujuan', 'chip-warn'], ditolak: ['Ditolak', 'chip-bad'], dibatalkan: ['Dibatalkan', ''] };

  function toDateInput(ts) { var d = new Date(ts); return d.getFullYear() + '-' + S.pad(d.getMonth() + 1) + '-' + S.pad(d.getDate()); }

  function renderActive() {
    var p = S.activePrice(), prev = S.previousPrice();
    var diff = prev ? p.price - prev.price : 0;
    $('#active-price').innerHTML =
      '<span class="num" style="font-size:72px;line-height:1;font-weight:600;letter-spacing:-.04em">' + f.rp(p.price) + '<span style="font-size:22px;font-weight:500;color:var(--lime);letter-spacing:0">/kg</span></span>' +
      (prev ? '<span class="chip chip-lime" style="align-self:flex-start">' + (diff >= 0 ? '▲ ' : '▼ ') + f.rp(Math.abs(diff)) + ' dari harga sebelumnya</span>' : '') +
      '<dl style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:6px">' +
        '<div><dt class="xs" style="color:var(--on-dark)">Berlaku sejak</dt><dd style="margin:2px 0 0;font-weight:500">' + f.date(p.from) + '</dd></div>' +
        '<div><dt class="xs" style="color:var(--on-dark)">Disetujui</dt><dd style="margin:2px 0 0;font-weight:500">' + esc(p.approver || '—') + '</dd></div></dl>';
  }

  function renderScheduled() {
    var list = S.scheduledPrices();
    var p = S.activePrice();
    if (!list.length) { $('#scheduled').innerHTML = U.emptyState('Tidak ada perubahan terjadwal', canPropose ? 'Ajukan harga baru bila harga pabrik berubah.' : ''); return; }
    $('#scheduled').innerHTML = list.map(function (x) {
      var d = x.price - p.price;
      var acts = '';
      if (x.status === 'menunggu' && canApprove) acts = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:auto"><button type="button" class="btn btn-primary btn-lg" style="flex:1 1 140px" data-approve="' + x.id + '">Setujui</button><button type="button" class="btn btn-outline btn-lg" style="flex:1 1 110px" data-reject="' + x.id + '">Tolak</button></div>';
      else if (x.status === 'menunggu') acts = '<p class="small muted-2">Menunggu keputusan Pemilik.</p>';
      else if (canApprove) acts = '<button type="button" class="btn-link danger" data-cancelp="' + x.id + '" style="align-self:flex-start">Batalkan jadwal</button>';
      return '<div style="display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:20px;background:var(--subtle)">' +
        '<div class="card-head"><span style="font-size:36px;line-height:1;font-weight:600;letter-spacing:-.03em">' + f.rp(x.price) + '</span>' + U.chip(P_STATUS[x.status][0], P_STATUS[x.status][1]) + '</div>' +
        '<span class="small muted-2">mulai ' + f.dateLong(x.from) + ' · ' + (d >= 0 ? 'naik ' : 'turun ') + f.rp(Math.abs(d)) + ' (' + (d >= 0 ? '+' : '−') + f.num(Math.abs(d / p.price * 100), 1) + '%)</span>' +
        '<span class="xs muted">Diajukan ' + esc(x.proposer) + ', ' + f.dateTime(x.at) + ' · ' + esc(x.reason) + '</span>' + acts + '</div>';
    }).join('');
  }

  function renderBars() {
    var list = S.state.prices.filter(function (x) { return x.status === 'disetujui' || x.status === 'menunggu'; }).sort(function (a, b) { return a.from - b.from; }).slice(-6);
    var min = Math.min.apply(null, list.map(function (x) { return x.price; })) - 60;
    var max = Math.max.apply(null, list.map(function (x) { return x.price; }));
    var act = S.activePrice();
    $('#price-bars').innerHTML = list.map(function (x) {
      var h = Math.round((x.price - min) / (max - min) * 120) + 8;
      var cls = x.from > Date.now() ? ' ghost' : x.id === act.id ? ' now' : '';
      return '<div class="bar' + cls + '"><span class="v">' + f.rp(x.price) + '</span><i style="height:' + h + 'px;background:' + (cls ? '' : '#649A8A') + '"></i><span class="l">' + f.dateShort(x.from) + (x.from > Date.now() ? '*' : '') + '</span></div>';
    }).join('');
    $('#price-bars').setAttribute('aria-label', 'Riwayat harga: ' + list.map(function (x) { return f.dateShort(x.from) + ' ' + f.rp(x.price); }).join(', '));
  }

  function renderDeductions() {
    var from = S.periodRange('bulan').from;
    var list = S.state.transactions.filter(function (t) { return t.at >= from && t.sortAt && t.status !== 'batal'; });
    var sums = {}, total = 0;
    list.forEach(function (t) { Object.keys(t.deductions).forEach(function (k) { sums[k] = (sums[k] || 0) + t.deductions[k]; total += t.deductions[k]; }); });
    var n = list.length || 1;
    var maxAvg = Math.max.apply(null, S.state.deductionTypes.map(function (d) { return (sums[d.id] || 0) / n; }).concat([0.1]));
    $('#ded-rows').innerHTML = S.state.deductionTypes.map(function (d) {
      var avg = (sums[d.id] || 0) / n;
      return '<tr><td class="strong">' + esc(d.name) + '</td><td>% berat netto</td>' +
        '<td><span style="display:flex;align-items:center;gap:10px"><span class="meter" style="flex:0 0 90px"><span style="width:' + Math.round(avg / maxAvg * 100) + '%;background:#649A8A"></span></span><b>' + f.num(avg, 1) + '%</b></span></td>' +
        '<td class="muted-2">' + esc(d.desc) + '</td>' +
        '<td><button type="button" class="switch" role="switch" aria-checked="' + d.active + '" aria-label="Aktifkan ' + esc(d.name) + '" data-ded="' + d.id + '"' + (canDed ? '' : ' disabled') + '></button></td></tr>';
    }).join('');
    $('#ded-note').textContent = 'Rata-rata potongan total bulan ini ' + f.num(total / n, 1) + '% dari ' + list.length + ' transaksi. ' + (canDed ? 'Perubahan hanya berlaku untuk transaksi baru dan tercatat di audit.' : 'Hanya Pemilik yang dapat mengubah jenis potongan.');
    var rp = $('#review-pot'); rp.value = S.state.settings.reviewPot; rp.disabled = !canDed;
    $('#add-ded-btn').hidden = !canDed;
  }

  function renderLog() {
    var list = S.state.prices.slice().sort(function (a, b) { return b.from - a.from; });
    $('#price-log').innerHTML = list.map(function (x) {
      return '<tr><td>' + f.date(x.from) + '</td><td class="right strong">' + f.rp(x.price) + '</td><td>' + esc(x.reason) + '</td><td class="small">' + esc(x.proposer) + '<br><span class="muted xs">' + f.dateTime(x.at) + '</span></td>' +
        '<td class="small">' + (x.approver ? esc(x.approver) + (x.decidedAt ? '<br><span class="muted xs">' + f.dateTime(x.decidedAt) + '</span>' : '') : '—') + '</td><td>' + U.chip(P_STATUS[x.status][0], P_STATUS[x.status][1], true) + '</td></tr>';
    }).join('');
  }

  function renderAll() {
    $('#propose-btn').hidden = !canPropose;
    renderActive(); renderScheduled(); renderBars(); renderDeductions(); renderLog();
  }

  // ---------- aksi ----------
  function decide(id, status) {
    var x = S.state.prices.filter(function (p) { return p.id === id; })[0];
    x.status = status; x.approver = user.name; x.decidedAt = Date.now();
    S.audit('Harga', f.rp(x.price) + '/kg mulai ' + f.dateShort(x.from) + ' ' + (status === 'disetujui' ? 'disetujui' : status === 'ditolak' ? 'ditolak' : 'dibatalkan'), user.name);
    S.commit();
    U.toast(status === 'disetujui' ? 'Harga disetujui · aktif otomatis ' + f.dateShort(x.from) : status === 'ditolak' ? 'Pengajuan ditolak' : 'Jadwal dibatalkan', status === 'disetujui' ? '' : 'warn');
    renderAll();
  }

  var form = $('#propose-form');
  $('#propose-btn').addEventListener('click', function () {
    form.hidden = !form.hidden;
    if (!form.hidden) {
      var tomorrow = S.startOfDay(Date.now()) + S.DAY;
      $('#p-from').min = toDateInput(Date.now());
      $('#p-from').value = toDateInput(tomorrow);
      $('#propose-note').textContent = canApprove ? 'Sebagai Pemilik, pengajuan Anda langsung disetujui.' : 'Akan menunggu persetujuan Pemilik.';
      $('#p-price').focus();
    }
  });
  $('#propose-cancel').addEventListener('click', function () { form.hidden = true; });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var price = U.parseNum($('#p-price').value);
    var dateVal = $('#p-from').value;
    var from = dateVal ? new Date(dateVal + 'T00:00:00').getTime() : NaN;
    var pe = '', de = '';
    if (isNaN(price)) pe = 'Isi harga dalam rupiah per kg.';
    else if (price < 1000 || price > 6000) pe = 'Harga TBS wajar antara Rp1.000 dan Rp6.000/kg.';
    if (isNaN(from)) de = 'Pilih tanggal berlaku.';
    else if (from < S.startOfDay(Date.now())) de = 'Tanggal tidak boleh di masa lalu.';
    else if (S.state.prices.some(function (p) { return p.from === from && (p.status === 'menunggu' || p.status === 'disetujui'); })) de = 'Sudah ada harga untuk tanggal ini.';
    $('#p-price-err').hidden = !pe; $('#p-price-err').textContent = pe; $('#p-price').setAttribute('aria-invalid', String(!!pe));
    $('#p-from-err').hidden = !de; $('#p-from-err').textContent = de; $('#p-from').setAttribute('aria-invalid', String(!!de));
    if (pe || de) return;
    if (from === S.startOfDay(Date.now())) from = Date.now();
    var x = { id: 'PR-' + Date.now(), price: Math.round(price), from: from, status: canApprove ? 'disetujui' : 'menunggu', proposer: user.name, approver: canApprove ? user.name : '', decidedAt: canApprove ? Date.now() : null, reason: $('#p-reason').value, at: Date.now() };
    S.state.prices.push(x);
    S.audit('Harga', 'Diajukan ' + f.rp(x.price) + '/kg mulai ' + f.dateShort(x.from) + (canApprove ? ' (langsung disetujui)' : ''), user.name);
    S.commit();
    form.reset(); form.hidden = true;
    U.toast(canApprove ? 'Harga baru disetujui' : 'Pengajuan terkirim ke Pemilik');
    renderAll();
  });

  var main = $('#main');
  U.on(main, 'click', '[data-approve]', function (e, el) {
    var id = el.getAttribute('data-approve');
    var x = S.state.prices.filter(function (p) { return p.id === id; })[0];
    U.confirm({ title: 'Setujui ' + f.rp(x.price) + '/kg?', text: 'Harga aktif otomatis mulai ' + f.dateLong(x.from) + '. Transaksi sebelum tanggal itu tetap memakai harga lama.', confirmLabel: 'Setujui harga' }).then(function (ok) { if (ok) decide(id, 'disetujui'); });
  });
  U.on(main, 'click', '[data-reject]', function (e, el) { decide(el.getAttribute('data-reject'), 'ditolak'); });
  U.on(main, 'click', '[data-cancelp]', function (e, el) {
    var id = el.getAttribute('data-cancelp');
    U.confirm({ title: 'Batalkan jadwal harga?', text: 'Harga terjadwal tidak akan aktif. Tindakan ini tercatat di audit.', confirmLabel: 'Batalkan jadwal', danger: true }).then(function (ok) { if (ok) decide(id, 'dibatalkan'); });
  });
  U.on(main, 'click', '[data-ded]', function (e, el) {
    if (!canDed) return;
    var d = S.state.deductionTypes.filter(function (x) { return x.id === el.getAttribute('data-ded'); })[0];
    if (d.active && S.activeDeductionTypes().length <= 1) { U.toast('Minimal satu jenis potongan harus aktif.', 'warn'); return; }
    d.active = !d.active;
    S.audit('Aturan', 'Jenis potongan "' + d.name + '" ' + (d.active ? 'diaktifkan' : 'dinonaktifkan'), user.name);
    S.commit(); U.toast(d.name + (d.active ? ' diaktifkan' : ' dinonaktifkan')); renderDeductions();
  });
  $('#review-pot').addEventListener('change', function () {
    var v = U.parseNum(this.value);
    if (isNaN(v) || v < 1 || v > 20) { U.toast('Batas review harus 1–20%.', 'bad'); this.value = S.state.settings.reviewPot; return; }
    var old = S.state.settings.reviewPot;
    S.state.settings.reviewPot = v;
    S.audit('Aturan', 'Batas review potongan ' + old + '% → ' + v + '%', user.name);
    S.commit(); U.toast('Batas review disimpan: ' + v + '%');
  });
  $('#add-ded-btn').addEventListener('click', function () {
    U.confirm({
      title: 'Jenis potongan baru',
      html: '<div class="field"><label for="nd-name">Nama</label><input class="input" id="nd-name" placeholder="cth. Buah lewat matang"></div><div class="field"><label for="nd-desc">Contoh kondisi</label><input class="input" id="nd-desc"></div><p class="field-error" id="nd-err" hidden>Nama minimal 3 huruf dan belum dipakai.</p>',
      confirmLabel: 'Tambah',
      validate: function (box) { var n = box.querySelector('#nd-name').value.trim(); var ok = n.length >= 3 && !S.state.deductionTypes.some(function (d) { return d.name.toLowerCase() === n.toLowerCase(); }); box.querySelector('#nd-err').hidden = ok; return ok; },
      collect: function (box) { return { name: box.querySelector('#nd-name').value.trim(), desc: box.querySelector('#nd-desc').value.trim() || '—' }; }
    }).then(function (r) {
      if (!r) return;
      S.state.deductionTypes.push({ id: 'd' + Date.now(), name: r.name, desc: r.desc, active: true });
      S.audit('Aturan', 'Jenis potongan baru "' + r.name + '"', user.name); S.commit();
      U.toast('Jenis potongan ditambahkan'); renderDeductions();
    });
  });

  renderAll();
})();
