"""Inter yazı tipini sitenin gerçekten kullandığı karakterlere indirger.

Neden: @fontsource-variable/inter'in hazır dosyaları tarayıcıya 133 KB
indiriyor. Bunun 85 KB'ı "latin-ext" dosyası ve oradan Türkçe için yalnızca
birkaç harf (ğ Ğ ş Ş İ) kullanılıyor — geri kalanı Lehçe, Çekçe, Vietnamca
vb. için.

Çıktı `src/styles/yazitipi/` altına yazılır; global.css oradan @font-face ile
kullanır. Böylece Vite dosyayı hash'leyip _astro/ altına koyar ve sunucudaki
önbellek kuralı (1 yıl, immutable) kapsamına girer.

Çalıştırma:  python araclar/yazitipi-altkume.py
Gereksinim:  pip install "fonttools[woff]"
"""

import os
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = os.path.join(KOK, "node_modules", "@fontsource-variable", "inter", "files")
CIKTI = os.path.join(KOK, "src", "styles", "yazitipi")

# Temel takım: ASCII + Latin-1 (İngilizce, Türkçe'nin ç ö ü harfleri burada)
# + tipografik noktalama (tırnak, tire, üç nokta) + kullandığımız birkaç simge.
TEMEL = (
    "U+0000-00FF,"      # ASCII + Latin-1 Supplement
    "U+0131,"           # ı  (noktasız i)
    "U+0152-0153,"      # Œ œ
    "U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+2000-206F,"      # noktalama: – — ' ' " " … ‰ vb.
    "U+20AC,"           # €
    "U+20BA,"           # ₺
    "U+2122,"           # ™
    "U+2190-2193,"      # ← ↑ → ↓  (bağlantılarda "Tüm yazılar →")
    "U+2212,U+2215,"
    "U+FEFF,U+FFFD"
)

# Ek takım: Türkçe'ye özgü, Latin-1'de olmayan harfler.
# Ayrıca Avrupa adlarında sık geçen birkaç harf korunuyor (ā ē ī ō ū değil,
# yalnızca yaygın olanlar) — blog yazılarında ad geçerse kutu görünmesin.
#
# `ı` (U+0131) BURAYA GİRMEMELİ: o harf temel dosyada duruyor. Aynı karakter
# iki takımda birden tanımlıysa tarayıcı sonra geleni seçiyor ve tek bir `ı`
# yüzünden bu dosyanın tamamı iniyordu — İngilizce sayfalarda 15 KB'lık
# gereksiz bir indirme demekti.
#
# `₺` (U+20BA) ise burada KALMALI. Temel listede de yazıyor ama kaynak yazı
# tipinin latin alt kümesinde o glif yok, dolayısıyla temel dosyaya hiç
# girmiyor; ₺ yalnızca bu dosyadan geliyor. Çıkarılırsa kutu görünür.
#
# Buradaki aralık `src/styles/global.css` içindeki `unicode-range` ile AYNI
# olmak zorunda: biri değişip öbürü kalırsa ya kutu görünür ya da gereksiz
# indirme geri gelir.
EK = (
    "U+011E-011F,"      # Ğ ğ
    "U+0130,"           # İ
    "U+015E-015F,"      # Ş ş
    "U+0100-0130,"      # Latin Extended-A (Lehçe, Çekçe, Hırvatça adlar)
    "U+0132-017F,"      # — U+0131 (ı) hariç: o temel dosyada
    "U+20BA"            # ₺ (temel dosyada yok, buradan geliyor)
)

ISLER = [
    ("inter-latin-wght-normal.woff2", "inter-temel.woff2", TEMEL),
    ("inter-latin-ext-wght-normal.woff2", "inter-ek.woff2", EK),
]


def boyut(yol):
    return os.path.getsize(yol)


def main():
    os.makedirs(CIKTI, exist_ok=True)
    toplam_once = toplam_sonra = 0

    for kaynak_ad, cikti_ad, takim in ISLER:
        kaynak = os.path.join(KAYNAK, kaynak_ad)
        if not os.path.exists(kaynak):
            sys.exit(f"kaynak bulunamadi: {kaynak}")
        hedef = os.path.join(CIKTI, cikti_ad)

        subprocess.run(
            [
                sys.executable, "-m", "fontTools.subset", kaynak,
                f"--unicodes={takim}",
                "--flavor=woff2",
                f"--output-file={hedef}",
                # Değişken eksenler korunuyor: site 400-700 arası ağırlık kullanıyor.
                "--drop-tables+=DSIG",
                "--layout-features=kern,liga,calt",
                "--no-hinting",
            ],
            check=True,
            capture_output=True,
        )

        onc, son = boyut(kaynak), boyut(hedef)
        toplam_once += onc
        toplam_sonra += son
        print(f"{kaynak_ad:38} {onc:>7,} -> {son:>7,} bayt  (%{100 - son * 100 // onc} kazanc)")

    print(f"\nTOPLAM {toplam_once:,} -> {toplam_sonra:,} bayt "
          f"({toplam_once - toplam_sonra:,} bayt daha az)")


if __name__ == "__main__":
    main()
