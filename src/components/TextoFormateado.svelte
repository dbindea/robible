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
   */
  import { segmentarTexto } from '../services/sermon-content.service';

  export let texto = '';

  $: segmentos = segmentarTexto(texto || '');
</script>

<span class="texto-formateado">{#each segmentos as s, i (i)}{#if s.bold}<strong>{s.texto}</strong>{:else if s.italica}<em>{s.texto}</em>{:else}{s.texto}{/if}{/each}</span>

<style>
  /* `inline` a propósito: se usa dentro de un `<p>` existente y no debe
     romper el flujo del párrafo. */
  .texto-formateado {
    display: inline;
  }
</style>
