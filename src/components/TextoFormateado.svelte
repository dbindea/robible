<script>
  /**
   * Un texto de la predicación (explicación, ilustración, aplicación, un
   * subpunto, la introducción…) con el formato de sus tres marcados:
   * `*palabra*` sale en negrita, `{{ref|versículo}}` en cursiva y `## rótulo`
   * como subtítulo, en el sitio exacto donde se escribieron.
   *
   * Por qué existe: antes estas pantallas llamaban a `quitarMarcas`, que
   * limpia la sintaxis pero no le da ningún formato al resultado — la negrita
   * nunca llegaba a verse y una cita en línea salía como texto plano pegado a
   * la frase, indistinguible del resto. Este componente y `runsDeTexto` en
   * `sermon-pdf.service.js` son la misma idea en dos sitios: HTML aquí,
   * un array de `text` de pdfmake allí. Los dos se apoyan en la misma
   * segmentación pura (`bloquesDe` + `segmentarTexto`), así que el documento
   * en pantalla y el PDF nunca pueden desincronizarse en esto.
   *
   * Hay dos niveles y conviene no confundirlos:
   *   - `bloquesDe` parte el campo en PÁRRAFOS, subtítulos y citas sueltas.
   *     Es lo que traduce una línea en blanco del `textarea` en un párrafo de
   *     verdad en vez de un renglón vacío.
   *   - `segmentarTexto` parte cada párrafo en trozos con formato. La
   *     referencia y el versículo de una cita en línea van marcados con
   *     `cita: true` en los dos segmentos que la forman; aquí se agrupan en un
   *     solo `<span>` con su barra a la izquierda, para que se distinga de un
   *     vistazo de una palabra suelta en negrita.
   *
   * Con un solo párrafo —una palabra clave de la schiță, una línea del Modo
   * Amvon— se pinta EN LÍNEA, exactamente como antes: este componente vive
   * dentro de un `<p>` ajeno y no puede romperle el flujo sin motivo.
   */
  import { bloquesDe, segmentarTexto } from '../services/sermon-content.service';

  export let texto = '';

  /** Agrupa segmentos consecutivos de una misma cita en un solo bloque. */
  const agrupar = (segmentos) => {
    const grupos = [];
    for (const s of segmentos) {
      const anterior = grupos[grupos.length - 1];
      if (s.cita && anterior?.cita) anterior.partes.push(s);
      else grupos.push(s.cita ? { cita: true, partes: [s] } : s);
    }
    return grupos;
  };

  $: bloques = bloquesDe(texto || '').map((b) => ({ ...b, grupos: agrupar(segmentarTexto(b.texto)) }));
  $: enBloques = bloques.length > 1 || (bloques[0] && bloques[0].tipo !== 'parrafo');
  $: sueltos = bloques[0]?.grupos || [{ texto: '' }];
</script>

<span class="texto-formateado" class:texto-formateado--bloques={enBloques}
  >{#if !enBloques}{#each sueltos as g, i (i)}{#if g.cita}<span class="texto-formateado__cita"
          >{#each g.partes as p, j (j)}{#if p.bold}<strong>{p.texto}</strong>{:else if p.italica}<em>{p.texto}</em
              >{/if}{/each}</span
        >{:else if g.bold}<strong>{g.texto}</strong>{:else if g.italica}<em>{g.texto}</em
        >{:else}{g.texto}{/if}{/each}{:else}{#each bloques as b, i (i)}{#if b.tipo === 'subtitulo'}<span
          class="texto-formateado__subtitulo">{b.texto}</span
        >{:else if b.tipo === 'cita'}<span class="texto-formateado__verso"
          ><span class="texto-formateado__verso-ref">{b.label}</span><em
            >{#each b.grupos as g, j (j)}{#if g.bold}<strong>{g.texto}</strong>{:else}{g.texto}{/if}{/each}</em
          ></span
        >{:else}<span class="texto-formateado__parrafo"
          >{#each b.grupos as g, j (j)}{#if g.cita}<span class="texto-formateado__cita"
                >{#each g.partes as p, k (k)}{#if p.bold}<strong>{p.texto}</strong>{:else if p.italica}<em>{p.texto}</em
                    >{/if}{/each}</span
              >{:else if g.bold}<strong>{g.texto}</strong>{:else if g.italica}<em>{g.texto}</em
              >{:else}{g.texto}{/if}{/each}</span
        >{/if}{/each}{/if}</span
>

<style>
  /* `inline` a propósito: se usa dentro de un `<p>` existente y, mientras el
     campo sea un solo párrafo, no debe romper el flujo de ese párrafo. */
  .texto-formateado {
    display: inline;
  }

  /* En cuanto hay más de un bloque —párrafos separados, un subtítulo, un
     versículo suelto— cada uno necesita su propia caja y su aire. */
  .texto-formateado--bloques {
    display: block;
  }

  .texto-formateado--bloques > span {
    display: block;
  }

  .texto-formateado--bloques > span + span {
    margin-top: 0.75em;
  }

  /* El rótulo que pone el predicador. Antes aquí había tres etiquetas fijas
     —EXPLICĂ, ILUSTREAZĂ, APLICĂ— que eran andamio del curso de homilética;
     esto es lo contrario: su propia división del texto. Aire de párrafo antes
     y después, que es lo que lo separa del cuerpo. */
  .texto-formateado__subtitulo {
    color: var(--color-ink-strong);
    font-weight: 700;
    letter-spacing: var(--letter-spacing-eyebrow);
    text-transform: uppercase;
  }

  .texto-formateado--bloques > .texto-formateado__subtitulo {
    margin-top: 1.5em;
  }

  /* La barra a la izquierda distingue una cita bíblica insertada de una
     palabra cualquiera en negrita, sin convertirla en un bloque aparte: sigue
     fluyendo dentro de la misma frase. */
  .texto-formateado__cita {
    padding-left: 0.4rem;
    border-left: 2px solid var(--color-accent);
  }

  /* Y cuando la cita está sola en su línea, es un bloque de verdad: la
     referencia encima y el versículo sangrado, igual que en el PDF. */
  .texto-formateado__verso {
    padding-left: 0.85rem;
    border-left: 3px solid var(--color-accent);
    color: var(--color-ink-soft);
  }

  .texto-formateado__verso-ref {
    display: block;
    color: var(--color-accent-ink);
    font-size: 0.85em;
    font-weight: 700;
  }
</style>
