/* CostCare — Supplier & Kendaraan. */
(function () {
  'use strict';
  var S = CC.store, U = CC.ui, f = U.fmt, esc = U.esc, $ = U.$;
  var user = U.boot('supplier');
  if (!user) return;

  var canEdit = U.allowed('editSupplier', user);
  var params = new URLSearchParams(location.search);
  var st = { kind: params.get('tab') === 'kendaraan' ? 'kendaraan' : 'supplier', q: '', filter: 'semua', sel: params.get('id') || 'SUP-00281', vq: '' };
  var PAY = ['Tunai', 'Transfer BRI', 'Transfer BNI', 'Transfer Mandiri', 'Transfer Bank Riau Kepri'];
  var TYPES = ['Colt Diesel', 'Fuso', 'Dump truck kecil', 'Pikap'];
  var AV = { ok: ['#DCEAE4', '#24453C'], baru: ['#E4ECFA', '#2850A8'], review: ['#FFF0D2', '#8F5300'], blokir: ['#FDE6E1', '#A3261A'] };

  function stats30(sid) {
    var from = S.startOfDay(Date.now()) - 29 * S.DAY;
    var list = S.state.transactions.filter(function (t) { return t.supplierId === sid && t.at >= from && t.status !== 'batal'; });
    var a = S.aggregate(list);
    var pct = 0, n = 0;
    list.forEach(function (t) { if (t.sortAt) { pct += S.sumDed(t.deductions); n++; } });
    var unpaid = S.state.invoices.filter(function (i) { return i.supplierId === sid && S.invoiceStatus(i) !== 'lunas'; }).reduce(function (s, i) { return s + i.total - S.paidOf(i); }, 0);
    return { n: a.count, kg: a.netto, pot: n ? pct / n : null, unpaid: unpaid };
  }

  function filteredSuppliers() {
    var q = st.q.trim().toLowerCase();
    return S.state.suppliers.filter(function (s) {
      if (st.filter !== 'semua' && s.status !== st.filter) return false;
      if (!q) return true;
      var plates = S.vehiclesOf(s.id).map(function (v) { return v.plate; }).join(' ');
      return [s.name, s.id, s.rfid, plates, s.origin].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      var order = { review: 0, baru: 1, blokir: 2, ok: 3 };
      return (order[a.status] - order[b.status]) || a.name.localeCompare(b.name);
    });
  }

  function renderKind() {
    document.querySelectorAll('[data-kind]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-kind') === st.kind)); });
    $('#tab-supplier').hidden = st.kind !== 'supplier';
    $('#tab-kendaraan').hidden = st.kind !== 'kendaraan';
    var add = $('#add-btn');
    add.hidden = !canEdit;
    add.textContent = st.kind === 'supplier' ? '+ Tambah supplier' : '+ Tambah kendaraan';
    $('#subtitle').textContent = 'Data master · ' + S.state.suppliers.length + ' supplier · ' + S.state.vehicles.length + ' kendaraan';
  }

  function renderFilter() {
    var n = { semua: S.state.suppliers.length, ok: 0, baru: 0, review: 0, blokir: 0 };
    S.state.suppliers.forEach(function (s) { n[s.status]++; });
    var opts = [['semua', 'Semua'], ['review', 'Perlu review'], ['baru', 'Baru'], ['blokir', 'Diblokir'], ['ok', 'Terverifikasi']];
    $('#sfilter').innerHTML = opts.filter(function (o) { return o[0] === 'semua' || n[o[0]]; }).map(function (o) {
      return '<button type="button" role="tab" class="pilltab' + (o[0] === 'review' ? ' warn' : '') + '" style="height:34px;font-size:12.5px;background:' + (st.filter === o[0] ? '' : 'var(--ground)') + '" data-filter="' + o[0] + '" aria-selected="' + (st.filter === o[0]) + '">' + o[1] + '<span class="n">' + n[o[0]] + '</span></button>';
    }).join('');
  }

  function renderList() {
    var list = filteredSuppliers();
    $('#slist').innerHTML = list.length ? list.map(function (s) {
      var av = AV[s.status];
      return '<button type="button" class="sup-row" data-sid="' + s.id + '" aria-pressed="' + (s.id === st.sel) + '">' +
        '<span class="av" style="background:' + av[0] + ';color:' + av[1] + '">' + esc(U.initials(s.name)) + '</span>' +
        '<span class="info"><b>' + esc(s.name) + '</b><small>' + esc(s.id + ' · ' + (s.rfid ? (s.status === 'blokir' ? 'kartu diblokir' : s.rfid) : 'tanpa kartu')) + '</small></span>' +
        (s.status !== 'ok' ? U.supChip(s, true) : '') + '</button>';
    }).join('') : U.emptyState('Supplier tidak ditemukan', 'Coba kata kunci lain.');
    $('#scount').textContent = list.length + ' dari ' + S.state.suppliers.length + ' supplier';
  }

  function renderProfile() {
    var s = S.supplier(st.sel);
    var box = $('#profile');
    if (!s) { box.innerHTML = '<div class="card">' + U.emptyState('Pilih supplier', 'Klik nama supplier di daftar.') + '</div>'; return; }
    var m = stats30(s.id);
    var veh = S.vehiclesOf(s.id);
    var hist = S.state.transactions.filter(function (t) { return t.supplierId === s.id; }).sort(function (a, b) { return b.at - a.at; }).slice(0, 8);
    var cardClass = { ok: '', baru: ' st-baru', review: ' st-review', blokir: ' st-blokir' }[s.status];
    var chipCls = { ok: 'chip-lime', baru: 'chip-info', review: 'chip-warn', blokir: 'chip-bad' }[s.status];
    var html = '<div class="card" style="flex-direction:row;flex-wrap:wrap;gap:20px">' +
      '<div class="rfid-card' + cardClass + '" style="flex:1 1 280px;max-width:380px">' +
        '<img class="watermark" src="../assets/img/costcare-mark.png" alt="" style="right:-40px;top:-44px;width:170px;opacity:.16">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><span class="label">KARTU SUPPLIER · RFID</span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CFE3DB" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8.5 8a6 6 0 0 1 0 8"/><path d="M12 5a10 10 0 0 1 0 14"/><path d="M5 10.5a2.5 2.5 0 0 1 0 3"/></svg></div>' +
        '<div style="display:flex;align-items:center;gap:14px"><span class="chipcard" aria-hidden="true"></span><span style="min-width:0"><h2 class="name" style="font-size:22px">' + esc(s.name) + '</h2><div class="ids">' + esc(s.id + ' · ' + (s.rfid || 'belum ada kartu')) + '</div></span></div>' +
        '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px"><span class="xs" style="color:var(--on-dark-2)">sejak ' + f.date(s.since) + '</span><span class="chip ' + chipCls + '"><span class="dot"></span>' + esc(U.SUP_STATUS[s.status][0]) + '</span></div>' +
      '</div>' +
      '<div style="flex:1 1 260px;display:flex;flex-direction:column;gap:12px;min-width:0">' +
        '<span class="small muted-2">' + esc('WA ' + s.phone + ' · ' + (s.pay || 'metode bayar belum diisi') + (s.contact ? ' · ' + s.contact : '')) + '</span>' +
        '<div class="mini-stats soft"><div><div class="k">Transaksi 30 hari</div><div class="v" style="font-size:22px">' + m.n + '</div></div><div><div class="k">Netto 30 hari</div><div class="v" style="font-size:22px">' + f.ton(m.kg) + ' t</div></div>' +
        '<div><div class="k">Rata-rata potongan</div><div class="v" style="font-size:22px">' + (m.pot == null ? '—' : f.num(m.pot, 1) + '%') + '</div></div><div><div class="k">Belum dibayar</div><div class="v" style="font-size:16px;line-height:1.7">' + f.rp(m.unpaid) + '</div></div></div>' +
        (canEdit ? '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          '<button type="button" class="btn btn-sm btn-outline btn-pill" id="edit-btn">Ubah data</button>' +
          '<button type="button" class="btn btn-sm btn-outline btn-pill" id="card-btn">' + (s.rfid ? 'Ganti kartu' : 'Pasang kartu') + '</button>' +
          (s.rfid ? (s.status === 'blokir' ? '<button type="button" class="btn btn-sm btn-pill btn-teal" id="unblock-btn">Aktifkan kartu</button>' : '<button type="button" class="btn btn-sm btn-pill btn-danger-outline" id="block-btn">Blokir kartu</button>') : '') +
        '</div>' : '') +
      '</div></div>';

    if (s.note || s.status === 'review') {
      var cls = { baru: 'info', review: 'warn', blokir: 'bad', ok: 'info' }[s.status];
      html += '<div class="notice ' + cls + '"><span class="ic">!</span><span style="flex:1"><strong>' + esc(U.SUP_STATUS[s.status][0]) + '</strong>' + esc(s.note || '') +
        (s.status === 'review' && canEdit && s.dupOf ? '<span style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><button type="button" class="btn btn-sm btn-dark" id="merge-btn">Gabungkan ke ' + esc(s.dupOf) + '</button><button type="button" class="btn btn-sm btn-outline" id="distinct-btn">Tandai supplier berbeda</button></span>' : '') +
        (s.status === 'baru' && canEdit ? '<span style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sm btn-dark" id="complete-btn">Lengkapi data</button></span>' : '') +
        '</span></div>';
    }

    html += '<div class="row stretch">' +
      '<div class="card f1" style="flex-basis:240px"><div class="card-head"><h3 class="card-title" style="font-size:15px">Kendaraan terhubung</h3>' + (canEdit ? '<button type="button" class="btn-link" id="add-veh-btn" style="min-height:32px">+ Tambah</button>' : '') + '</div>' +
        (veh.length ? veh.map(function (v) { return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' + U.plate(v.plate) + '<span class="small muted-2">' + esc(v.type) + ' · tara ' + (v.tareMin ? f.num(v.tareMin) + '–' + f.num(v.tareMax) + ' kg' : 'belum ada') + '</span></div>'; }).join('') : '<p class="small muted-2">Belum ada kendaraan.</p>') + '</div>' +
      '<div class="card card-mint f1" style="flex-basis:200px;gap:6px"><h3 class="card-title" style="font-size:15px">Asal kebun</h3><span style="font-size:18px;font-weight:600">' + esc(s.origin || '—') + '</span><span class="xs" style="color:var(--mint-ink)">Sesuai pengakuan supplier — belum diverifikasi lapangan</span></div>' +
      '</div>';

    html += '<div class="card" style="padding:20px 12px 12px"><div class="card-head" style="padding:0 12px"><h3 class="card-title" style="font-size:16px">Riwayat transaksi</h3><a class="small strong" href="transaksi.html?q=' + encodeURIComponent(s.id) + '">Buka di Transaksi →</a></div>' +
      (hist.length ? '<div class="table-wrap"><table class="rows" style="min-width:620px"><thead><tr><th>Tanggal</th><th>No.</th><th class="right">Netto · potongan</th><th class="right">Harga</th><th class="right">Total</th><th>Status</th></tr></thead><tbody>' +
        hist.map(function (t) {
          var c = S.calc(t);
          return '<tr class="is-clickable" data-href="transaksi.html?id=' + encodeURIComponent(t.id) + '"><td>' + f.dateShort(t.at) + '</td><td class="mono small">' + esc(t.id) + '</td><td class="right">' + (c.netto == null ? '—' : f.kg(c.netto) + ' · ' + f.pct(c.pct)) + '</td><td class="right">' + f.rp(t.price) + '</td><td class="right strong">' + f.rp(c.total) + '</td><td>' + U.trxChip(t, true) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : U.emptyState('Belum ada transaksi', 'Riwayat muncul setelah supplier ini menimbang.')) + '</div>';
    box.innerHTML = html;
  }

  function renderVehicles() {
    var q = st.vq.trim().toLowerCase();
    var from = S.startOfDay(Date.now()) - 29 * S.DAY;
    var count = {};
    S.state.transactions.forEach(function (t) { if (t.at >= from && t.status !== 'batal') count[t.plate] = (count[t.plate] || 0) + 1; });
    var list = S.state.vehicles.filter(function (v) {
      return !q || [v.plate, v.type, S.supplierName(v.supplierId)].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return (count[b.plate] || 0) - (count[a.plate] || 0); });
    var ST = { aktif: ['Aktif', 'chip-done'], baru: ['Baru', 'chip-info'], nonaktif: ['Nonaktif', ''] };
    $('#vlist').innerHTML = list.map(function (v) {
      var s = ST[v.status] || ST.aktif;
      return '<tr><td>' + U.plate(v.plate) + '</td><td>' + esc(v.type) + '</td><td><a href="?id=' + v.supplierId + '" data-goto="' + v.supplierId + '" class="strong" style="color:inherit">' + esc(S.supplierName(v.supplierId)) + '</a></td>' +
        '<td class="right">' + (v.tareMin ? f.num(v.tareMin) + '–' + f.num(v.tareMax) + ' kg' : '<span class="muted">belum ada</span>') + '</td><td class="right">' + (count[v.plate] || 0) + '</td><td>' + U.chip(s[0], s[1], true) + '</td>' +
        '<td class="right">' + (canEdit ? '<button type="button" class="btn btn-sm btn-outline" data-vtoggle="' + esc(v.plate) + '">' + (v.status === 'nonaktif' ? 'Aktifkan' : 'Nonaktifkan') + '</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="7">' + U.emptyState('Kendaraan tidak ditemukan', '') + '</td></tr>';
    $('#vcount').textContent = list.length + ' kendaraan';
  }

  function renderAll() { renderKind(); renderFilter(); renderList(); renderProfile(); renderVehicles(); }

  // ---------- form ----------
  function supplierForm(s) {
    var isNew = !s; s = s || {};
    return '<div class="form-grid">' +
      '<div class="field"><label for="f-name">Nama lengkap / badan usaha</label><input class="input" id="f-name" value="' + esc(s.name || '') + '"></div>' +
      '<div class="field"><label for="f-phone">No. HP / WhatsApp</label><input class="input" id="f-phone" type="tel" inputmode="tel" value="' + esc(s.phone || '') + '" placeholder="08xx-xxxx-xxxx"></div>' +
      '<div class="field"><label for="f-origin">Asal kebun (desa/kecamatan)</label><input class="input" id="f-origin" value="' + esc(s.origin || '') + '"></div>' +
      '<div class="field"><label for="f-pay">Metode bayar</label><select class="input" id="f-pay"><option value="">— pilih —</option>' + PAY.map(function (p) { return '<option' + (p === s.pay ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></div>' +
      (isNew ? '<div class="field"><label for="f-plate">Plat kendaraan (opsional)</label><input class="input" id="f-plate" placeholder="BM 1234 XX"></div>' : '') +
      '</div>' +
      (isNew ? '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:18px;box-shadow:inset 0 0 0 1.5px #B3C2B0"><span class="small">Kartu RFID: <b id="f-card">belum dipasang</b></span><button type="button" class="btn btn-sm btn-outline btn-pill" id="f-tap">Simulasikan tap kartu</button></div>' : '') +
      '<p class="field-error" id="f-err" hidden></p>';
  }
  function readForm(box) {
    return { name: box.querySelector('#f-name').value.trim(), phone: box.querySelector('#f-phone').value.trim(), origin: box.querySelector('#f-origin').value.trim(), pay: box.querySelector('#f-pay').value,
      plate: box.querySelector('#f-plate') ? box.querySelector('#f-plate').value.trim().toUpperCase() : '', card: box.querySelector('#f-card') ? box.querySelector('#f-card').getAttribute('data-card') : null };
  }
  function validate(box) {
    var d = readForm(box), err = '';
    if (d.name.length < 3) err = 'Nama minimal 3 huruf.';
    else if (!/^[0-9+\-\s]{9,16}$/.test(d.phone)) err = 'Nomor HP tidak valid (9–16 digit).';
    else if (d.origin.length < 3) err = 'Isi asal kebun.';
    else if (d.plate && !/^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{0,3}$/.test(d.plate)) err = 'Format plat tidak valid, contoh BM 1234 XX.';
    else if (d.plate && S.vehicle(d.plate.replace(/\s+/g, ' '))) err = 'Plat ' + d.plate + ' sudah terdaftar.';
    var e = box.querySelector('#f-err'); e.hidden = !err; e.textContent = err;
    ['#f-name', '#f-phone', '#f-origin'].forEach(function (id) { box.querySelector(id).removeAttribute('aria-invalid'); });
    if (err) { var map = { 'Nama': '#f-name', 'Nomor': '#f-phone', 'Isi asal': '#f-origin' }; Object.keys(map).forEach(function (k) { if (err.indexOf(k) === 0) box.querySelector(map[k]).setAttribute('aria-invalid', 'true'); }); }
    return !err;
  }
  function newCardId() { return 'RF-' + Math.floor(4096 + Math.random() * 61439).toString(16).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 8999); }

  function addSupplier() {
    var m = U.modal({
      title: 'Tambah supplier', wide: true, body: supplierForm(null),
      actions: [{ label: 'Batal' }, { label: 'Simpan supplier', cls: 'btn-primary', onClick: function (box) {
        if (!validate(box)) return false;
        var d = readForm(box);
        var max = 0; S.state.suppliers.forEach(function (s) { var n = parseInt(s.id.slice(4), 10); if (n > max) max = n; });
        var id = 'SUP-' + S.pad(max + 1, 5);
        var dup = S.state.suppliers.filter(function (s) { return s.phone.replace(/\D/g, '') === d.phone.replace(/\D/g, '') || s.name.toLowerCase() === d.name.toLowerCase(); })[0];
        var sup = { id: id, name: d.name, phone: d.phone, origin: d.origin, pay: d.pay, rfid: d.card || '', since: Date.now(), contact: '', dupOf: dup ? dup.id : '',
          status: dup ? 'review' : (d.card && d.pay ? 'ok' : 'baru'),
          note: dup ? 'Kemungkinan duplikat dari ' + dup.id + ' ' + dup.name + ': nama atau nomor HP sama.' : (d.card && d.pay ? '' : 'Supplier baru — lengkapi ' + [!d.pay ? 'metode pembayaran' : '', !d.card ? 'kartu RFID' : ''].filter(Boolean).join(' dan ') + '.') };
        S.state.suppliers.push(sup);
        if (d.plate) S.state.vehicles.push({ plate: d.plate.replace(/\s+/g, ' '), type: 'Belum diisi', supplierId: id, tareMin: null, tareMax: null, status: 'baru' });
        S.audit('Supplier', 'Supplier baru ' + id + ' · ' + d.name + (dup ? ' (dugaan duplikat ' + dup.id + ')' : ''), user.name);
        S.commit();
        st.sel = id; st.filter = 'semua';
        U.toast(dup ? 'Tersimpan · ditandai dugaan duplikat' : 'Supplier ' + d.name + ' tersimpan', dup ? 'warn' : '');
        renderAll();
      } }]
    });
    m.el.querySelector('#f-tap').addEventListener('click', function () {
      var c = newCardId(); var el = m.el.querySelector('#f-card');
      el.textContent = c + ' terbaca (simulasi)'; el.setAttribute('data-card', c); this.textContent = 'Tap ulang';
    });
  }

  function editSupplier(s) {
    U.modal({
      title: 'Ubah data · ' + s.name, wide: true, body: supplierForm(s),
      actions: [{ label: 'Batal' }, { label: 'Simpan', cls: 'btn-primary', onClick: function (box) {
        if (!validate(box)) return false;
        var d = readForm(box);
        s.name = d.name; s.phone = d.phone; s.origin = d.origin; s.pay = d.pay;
        if (s.status === 'baru' && s.pay && s.rfid) { s.status = 'ok'; s.note = ''; }
        else if (s.status === 'baru') s.note = 'Supplier baru — lengkapi ' + [!s.pay ? 'metode pembayaran' : '', !s.rfid ? 'kartu RFID' : ''].filter(Boolean).join(' dan ') + '.';
        S.audit('Supplier', 'Data ' + s.id + ' diubah', user.name); S.commit();
        U.toast('Data supplier tersimpan'); renderAll();
      } }]
    });
  }

  function addVehicle(sid) {
    var opts = S.state.suppliers.filter(function (s) { return s.status !== 'blokir'; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    U.modal({
      title: 'Tambah kendaraan',
      body: '<div class="form-grid"><div class="field"><label for="v-plate">Plat nomor</label><input class="input" id="v-plate" placeholder="BM 1234 XX"></div>' +
        '<div class="field"><label for="v-type">Jenis</label><select class="input" id="v-type">' + TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label for="v-sup">Supplier</label><select class="input" id="v-sup">' + opts.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sid ? ' selected' : '') + '>' + esc(s.name + ' · ' + s.id) + '</option>'; }).join('') + '</select></div>' +
        '<p class="small muted-2">Rentang tara terisi otomatis setelah kendaraan ditimbang pertama kali.</p><p class="field-error" id="v-err" hidden></p>',
      actions: [{ label: 'Batal' }, { label: 'Simpan kendaraan', cls: 'btn-primary', onClick: function (box) {
        var plate = box.querySelector('#v-plate').value.trim().toUpperCase().replace(/\s+/g, ' ');
        var err = !/^[A-Z]{1,2} ?\d{1,4} ?[A-Z]{0,3}$/.test(plate) ? 'Format plat tidak valid, contoh BM 1234 XX.' : S.vehicle(plate) ? 'Plat sudah terdaftar.' : '';
        var e = box.querySelector('#v-err'); e.hidden = !err; e.textContent = err;
        box.querySelector('#v-plate').setAttribute('aria-invalid', String(!!err));
        if (err) return false;
        var supId = box.querySelector('#v-sup').value;
        S.state.vehicles.push({ plate: plate, type: box.querySelector('#v-type').value, supplierId: supId, tareMin: null, tareMax: null, status: 'baru' });
        S.audit('Supplier', 'Kendaraan ' + plate + ' ditambahkan ke ' + supId, user.name); S.commit();
        U.toast('Kendaraan ' + plate + ' tersimpan'); renderAll();
      } }]
    });
  }

  // ---------- event ----------
  var main = $('#main');
  U.on(main, 'click', '[data-kind]', function (e, el) { st.kind = el.getAttribute('data-kind'); renderKind(); });
  U.on(main, 'click', '[data-filter]', function (e, el) { st.filter = el.getAttribute('data-filter'); renderFilter(); renderList(); });
  U.on(main, 'click', '[data-sid]', function (e, el) {
    st.sel = el.getAttribute('data-sid'); renderList(); renderProfile();
    history.replaceState(null, '', '?id=' + st.sel);
    if (window.innerWidth < 900) $('#profile').scrollIntoView({ behavior: 'smooth' });
  });
  U.on(main, 'click', '[data-goto]', function (e, el) { e.preventDefault(); st.sel = el.getAttribute('data-goto'); st.kind = 'supplier'; st.filter = 'semua'; renderAll(); });
  U.on(main, 'click', 'tr[data-href]', function (e, el) { location.href = el.getAttribute('data-href'); });
  $('#sq').addEventListener('input', function () { st.q = this.value; renderList(); });
  $('#vq').addEventListener('input', function () { st.vq = this.value; renderVehicles(); });
  $('#add-btn').addEventListener('click', function () { if (st.kind === 'supplier') addSupplier(); else addVehicle(null); });
  U.on(main, 'click', '#edit-btn', function () { editSupplier(S.supplier(st.sel)); });
  U.on(main, 'click', '#complete-btn', function () { editSupplier(S.supplier(st.sel)); });
  U.on(main, 'click', '#add-veh-btn', function () { addVehicle(st.sel); });
  U.on(main, 'click', '#card-btn', function () {
    var s = S.supplier(st.sel);
    U.confirm({ title: (s.rfid ? 'Ganti kartu ' : 'Pasang kartu untuk ') + s.name + '?', text: s.rfid ? 'Kartu lama ' + s.rfid + ' langsung tidak berlaku. Tempel kartu baru di pembaca (disimulasikan).' : 'Tempel kartu baru di pembaca (disimulasikan).', confirmLabel: 'Tap kartu baru' }).then(function (ok) {
      if (!ok) return;
      var old = s.rfid; s.rfid = newCardId();
      if (s.status === 'blokir') { s.status = 'ok'; s.note = ''; }
      if (s.status === 'baru' && s.pay) { s.status = 'ok'; s.note = ''; }
      S.audit('Supplier', s.id + ' · kartu ' + (old ? old + ' diganti ' : 'baru ') + s.rfid, user.name); S.commit();
      U.toast('Kartu ' + s.rfid + ' aktif'); renderAll();
    });
  });
  U.on(main, 'click', '#block-btn', function () {
    var s = S.supplier(st.sel);
    U.confirm({ title: 'Blokir kartu ' + s.rfid + '?', danger: true, confirmLabel: 'Blokir kartu',
      html: '<p>Tap kartu ini akan ditolak di Timbang. Data dan riwayat supplier tetap tersimpan.</p><div class="field"><label for="b-reason">Alasan</label><select class="input" id="b-reason"><option>Kartu dilaporkan hilang</option><option>Kartu rusak</option><option>Dugaan penyalahgunaan</option></select></div>',
      collect: function (box) { return box.querySelector('#b-reason').value; } }).then(function (reason) {
      if (!reason) return;
      s.status = 'blokir'; s.note = reason + ' · diblokir oleh ' + user.name + ' ' + f.dateShort(Date.now()) + '. Tap kartu ini ditolak di Timbang.';
      S.audit('Supplier', s.id + ' · kartu ' + s.rfid + ' diblokir (' + reason + ')', user.name); S.commit();
      U.toast('Kartu diblokir', 'warn'); renderAll();
    });
  });
  U.on(main, 'click', '#unblock-btn', function () {
    var s = S.supplier(st.sel);
    U.confirm({ title: 'Aktifkan lagi kartu ' + s.rfid + '?', text: 'Gunakan hanya bila kartu sudah ditemukan kembali. Untuk kartu hilang, lebih aman ganti kartu baru.', confirmLabel: 'Aktifkan' }).then(function (ok) {
      if (!ok) return;
      s.status = 'ok'; s.note = '';
      S.audit('Supplier', s.id + ' · kartu ' + s.rfid + ' diaktifkan kembali', user.name); S.commit();
      U.toast('Kartu aktif kembali'); renderAll();
    });
  });
  U.on(main, 'click', '#merge-btn', function () {
    var s = S.supplier(st.sel), target = S.supplier(s.dupOf);
    U.confirm({ title: 'Gabungkan ke ' + target.name + '?', text: 'Kendaraan dan transaksi ' + s.id + ' dipindah ke ' + target.id + '. ' + s.id + ' dinonaktifkan. Keputusan tercatat di audit.', confirmLabel: 'Gabungkan' }).then(function (ok) {
      if (!ok) return;
      S.state.vehicles.forEach(function (v) { if (v.supplierId === s.id) v.supplierId = target.id; });
      S.state.transactions.forEach(function (t) { if (t.supplierId === s.id) t.supplierId = target.id; });
      S.state.suppliers = S.state.suppliers.filter(function (x) { return x.id !== s.id; });
      S.audit('Supplier', s.id + ' digabung ke ' + target.id, user.name); S.commit();
      st.sel = target.id; history.replaceState(null, '', '?id=' + target.id);
      U.toast('Data digabung ke ' + target.id); renderAll();
    });
  });
  U.on(main, 'click', '#distinct-btn', function () {
    var s = S.supplier(st.sel);
    s.status = s.rfid && s.pay ? 'ok' : 'baru'; s.note = ''; s.dupOf = '';
    S.audit('Supplier', s.id + ' ditandai berbeda dari dugaan duplikat', user.name); S.commit();
    U.toast('Ditandai sebagai supplier berbeda'); renderAll();
  });
  U.on(main, 'click', '[data-vtoggle]', function (e, el) {
    var v = S.vehicle(el.getAttribute('data-vtoggle'));
    v.status = v.status === 'nonaktif' ? (v.tareMin ? 'aktif' : 'baru') : 'nonaktif';
    S.audit('Supplier', 'Kendaraan ' + v.plate + ' ' + (v.status === 'nonaktif' ? 'dinonaktifkan' : 'diaktifkan'), user.name); S.commit();
    renderVehicles();
  });

  if (!S.supplier(st.sel)) st.sel = S.state.suppliers[0].id;
  renderAll();
})();
