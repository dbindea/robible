<script>
  /**
   * Las notas de trabajo del paso TEXT, plegadas para releerlas después.
   *
   * Por qué existe: lo que se apunta antes de empezar —una ilustración que se
   * acaba de oír, un versículo que viene a la memoria, media frase— es
   * justamente lo que hace falta tener delante al formular la idea o al pensar
   * las divisiones, y estaba tres pasos atrás. Volver a TEXT a leerlo perdía el
   * hilo de lo que se estaba escribiendo.
   *
   * Es de **sólo lectura** a propósito. El sitio donde se escribe es TEXT, con
   * una hoja entera para escribir a gusto; si además se pudiera editar desde
   * aquí habría dos campos vivos sobre el mismo texto y ninguno de los dos
   * sería el bueno. Aquí se viene a mirar, no a apuntar.
   *
   * Se pliega como [Ajutor] y [Recapitulare] y recuerda la preferencia, con su
   * propia clave: son tres bloques distintos —uno enseña, otro recuerda lo
   * respondido, éste guarda lo tuyo— y cada uno se abre o se cierra por su
   * cuenta.
   */
  import Icon from './Icon.svelte';
  import { _ } from '../services/i18n.service';

  export let notes = '';

  const CLAVE = 'robible:sermons:notes-open';

  // Cerrada por defecto, al revés que el guía: son apuntes largos y abiertos de
  // salida empujarían el campo del paso fuera de la pantalla en un móvil.
  let abierta = false;
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado !== null) abierta = guardado === '1';
  } catch { /* sin localStorage se queda cerrada */ }

  const alternar = () => {
    abierta = !abierta;
    try { localStorage.setItem(CLAVE, abierta ? '1' : '0'); } catch { /* da igual */ }
  };

  $: hayNotas = typeof notes === 'string' && notes.trim().length > 0;
</script>

{#if hayNotas}
  <div class="notite" class:notite--abierta={abierta}>
    <button type="button" class="notite__boton" aria-expanded={abierta} on:click={alternar}>
      <span class="notite__icono"><Icon name="note" weight={abierta ? 'fill' : 'regular'} /></span>
      <span class="notite__etiqueta">{$_('app.sermons.notes_open')}</span>
      <!-- `class:` no compila sobre <Icon>: el chevron gira desde el <span>. -->
      <span class="notite__chevron"><Icon name="chevron-up" /></span>
    </button>

    {#if abierta}
      <div class="notite__cuerpo">
        <p class="notite__texto">{notes}</p>
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  /* Tercer bloque plegable de la preparación, y tiene que distinguirse de los
     otros dos de un vistazo: el guía va sobre veladura de acento y la
     recapitulación sobre superficie con filete de acento. Éste es el cuaderno
     del predicador, así que va sobre la superficie hundida y con el filete en
     tinta suave — más callado que los dos anteriores, porque no explica nada. */
  .notite {
    margin: 0 0 1.1rem;
    border: 1px solid var(--color-line);
    border-left: 3px solid var(--color-line-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    overflow: hidden;
  }

  .notite__boton {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.55rem 0.8rem;
    border: 0;
    background: transparent;
    color: var(--color-ink-strong);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    --icon-size: 1rem;
  }

  .notite__icono {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--color-ink-soft);
  }

  .notite__etiqueta { flex: 1; }

  .notite__chevron {
    display: inline-flex;
    flex-shrink: 0;
    transform: rotate(180deg);
    transition: transform var(--motion-base) var(--ease-out);
    --icon-size: 0.9rem;
  }

  .notite--abierta .notite__chevron { transform: rotate(0deg); }

  .notite__cuerpo {
    padding: 0 0.8rem 0.85rem;
  }

  .notite__texto {
    margin: 0;
    /* Se escribieron con saltos de línea y listas a mano: sin esto se pegan
       todas en un párrafo y dejan de ser una lista de ocurrencias. */
    white-space: pre-line;
    color: var(--color-ink);
    font-size: 0.88rem;
    line-height: 1.5;
    /* Un cuaderno de notas puede ser largo. Se le pone tope y scroll propio
       para que el bloque plegado no empuje el campo del paso fuera de la
       pantalla, que es justo lo que se venía a evitar. */
    max-height: 40vh;
    overflow-y: auto;
  }
</style>
