/* CostCare — Pengaturan, perangkat, pengguna, audit & data demo. */
(function () {
  'use strict';
  var S = CC.store, U = CC.ui, f = U.fmt, esc = U.esc, $ = U.$;
  var user = U.boot('pengaturan');
  if (!user) return;

  var canEdit = U.allowed('editRules', user);
  var canUsers = U.allowed('manageUsers', user);
  var params = new URLSearchParams(location.search);
  var tab = params.get('tab') || 'aturan';
  var draft = JSON.parse(JSON.stringify(S.state.settings));
  var audit = { cat: 'semua', q: '', limit: 30 };
  var tests = {};

  function setTab(t) {
    tab = t;
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t)); });
    ['aturan', 'perangkat', 'pengguna', 'audit', 'data'].forEach(function (p) { $('#pane-' + p).hidden = p !== t; });
    history.replaceState(null, '', '?tab=' + t);
  }

  // ---------- aturan ----------
  function dirty() { var s = S.state.settings; return ['basis', 'wround', 'rround', 'stabTol', 'stabSec', 'reviewPot', 'reviewTara'].some(function (k) { return String(s[k]) !== String(draft[k]); }); }
  function renderRules() {
    var groups = [
      ['basis', 'Potongan sortasi dikenakan pada', [['berat', 'Berat netto', 'berat dibayar berkurang'], ['harga', 'Harga per kg', 'harga bersih berkurang']]],
      ['wround', 'Pembulatan berat dibayar', [['none', 'Tidak dibulatkan', '1 angka desimal'], ['1', 'Ke 1 kg', 'pembulatan biasa'], ['10', 'Ke 10 kg', 'pembulatan biasa']]],
      ['rround', 'Pembulatan total rupiah', [['1', 'Ke Rp1', 'paling teliti'], ['100', 'Ke Rp100', 'pembulatan biasa'], ['1000', 'Ke Rp1.000', 'mudah untuk tunai']]]
    ];
    $('#rule-groups').innerHTML = groups.map(function (g) {
      return '<div role="radiogroup" aria-label="' + esc(g[1]) + '" class="col" style="gap:10px"><span class="strong" style="font-size:14px">' + esc(g[1]) + '</span><div class="option-group">' +
        g[2].map(function (o) { return '<button type="button" role="radio" class="option" data-rule="' + g[0] + '" data-val="' + o[0] + '" aria-checked="' + (String(draft[g[0]]) === o[0]) + '"' + (canEdit ? '' : ' disabled') + '><strong>' + o[1] + '</strong><span>' + o[2] + '</span></button>'; }).join('') + '</div></div>';
    }).join('');
    document.querySelectorAll('[data-num]').forEach(function (i) { i.value = draft[i.getAttribute('data-num')]; i.disabled = !canEdit; });
    renderExample();
    var d = dirty();
    $('#rule-save').disabled = !d || !canEdit;
    $('#rule-reset').hidden = !d;
    $('#save-text').textContent = d ? 'Ada perubahan yang belum disimpan.' : 'Aturan aktif · potongan dari ' + (S.state.settings.basis === 'harga' ? 'harga' : 'netto') + ', berat ' + (S.state.settings.wround === 'none' ? 'tidak dibulatkan' : 'ke ' + S.state.settings.wround + ' kg') + ', total ke Rp' + f.num(S.state.settings.rround) + '.';
    $('#save-text').className = 'small ' + (d ? 'warn-text' : 'muted-2');
  }
  function renderExample() {
    var base = { gross: 8420, tare: 3210, deductions: { mentah: 2, tangkai: 1 }, price: 2850 };
    var now = S.calc(Object.assign({}, base, { rules: S.state.settings }));
    var t = Object.assign({}, base, { rules: draft });
    var c = S.calc(t);
    var rows = draft.basis === 'harga'
      ? [['Harga bersih 97% × Rp2.850', 'Rp' + f.num(c.priceNet, 1) + '/kg'], ['Berat dibayar', f.kg(c.bayar) + ' (tanpa potong berat)'], ['Pembulatan berat', 'tidak berlaku'], ['5.210 kg × ' + 'Rp' + f.num(c.priceNet, 1), f.rp(Math.round(c.netto * c.priceNet))]]
      : [['Potongan 3% × 5.210 kg', '− ' + f.kg(c.potKg)], ['Berat dibayar', f.kg(Math.round((c.netto - c.netto * .03) * 10) / 10)], ['Setelah pembulatan berat', f.kg(c.bayar)], [f.kg(c.bayar) + ' × Rp2.850', f.rp(Math.round(c.bayar * 2850))]];
    var diff = c.total - now.total;
    $('#example').innerHTML = rows.map(function (r) { return '<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #1F5246;font-size:14px"><span style="color:var(--on-dark-2)">' + esc(r[0]) + '</span><b style="font-weight:600">' + esc(r[1]) + '</b></div>'; }).join('') +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-top:12px"><span style="color:var(--on-dark-2)">Total dibayar</span><span style="font-size:32px;font-weight:600;letter-spacing:-.02em">' + f.rp(c.total) + '</span></div>' +
      '<span class="chip ' + (diff === 0 ? '' : 'chip-lime') + '" style="margin-top:10px;' + (diff === 0 ? 'background:var(--forest-2);color:var(--on-dark-2)' : '') + '">' + (diff === 0 ? 'Sama dengan aturan aktif' : (diff > 0 ? '+' : '−') + f.rp(Math.abs(diff)) + ' dibanding aturan aktif') + '</span>';
  }

  // ---------- perangkat ----------
  function renderDevices() {
    var D = { ok: ['Terhubung', 'chip-ok'], off: ['Terputus', 'chip-bad'] };
    $('#devices').innerHTML = S.state.devices.map(function (d) {
      var r = tests[d.id];
      return '<div class="card"><div class="card-head" style="align-items:flex-start"><span style="display:flex;flex-direction:column;gap:2px"><strong style="font-size:16px;font-weight:600">' + esc(d.name) + '</strong><span class="small muted">' + esc(d.where) + '</span></span>' + U.chip(D[d.status][0], D[d.status][1]) + '</div>' +
        '<dl class="mini-stats soft"><div><dt>Adapter</dt><dd style="font-size:14px">' + esc(d.adapter) + '</dd></div><div><dt>Data terakhir</dt><dd style="font-size:14px">' + f.rel(d.last) + '</dd></div></dl>' +
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px"><button type="button" class="btn btn-sm btn-outline btn-pill" data-test="' + d.id + '"' + (r === 'run' ? ' disabled' : '') + '>' + (r === 'run' ? 'Menguji…' : 'Uji koneksi') + '</button>' +
        (d.status === 'off' && canEdit ? '<button type="button" class="btn btn-sm btn-danger-outline btn-pill" data-reconnect="' + d.id + '">Hubungkan ulang</button>' : '') +
        '<span class="small strong ' + (r === 'ok' ? 'ok-text' : r === 'fail' ? 'bad-text' : '') + '" role="status">' + (r === 'ok' ? 'Berhasil · respons 0,2 dtk (simulasi)' : r === 'fail' ? 'Gagal · tidak ada respons' : '') + '</span></div></div>';
    }).join('');
  }

  // ---------- pengguna ----------
  var MATRIX = [
    ['Timbang & kunci berat', 'weigh'], ['Batalkan transaksi', 'cancelTrx'], ['Setujui transaksi', 'approveTrx'], ['Ajukan koreksi', 'requestCorrection'], ['Setujui koreksi', 'approveCorrection'],
    ['Catat pembayaran', 'recordPayment'], ['Ajukan harga TBS', 'proposePrice'], ['Setujui harga TBS', 'approvePrice'], ['Ubah aturan hitung', 'editRules'], ['Kelola pengguna', 'manageUsers']
  ];
  function renderUsers() {
    var roles = ['operator', 'admin', 'pemilik', 'auditor'];
    $('#invite-btn').hidden = !canUsers;
    $('#users').innerHTML = S.state.users.map(function (u) {
      var self = u.id === user.id;
      return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;background:var(--subtle);opacity:' + (u.active ? 1 : .6) + '">' +
        '<span class="avatar" style="border-radius:12px;width:38px;height:38px">' + esc(u.initials) + '</span>' +
        '<span style="flex:1 1 160px;min-width:0;display:flex;flex-direction:column"><b style="font-size:14px;font-weight:600">' + esc(u.name) + (self ? ' <span class="xs muted">(Anda)</span>' : '') + '</b><span class="xs muted">' + esc(u.email) + (u.active ? '' : ' · nonaktif') + '</span></span>' +
        (canUsers && !self ? '<label class="sr-only" for="role-' + u.id + '">Peran ' + esc(u.name) + '</label><select class="input" id="role-' + u.id + '" data-role="' + u.id + '" style="width:auto;min-height:38px;font-size:13px">' + roles.map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + esc(S.ROLE_LABEL[r]) + '</option>'; }).join('') + '</select>' +
          '<button type="button" class="btn btn-sm btn-outline" data-active="' + u.id + '">' + (u.active ? 'Nonaktifkan' : 'Aktifkan') + '</button>'
          : '<span class="chip chip-done">' + esc(S.ROLE_LABEL[u.role]) + '</span>') + '</div>';
    }).join('');
    var map = { operator: 0, admin: 1, pemilik: 2, auditor: 3 };
    var approveOnly = { proposePrice: ['admin'], requestCorrection: ['admin'] };
    $('#matrix').innerHTML = MATRIX.map(function (m) {
      return '<tr><th scope="row" style="text-align:left;font-weight:500;font-size:13.5px;color:var(--ink);padding:9px 12px;background:var(--subtle);border-radius:12px 0 0 12px">' + esc(m[0]) + '</th>' + roles.map(function (r, i) {
        var ok = U.allowed(m[1], { role: r });
        var a = !!(approveOnly[m[1]] && approveOnly[m[1]].indexOf(r) !== -1);
        var cls = a ? 'a' : ok ? 'y' : 'n', mark = a ? 'A' : ok ? '✓' : '—';
        return '<td style="text-align:center;padding:9px 8px' + (i === 3 ? ';border-radius:0 12px 12px 0' : ';border-radius:0') + '"><span class="perm ' + cls + '" aria-label="' + (a ? 'boleh mengajukan' : ok ? 'boleh' : 'tidak boleh') + '">' + mark + '</span></td>';
      }).join('') + '</tr>';
    }).join('');
  }

  // ---------- audit ----------
  var CAT = { Transaksi: ['#DCEAE4', '#24453C'], Harga: ['#EDF5D6', '#4A6A00'], Perangkat: ['#FDE6E1', '#A3261A'], Pengguna: ['#E4ECFA', '#2850A8'], Aturan: ['#FFF0D2', '#8F5300'], Supplier: ['#EEE8FA', '#5A3FA0'], Pembayaran: ['#EDF5D6', '#4A6A00'], Data: ['#EFF3EA', '#44574F'] };
  function auditList() {
    var q = audit.q.trim().toLowerCase();
    return S.state.audit.filter(function (e) { return (audit.cat === 'semua' || e.cat === audit.cat) && (!q || (e.what + ' ' + e.who).toLowerCase().indexOf(q) !== -1); }).sort(function (a, b) { return b.at - a.at; });
  }
  function renderAudit() {
    var cats = ['semua'].concat(Object.keys(CAT).filter(function (c) { return S.state.audit.some(function (e) { return e.cat === c; }); }));
    $('#cats').innerHTML = cats.map(function (c) { return '<button type="button" class="pilltab" style="height:36px;padding:0 14px;background:' + (audit.cat === c ? '' : 'var(--ground)') + '" aria-selected="' + (audit.cat === c) + '" data-cat="' + c + '">' + (c === 'semua' ? 'Semua' : c) + '</button>'; }).join('');
    var list = auditList();
    $('#audit').innerHTML = list.length ? list.slice(0, audit.limit).map(function (e) {
      var c = CAT[e.cat] || CAT.Data;
      return '<li style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:12px 16px;border-radius:16px;background:var(--subtle)">' +
        '<span class="mono small muted-2" style="flex:0 0 130px">' + f.dateTime(e.at) + '</span>' +
        '<span class="chip chip-sm" style="background:' + c[0] + ';color:' + c[1] + '">' + esc(e.cat) + '</span>' +
        '<span style="flex:1 1 280px;font-size:13.5px">' + esc(e.what) + '</span><span class="small muted">' + esc(e.who) + '</span></li>';
    }).join('') : '<li>' + U.emptyState('Tidak ada kejadian', 'Ubah filter atau kata kunci.') + '</li>';
    $('#audit-count').textContent = 'Menampilkan ' + Math.min(audit.limit, list.length) + ' dari ' + list.length + ' kejadian';
    $('#audit-more').hidden = list.length <= audit.limit;
  }

  function renderData() {
    var s = S.state;
    $('#data-stats').innerHTML = [['Supplier', s.suppliers.length], ['Kendaraan', s.vehicles.length], ['Transaksi', s.transactions.length], ['Nota', s.invoices.length], ['Catatan audit', s.audit.length], ['Data dibuat', f.dateTime(s.seededAt)]]
      .map(function (x) { return '<div><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div></div>'; }).join('');
    $('#reset-btn').hidden = !U.allowed('resetDemo', user);
  }

  function renderAll() {
    $('#readonly-note').hidden = canEdit;
    $('#subtitle').textContent = 'Sistem · ' + S.state.settings.site + ', ' + S.state.settings.city;
    setTab(tab); renderRules(); renderDevices(); renderUsers(); renderAudit(); renderData();
  }

  // ---------- event ----------
  var main = $('#main');
  U.on(main, 'click', '[data-tab]', function (e, el) { setTab(el.getAttribute('data-tab')); });
  U.on(main, 'click', '[data-rule]', function (e, el) {
    var k = el.getAttribute('data-rule'), v = el.getAttribute('data-val');
    draft[k] = k === 'rround' ? Number(v) : v;
    renderRules();
  });
  U.on(main, 'input', '[data-num]', function (e, el) {
    var v = U.parseNum(el.value);
    draft[el.getAttribute('data-num')] = isNaN(v) ? el.value : v;
    var d = dirty();
    $('#rule-save').disabled = !d; $('#rule-reset').hidden = !d;
    $('#save-text').textContent = d ? 'Ada perubahan yang belum disimpan.' : ''; $('#save-text').className = 'small warn-text';
  });
  $('#rule-reset').addEventListener('click', function () { draft = JSON.parse(JSON.stringify(S.state.settings)); $('#rule-err').hidden = true; renderRules(); });
  $('#rule-save').addEventListener('click', function () {
    var lim = { stabTol: [1, 50], stabSec: [1, 10], reviewPot: [1, 20], reviewTara: [1, 30] }, err = '';
    Object.keys(lim).forEach(function (k) { var v = Number(draft[k]); if (!err && (isNaN(v) || v < lim[k][0] || v > lim[k][1])) err = 'Nilai "' + $('#s-' + k).previousElementSibling.textContent + '" harus ' + lim[k][0] + '–' + lim[k][1] + '.'; });
    var e = $('#rule-err'); e.hidden = !err; e.textContent = err;
    if (err) return;
    U.confirm({ title: 'Simpan aturan hitung?', text: 'Aturan baru berlaku untuk transaksi yang dibuat setelah ini. Transaksi lama tidak berubah.', confirmLabel: 'Simpan aturan' }).then(function (ok) {
      if (!ok) return;
      var changes = [];
      Object.keys(draft).forEach(function (k) { if (String(S.state.settings[k]) !== String(draft[k])) changes.push(k + ' ' + S.state.settings[k] + ' → ' + draft[k]); });
      Object.keys(draft).forEach(function (k) { S.state.settings[k] = ['stabTol', 'stabSec', 'reviewPot', 'reviewTara', 'rround'].indexOf(k) !== -1 ? Number(draft[k]) : draft[k]; });
      S.audit('Aturan', 'Aturan hitung diubah: ' + changes.join(', '), user.name);
      S.commit(); U.toast('Aturan disimpan · berlaku untuk transaksi baru'); renderRules(); renderAudit();
    });
  });

  U.on(main, 'click', '[data-test]', function (e, el) {
    var id = el.getAttribute('data-test'); var d = S.state.devices.filter(function (x) { return x.id === id; })[0];
    tests[id] = 'run'; renderDevices();
    setTimeout(function () { tests[id] = d.status === 'ok' ? 'ok' : 'fail'; if (d.status === 'ok') d.last = Date.now(); S.audit('Perangkat', 'Uji koneksi ' + d.name + ': ' + (d.status === 'ok' ? 'berhasil' : 'gagal'), user.name); S.commit(); renderDevices(); renderAudit(); }, 1200);
  });
  U.on(main, 'click', '[data-reconnect]', function (e, el) {
    var d = S.state.devices.filter(function (x) { return x.id === el.getAttribute('data-reconnect'); })[0];
    tests[d.id] = 'run'; renderDevices();
    setTimeout(function () { d.status = 'ok'; d.last = Date.now(); tests[d.id] = 'ok'; S.audit('Perangkat', d.name + ' terhubung kembali', user.name); S.commit(); U.toast(d.name + ' terhubung kembali'); renderDevices(); renderAudit(); }, 1500);
  });

  $('#invite-btn').addEventListener('click', function () {
    U.confirm({
      title: 'Undang pengguna',
      html: '<div class="field"><label for="i-name">Nama</label><input class="input" id="i-name"></div><div class="field"><label for="i-email">Email</label><input class="input" id="i-email" type="email" placeholder="nama@costcare.id"></div>' +
        '<div class="field"><label for="i-role">Peran</label><select class="input" id="i-role"><option value="operator">Operator timbangan</option><option value="admin">Admin &amp; keuangan</option><option value="auditor">Auditor (baca saja)</option></select></div><p class="field-error" id="i-err" hidden></p>' +
        '<p class="small muted-2">Demo: pengguna baru bisa langsung masuk dengan kata sandi <b class="mono">demo123</b>. Undangan email belum dikirim (tidak ada server).</p>',
      confirmLabel: 'Tambah pengguna',
      validate: function (box) {
        var n = box.querySelector('#i-name').value.trim(), em = box.querySelector('#i-email').value.trim().toLowerCase(), err = '';
        if (n.length < 3) err = 'Nama minimal 3 huruf.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) err = 'Email tidak valid.';
        else if (S.state.users.some(function (u) { return u.email.toLowerCase() === em; })) err = 'Email sudah terdaftar.';
        var x = box.querySelector('#i-err'); x.hidden = !err; x.textContent = err; return !err;
      },
      collect: function (box) { return { name: box.querySelector('#i-name').value.trim(), email: box.querySelector('#i-email').value.trim().toLowerCase(), role: box.querySelector('#i-role').value }; }
    }).then(function (r) {
      if (!r) return;
      S.state.users.push({ id: 'U' + Date.now(), name: r.name, email: r.email, role: r.role, initials: U.initials(r.name), active: true });
      S.audit('Pengguna', 'Pengguna baru ' + r.name + ' (' + S.ROLE_LABEL[r.role] + ')', user.name);
      S.commit(); U.toast(r.name + ' ditambahkan'); renderUsers(); renderAudit();
    });
  });
  U.on(main, 'change', '[data-role]', function (e, el) {
    var u = S.user(el.getAttribute('data-role')), old = u.role;
    u.role = el.value;
    S.audit('Pengguna', 'Peran ' + u.name + ': ' + S.ROLE_LABEL[old] + ' → ' + S.ROLE_LABEL[u.role], user.name);
    S.commit(); U.toast('Peran ' + u.name + ' diubah'); renderAudit();
  });
  U.on(main, 'click', '[data-active]', function (e, el) {
    var u = S.user(el.getAttribute('data-active'));
    u.active = !u.active;
    S.audit('Pengguna', u.name + ' ' + (u.active ? 'diaktifkan' : 'dinonaktifkan'), user.name);
    S.commit(); U.toast(u.name + (u.active ? ' diaktifkan' : ' dinonaktifkan')); renderUsers(); renderAudit();
  });

  $('#aq').addEventListener('input', function () { audit.q = this.value; audit.limit = 30; renderAudit(); });
  U.on(main, 'click', '[data-cat]', function (e, el) { audit.cat = el.getAttribute('data-cat'); audit.limit = 30; renderAudit(); });
  $('#audit-more').addEventListener('click', function () { audit.limit += 30; renderAudit(); });
  $('#audit-csv').addEventListener('click', function () {
    var rows = [['Waktu', 'Kategori', 'Kejadian', 'Oleh']];
    auditList().forEach(function (e) { rows.push([f.dateTime(e.at) + ' ' + new Date(e.at).getFullYear(), e.cat, e.what, e.who]); });
    U.downloadCSV('costcare-audit-' + S.todayKey() + '.csv', rows); U.toast((rows.length - 1) + ' kejadian diekspor');
  });

  $('#reset-btn').addEventListener('click', function () {
    U.confirm({ title: 'Reset data demo?', text: 'Semua perubahan (transaksi baru, pembayaran, pengaturan) dihapus dan data contoh dibuat ulang. Tidak bisa dibatalkan.', confirmLabel: 'Reset data', danger: true }).then(function (ok) {
      if (!ok) return;
      var uid = user.id;
      S.reset(); S.loginAs(uid); sessionStorage.clear();
      S.audit('Data', 'Data demo direset', user.name); S.commit();
      location.reload();
    });
  });
  $('#backup-btn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(S.state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'costcare-data-demo-' + S.todayKey() + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  });

  renderAll();
})();
