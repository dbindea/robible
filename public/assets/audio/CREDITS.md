# Créditos de audio

## Cómo funciona la música en RoBible

Hay **tres ambientes**, definidos en `src/services/music.service.js`. Cada uno
puede sonar de dos formas:

1. **Desde un fichero de esta carpeta**, si existe.
2. **Sintetizado con Web Audio**, si no hay fichero o falla al cargar.

El fichero es **opcional a propósito**. Los tres ambientes suenan hoy sin ningún
MP3: cero problemas de licencia, cero bytes añadidos a la instalación de la PWA
y funcionan sin conexión desde el primer día. Cuando haya una pista con licencia
clara, basta con dejarla aquí con el nombre que toca y pasa a usarse sola, sin
tocar código.

| Ambiente | Fichero esperado | Estado |
|---|---|---|
| `ebraica` | `ebraica.mp3` | Sintetizado (no hay fichero) |
| `rugaciune` | `rugaciune.mp3` | **Fichero** (ver abajo) |
| `liniste` | `liniste.mp3` | Sintetizado (no hay fichero) |

### Añadir una pista

1. Deja el archivo aquí con el nombre exacto de la tabla.
2. Añade su origen y licencia a este documento.
3. Bumpea `CACHE_NAME` en `public/sw.js` para que los usuarios con la PWA
   instalada reciban el archivo nuevo.

No hace falta tocar nada más: el servicio lo detecta al reproducir. Si el
archivo falta o no se puede decodificar, vuelve a la síntesis sin avisar —
no tener fichero es el estado normal, no un error.

**Requisitos de la pista**: instrumental, sin voz protagonista (compite con la
lectura), y que empalme razonablemente en bucle. Se reproduce con
`AudioBufferSourceNode.loop = true`, que une final y principio a nivel de
muestra, así que un corte brusco en los extremos se oirá en cada vuelta.

**Licencias**: sólo música propia, royalty-free con licencia que permita
realmente el uso, o dominio público. Nada de origen dudoso y nada enlazado
desde webs externas: los archivos viven en el repositorio para que la app
funcione sin conexión.

---

## `rugaciune.mp3`

- **Título original**: Contemplation
- **Autor**: Joth
- **Origen**: OpenGameArt — https://opengameart.org/content/contemplation-0
- **Licencia**: **CC0 1.0 Universal (dominio público)** — https://creativecommons.org/publicdomain/zero/1.0/
- **Descargado**: 4 septiembre 2026
- **Formato**: MP3, 160 kbps, 44,1 kHz, estéreo · 2,3 MB · ~2 min

CC0 significa que el autor renuncia a sus derechos: se puede usar con fines
comerciales, modificar y redistribuir **sin atribución obligatoria**. Este
archivo de créditos se mantiene igualmente por trazabilidad y cortesía.

El archivo no se ha modificado respecto al original descargado.

> Antes se llamaba `prayer-ambient.mp3` y era la única pista de la aplicación.
> El 7 sep 2026 pasó a ser la pista del ambiente `rugaciune`, que es exactamente
> el uso que ya tenía.

---

## Sobre la síntesis

Los ambientes sin fichero se generan con osciladores. No pretenden imitar una
grabación: buscan dar carácter propio a cada uno y, sobre todo, no competir con
la lectura.

- **`ebraica`** — escala **frigia dominante**, el modo *Ahava Raba* de la
  liturgia judía: 1 · b2 · 3 · 4 · 5 · b6 · b7. Lo que da ese color reconocible
  es la segunda aumentada entre la b2 y la tercera mayor, y el movimiento
  I → bII → I. Está generado, no copiado de ninguna grabación.
- **`rugaciune`** — dos octavas por debajo del ambiente neutro, con nota tenida
  y acordes muy largos. Grave y envolvente, para orar o escuchar sin distracción.
- **`liniste`** — pads suaves en registro alto, el más discreto de los tres.
