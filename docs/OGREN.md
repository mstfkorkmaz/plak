# Plak'ı Öğren

Bu rehber Plak'ın nasıl çalıştığını baştan sona anlatır. Sırayla okursan sonunda her dosyanın ne işe yaradığını, neden öyle yazıldığını ve yeni bir özelliği nasıl ekleyeceğini bilirsin.

Her bölümün sonunda küçük bir **Dene** kutusu var. Okumak yerine yapmak çok daha kalıcı, o yüzden atlamamaya çalış.

---

## 1. Büyük resim

Plak iki parçadan oluşur:

```
┌──────────────────────────┐         HTTP (JSON + ses)         ┌──────────────────────────┐
│      TARAYICI (web/)     │  ───────────────────────────────▶  │     SUNUCU (server/)     │
│                          │                                    │                          │
│  React arayüzü           │   GET /api/albums      → JSON      │  Fastify (HTTP)          │
│  <audio> ile çalma       │   GET /api/stream/12   → ses       │  SQLite veritabanı       │
│                          │   POST /api/playlists  → JSON      │  Tarayıcı (scanner)      │
└──────────────────────────┘                                    └────────────┬─────────────┘
                                                                             │ okur
                                                                  ┌──────────▼──────────┐
                                                                  │  Müzik klasörü      │
                                                                  │  D:\Müzik\...       │
                                                                  └─────────────────────┘
```

1. **Tarama:** Sunucu açılınca müzik klasörünü gezer. Her dosyanın içindeki etiketleri (şarkı adı, sanatçı, albüm, kapak) okur ve veritabanına yazar.
2. **Listeleme:** Arayüz "albümleri ver" diye sorar, sunucu veritabanından okuyup JSON döner.
3. **Çalma:** Arayüz bir şarkıyı `<audio src="/api/stream/12">` ile çalar. Sunucu dosyayı parça parça gönderir.

Bu yapıya **istemci-sunucu mimarisi** denir. Spotify da, Netflix de böyle çalışır. Fark şu: Plak'ta sunucu senin bilgisayarın.

## 2. Kullandığımız teknolojiler ve nedenleri

| Teknoloji | Ne işe yarıyor | Neden bu |
| --- | --- | --- |
| **Node.js 24** | Sunucuda JavaScript çalıştırır | TypeScript'i derlemeden doğrudan çalıştırabiliyor, SQLite içinde geliyor |
| **TypeScript** | Tipli JavaScript | "Bu değişken sayı mı, metin mi?" hatalarını kod çalışmadan yakalar |
| **Fastify** | HTTP sunucusu | Hızlı, gelen veriyi şemayla doğruluyor |
| **SQLite** (`node:sqlite`) | Veritabanı | Tek dosya, kurulum yok, derleme yok |
| **music-metadata** | Ses dosyası etiketlerini okur | Saf JavaScript, her biçimi tanıyor |
| **React** | Arayüz kütüphanesi | Ekranı "durum"dan üretir, en yaygın arayüz aracı |
| **Vite** | Arayüzü derler ve geliştirme sunucusu açar | Çok hızlı, ayar istemiyor |

Bağımsız (native) modül kullanmadık. Yani `npm install` hiçbir şey derlemez ve her bilgisayarda çalışır. Bu bilinçli bir karar.

## 3. Klasör yapısı

```
plak/
├── package.json          Kök: iki alt projeyi (workspace) bağlar, ortak komutlar
├── server/
│   ├── src/
│   │   ├── index.ts      Başlangıç noktası: sunucuyu açar, taramayı başlatır
│   │   ├── app.ts        Fastify'ı kurar, rotaları ve güvenlik başlıklarını ekler
│   │   ├── config.ts     Ortam değişkenlerinden ayarları okur
│   │   ├── db.ts         Veritabanı bağlantısı, tablolar, yardımcı fonksiyonlar
│   │   ├── scanner.ts    Müzik klasörünü tarar
│   │   ├── library.ts    Albüm, sanatçı, arama sorguları
│   │   ├── auth.ts       Şifre, oturum, çerez
│   │   ├── range.ts      Ses akışı için "Range" başlığını çözer
│   │   ├── text.ts       Türkçe arama ve sıralama
│   │   ├── static.ts     Derlenmiş arayüz dosyalarını sunar
│   │   └── routes/       Her konu için ayrı API uç noktaları
│   └── test/             Otomatik testler
├── web/
│   ├── index.html
│   └── src/
│       ├── main.tsx      Arayüzün başlangıç noktası
│       ├── App.tsx       Giriş kontrolü ve sayfa yönlendirme
│       ├── api.ts        Sunucuyla konuşan fonksiyonlar
│       ├── player.tsx    Çalma mantığı: sıra, karıştır, tekrar
│       ├── router.ts     Adres çubuğundaki #/album/3 gibi yolları okur
│       ├── i18n.tsx      Türkçe/İngilizce metinler
│       ├── styles.css    Bütün görünüm
│       ├── components/   Tekrar kullanılan parçalar
│       └── pages/        Sayfalar
├── scripts/
│   ├── dev.mjs           Geliştirmede iki sunucuyu birlikte açar
│   └── demo-library.mjs  Telifsiz deneme müziği üretir
└── docs/                 Bu rehber
```

> **Dene:** `npm run demo-library` çalıştır, sonra `music/Plak Demo` klasörüne bak. Bir `.wav` dosyasını bilgisayarının müzik çalarında aç.

---

## 4. Sunucu, adım adım

### 4.1 Ayarlar: `config.ts`

Program ayarlarını **ortam değişkenlerinden** okur. Ortam değişkeni, programı başlatırken dışarıdan verilen bir değerdir:

```powershell
$env:PLAK_MUSIC_DIR = "D:\Müzik"
npm start
```

Kodda `process.env.PLAK_MUSIC_DIR` bu değeri verir. Verilmemişse varsayılan kullanılır. Böylece kodu değiştirmeden ayar değiştirebilirsin. Docker gibi araçlar da bu yöntemle çalışır.

### 4.2 Veritabanı: `db.ts`

Veritabanı, verileri tablolarda tutan bir dosyadır. Excel sayfası gibi düşün: her tablo bir sayfa, her satır bir kayıt.

```
artists          albums                     tracks
┌────┬────────┐  ┌────┬───────┬──────────┐  ┌────┬──────────┬──────────┬──────────┐
│ id │ name   │  │ id │ title │artist_id │  │ id │ title    │ album_id │ path     │
├────┼────────┤  ├────┼───────┼──────────┤  ├────┼──────────┼──────────┼──────────┤
│ 1  │ Gece   │◀─│ 1  │İstas..│ 1        │◀─│ 1  │Son Vapur │ 1        │ D:\...   │
│    │ Treni  │  │    │       │          │  │ 2  │Şehir ... │ 1        │ D:\...   │
└────┴────────┘  └────┴───────┴──────────┘  └────┴──────────┴──────────┴──────────┘
```

`album_id = 1`, "bu şarkı 1 numaralı albüme ait" demek. Buna **yabancı anahtar** (foreign key) denir. Verileri tekrar etmeden birbirine bağlar.

Bu dosyada üç önemli fikir var:

**Göç (migration):** `migrations` dizisinin her elemanı veritabanını bir sürüm ilerletir. Veritabanı kendi sürümünü `PRAGMA user_version` ile hatırlar. Yarın yeni bir sütun eklemek istersen diziye yeni bir eleman eklersin. Eski kullanıcıların veritabanı da açılışta otomatik güncellenir. Yayınlanmış bir elemanı **asla değiştirme**.

**Hazır sorgular (prepared statements):** Sorguları şöyle yazıyoruz:

```ts
get('SELECT * FROM users WHERE username = ?', username);
```

`?` yerine değer veritabanı tarafından güvenle yerleştirilir. Metni elle birleştirseydik (`"... WHERE username = '" + username + "'"`), biri kullanıcı adına `' OR 1=1 --` yazarak bütün kayıtları okuyabilirdi. Bu saldırıya **SQL enjeksiyonu** denir. `?` kullanmak bunu tamamen engeller.

**İşlem (transaction):** `transaction(() => { ... })` içindeki komutlar ya hep birlikte olur ya hiç olmaz. Şarkı eklerken elektrik kesilirse yarım kayıt kalmaz.

> **Dene:** [DB Browser for SQLite](https://sqlitebrowser.org) programını kur ve `data/plak.db` dosyasını aç. Tabloları gez. Sunucu açıkken sadece okuma yap.

### 4.3 Tarayıcı: `scanner.ts`

Tarama adımları:

1. `walk()` klasörü ve alt klasörlerini gezer, ses dosyalarını tek tek verir. `async function*` bir **üreteç**tir: bütün listeyi belleğe almadan dosyaları sırayla üretir. 100.000 şarkılık arşivde bile bellek şişmez.
2. Her dosya için `indexFile()`:
   - Dosyanın boyutu ve değişme tarihi veritabanındakiyle aynıysa atlar. İkinci tarama bu yüzden saniyeler sürer.
   - Değilse `parseFile()` ile etiketleri okur.
   - Sanatçı yoksa ekler, albüm yoksa ekler, şarkıyı ekler veya günceller.
   - Albümün kapağı yoksa önce klasörde `cover.jpg` arar, bulamazsa dosyanın içindeki gömülü kapağı kaydeder.
3. Tarama bitince bu turda görülmeyen şarkıları siler (`scan_id` karşılaştırması).

**Önemli bir koruma:** Müziklerin harici diskte ve disk takılı değilse, klasör boş görünür. Bunu "kullanıcı her şeyi silmiş" diye yorumlarsak bütün kitaplık silinir ve çalma listeleri de gider. Bu yüzden klasör boş görünüyor ama veritabanında şarkı varsa hiçbir şey silmiyoruz. Testlerde bunun da testi var.

> **Dene:** `music/Plak Demo` içinden bir albüm klasörünü başka yere taşı, Ayarlar'dan tarama başlat. Albümün kaybolduğunu gör. Geri taşı, tekrar tara.

### 4.4 Türkçe: `text.ts`

Bilgisayar için `Ş` ile `S` farklı harflerdir. Kullanıcı "sarki" yazınca "Şarkı"yı bulmak için iki metni de ortak bir biçime çeviriyoruz:

```
"ŞARKI"  →  küçült (Türkçe kurallarla)  →  "şarkı"
         →  NFD ile ayrıştır            →  "s + ̧ + a r k ı"
         →  işaretleri sil               →  "sarkı"
         →  ı → i                        →  "sarki"
```

`toLocaleLowerCase('tr')` önemli: düz `toLowerCase()` `I` harfini `i` yapar, oysa Türkçede `ı` olmalı. Her şarkı eklenirken bu biçim `search` sütununa yazılır. Aramada da kullanıcının yazdığı aynı işlemden geçer.

Sıralama için `Intl.Collator('tr')` kullanıyoruz. O da Türk alfabesini biliyor: C, Ç, D... I, İ, J...

### 4.5 Giriş ve güvenlik: `auth.ts`

**Şifreler asla düz saklanmaz.** `hashPassword()` şifreyi **scrypt** ile özetler:

```
"benim şifrem" + rastgele tuz  →  scrypt  →  "scrypt$Xk3...$9fA..."
```

Özet tek yönlüdür, geri çevrilemez. Giriş sırasında girilen şifreyi aynı tuzla tekrar özetleyip karşılaştırırız. scrypt bilerek yavaş ve bellek yiyen bir algoritmadır: veritabanı çalınsa bile milyarlarca şifre denemek çok pahalıya patlar. **Tuz** sayesinde aynı şifreyi kullanan iki kişinin özeti farklı olur.

`timingSafeEqual` karşılaştırmayı hep aynı sürede yapar. Normal `===` ilk farklı baytta durur ve saldırgan cevap süresine bakarak şifreyi tahmin edebilir.

**Oturum:** Giriş yapınca rastgele 32 baytlık bir anahtar üretir ve çerezde saklarız. Veritabanına anahtarın kendisini değil özetini (SHA-256) yazarız. Veritabanı sızsa bile kimse o anahtarlarla giriş yapamaz.

**Çerez ayarları:**
- `HttpOnly`: JavaScript çerezi okuyamaz. Sayfaya kötü kod sızsa bile oturumu çalamaz.
- `SameSite=Lax`: Başka bir site senin adına istek gönderemez.
- `Secure`: HTTPS varsa çerez sadece şifreli bağlantıda gider.

**Deneme sınırı:** Aynı IP 15 dakikada 5 kez yanlış şifre girerse bekletilir. Şifre tahmin saldırılarını yavaşlatır.

### 4.6 Rotalar: `routes/`

Rota, "bu adrese bu yöntemle gelen isteği şu fonksiyon cevaplasın" demektir:

```ts
app.get('/api/albums/:id', { schema: { params: idParams } }, async (request, reply) => {
  return getAlbum(request.params.id) ?? reply.code(404).send({ error: 'not_found' });
});
```

- `GET` okumak, `POST` oluşturmak, `PUT` güncellemek, `DELETE` silmek içindir.
- `:id` adresin değişken kısmıdır. `/api/albums/7` için `request.params.id` 7 olur.
- `schema` gelen veriyi doğrular. `id` sayı değilse Fastify fonksiyonu hiç çalıştırmadan 400 hatası döner. **Kullanıcıdan gelen hiçbir veriye güvenme** kuralının uygulaması budur.

HTTP durum kodları: `200` tamam, `206` parça gönderildi, `400` istek hatalı, `401` giriş yapılmamış, `403` yetki yok, `404` bulunamadı, `409` çakışma (örneğin kullanıcı adı alınmış), `429` çok fazla istek.

`app.ts` içindeki `onRequest` kancası her istekten önce çalışır: çerezden kullanıcıyı bulur, giriş yapılmamışsa ve adres herkese açık değilse 401 döner. Böylece her rotada tek tek kontrol yazmak gerekmez. `admin.ts` de kendi kancasıyla sadece yöneticileri içeri alır.

### 4.7 Ses akışı: `routes/media.ts` ve `range.ts`

Tarayıcı 40 MB'lık bir FLAC dosyasını tamamı inmeden çalmaya başlar ve şarkının ortasına atlayabilir. Bunu **Range** isteğiyle yapar:

```
Tarayıcı:  GET /api/stream/12
           Range: bytes=20000000-

Sunucu:    206 Partial Content
           Content-Range: bytes 20000000-41999999/42000000
           (sadece istenen parça)
```

`parseRange()` bu başlığı çözer. `fs.createReadStream(path, { start, end })` dosyanın sadece o kısmını okur ve **akış** olarak gönderir. Dosya hiçbir zaman tamamen belleğe alınmaz.

> **Dene:** Sunucu açıkken tarayıcının geliştirici araçlarını (F12) aç, **Ağ** sekmesine geç ve bir şarkı çal. `stream` isteğine tıkla, durum kodunun 206 olduğunu ve `Range` başlığını gör. Sonra şarkının ortasına tıkla: yeni bir istek göreceksin.

### 4.8 Güvenlik başlıkları

`app.ts` her cevaba şu başlıkları ekler:

- `Content-Security-Policy`: Sayfa sadece kendi sunucusundan kod, görsel ve ses yükleyebilir. Bir şarkı adına `<script>` yazılsa bile çalışmaz.
- `X-Frame-Options: DENY`: Sayfa başka bir sitenin içine gömülemez (tıklama tuzağına karşı).
- `X-Content-Type-Options: nosniff`: Tarayıcı dosya türünü tahmin etmeye çalışmaz.

`static.ts` derlenmiş arayüzü sunarken `../` ile klasör dışına çıkılmasını engeller. Buna **dizin geçişi** (path traversal) saldırısı denir.

---

## 5. Arayüz, adım adım

### 5.1 React'in temel fikri

React'te ekranı adım adım değiştirmezsin. "Durum şuyken ekran böyle görünür" diye tarif edersin, React gerisini halleder:

```tsx
function Sayac() {
  const [sayi, setSayi] = useState(0);
  return <button onClick={() => setSayi(sayi + 1)}>{sayi} kez tıklandı</button>;
}
```

`setSayi` çağrılınca React bileşeni yeniden çizer. Plak'taki her şey bu fikirle yazıldı: çalan şarkı, sıra, beğeniler birer **durum**dur.

**Bileşen:** Kendi başına bir arayüz parçası. `TrackList`, `PlayerBar`, `AlbumCard` birer bileşen.

**Hook:** `use` ile başlayan fonksiyonlar. `useState` durum tutar, `useEffect` ekran çizildikten sonra bir iş yapar (veri çekmek, olay dinlemek gibi).

**Context:** Durumu bütün bileşenlerle paylaşmanın yolu. Oynatıcı çubuğu da, şarkı listesi de aynı oynatıcıyı bilmeli. `PlayerProvider` en üstte durur, herkes `usePlayer()` ile ona ulaşır.

### 5.2 Sunucuyla konuşmak: `api.ts`

`api()` fonksiyonu `fetch` üzerine ince bir katman. Hata varsa fırlatır, 401 gelirse giriş ekranına dönmek için bir olay yayınlar.

`useApi()` hook'u bir sayfanın veri ihtiyacını tek satıra indirir:

```tsx
const { data, error, reload } = useApi<AlbumDetail>(`/albums/${id}`);
if (error) return <ErrorState onRetry={reload} />;
if (!data) return <Loading />;
return <h1>{data.title}</h1>;
```

İçindeki `cancelled` değişkeni önemli: kullanıcı veri gelmeden başka sayfaya geçerse eski cevap yeni sayfanın üzerine yazılmaz.

### 5.3 Yönlendirme: `router.ts`

Adres çubuğunda `#/album/3` gördüğün kısım **hash**. Hash değişince sayfa yeniden yüklenmez, sadece `hashchange` olayı tetiklenir. `useRoute()` bu olayı dinler ve `['album', '3']` döner. `App.tsx` de buna göre hangi sayfanın çizileceğini seçer. Müzik çalarken sayfa değiştirmek bu yüzden müziği kesmez.

### 5.4 Oynatıcı: `player.tsx`

Projenin kalbi burası. Tek bir `Audio` nesnesi var ve bütün uygulama onu paylaşıyor.

Durum:
- `queue`: Çalınacak şarkılar dizisi
- `index`: Şu an kaçıncısı çalıyor
- `playing`, `shuffle`, `repeat`: Adlarından belli
- `nonce`: Her "şunu çal" komutunda bir artar. Aynı şarkıya tekrar basınca baştan başlaması için gerekli.

Akış:
1. Kullanıcı bir albümde "Çal"a basar, `playTracks(tracks)` çağrılır.
2. Durum değişir: `queue = albümün şarkıları`, `index = 0`.
3. `useEffect` çalışır, `audio.src = '/api/stream/<id>'` yapar ve çalmaya başlar.
4. Şarkı bitince `ended` olayı gelir, `advance(1)` sıradakine geçer.

**Karıştırma:** Açılınca mevcut şarkı başta kalır, kalanlar Fisher-Yates algoritmasıyla karıştırılır. Orijinal sıra saklanır, kapatınca geri gelir.

**Media Session API:** Telefonun kilit ekranındaki şarkı adı, kapak ve ileri/geri tuşları buradan gelir.

**Dinleme sayımı:** Bir şarkı 30 saniye ya da yarısı dinlenince sunucuya bildirilir. "En çok dinlediklerin" bölümü bu kayıtlardan oluşur.

**Neden `useProgress` ayrı?** Şarkının ilerlemesi saniyede birkaç kez değişir. Bunu paylaşılan context'e koysaydık bütün uygulama saniyede birkaç kez yeniden çizilirdi. Sadece ilerleme çubuğu bunu dinliyor.

### 5.5 Diğer parçalar

- `favorites.tsx`: **İyimser güncelleme** örneği. Kalbe basınca ekranda hemen dolar, istek arkadan gider. Sunucu reddederse geri alınır. Uygulama böylece hızlı hisseder.
- `i18n.tsx`: Bütün metinler iki dilde burada. Yeni bir metin eklersen ikisine birden eklemelisin, yoksa TypeScript hata verir. `tr` sözlüğünün tipi `en` sözlüğünden geliyor.
- `styles.css`: Renkler en üstte değişken olarak tanımlı (`--accent` gibi). Tema rengini değiştirmek tek satır. Mobil görünüm en alttaki `@media (max-width: 760px)` bloğunda.

> **Dene:** `styles.css` içinde `--accent: #f97316;` değerini `#22c55e` yap, `npm run dev` açıkken kaydet ve arayüzün anında yeşile döndüğünü gör. Sonra geri al.

---

## 6. Testler

`server/test/` altındaki testler `npm test` ile çalışır. İki tür var:

- **Birim testleri** (`unit.test.ts`): Tek bir fonksiyonu dener. "`fold('ŞARKI')` sonucu `sarki` mi?"
- **API testleri** (`api.test.ts`): Geçici bir klasöre demo müzik üretir, sunucuyu ağ açmadan çalıştırır (`app.inject`) ve gerçek istekler gönderir. Kurulum, yanlış şifre, tarama, arama, akış, çalma listesi sahipliği ve diskin çıkarılması senaryolarını dener.

Testler neden önemli? Yarın bir şeyi değiştirdiğinde başka bir yeri bozup bozmadığını saniyeler içinde öğrenirsin. GitHub da her gönderimde bu testleri Linux ve Windows'ta otomatik çalıştırır (`.github/workflows/ci.yml`).

> **Dene:** `text.ts` içinde `.replace(/ı/g, 'i')` satırını sil ve `npm test` çalıştır. Hangi testlerin kırıldığını gör. Satırı geri koy.

---

## 7. Alıştırma: Yeni bir özellik ekleyelim

Örnek olarak sanatçı sayfasına "toplam dinleme sayısı" ekleyelim. Gerçek bir özellik eklemenin bütün adımları burada.

**1. Sunucu: veriyi üret.** `server/src/library.ts` içinde `ARTIST_SELECT` sorgusuna bir sütun ekle:

```sql
(SELECT COUNT(*) FROM plays p JOIN tracks t ON t.id = p.track_id WHERE t.artist_id = ar.id) AS playCount
```

ve `Artist` tipine `playCount: number` ekle.

**2. Test yaz.** `api.test.ts` içinde bir şarkı için `POST /api/plays/:id` gönder, sonra `GET /api/artists/:id` cevabında `playCount` değerinin 1 olduğunu kontrol et.

**3. Arayüz: tipi güncelle.** `web/src/api.ts` içindeki `Artist` tipine `playCount: number` ekle.

**4. Metni ekle.** `i18n.tsx` içinde iki dile de ekle:

```ts
plays: (n: number) => `${n} plays`,   // en
plays: (n) => `${n} dinlenme`,        // tr
```

**5. Göster.** `pages/Artists.tsx` içindeki `hero-meta` satırına `<span>{t.plays(data.playCount)}</span>` ekle.

**6. Kontrol et.** `npm run typecheck`, `npm test`, sonra `npm run dev` ile gözünle bak.

**7. Kaydet.** Git ile commit at (bir sonraki bölüm).

Her yeni özellik aşağı yukarı bu yolu izler: **veri → test → tip → metin → arayüz → kontrol → commit.**

---

## 8. Git ve GitHub temelleri

**Git** kodun geçmişini tutar. **GitHub** bu geçmişi internette saklar ve başkalarıyla paylaşır.

| Komut | Ne yapar |
| --- | --- |
| `git status` | Neler değişti? |
| `git diff` | Tam olarak ne değişti? |
| `git add .` | Değişiklikleri kayda hazırla |
| `git commit -m "Sanatçı sayfasına dinlenme sayısı ekle"` | Bir kayıt noktası oluştur |
| `git push` | Kayıtları GitHub'a gönder |
| `git pull` | GitHub'daki yenilikleri al |
| `git log --oneline` | Geçmişi gör |
| `git switch -c ozellik-adi` | Yeni bir dal aç |

**İyi commit mesajı:** Ne yaptığını emir kipinde ve kısa yaz. "düzeltme" yerine "Boş klasör taramasında kitaplığın silinmesini engelle".

**Dal (branch) ve PR:** Büyük bir değişikliği ana daldan (`main`) ayrı bir dalda yaparsın. Bitince GitHub'da **Pull Request** açarsın. CI testleri çalıştırır, sen ya da bir başkası inceler, sonra `main`'e birleştirirsin. Açık kaynak projelere dışarıdan katkı da böyle gelir.

**Issue:** Hata bildirimi ya da fikir. Yol haritasındaki her maddeyi bir issue olarak açmak, katkı vermek isteyenlere nereden başlayacaklarını gösterir.

**Sürüm (release):** Belli bir noktada `v0.1.0` gibi bir etiket koyup GitHub'da yayınlarsın. Kullanıcılar hangi sürümü kullandıklarını bilir.

---

## 9. Projeyi büyütmek: yol haritası

Sırası önerilen sıradır. Her biri kendi başına öğretici bir iş.

1. **Subsonic API:** Navidrome'un en büyük gücü bu. Subsonic, müzik sunucuları için eski ve yaygın bir protokol. Bunu desteklersek Symfonium, Substreamer, DSub gibi hazır mobil uygulamalar Plak'a bağlanır. Yeni bir `routes/subsonic.ts` dosyası ve `/rest/*` uç noktaları demek.
2. **ffmpeg ile dönüştürme:** Mobil veride FLAC yerine 128 kbps Opus göndermek. `child_process.spawn('ffmpeg', ...)` çıktısını doğrudan akış olarak göndermek.
3. **Windows kurulum paketi:** Tek tıkla kurulum ve sistem tepsisinde simge. Projeyi teknik olmayan kullanıcılara açan şey bu olur.
4. **Şarkı sözleri:** Şarkının yanındaki `.lrc` dosyasını okuyup senkron göstermek.
5. **Akıllı listeler:** "Son 30 günde eklenen", "Hiç dinlenmeyenler" gibi kurallı listeler.
6. **Çevrimdışı indirme:** Service Worker ile şarkıları telefona kaydetmek.

---

## 10. Sözlük

| Terim | Anlamı |
| --- | --- |
| API | Programların birbiriyle konuştuğu arayüz. Burada `/api/...` adresleri |
| JSON | Veri taşıma biçimi: `{"title": "Son Vapur", "duration": 20}` |
| Endpoint / uç nokta | Tek bir API adresi, örneğin `GET /api/albums` |
| Şema | Verinin uyması gereken kurallar |
| Migration / göç | Veritabanı yapısını sürüm sürüm ilerletme |
| Hash / özet | Geri çevrilemeyen sabit uzunlukta parmak izi |
| Çerez | Tarayıcının her istekte sunucuya geri gönderdiği küçük veri |
| Akış (stream) | Veriyi tamamını beklemeden parça parça gönderme |
| Bileşen | Kendi başına bir arayüz parçası |
| Durum (state) | Arayüzün o anki verisi |
| Hook | React'te `use` ile başlayan yardımcı fonksiyonlar |
| CI | Her gönderimde testleri otomatik çalıştıran sistem |
| Workspace | Tek depoda birden fazla npm projesi |
