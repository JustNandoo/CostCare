# CostCare — Prototipe Front-end

Prototipe web **CostCare**: sistem timbang dan pembelian TBS untuk RAM sawit.
Dibuat dari desain CostCare dengan HTML, CSS, dan JavaScript murni (tanpa framework, tanpa build tool).
Semua data adalah **data demo** yang disimpan di browser (`localStorage`). Tidak ada backend.

## Cara menjalankan

Cara paling mudah: buka `index.html` atau `masuk.html` langsung di browser (klik dua kali).

Atau jalankan server lokal dari folder proyek:

```bash
python3 -m http.server 5173
```

lalu buka <http://localhost:5173>. Di WebStorm, klik kanan `index.html` → **Open in Browser**.

> Font Poppins dimuat dari Google Fonts, jadi perlu internet agar tampilan sesuai.

## Akun demo

Kata sandi semua akun: `demo123` (atau klik kartu akun di halaman Masuk).

| Peran | Email | Halaman utama |
|---|---|---|
| Operator timbangan | rina@costcare.id | Timbang Langsung |
| Admin & keuangan | maya@costcare.id | Ringkasan |
| Pemilik | hasan@costcare.id | Ringkasan |
| Auditor (baca saja) | audit@costcare.id | Ringkasan |

Peran bisa diganti cepat dari menu nama pengguna di kanan atas.

## Struktur

```
index.html              Website publik (landing)
masuk.html              Halaman masuk
app/
  timbang.html          Timbang Langsung (simulator timbangan + alur 6 tahap)
  ringkasan.html        Ringkasan pemilik
  transaksi.html        Daftar & detail transaksi, review, koreksi, cetak, ekspor
  supplier.html         Supplier & kendaraan, kartu RFID
  harga.html            Harga TBS & jenis potongan
  pembayaran.html       Nota & pembayaran
  laporan.html          Laporan periode
  pengaturan.html       Aturan hitung, perangkat, pengguna, audit, data demo
assets/
  css/base.css          Token warna, tipografi, komponen dasar
  css/app.css           Kerangka aplikasi & gaya per layar
  css/site.css          Website publik & halaman masuk
  js/store.js           Data demo, penyimpanan, aturan hitung & penandaan
  js/ui.js              Format angka/tanggal, navigasi & hak akses, modal, toast, cetak, CSV
  js/pages/*.js         Logika tiap halaman
  img/                  Logo CostCare (terang, gelap, ikon) & favicon
```

## Fitur yang berjalan

- **Masuk** dengan validasi dan akses berdasarkan peran (halaman terlarang menampilkan pesan akses ditolak).
- **Timbang Langsung**: simulator indikator (stabil / bergoyang / terputus). Tombol kunci berat aktif hanya saat angka stabil. Alurnya gerbang → bruto → sortasi → tara → review → nota. Tersedia juga input manual yang otomatis masuk review, hubungkan ulang, tunda, batalkan dengan alasan, dan cetak tiket.
- **Aturan penandaan**: R-01 berat manual, R-02 potongan di atas batas, R-03 tara menyimpang, R-04 dugaan transaksi ganda.
- **Transaksi**: pencarian, filter periode/operator/status, halaman bertingkat, setujui, ajukan dan setujui koreksi (total dihitung ulang), batalkan, jejak audit, cetak tiket, ekspor CSV.
- **Supplier**: tambah dengan validasi dan cek dugaan duplikat, simulasi tap kartu, ganti/blokir/aktifkan kartu, gabungkan duplikat, tambah/nonaktifkan kendaraan.
- **Harga**: ajukan harga (Admin perlu persetujuan, Pemilik langsung disetujui), setujui/tolak/batalkan jadwal, riwayat, sakelar jenis potongan, batas review.
- **Pembayaran**: papan status, catat bayar penuh/sebagian (tunai/transfer), sengketa, cetak nota, ekspor rekap.
- **Laporan**: periode bulan ini/bulan lalu/7/30 hari, grafik harian, arus kas, komposisi potongan, ekspor CSV, cetak/PDF.
- **Pengaturan**: aturan hitung dengan contoh langsung, uji perangkat, undang pengguna dan ubah peran, jejak audit (filter, cari, ekspor), cadangan JSON, reset data demo.
- Responsif sampai lebar ponsel, ada fokus keyboard, dan label aksesibilitas.

## Aturan hitung (default)

Netto = bruto − tara. Potongan sortasi dihitung dari berat netto. Berat dibayar tidak dibulatkan (1 desimal). Total = berat dibayar × harga, lalu dibulatkan ke Rp1.
Contoh: 8.420 − 3.210 = 5.210 kg. Potongan 3% → 5.053,7 kg × Rp2.850 = **Rp14.403.045**.
Aturan bisa diubah di Pengaturan dan hanya berlaku untuk transaksi baru. Setiap transaksi menyimpan aturannya sendiri.

## Menyambungkan ke backend nanti

Semua akses data ada di `assets/js/store.js` (`CC.store`). Ganti fungsi `load/save` dan tiap mutasi dengan panggilan API, dan biarkan halaman tetap memanggil API `CC.store` yang sama. Integrasi timbangan dan RFID nyata menggantikan simulator di `assets/js/pages/timbang.js` (fungsi `tick`).

## Catatan

- Data demo dibuat ulang dengan tanggal hari ini saat pertama kali dibuka atau setelah **Pengaturan → Data demo → Reset**.
- Nomor kontak di website masih placeholder: `[NO. WHATSAPP]` dan `[EMAIL]`.
- Formulir demo di website hanya menyimpan di browser, belum mengirim ke server.
