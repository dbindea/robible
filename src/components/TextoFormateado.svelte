<script>
  /**
   * Un texto de la predicación (explicación, ilustración, aplicación, un
   * subpunto, la introducción…) con el formato de sus dos marcados en línea:
   * `*palabra*` sale en negrita y `{{ref|versículo}}` en cursiva, en el sitio
   * exacto donde se escribieron.
   *
   * Por qué existe: antes estas pantallas llamaban a `quitarMarcas`, que
   * limpia la sintaxis pero no le da ningún formato al resultado — la negrita
   * nunca llegaba a verse y una cita en línea salía como texto plano pegado a
   * la frase, indistinguible del resto. Este componente y `runsDeTexto` en
   * `sermon-pdf.service.js` son la misma idea en dos sitios: HTML aquí,
   * un array de `text` de pdfmake allí. Los dos se apoyan en la misma
   * segmentación pura (`segmentarTexto`), así que el documento en pantalla y
   * el PDF nunca pueden desincronizarse en esto.
   *
   * La referencia y el versículo de una cita van marcados con `cita: true` en
   * los dos segmentos que la forman (ver `segmentarTexto`); aquí se agrupan
   * en un solo `<span>` con su propia barra a la izquierda, para que se
   * distinga de un vistazo de una palabra suelta en negrita.
   */
  import { segmentarTexto } from '../services/sermon-content.service';

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

  $: grupos = agrupar(segmentarTexto(texto || ''));
</script>

<span class="texto-formateado">{#each grupos as g, i (i)}{#if g.cita}<span class="texto-formateado__cita">{#each g.partes as p, j (j)}{#if p.bold}<strong>{p.texto}</strong>{:else if p.italica}<em>{p.texto}</em>{/if}{/each}</span>{:else if g.bold}<strong>{g.texto}</strong>{:else if g.italica}<em>{g.texto}</em>{:else}{g.texto}{/if}{/each}</span>

<style>
  /* `inline` a propósito: se usa dentro de un `<p>` existente y no debe
     romper el flujo del párrafo. */
  .texto-formateado {
    display: inline;
  }

  /* La barra a la izquierda distingue una cita bíblica insertada de una
     palabra cualquiera en negrita, sin convertirla en un bloque aparte: sigue
     fluyendo dentro de la misma frase. */
  .texto-formateado__cita {
    padding-left: 0.4rem;
    border-left: 2px solid var(--color-accent);
  }
</style>
