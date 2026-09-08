<script>
  /**
   * Lo ya respondido en los pasos anteriores, plegado en un bloque.
   *
   * Por qué existe: en STRUCTURĂ hay que hacerle preguntas analíticas a la idea
   * omiletică, y la idea se escribió en el paso anterior. Sin esto había que
   * retroceder a IDEE, leerla, y volver — cada vez que se formulaba una
   * división. Lo mismo pasa en DEZVOLTARE y en FINALIZARE, donde la frase de
   * inicio sale también de la idea.
   *
   * Sólo muestra los pasos **anteriores** al actual y sólo los campos con algo
   * escrito: un recordatorio con quince apartados vacíos no es un recordatorio.
   *
   * Se pliega como el guía y recuerda la preferencia, pero con su propia clave:
   * son dos cosas distintas —una enseña, la otra recuerda— y quien ya sabe
   * homilética cierra la primera y deja abierta la segunda.
   */
  import Icon from './Icon.svelte';
  import { _ } from '../services/i18n.service';
  import { STEPS, quitarMarcas } from '../services/sermon-content.service';

  export let content = null;
  export let paso = '';
  export let referencia = '';

  const CLAVE = 'robible:sermons:recap-open';

  let abierta = true;
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado !== null) abierta = guardado === '1';
  } catch { /* sin localStorage se queda abierta */ }

  const alternar = () => {
    abierta = !abierta;
    try { localStorage.setItem(CLAVE, abierta ? '1' : '0'); } catch { /* da igual */ }
  };

  const lleno = (v) => typeof v === 'string' && v.trim().length > 0;

  /**
   * Los apartados a enseñar, en el orden en que se escribieron.
   *
   * `destacado` es la idea omiletică: es de la que cuelga todo lo que se hace a
   * partir de aquí, así que se lee antes que el resto y no mezclada con él.
   */
  // `hecho` vive fuera del bloque reactivo y recibe el índice: definirla dentro
  // sería crear una función en cada recálculo (lo prohíbe `no-reactive-functions`)
  // y, sobre todo, escondería `indiceActual` al compilador. Svelte sólo sigue
  // lo que ve escrito en la expresión — la trampa 23 de CLAUDE.md.
  const hecho = (nombrePaso, actual) => STEPS.indexOf(nombrePaso) < actual;

  $: indiceActual = STEPS.indexOf(paso);

  $: apartados = !content ? [] : [
    ...(hecho('idea', indiceActual) && lleno(content.idea?.central)
      ? [{ clave: 'idea_central', valor: content.idea.central, destacado: true }]
      : []),
    ...(hecho('idea', indiceActual) && lleno(content.idea?.question)
      ? [{ clave: 'idea_question', valor: content.idea.question, destacado: true }]
      : []),
    ...(hecho('idea', indiceActual) && lleno(content.idea?.exegetical)
      ? [{ clave: 'idea_exegetical', valor: content.idea.exegetical }]
      : []),
    ...(hecho('idea', indiceActual) && lleno(content.idea?.purpose)
      ? [{ clave: 'idea_purpose', valor: content.idea.purpose }]
      : []),
    ...(hecho('observation', indiceActual)
      ? ['repeats', 'contrasts', 'actions', 'tension', 'truth']
          .filter((k) => lleno(content.observation?.[k]))
          .map((k) => ({ clave: `obs_${k}`, valor: content.observation[k] }))
      : []),
    ...(hecho('context', indiceActual)
      ? ['before', 'after', 'historical']
          .filter((k) => lleno(content.context?.[k]))
          .map((k) => ({ clave: `ctx_${k}`, valor: content.context[k] }))
      : []),
  ];

  // Las palabras que marcó en el texto: en STRUCTURĂ son la materia prima de
  // los títulos de las divisiones.
  $: marcadas = hecho('text', indiceActual) ? (content?.marks || []) : [];

  $: destacados = apartados.filter((a) => a.destacado);
  $: resto = apartados.filter((a) => !a.destacado);
  $: hayAlgo = apartados.length > 0 || marcadas.length > 0;
</script>

{#if hayAlgo}
  <div class="recap" class:recap--abierta={abierta}>
    <button type="button" class="recap__boton" aria-expanded={abierta} on:click={alternar}>
      <span class="recap__icono"><Icon name="file-text" weight={abierta ? 'fill' : 'regular'} /></span>
      <span class="recap__etiqueta">{$_('app.sermons.recap_open')}</span>
      <!-- `class:` no compila sobre <Icon>: el chevron gira desde el <span>. -->
      <span class="recap__chevron"><Icon name="chevron-up" /></span>
    </button>

    {#if abierta}
      <div class="recap__cuerpo">
        {#if referencia}
          <p class="recap__ref">{referencia}</p>
        {/if}

        {#each destacados as a (a.clave)}
          <div class="recap__campo recap__campo--destacado">
            <p class="recap__clave">{$_(`app.sermons.${a.clave}`)}</p>
            <p class="recap__valor">{quitarMarcas(a.valor)}</p>
          </div>
        {/each}

        {#if marcadas.length}
          <div class="recap__campo">
            <p class="recap__clave">{$_('app.sermons.recap_marked')}</p>
            <p class="recap__palabras">
              <!-- Sólo la palabra, sin el versículo: aquí se viene a recordar
                   qué llamó la atención, no dónde estaba. -->
              {#each marcadas as m, i (i)}
                <span class="recap__palabra">{m.word}</span>
              {/each}
            </p>
          </div>
        {/if}

        {#each resto as a (a.clave)}
          <div class="recap__campo">
            <p class="recap__clave">{$_(`app.sermons.${a.clave}`)}</p>
            <p class="recap__valor">{quitarMarcas(a.valor)}</p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  /* Deliberadamente distinto del guía: éste es tuyo, aquél explica. El guía va
     sobre veladura de acento; éste sobre superficie, con un filete lateral. */
  .recap {
    margin: 0 0 1.1rem;
    border: 1px solid var(--color-line);
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    overflow: hidden;
  }

  .recap__boton {
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

  .recap__icono {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--color-accent);
  }

  .recap__etiqueta { flex: 1; }

  .recap__chevron {
    display: inline-flex;
    flex-shrink: 0;
    transform: rotate(180deg);
    transition: transform var(--motion-base) var(--ease-out);
    --icon-size: 0.9rem;
  }

  .recap--abierta .recap__chevron { transform: rotate(0deg); }

  .recap__cuerpo {
    display: grid;
    gap: 0.7rem;
    padding: 0 0.8rem 0.85rem;
  }

  .recap__ref {
    margin: 0;
    color: var(--color-accent-ink);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .recap__campo { margin: 0; }

  .recap__clave {
    margin: 0 0 0.15rem;
    color: var(--color-ink-soft);
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .recap__valor {
    margin: 0;
    color: var(--color-ink);
    font-size: 0.88rem;
    line-height: 1.45;
    /* Los campos largos se escriben con saltos de línea; sin esto se pegan. */
    white-space: pre-line;
  }

  /* La idea omiletică y su pregunta: de ellas cuelga todo lo que viene. */
  .recap__campo--destacado {
    padding: 0.55rem 0.65rem;
    border-radius: var(--radius-sm);
    background: var(--wash-accent);

    .recap__valor {
      color: var(--color-ink-strong);
      font-size: 0.95rem;
      font-weight: 600;
    }
  }

  .recap__palabras {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0;
  }

  .recap__palabra {
    padding: 0.1rem 0.5rem;
    border-radius: var(--radius-pill);
    background: var(--wash-subtle);
    color: var(--color-ink);
    font-size: 0.82rem;
  }
</style>
