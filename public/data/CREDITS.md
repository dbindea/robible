# Procedencia de los textos bíblicos

Los cuatro textos son de **dominio público**. Se regeneran con
`node scripts/build-bible-data.mjs [version]`, que descarga la fuente, la
convierte al formato de la app y la valida contra el canon (66 libros con su
número de capítulos) antes de escribir nada.

| Versión | Texto | Fuente | Licencia |
|---|---|---|---|
| `vdc` | **Cornilescu Corregida (RCCV / VDCC)** | Heredada del proyecto | Dominio público |
| `rvl` | **Biblia en Español Sencillo (BES)** | Heredada del proyecto | **CC BY 4.0** |
| `en_kjv` | King James Version | [churchstudio-org/openbible](https://github.com/churchstudio-org/openbible) (`KJV/bible.json`) | Texto de dominio público; el repositorio, MIT |
| `zh_cuv` | 和合本 Chinese Union Version, chino simplificado | [seven1m/open-bibles](https://github.com/seven1m/open-bibles) (`chi-cuv-simp.usfx.xml`) | Dominio público (publicada en 1919) |

Las dos últimas se descargaron el 4 septiembre 2026.

## Qué son de verdad `vdc` y `rvl`

Los dos textos venían heredados y sin documentar. Se identificaron el 5 sep 2026
comparándolos verso a verso con candidatos de [seven1m/open-bibles](https://github.com/seven1m/open-bibles);
en ambos casos **7 de 7 sondeos coincidieron literalmente** (Gn 1:1, Sal 23:1,
Is 53:5, Jn 1:1, Jn 3:16, Rom 8:28, Ap 22:21).

**`vdc` = `ron-rccv.usfx.xml`**, la *Romanian Corrected Cornilescu Version*.
Es Cornilescu, pero la edición **corregida**, no la original de 1924. El código
`vdc` se mantiene por decisión del propietario: es la misma familia y cambiarlo
invalidaría las URLs ya indexadas del idioma principal de la aplicación.

**`rvl` = `spa-bes.usfx.xml`**, la *Biblia en Español Sencillo*. **No es
Reina-Valera**, pese a lo que sugiere el código: es una traducción a lenguaje
sencillo derivada de la *Bible in Basic English*. Se ve claro en Juan 1:1, que
dice «Desde el principio él era la Palabra» en lugar de «En el principio era el
Verbo». El código `rvl` se mantiene, también por decisión del propietario.

> ⚠️ **Pendiente**: la BES es **CC BY 4.0**, que obliga a atribuir. La aplicación
> no muestra hoy ninguna atribución del texto español. Este archivo no basta:
> la licencia pide crédito allí donde se usa la obra. Bastaría una línea en el
> pie o en la pantalla «acerca de».

## Formato

```
bible.json      array[66] → capítulos → versículos (string)
bible.map.json  { "0": "Genesis", …, "65": "Revelation", ot: [...], nt: [...], all: [...] }
```

Índices 0-based en los arrays; en las URLs, capítulo y versículo son 1-based.

## Cifras

| Versión | Versículos | bible.json |
|---|---|---|
| `en_kjv` | 31.103 | 4,0 MB |
| `zh_cuv` | 31.100 | 1,1 MB |

Las diferencias de recuento entre versiones son normales: la versificación varía
según la tradición textual.

## Añadir otra versión

1. Añade su entrada a `FUENTES` en `scripts/build-bible-data.mjs`, con una
   función `convertir()` que devuelva `{ libros, nombres }`.
2. Ejecuta el script: si la fuente está incompleta o desordenada, la validación
   falla antes de escribir.
3. Añade la versión a `BIBLE_VERSIONS` en `src/config/bible-versions.js` con
   `available: true`.
4. Decide `seoVersePages`. Ver abajo.
5. Bumpea `CACHE_NAME` en `public/sw.js`.

### Sobre `seoVersePages`

Cada versión con `seoVersePages: true` genera **una página HTML estática por
versículo**: unos 31.000 archivos. Con las cuatro versiones activadas, `dist`
pasaba a 938 MB en 102.000 archivos y el build a más de siete minutos, lo que
hace el despliegue inviable.

Hoy solo `vdc` y `rvl` las generan. `en_kjv` y `zh_cuv` tienen páginas de libro
y de capítulo, que ya cubren lo esencial para buscadores; los versículos siguen
siendo navegables en la aplicación y aparecen en el sitemap de su capítulo.

### Sobre el service worker

`public/sw.js` precachea solo `vdc` y `rvl`. Las otras dos se cachean la primera
vez que se abren, no en la instalación: precachear cuatro Biblias dejaría la
instalación de la PWA en unos 17 MB para leer una sola.
