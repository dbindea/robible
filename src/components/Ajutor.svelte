<script>
  /**
   * Nota al margen de homilética para un paso de la preparación.
   *
   * Es un desplegable **en línea**, no un modal: la ayuda se lee mientras se
   * escribe en el campo de al lado, y un diálogo por encima obligaría a
   * cerrarlo para volver a mirar el texto. Por lo mismo no es un tooltip: hay
   * cinco viñetas y un ejemplo, que en un globo flotante no caben.
   *
   * La preferencia de abierto/cerrado se guarda una sola vez para toda la
   * aplicación, no por paso: quien está aprendiendo la quiere siempre y quien
   * ya sabe la cierra una vez y no la vuelve a ver.
   */
  import Icon from './Icon.svelte';
  import { _ } from '../services/i18n.service';
  import { GUIA, vinetasDe, ejemploDe, tieneGuia, tieneNotaDeTipo } from '../config/homiletics';

  export let paso = '';
  /** Tipo de predicación. Sólo cambia el aviso; la guía es la misma. */
  export let tip = 'expositive';

  const CLAVE = 'robible:sermons:guide-open';

  // Abierta por defecto: el que no la necesita la cierra una vez; el que la
  // necesita no sabe todavía que existe, así que no la iría a buscar.
  let abierta = true;
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado !== null) abierta = guardado === '1';
  } catch { /* sin localStorage se queda abierta */ }

  const alternar = () => {
    abierta = !abierta;
    try { localStorage.setItem(CLAVE, abierta ? '1' : '0'); } catch { /* da igual */ }
  };

  $: conf = GUIA[paso] || {};
  $: vinetas = vinetasDe(paso);
  $: ejemplo = ejemploDe(paso);
</script>

{#if tieneGuia(paso)}
  <div class="ajutor" class:ajutor--abierta={abierta}>
    <button type="button" class="ajutor__boton" aria-expanded={abierta} on:click={alternar}>
      <span class="ajutor__icono"><Icon name="light" weight={abierta ? 'fill' : 'regular'} /></span>
      <span class="ajutor__etiqueta">{$_('app.homiletics.open')}</span>
      <!-- `class:` no compila sobre <Icon> (es una directiva de elemento):
           el chevron gira desde el <span> que lo envuelve. -->
      <span class="ajutor__chevron"><Icon name="chevron-up" /></span>
    </button>

    {#if abierta}
      <div class="ajutor__cuerpo">
        <!-- Primero el aviso del tipo, si lo hay: si estás escribiendo una
             temática, saberlo cambia cómo se lee todo lo de debajo. -->
        {#if tieneNotaDeTipo(tip, paso)}
          <p class="ajutor__tipo">
            <strong>{$_(`app.sermons.type_${tip}`)}:</strong>
            {$_(`app.homiletics.types.${tip}.${paso}`)}
          </p>
        {/if}

        <p class="ajutor__porque">{$_(`app.homiletics.${paso}.why`)}</p>

        <ul class="ajutor__lista">
          {#each vinetas as v (v)}
            <li>{$_(`app.homiletics.${paso}.${v}`)}</li>
          {/each}
        </ul>

        {#if conf.quote}
          <blockquote class="ajutor__cita">{$_(`app.homiletics.${paso}.quote`)}</blockquote>
        {/if}

        {#if ejemplo.length}
          <div class="ajutor__ejemplo">
            <p class="ajutor__ejemplo-titulo">{$_('app.homiletics.example')}</p>
            {#each ejemplo as e (e)}
              <p class="ajutor__ejemplo-linea">{$_(`app.homiletics.${paso}.${e}`)}</p>
            {/each}
          </div>
        {/if}

        {#if conf.warn}
          <p class="ajutor__aviso">{$_(`app.homiletics.${paso}.warn`)}</p>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .ajutor {
    margin: 0 0 1.1rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--wash-accent);
    overflow: hidden;
  }

  .ajutor__boton {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.55rem 0.8rem;
    border: 0;
    background: transparent;
    color: var(--color-accent-ink);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    --icon-size: 1rem;
  }

  .ajutor__icono {
    display: inline-flex;
    flex-shrink: 0;
  }

  .ajutor__etiqueta {
    flex: 1;
  }

  .ajutor__chevron {
    display: inline-flex;
    flex-shrink: 0;
    /* Cerrada apunta hacia abajo; al abrirse vuelve a su posición. */
    transform: rotate(180deg);
    transition: transform var(--motion-base) var(--ease-out);
    --icon-size: 0.9rem;
  }

  .ajutor--abierta .ajutor__chevron {
    transform: rotate(0deg);
  }

  .ajutor__cuerpo {
    padding: 0 0.8rem 0.85rem;
    color: var(--color-ink);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .ajutor__porque {
    margin: 0 0 0.6rem;
    font-weight: 600;
  }

  .ajutor__tipo {
    margin: 0 0 0.7rem;
    padding: 0.5rem 0.65rem;
    border-left: 3px solid var(--color-accent);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--color-surface);
    line-height: 1.45;
  }

  .ajutor__lista {
    margin: 0;
    padding-left: 1.1rem;

    li { margin-bottom: 0.35rem; }
  }

  .ajutor__cita {
    margin: 0.75rem 0 0;
    padding-left: 0.7rem;
    border-left: 3px solid var(--color-accent);
    color: var(--color-ink-soft);
    font-style: italic;
  }

  .ajutor__ejemplo {
    margin-top: 0.8rem;
    padding: 0.6rem 0.75rem;
    border-radius: var(--radius-sm);
    /* Sobre la veladura de acento del contenedor hace falta un fondo propio,
       o el ejemplo se confunde con las viñetas. */
    background: var(--color-surface);
    border: 1px solid var(--color-line);
  }

  .ajutor__ejemplo-titulo {
    margin: 0 0 0.35rem;
    color: var(--color-ink-soft);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .ajutor__ejemplo-linea {
    margin: 0 0 0.25rem;

    &:last-child { margin-bottom: 0; }
  }

  .ajutor__aviso {
    margin: 0.8rem 0 0;
    font-weight: 700;
    color: var(--color-accent-ink);
  }
</style>
