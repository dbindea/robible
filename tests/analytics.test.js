// Quién cuenta como visita y quién no.
//
// El contador del panel de admin sirve para saber cuánta gente entra. Un
// rastreador que renderiza la página dispara el mismo beacon que una persona,
// así que sin este filtro las cifras son las de Googlebot y no las de nadie.
//
// Este test existe sobre todo por el otro lado del riesgo: cortar de más.
// Una persona que deja de contarse no produce ningún síntoma — la cifra
// simplemente baja y nadie sabe por qué. Por eso la mitad de los casos son
// User-Agent de navegador de verdad que TIENEN que seguir contando.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esVisitaDeBot } from '../workers/robible-api/src/analytics.js';

// User-Agent reales, copiados tal cual. No los "limpies": el valor del test
// está en que sean los que llegan de verdad.
const NAVEGADORES = [
  // Chrome en Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  // Safari en iPhone — el caso más común de la aplicación
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // Chrome en Android
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36',
  // Firefox en Linux
  'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  // Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.2739.79',
  // Samsung Internet
  'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  // Opera
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 OPR/113.0.0.0',
  // Safari en Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
];

const BOTS = [
  // Los dos que se pidió cortar
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/129.0.6668.70 Safari/537.36',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  // Otros buscadores
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckgo-help-pages/)',
  'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  // Modelos de lenguaje
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot',
  'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot',
  'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
  // SEO
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  // Vista previa al pegar el enlace en un chat
  'Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Safari/537.36 (compatible; TelegramBot)',
  'WhatsApp/2.23.20.0 A',
  'Twitterbot/1.0',
  // Herramientas y bibliotecas
  'curl/8.4.0',
  'Wget/1.21.4',
  'python-requests/2.32.3',
  'Go-http-client/1.1',
  'axios/1.7.2',
  'PostmanRuntime/7.39.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Chrome-Lighthouse',
  // Monitorización
  'Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
];

test('los navegadores de verdad cuentan como visita', () => {
  for (const ua of NAVEGADORES) {
    assert.equal(esVisitaDeBot(ua), false, `no debería descartar: ${ua}`);
  }
});

test('los rastreadores no cuentan', () => {
  for (const ua of BOTS) {
    assert.equal(esVisitaDeBot(ua), true, `debería descartar: ${ua}`);
  }
});

test('sin User-Agent no se cuenta', () => {
  for (const vacio of ['', '   ', null, undefined, 0]) {
    assert.equal(esVisitaDeBot(vacio), true, `debería descartar ${JSON.stringify(vacio)}`);
  }
});

// El motivo de que la lista sea explícita en vez de un `/bot/` genérico: CUBOT
// es una marca de móviles Android y su nombre aparece en el User-Agent. Con el
// comodín, esa gente dejaba de contarse y no había forma de notarlo.
test('una marca de móvil con «bot» en el nombre sigue contando', () => {
  const cubot = 'Mozilla/5.0 (Linux; Android 10; CUBOT_NOTE_7 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
  assert.equal(esVisitaDeBot(cubot), false);

  // Mismo riesgo con 'abot', 'robot' dentro de una palabra, etc.
  const robotics = 'Mozilla/5.0 (Linux; Android 12; Robotic Tab X1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  assert.equal(esVisitaDeBot(robotics), false);
});

test('la comparación no depende de mayúsculas', () => {
  assert.equal(esVisitaDeBot('MOZILLA/5.0 (COMPATIBLE; GOOGLEBOT/2.1)'), true);
  assert.equal(esVisitaDeBot('Mozilla/5.0 (compatible; googlebot/2.1)'), true);
});
