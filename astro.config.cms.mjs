// @ts-check
import { defineConfig } from 'astro/config';
import keystatic from '@keystatic/astro';
import temelYapilandirma from './astro.config.mjs';
import istatistikPaneli from './src/istatistik/eklenti.mjs';

/*
  YAZI PANELİ İÇİN AYRI YAPILANDIRMA

  Panel `npm run yazi` ile bu dosyadan açılıyor. İki sebeple ayrı tutuldu.

  1. Yayın derlemesi hiç etkilenmiyor. Panel React ile çalışıyor ve kendi
     rotasını açıyor; eklenti ana yapılandırmada dursaydı bir gün yanlışlıkla
     yayın çıktısına sızardı. Burada duruyorsa sızamaz — `astro build` bu
     dosyayı hiç okumuyor.

  2. `base` KALDIRILIYOR. Site "/web-sitem" altında yayınlanıyor ama
     Keystatic'in istemci yönlendiricisi Astro'nun `base` ayarını bilmiyor:
     kenar çubuğundaki bağlantı "/keystatic/collection/..." adresine gidiyor,
     API çağrısı da öneksiz çıkıp 404 alıyor ve koleksiyon "Unable to load"
     diyordu. Panel yalnızca yerelde, dosyaları düzenlemek için çalıştığı
     için önekin burada bir karşılığı yok.

  Panel `src/content/blog/` altındaki dosyaları doğrudan yazıyor; içerik
  git'te kalıyor, sunucuya hiçbir şey eklenmiyor.

  Ziyaretçi istatistiği sayfası (`/istatistik`) da aynı gerekçeyle buraya
  bağlandı: ziyaretçi verisi gösteriyor, internete açılamaz. Sayfanın kendisi
  `src/pages/` dışında duruyor ve rotayı yalnızca bu eklenti açıyor.
*/
export default defineConfig({
	...temelYapilandirma,
	base: undefined,
	integrations: [
		...(temelYapilandirma.integrations ?? []),
		keystatic(),
		istatistikPaneli(),
	],
});
