# Cloudflare — Configuracion Anti-Scraping para RoBible

## Por que Cloudflare?

Tu sitio tuvo 16.000 peticiones en un dia. Netlify sirve todo sin filtrar bots.
Cloudflare se pone delante de Netlify y:
- Cachea tus archivos estaticos en edge (menos peticiones llegan a Netlify)
- Detecta y bloquea bots automaticamente
- Rate limiting por IP configurable
- Proteccion DDoS gratis

Coste: **gratis** (plan gratuito).

---

## Paso 1: Apuntar DNS a Cloudflare

1. En Cloudflare, anade tu dominio `robible.com`
2. Cambia los nameservers en tu registrador a los de Cloudflare
3. Cloudflare empieza a recibir todo el trafico

**Importante:** Netlify sigue siendo tu hosting. Cloudflare solo hace de proxy/CDN.

En Cloudflare DNS:
- `A robible.com` → IP de Netlify (o usa `Netlify` como proxy directo)
- `CNAME www` → `robible.netlify.app` (proxied)

---

## Paso 2: Configurar Cache en Cloudflare

### Page Rules para cachear JSON de la Biblia

Ve a **Caching > Page Rules** y crea:

```
URL pattern: robible.com/data/*/*/*/*.json
Setting: Cache Level = Cache Everything
Edge Cache TTL: 1 month
```

```
URL pattern: robible.com/lang/*.json
Setting: Cache Level = Cache Everything
Edge Cache TTL: 1 month
```

```
URL pattern: robible.com/assets/*
Setting: Cache Level = Cache Everything
Edge Cache TTL: 1 month
```

Esto significa: si alguien pide `/data/vdc/bible.json`, Cloudflare lo cachea la primera vez y luego lo sirve desde edge — **ni llega a Netlify**.

---

## Paso 3: Firewall Rules (anti-scraping)

Ve a **Security > WAF > Custom Rules** y crea:

### Regla 1: Bloquear User-Agents de scrapers conocidos

```
Field: User Agent
Operator: contains
Value: GPTBot
Action: Block
```

Repite para: `ChatGPT-User`, `anthropic-ai`, `Bytespider`, `Claude-Web`, `Diffbot`

### Regla 2: Bloquear IPs con muchas peticiones

```
Field: Origin HTTP Response Code
Operator: equals
Value: 200

AND

Field: URI Path
Operator: contains
Value: /data/

AND

Field: Requests with known browser
Operator: does not equal
Value: yes
Action: JS Challenge
```

### Regla 3: Rate Limiting por IP

Ve a **Security > WAF > Rate Limiting**:

```
Name: Limite datos biblicos
Metric: IP + URI containing /data/
Condition: more than 50 requests per 1 minute
Action: Challenge (Captcha)
Browser Integrity Check: on
```

### Regla 4: Bloquear trafico con threat score alto

```
Field: Threat Score
Operator: greater than or equal
Value: 30
Action: Block
```

---

## Paso 4: Bot Management (gratis)

Ve a **Security > Bots**:

- **Bot Fight Mode**: ON
- **Automatically detect malicious bots**: ON

Esto bloquea automaticamente bots que se disfrazan de browsers normales.

---

## Paso 5: Configuracion de SSL

En **SSL/TLS**:
- Mode: Full (strict)
- Always Use HTTPS: ON
- Minimum TLS Version: 1.2

---

## Paso 6: Configuracion de Speed

En **Speed > Optimization**:

- **Auto Minify**: HTML, CSS, JS → ON
- **Brotli**: ON
- **Rocket Loader**: OFF (puede causar problemas con Svelte)

---

## Configuracion de Headers personalizados (Cloudflare Workers)

Si quieres control mas fino, crea un Worker:

```javascript
// wrangler.toml
name = "robible-headers"
main = "src/index.js"

[env.production]
zone_id = "TU_ZONE_ID"
routes = [{ pattern = "robible.com/*", zone_name = "robible.com" }]
```

```javascript
// src/index.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Headers de seguridad
    const securityHeaders = {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://robible-api.robible.workers.dev",
    };

    // Proteger JSONs contra hotlinking
    if (url.pathname.startsWith('/data/')) {
      const referer = request.headers.get('Referer') || '';
      const allowed = referer.includes('robible.com') || referer === '';
      if (!allowed && request.method === 'GET') {
        return new Response('Forbidden', { status: 403 });
      }
    }

    const response = await fetch(request);
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(securityHeaders)) {
      newHeaders.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  }
};
```

---

## Verificacion

Despues de aplicar:

1. **Limpia cache de Netlify**: `netlify deploy --prod --dir=dist` para forzar redeploy
2. **Verifica headers**: abre DevTools > Network > mira los headers de respuesta
3. **Prueba un scraper simulado**: `curl -A "GPTBot" https://robible.com/` → debe dar 403 o challenge
4. **Monitoriza en Cloudflare**: ve **Analytics & Security** para ver que se esta bloqueando

---

## Estimated Impact

| Sin Cloudflare | Con Cloudflare |
|---------------|---------------|
| 16.000 req/dia en Netlify | ~500 req/dia en Netlify (solo trafico real) |
| Todo el trafico pasa por Netlify | Assets cacheados en 200+ edge locations |
| Sin proteccion bots | Bot Fight Mode bloquea ~90% de scrapers |
| Sin rate limit | 50 req/min por IP enforced |

Con cache de Cloudflare en `/data/*`:
- La primera peticion de cada JSON va a Netlify
- Las siguientes 10.000 peticiones del mismo archivo se sirven desde edge
- **Ahorro de ancho de banda: ~99%**
