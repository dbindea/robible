# Créditos de audio

## `prayer-ambient.mp3`

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

### Cómo cambiar la pista

1. Sustituye `prayer-ambient.mp3` por el archivo nuevo, con el mismo nombre.
2. Actualiza este documento con el origen y la licencia de la pista nueva.
3. Bumpea `CACHE_NAME` en `public/sw.js` para que los usuarios con la PWA
   instalada reciban la pista nueva en vez de la cacheada.

La ruta está en `PRAYER_TRACK_URL`, en
[`src/services/music.service.js`](../../../src/services/music.service.js). Si el
archivo falta o no se puede decodificar, el servicio cae a un pad sintético
generado con osciladores, así que la app no se rompe.

### Nota sobre el bucle

La pista se reproduce con `AudioBufferSourceNode.loop = true`, que empalma final
y principio con precisión de muestra. Aun así, si una pista no está compuesta
para repetirse, el empalme se nota como un salto musical. Al elegir una pista
nueva, conviene que sea de tipo *loop* o que empiece y acabe en silencio.

---

## Licencias de terceros en el proyecto

Fuentes tipográficas: Open Sans (Apache License 2.0), en `public/assets/font/`.
