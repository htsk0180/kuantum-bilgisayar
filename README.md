# Q/LAB — Kuantum Hesaplama Laboratuvarı

Q/LAB, kuantum hesaplamayı bir kübitin geometrisinden hata toleransına kadar uçtan uca inceleyen, Türkçe ve tarayıcı tabanlı interaktif bir öğrenme ortamıdır. İçerik doktora düzeyi bir okuma rotası hedefler; görselleştirmeler dekoratif değil, gerçek lineer cebir ve gerçek durum vektörü hesapları üzerinde çalışır.

- **Sıfır çalışma zamanı bağımlılığı:** derleme adımı, paket yöneticisi veya CDN yoktur.
- **Yerel çalışır:** tüm betikler, stiller, fontlar ve favicon proje içindedir; dış ağ isteği yapılmaz.
- **Gerçek WebGL:** beş adet WebGL sahnesi prosedürel mesh ve shader'larla çizilir. QFT faz çarkı ve eşik grafiği gibi laboratuvarlar gerçek matematiksel veriyi Canvas 2D/SVG ile görselleştirir.
- **Tek sayfa:** hash tabanlı yönlendirme, derin bağlantılar, tarayıcı geri/ileri gezinmesi ve kalıcı ilerleme.

## Hızlı başlangıç

Proje kökünde statik bir HTTP sunucusu başlatın:

```bash
cd kuantum-bilgisayar
python3 -m http.server 8000
```

Ardından `http://localhost:8000/` adresini açın.

Alternatif olarak:

```bash
php -S localhost:8000
# veya
npx serve .
```

> `index.html` doğrudan `file://` ile de açılabilir; ancak yerel fontların ve tarayıcı depolamasının tutarlı çalışması için HTTP sunucusu önerilir.

**Gereksinimler:** güncel Chrome, Edge, Firefox veya Safari. 3B laboratuvarlar için WebGL 1, diğer grafikler için Canvas 2D ve SVG gerekir. WebGL açılamazsa ilgili sahne bir fallback mesajıyla devre dışı kalır; metin içeriği ve 2B laboratuvarlar çalışmaya devam eder.

## Modüller

| Modül | İçerik | Etkileşim |
| --- | --- | --- |
| **00 · Genel Bakış** | İzlence haritası, üç hızlı başlangıç laboratuvarı, çalışma yöntemi | WebGL faz bulutu, rota kartları |
| **01 · Temeller** | Postülatlar, Bloch küresi, ölçüm, POVM, Kraus kanalları, T₁/T₂, Bell durumları, CHSH, entropi, problem seti | Bloch küresi; T₂/T₁ oranı; ölçüm günlüğü; yoğunluk matrisi |
| **02 · Devre Laboratuvarı** | Kapılar, matris çarpımı, dolanıklık, zaman adımları, atış örnekleme, OpenQASM 2.0 | Devre editörü, 3B genlik inspektörü, timeline, 1024 atış, QASM kopyalama |
| **03 · Algoritmalar** | Grover, kuantum Fourier dönüşümü, Deutsch–Jozsa, hızlanma haritası, VQE/QAOA bağlamı | Grover stüdyosu (N=8), QFT faz çarkı (3 kübit), DJ oracle ve histogramı |
| **04 · Donanım** | Transmon, hapsedilmiş iyon, nötr atom, fotonik, silikon spin, topolojik kübitler; kontrol yığını ve benchmark'lar | WebGL seyreltme soğutucusu, 20 mK katmanları |
| **05 · Hata Düzeltme** | Stabilizer formalizmi, tekrar kodu, yüzey kodu, anyonlar, mantıksal hata, eşik ölçeklemesi | 3 kübitlik tekrar kodu; d=5 şematik yüzey yaması; eşik eğrileri |
| **06 · Araştırma Ufku** | BQP/QMA/QV, açık problemler, qLDPC, gerçek zamanlı dekoder, birincil kaynaklar, tez yönleri | Okuma listesi, ilerleme dışa aktarma |

## Laboratuvar kontrolleri

### 3B sahneler (WebGL)

| Sahne | Kontroller |
| --- | --- |
| Genel bakış faz bulutu | Sürükle → yörünge; tekerlek → yakınlaştırma; boşta otomatik dönüş |
| Bloch küresi | Sürükle → döndür; tekerlek → yakınlaştır; H/X/Y/Z/S/T/Rx/Ry/Rz düğmeleri; Z ölçümü; sıfırlama |
| Devre genlik inspektörü | Sürükle → döndür; tekerlek → yakınlaştır; genlik yüksekliği olasılığı, halka fazı gösterir |
| Seyreltme soğutucusu | Sürükle → döndür; 20 mK, plakalar ve kontrol katmanları |
| Yüzey kodu | Sürükle → döndür; tekerlek → yakınlaştır; veri kübitine tıkla → hata ekle/kaldır; X/Z modu; rastgele hata; dekode et; temizle |

### Devre laboratuvarı

1. Paletten bir kapı seçin (H, X, Y, Z, S, T, Rx, Ry, Rz, CNOT, CZ, SWAP).
2. Tek kübitlik kapı için boş bir hücreye tıklayın.
3. İki kübitlik kapı için önce kontrol kübitini, sonra aynı sütundaki hedef kübitini seçin.
4. Yerleştirilmiş bir kapıya tıklamak onu kaldırır.
5. Zaman kaydırıcısı veya oynat düğmesiyle ara durumları inceleyin.
6. `1024 atış` ile örnekleme yapın; `QASM kopyala` ile OpenQASM 2.0 çıktısını alın.

Kapı seçimi, kübit sayısı (2–4), hazır devreler ve `Temizle` işlemleri devreyi yeniden kurar. Durum inspektöründeki sekmeler olasılıkları ve ölçüm atışlarını gösterir.

### Diğer laboratuvarlar

- **Bloch:** Kapı düğmeleri durumu anında günceller; ölçüm, mevcut olasılıklardan sonuç örnekler ve günlüğe yazar.
- **Dekoherans:** `T₂ / T₁` kaydırıcısı zarf eğrilerini ve örnek T₂ değerini değiştirir.
- **Grover:** Hedef durumu seçin; `k` kaydırıcısı veya ileri/geri düğmeleriyle iterasyon uygulayın.
- **QFT:** Üç kübitlik girişi seçin; faz çarkı ve adım etiketi anlık güncellenir.
- **Deutsch–Jozsa:** Sabit veya dengeli oracle seçip devreyi çalıştırın; histogram ve teşhis birlikte güncellenir.
- **Tekrar kodu:** Kübitlere tıklayarak bit hatası ekleyin; sendromlar ve düzeltme mesajı anında hesaplanır.
- **Yüzey kodu:** X/Z hatalarını yamaya tıklayarak enjekte edin, rastgele hata üretin, dekoderi çalıştırın.
- **Eşik:** Fiziksel hata oranı `p` kaydırıcısı d₃/d₅/d₇ eğrilerini, eşik çizgisini ve d=5 mantıksal hata tahminini günceller.

## Klavye, erişilebilirlik ve ilerleme

- **Komut paleti:** `Ctrl+K` / `Cmd+K`; yazarken arama, `↑`/`↓` ile seçim, `Enter` ile açma, `Esc` ile kapatma.
- **Mobil menü:** 940 px altında hamburger düğmesi; `Esc` ve scrim ile kapanır; odak tuzağı ve kaydırma kilidi uygulanır.
- **Derin bağlantılar:** `#foundations-postulates`, `#qft-studio`, `#surface-lab` gibi tüm bölüm kimlikleri doğrudan açılabilir.
- **Erişilebilirlik:** atlama bağlantısı, görünür odak halkaları, ARIA etiketleri, canlı bölgeler, `prefers-reduced-motion` desteği ve mobilde en az 44×44 px dokunma hedefleri.
- **İlerleme:** ziyaret edilen modüller `localStorage` içindeki `qlab.progress.v1` anahtarında saklanır. Arayüzden sıfırlanabilir veya JSON olarak dışa aktarılabilir. Tarayıcı depolaması kapalıysa oturum yine çalışır, yalnızca kalıcılık kaybolur.

## Mimari

```text
.
├── index.html              # Tüm modül DOM'ları, bölüm kimlikleri, ARIA yapısı
├── css/
│   └── styles.css          # Tasarım sistemi, responsive kurallar, animasyonlar
├── js/
│   ├── quantum.js          # Karmaşık vektör çekirdeği, kapılar, ölçüm, QASM
│   ├── gl.js               # mat4, prosedürel mesh, shader'lar, Orbit kontrolleri
│   ├── scenes.js           # Beş WebGL sahnesi ve yüzey kodu geometrisi
│   ├── labs.js             # Dokuz laboratuvar ve yaşam döngüsü
│   └── app.js              # Yönlendirme, komut paleti, ilerleme, mobil menü
└── assets/
    ├── favicon.svg
    └── fonts/              # Manrope, IBM Plex Mono, Newsreader (yerel WOFF2)
```

Betikler bağımlılık sırasıyla yüklenir:

```html
<script src="js/quantum.js"></script>
<script src="js/gl.js"></script>
<script src="js/scenes.js"></script>
<script src="js/labs.js"></script>
<script src="js/app.js"></script>
```

### Durum vektörü çekirdeği (`quantum.js`)

- Genlikler çift duyarlıklı gerçek/imaginer bileşenler olarak `Float64Array` içinde tutulur.
- Kübit sırası **big-endian**'dır: `q0` en anlamlı bittir (MSB).
- Tek kübit kapıları H, X, Y, Z, S, T, SX; dönüşler Rx, Ry, Rz ve faz kapıları; iki kübit kapıları CNOT, CZ, SWAP, CP.
- Projektif ölçüm, Born olasılıkları, normalize durum, Bloch vektörü, yoğunluk matrisi, kısmi iz ve von Neumann entropisi hesaplanır.
- Devre uygulaması, verilen sütuna kadar ara durum üretmeyi destekler; timeline bu özelliği kullanır.
- QASM çıktısı her kübit için ayrı `measure` satırı üretir.

### WebGL motoru (`gl.js`, `scenes.js`)

- WebGL 1 uyumlu; mat4, perspektif ve look-at dönüşümleri elle uygulanır.
- Sahneler prosedürel küre, torus, silindir, kutu ve çizgi mesh'leri üretir.
- Nokta parçacıkları additive sprite shader'ı, çizgiler ayrı çizgi shader'ı, katı yüzeyler ışıklı shader ile çizilir.
- Orbit kontrolü pointer olayları ve tekerlek ile çalışır; `prefers-reduced-motion` açıkken otomatik dönüş kapanır.
- Görünmeyen rotaların sahneleri durdurulur; sekme gizlenince animasyon döngüsü duraklatılır.

### Yönlendirme (`app.js`)

- `#modül` ve `#bölüm-kimliği` biçimleri desteklenir; bilinmeyen kimlikler genel bakışa döner.
- Modül değişiminde sayfa anında en üste/çapaya taşınır; aynı rota içindeki bölüm geçişleri yumuşak kaydırılır.
- Bölüm casusu, kaydırma sırasında modül içi gezinmeyi günceller.
- Komut paleti modül, laboratuvar, kavram ve kaynakları birlikte arar.

## Simülasyon modelleri ve sınırlar

Bu ortam öğretim amaçlıdır; üretim veya araştırma sonucu üretmez.

- **Devre simülasyonu gürültüsüzdür.** Yalnızca üniter evrim ve projektif ölçüm uygulanır. Gerçek cihaz gürültüsü, dekoherans kanalları ve kapı hataları devre çalıştırmasına dâhil edilmez.
- **Durum vektörü ölçeği:** arayüz 2–4 kübit sunar. Genlik sayısı `2ⁿ` ile büyür; 40 kübit yaklaşık 16 TB'lık bir vektör gerektirir. Çekirdek daha büyük `n` için teorik olarak kullanılabilir, ancak tarayıcı belleği sınırlayıcıdır.
- **Bloch ve dekoherans:** T₁/T₂ eğrileri fenomenolojik zarflardır; Kraus yörünge örneklemesi veya tam kanal simülasyonu yapılmaz.
- **Grover:** N=8 (3 kübit) üzerinde gösterim; keyfi N veya oracle devreleri için genel bir derleyici değildir.
- **QFT:** 3 kübitlik (N=8) faz konumları tam karmaşık genliklerle hesaplanır; büyük ölçekli QFT devresi sentezlenmez.
- **Deutsch–Jozsa:** 3 bitlik tanım kümesi (8 girdi) üzerinde sabit/dengeli oracle ailesi; genel oracle temsili değildir.
- **Tekrar kodu:** Yalnızca bit-flip (X) hatalarını modeller; faz hataları ve ölçüm hatası yoktur.
- **Yüzey kodu:** d=5 **şematik** yamadır (25 veri kübiti). Sınır anyonları basitleştirilmiş düzlemsel davranışla gösterilir. Dekoder, ≤3 hata için kapsamlı arama, daha büyük durumlar için açgözlü bir yedek kullanır; gerçek donanım için MWPM veya gerçek zamanlı bir dekoder değildir.
- **Eşik paneli:** eğriler gerçek Monte Carlo değildir. `p_L ≈ A · (p/p_th)^((d+1)/2)` biçimindeki ölçekleme ilişkisini göstermek için üretilmiştir (`p_th = %0.8`, `A = 0.1` varsayımsal değerlerdir). Eşik çevresinde kesin tahmin için kod, gürültü modeli ve dekoderle Monte Carlo gerekir.
- **Donanım metrikleri:** kübit sayıları, koherans süreleri, kapı hataları ve benchmark değerleri **temsilî aralıklardır**; belirli bir cihazın canlı ölçümü değildir. Aynı teknoloji içinde cihazdan cihaza büyük farklar bulunur.
- **Kaynaklar:** okuma listesi gerçek kitap ve makalelere işaret eder; bağlantılar harici sitelere gidebilir. Uygulamanın kendisi çalışma zamanında dış kaynak yüklemez.

## Doğrulama

Geliştirme sırasında uygulama, Chrome DevTools Protocol üzerinden gerçek tarayıcıda test edildi:

- Durum vektörü çekirdeği: 22/22 birim testi (norm, kapılar, Bloch işareti, Bell durumu, ölçüm, QASM).
- Laboratuvar etkileşimleri: 68/68 test (Bloch, devre editörü, timeline, atışlar, Grover, QFT, Deutsch–Jozsa, tekrar kodu, yüzey kodu, eşik).
- Arayüz ve yönlendirme: 26/26 test (komut paleti, derin bağlantı, bölüm casusu, ilerleme, mobil menü).
- Gerçek fare testleri: WebGL yörünge/sürükleme/yakınlaştırma, yüzey kübit seçimi ve dekoder.
- Duyarlılık: 390×844, 768×1024, 1024×768 ve 1440×1000 çözünürlüklerinde yatay taşma, menü, odak ve kaydırma kilidi kontrol edildi.
- Erişilebilirlik, klavye ve `prefers-reduced-motion` senaryoları ayrıca doğrulandı.
- Konsol hatası, ağ hatası ve dış kaynak isteği gözlenmedi.

## Geliştirme notları

- Projede derleme veya paket yöneticisi yoktur; dosyaları düzenleyip tarayıcıyı yenilemek yeterlidir.
- Yeni bir laboratuvar eklerken `index.html` içinde bölüm kimliği ve ARIA etiketleri tanımlayın; `js/labs.js` içinde sınıfı oluşturup `init()` ve `setRoute()` yaşam döngüsüne bağlayın.
- Yeni bir WebGL sahnesi için `js/gl.js` primitiflerini ve `js/scenes.js` içindeki `Scene` tabanını kullanın; `window.Scenes` ihracına ekleyin.
- Rotalar `js/app.js` içindeki `MODULES` dizisine ve `js/labs.js` içindeki `routeScenes` eşlemesine birlikte eklenmelidir.
- Simülasyon çekirdeğini değiştirdikten sonra en azından Bell durumu, CNOT, ölçüm normalizasyonu ve QASM çıktısını yeniden kontrol edin.
- Metinler Türkçe ve akademik tondadır; yeni içerik eklerken matematiksel gösterim, kaynak ve “şematik/temsilî” sınırlamalarını koruyun.

---

Q/LAB — tarayıcıda çalışan, bağımsız bir kuantum hesaplama çalışma ortamı.
