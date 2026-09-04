# Créditos de las imágenes de la landing

Todas de [Unsplash](https://unsplash.com), bajo la **Unsplash License**: uso
comercial y no comercial libre, sin permiso ni atribución obligatoria. Se
acreditan aquí de todos modos, por cortesía y para poder rastrear el origen.

> No confundir con **Unsplash+**, que es de suscripción y tiene otros términos.
> Ninguna de estas lo es; se comprobó en la página de cada foto antes de bajarla.

| Archivo | Autor | Página original | Uso |
|---|---|---|---|
| `persona-leyendo.*` | Jessica Mangano | [75IkDR0Mqd8](https://unsplash.com/photos/a-person-is-reading-a-book-on-a-table-75IkDR0Mqd8) | Hero |
| `cruz.*` | Aaron Burden | [09AhDCedXF8](https://unsplash.com/photos/a-brown-wooden-cross-09AhDCedXF8) | Sección de confianza |
| `libro-abierto-vela.*` | Isaac Graulich | [y0g6QZkXAbM](https://unsplash.com/photos/an-open-book-sitting-on-top-of-a-table-next-to-a-candle-y0g6QZkXAbM) | Sección de lectura |

## Formato

Cada foto está en `.webp` (la que se sirve) y `.jpg` (respaldo para navegadores
sin soporte webp, ya muy raros). Reescaladas a 1000–1400 px de ancho y a calidad
72: las tres juntas pesan **184 KB**, frente a los ~15 MB de los originales.

Regenerar o añadir otra: descargar el original de Unsplash y pasarlo por `sharp`
con `.resize(ancho).webp({ quality: 72 })`. Comprobar siempre en la página de la
foto que **no** es Unsplash+.

## Descartadas

- `photo-1643716991951-285e23e35961` (Mindaugas Norvilas, vela y libro): la vela
  lleva el logotipo de una marca comercial bien visible. Poner la marca de otra
  empresa en el hero de RoBible no procede.
