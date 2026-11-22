/* CostCare — utilitas UI bersama: format, navigasi, sesi, modal, toast, cetak, CSV. */
(function (global) {
  'use strict';
  var S = global.CC.store;
  var doc = global.document;

  // ---------- format ----------
  var nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function num(n, dec) {
    if (n == null || isNaN(n)) return '—';
    if (dec === 1) return nf1.format(n);
    if (dec === 'auto') return Number.isInteger(Math.round(n * 10) / 10) ? nf0.format(n) : nf1.format(n);
    return nf0.format(n);
  }
  var fmt = {
    num: num,
    rp: function (n) { return n == null || isNaN(n) ? '—' : 'Rp' + nf0.format(Math.round(n)); },
    kg: function (n) { return n == null || isNaN(n) ? '—' : num(n, 'auto') + ' kg'; },
    ton: function (kg) { return kg == null ? '—' : nf1.format(kg / 1000); },
    pct: function (n) { return n == null ? '—' : num(n, 'auto') + '%'; },
    short: function (n) {
      if (n >= 1e9) return 'Rp' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M';
      if (n >= 1e6) return 'Rp' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
      return fmt.rp(n);
    },
    time: function (ts) { if (!ts) return '—'; var d = new Date(ts); return S.pad(d.getHours()) + ':' + S.pad(d.getMinutes()); },
    timeSec: function (ts) { var d = new Date(ts); return S.pad(d.getHours()) + ':' + S.pad(d.getMinutes()) + ':' + S.pad(d.getSeconds()); },
    date: function (ts) { return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); },
    dateShort: function (ts) { return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); },
    dateLong: function (ts) { return new Date(ts).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); },
    dayName: function (ts) { return new Date(ts).toLocaleDateString('id-ID', { weekday: 'short' }); },
    dateTime: function (ts) { return fmt.dateShort(ts) + ' · ' + fmt.time(ts); },
    rel: function (ts) {
      var m = Math.round((Date.now() - ts) / 60000);
      if (m < 1) return 'baru saja';
      if (m < 60) return m + ' mnt lalu';
      if (m < 1440) return Math.floor(m / 60) + ' jam lalu';
      return fmt.dateShort(ts);
    }
  };
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function parseNum(v) {
    if (typeof v === 'number') return v;
    var s = String(v || '').trim().replace(/\s/g, '');
    if (!s) return NaN;
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/[.,](?=\d{3}(\D|$))/g, '');
    return Number(s.replace(/[^\d.-]/g, ''));
  }
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function on(root, type, selector, fn) {
    root.addEventListener(type, function (e) {
      var el = e.target.closest(selector);
      if (el && root.contains(el)) fn(e, el);
    });
  }

  // ---------- status & chip ----------
  var TRX_STATUS = {
    jalan: ['Berjalan', 'chip-info'],
    review: ['Perlu review', 'chip-warn'],
    selesai: ['Selesai', 'chip-done'],
    batal: ['Dibatalkan', '']
  };
  var INV_STATUS = {
    belum: ['Belum dibayar', 'chip-bad', '#D9412F'],
    sebagian: ['Dibayar sebagian', 'chip-warn', '#E39B19'],
    sengketa: ['Disengketakan', 'chip-purple', '#7A5BC7'],
    lunas: ['Lunas', 'chip-ok', '#80B014']
  };
  var SUP_STATUS = {
    ok: ['Terverifikasi', 'chip-done'],
    baru: ['Baru', 'chip-info'],
    review: ['Perlu review', 'chip-warn'],
    blokir: ['Diblokir', 'chip-bad']
  };
  function chip(label, cls, small) { return '<span class="chip ' + (cls || '') + (small ? ' chip-sm' : '') + '"><span class="dot"></span>' + esc(label) + '</span>'; }
  function trxChip(t, small) { var s = TRX_STATUS[t.status] || ['—', '']; return chip(s[0], s[1], small); }
  function invChip(inv, small) { var s = INV_STATUS[S.invoiceStatus(inv)]; return chip(s[0], s[1], small); }
  function supChip(sup, small) { var s = SUP_STATUS[sup.status] || ['—', '']; return chip(s[0], s[1], small); }
  function payChipForTrx(t) {
    if (t.status === 'review') return '<span class="chip">Menunggu review</span>';
    if (t.status !== 'selesai') return '<span class="chip">—</span>';
    var inv = S.invoiceOfTrx(t.id);
    return inv ? invChip(inv) : '<span class="chip">—</span>';
  }
  function plate(p, small) { return '<span class="plate' + (small ? ' plate-sm' : '') + '">' + esc(p) + '</span>'; }

  // ---------- navigasi & hak akses ----------
  var NAV = [
    { key: 'ringkasan', label: 'Ringkasan', href: 'ringkasan.html', roles: ['pemilik', 'admin', 'auditor'] },
    { key: 'timbang', label: 'Timbang', href: 'timbang.html', roles: ['pemilik', 'admin', 'operator'], weigh: true },
    { key: 'transaksi', label: 'Transaksi', href: 'transaksi.html', roles: ['pemilik', 'admin', 'operator', 'auditor'], badge: true },
    { key: 'supplier', label: 'Supplier', href: 'supplier.html', roles: ['pemilik', 'admin', 'operator'] },
    { key: 'harga', label: 'Harga', href: 'harga.html', roles: ['pemilik', 'admin'] },
    { key: 'pembayaran', label: 'Pembayaran', href: 'pembayaran.html', roles: ['pemilik', 'admin'] },
    { key: 'laporan', label: 'Laporan', href: 'laporan.html', roles: ['pemilik', 'admin', 'auditor'] },
    { key: 'pengaturan', label: 'Pengaturan', href: 'pengaturan.html', roles: ['pemilik', 'auditor'] }
  ];
  var HOME = { pemilik: 'ringkasan.html', admin: 'ringkasan.html', operator: 'timbang.html', auditor: 'ringkasan.html' };
  function can(user, key) { var n = NAV.filter(function (x) { return x.key === key; })[0]; return !!(user && n && n.roles.indexOf(user.role) !== -1); }
  // izin tindakan
  var ACTIONS = {
    weigh: ['pemilik', 'admin', 'operator'],
    approveTrx: ['pemilik', 'admin'],
    requestCorrection: ['pemilik', 'admin'],
    approveCorrection: ['pemilik'],
    cancelTrx: ['pemilik', 'admin', 'operator'],
    editSupplier: ['pemilik', 'admin'],
    blockCard: ['pemilik', 'admin'],
    proposePrice: ['pemilik', 'admin'],
    approvePrice: ['pemilik'],
    toggleDeduction: ['pemilik'],
    recordPayment: ['pemilik', 'admin'],
    resolveDispute: ['pemilik'],
    editRules: ['pemilik'],
    manageUsers: ['pemilik'],
    testDevice: ['pemilik', 'admin', 'operator'],
    resetDemo: ['pemilik']
  };
  function allowed(action, user) { user = user || S.currentUser(); return !!(user && ACTIONS[action] && ACTIONS[action].indexOf(user.role) !== -1); }

  function reviewCount() { return S.state.transactions.filter(function (t) { return t.status === 'review'; }).length; }

  function renderTopbar(user, pageKey) {
    var bar = $('#topbar');
    if (!bar) return;
    var items = NAV.filter(function (n) { return n.roles.indexOf(user.role) !== -1; });
    var rc = reviewCount();
    var nav = items.map(function (n) {
      var cur = n.key === pageKey ? ' aria-current="page"' : '';
      var cls = n.weigh ? ' class="nav-weigh"' : '';
      var inner = (n.weigh ? '<span class="live" aria-hidden="true"></span>' : '') + esc(n.label) +
        (n.badge && rc && user.role !== 'operator' ? ' <span class="count-badge" aria-label="' + rc + ' perlu review">' + rc + '</span>' : '');
      return '<a href="' + n.href + '"' + cur + cls + '>' + inner + '</a>';
    }).join('');
    if (user.role === 'operator') nav += '<span class="nav-note">Akses Operator</span>';
    if (user.role === 'auditor') nav += '<span class="nav-note">Baca saja</span>';
    var site = S.state.settings.site;
    bar.innerHTML =
      '<a class="brand" href="' + HOME[user.role] + '" aria-label="CostCare beranda"><img src="../assets/img/costcare-logo.png" alt="CostCare"></a>' +
      '<nav class="nav" aria-label="Navigasi utama">' + nav + '</nav>' +
      '<div class="topbar-right">' +
        '<span class="demo-badge" title="Semua angka adalah data demo">DATA DEMO</span>' +
        '<div class="user-menu">' +
          '<button type="button" class="user-btn" id="user-btn" aria-haspopup="true" aria-expanded="false">' +
            '<span class="meta"><b>' + esc(user.name) + '</b><small>' + esc(S.ROLE_LABEL[user.role]) + ' · ' + esc(site) + '</small></span>' +
            '<span class="avatar" aria-hidden="true">' + esc(user.initials) + '</span>' +
          '</button>' +
          '<div class="menu" id="user-menu" role="menu" hidden>' +
            '<div class="menu-head">Ganti peran (demo)</div>' +
            S.state.users.filter(function (u) { return ['U1', 'U2', 'U3', 'U6'].indexOf(u.id) !== -1; }).map(function (u) {
              return '<button type="button" role="menuitem" data-switch="' + u.id + '"' + (u.id === user.id ? ' aria-current="true"' : '') + '><span class="avatar" style="width:28px;height:28px;font-size:11px">' + esc(u.initials) + '</span>' + esc(S.ROLE_LABEL[u.role]) + '</button>';
            }).join('') +
            '<div class="sep"></div>' +
            '<a role="menuitem" href="../index.html">Lihat website publik</a>' +
            '<button type="button" role="menuitem" data-logout>Keluar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    var btn = $('#user-btn'), menu = $('#user-menu');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    doc.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('.user-menu')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { menu.hidden = true; btn.focus(); } });
    on(menu, 'click', '[data-switch]', function (e, el) {
      var u = S.loginAs(el.getAttribute('data-switch'));
      global.location.href = can(u, pageKey) ? global.location.pathname.split('/').pop() : HOME[u.role];
    });
    on(menu, 'click', '[data-logout]', function () {
      S.audit('Pengguna', 'Keluar dari aplikasi', user.name); S.commit();
      S.logout(); global.location.href = '../masuk.html';
    });
  }

  function refreshNavBadge() {
    var user = S.currentUser(); if (!user) return;
    var a = $('.nav a[href="transaksi.html"]'); if (!a) return;
    var b = a.querySelector('.count-badge'); var rc = reviewCount();
    if (user.role === 'operator') return;
    if (!rc && b) b.remove();
    else if (rc) { if (!b) { b = doc.createElement('span'); b.className = 'count-badge'; a.appendChild(b); } b.textContent = rc; b.setAttribute('aria-label', rc + ' perlu review'); }
  }

  // Panggil di awal tiap halaman aplikasi. Mengembalikan user bila boleh mengakses halaman.
  function boot(pageKey) {
    var user = S.currentUser();
    if (!user) {
      global.location.replace('../masuk.html?next=' + encodeURIComponent(global.location.pathname.split('/').pop()));
      return null;
    }
    renderTopbar(user, pageKey);
    if (!can(user, pageKey)) {
      var main = $('#main');
      main.innerHTML =
        '<section class="denied" role="alert">' +
          '<img src="../assets/img/costcare-mark.png" alt="">' +
          '<h1>Halaman ini tidak tersedia untuk peran Anda</h1>' +
          '<p>Anda masuk sebagai <b>' + esc(S.ROLE_LABEL[user.role]) + '</b>. Minta Pemilik RAM menambah akses, atau kembali ke halaman utama Anda.</p>' +
          '<a class="btn btn-primary btn-lg" href="' + HOME[user.role] + '">Ke halaman utama</a>' +
        '</section>';
      return null;
    }
    return user;
  }

  // ---------- toast ----------
  function toast(msg, kind) {
    var root = $('#toast-root');
    if (!root) { root = doc.createElement('div'); root.id = 'toast-root'; root.className = 'toast-root'; root.setAttribute('aria-live', 'polite'); doc.body.appendChild(root); }
    var t = doc.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
    t.innerHTML = '<span class="dot" aria-hidden="true"></span><span>' + esc(msg) + '</span>';
    root.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 3200);
  }

  // ---------- modal ----------
  var lastFocus = null;
  function modal(opts) {
    lastFocus = doc.activeElement;
    var back = doc.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<h2 id="modal-title">' + esc(opts.title) + '</h2>' + (opts.body || '') +
      '<div class="modal-actions">' + (opts.actions || []).map(function (a, i) {
        return '<button type="button" class="btn btn-lg ' + (a.cls || 'btn-outline') + '" data-i="' + i + '">' + esc(a.label) + '</button>';
      }).join('') + '</div></div>';
    doc.body.appendChild(back);
    var box = back.querySelector('.modal');
    function close() { back.remove(); doc.removeEventListener('keydown', onKey); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        var f = $$('button, input, select, textarea, a[href]', box).filter(function (x) { return !x.disabled; });
        if (!f.length) return;
        if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    doc.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    $$('.modal-actions button', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = opts.actions[+b.getAttribute('data-i')];
        var res = a.onClick ? a.onClick(box) : true;
        if (res !== false) close();
      });
    });
    var first = box.querySelector('input, select, textarea') || box.querySelector('.modal-actions button:last-child');
    if (first) setTimeout(function () { first.focus(); }, 20);
    return { close: close, el: box };
  }
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      modal({
        title: o.title, body: (o.html || '') + (o.text ? '<p>' + esc(o.text) + '</p>' : ''),
        actions: [
          { label: o.cancelLabel || 'Batal', cls: 'btn-outline', onClick: function () { resolve(false); } },
          { label: o.confirmLabel || 'Ya, lanjutkan', cls: o.danger ? 'btn-danger' : 'btn-primary', onClick: function (box) {
            if (o.validate) { var ok = o.validate(box); if (!ok) return false; }
            resolve(o.collect ? o.collect(box) : true);
          } }
        ]
      });
    });
  }

  // ---------- tiket ----------
  function ticketRows(t) {
    var c = S.calc(t);
    var ded = Object.keys(t.deductions || {}).filter(function (k) { return t.deductions[k] > 0; })
      .map(function (k) { return S.deductionName(k).toLowerCase() + ' ' + fmt.pct(t.deductions[k]); }).join(' · ');
    var rules = t.rules || S.state.settings;
    var rows = [
      ['Bruto', t.grossAt ? fmt.time(t.grossAt) + (t.grossManual ? ' · MANUAL' : ' · otomatis') : '', fmt.kg(t.gross), ''],
      ['Tara', t.tareAt ? fmt.time(t.tareAt) + (t.tareManual ? ' · MANUAL' : ' · otomatis') : 'belum diambil', fmt.kg(t.tare), t.tareManual ? 'warn-text' : ''],
      ['Netto', '', fmt.kg(c.netto), ''],
      ['Potongan ' + fmt.pct(c.pct), ded, rules.basis === 'harga' ? 'dari harga' : (c.potKg == null ? '—' : '− ' + fmt.kg(c.potKg)), 'warn-text'],
      ['Berat dibayar', rules.wround !== 'none' ? 'dibulatkan ' + rules.wround + ' kg' : '', fmt.kg(c.bayar), ''],
      ['Harga TBS', rules.basis === 'harga' ? 'bersih ' + fmt.rp(c.priceNet) : '', fmt.rp(t.price) + '/kg', '']
    ];
    return { c: c, rows: rows, rules: rules };
  }
  function ticketHTML(t, opts) {
    opts = opts || {};
    var r = ticketRows(t);
    return '<div class="ticket">' +
      (opts.noTitle ? '' : '<div class="card-head" style="padding-bottom:8px"><span class="ticket-title">TIKET TIMBANG</span>' + (opts.badge || '') + '</div>') +
      r.rows.map(function (x) { return '<div class="ticket-row"><span>' + esc(x[0]) + (x[1] ? ' <small>' + esc(x[1]) + '</small>' : '') + '</span><b class="' + x[3] + '">' + esc(x[2]) + '</b></div>'; }).join('') +
      '<div class="ticket-cut" aria-hidden="true"></div>' +
      '<div class="ticket-total"><span>Total dibayar</span><strong>' + fmt.rp(r.c.total) + '</strong></div>' +
      (opts.noNote ? '' : '<p class="ticket-note">Aturan: potongan dari ' + (r.rules.basis === 'harga' ? 'harga per kg' : 'berat netto') + ' · berat ' + (r.rules.wround === 'none' ? 'tidak dibulatkan' : 'dibulatkan ke ' + r.rules.wround + ' kg') + ' · total dibulatkan ke Rp' + num(r.rules.rround) + '.</p>') +
      '</div>';
  }
  function printDoc(html) {
    var area = $('#print-area');
    if (!area) { area = doc.createElement('div'); area.id = 'print-area'; doc.body.appendChild(area); }
    area.innerHTML = html;
    setTimeout(function () { global.print(); }, 50);
  }
  function printTicket(t) {
    var r = ticketRows(t);
    var s = S.supplier(t.supplierId);
    var st = S.state.settings;
    printDoc('<div class="print-doc"><img src="../assets/img/costcare-logo.png" alt="CostCare">' +
      '<h1>Tiket Timbang</h1><div>' + esc(st.site + ' · ' + st.city) + '</div>' +
      '<div class="row"><span>No.</span><b>' + esc(t.id) + '</b></div>' +
      '<div class="row"><span>Tanggal</span><span>' + esc(fmt.dateTime(t.at)) + '</span></div>' +
      '<div class="row"><span>Supplier</span><span>' + esc(s ? s.name + ' (' + s.id + ')' : '—') + '</span></div>' +
      '<div class="row"><span>Kendaraan</span><span>' + esc(t.plate) + '</span></div>' +
      '<div class="row"><span>Operator</span><span>' + esc(t.operator) + '</span></div>' +
      r.rows.map(function (x) { return '<div class="row"><span>' + esc(x[0]) + '</span><span>' + esc(x[2]) + '</span></div>'; }).join('') +
      '<div class="row total"><span>Total</span><span>' + fmt.rp(r.c.total) + '</span></div>' +
      '<div class="foot">Status: ' + esc((TRX_STATUS[t.status] || [''])[0]) + (t.tareManual ? ' · tara MANUAL' : '') + '<br>Dicetak ' + esc(fmt.dateTime(Date.now())) + ' · DATA DEMO</div></div>');
  }

  // ---------- CSV ----------
  function downloadCSV(name, rows) {
    var csv = rows.map(function (r) { return r.map(function (v) { var s = String(v == null ? '' : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = doc.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  }

  function emptyState(title, text, btnHtml) {
    return '<div class="empty"><img src="../assets/img/costcare-mark.png" alt=""><strong>' + esc(title) + '</strong>' + (text ? '<span>' + esc(text) + '</span>' : '') + (btnHtml || '') + '</div>';
  }
  function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }

  global.CC.ui = {
    fmt: fmt, esc: esc, parseNum: parseNum, $: $, $$: $$, on: on,
    chip: chip, trxChip: trxChip, invChip: invChip, supChip: supChip, payChipForTrx: payChipForTrx, plate: plate,
    TRX_STATUS: TRX_STATUS, INV_STATUS: INV_STATUS, SUP_STATUS: SUP_STATUS,
    NAV: NAV, HOME: HOME, can: can, allowed: allowed, boot: boot, refreshNavBadge: refreshNavBadge,
    toast: toast, modal: modal, confirm: confirmDialog,
    ticketHTML: ticketHTML, printTicket: printTicket, printDoc: printDoc, downloadCSV: downloadCSV,
    emptyState: emptyState, initials: initials
  };
})(window);
