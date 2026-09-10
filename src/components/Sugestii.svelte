<script>
  /**
   * La bombilla de la propoziția de tranziție: cómo se construye y tres moldes
   * para empezar.
   *
   * Por qué no es otro [Ajutor]: aquél explica un paso entero y va abierto de
   * salida, con cinco viñetas y un ejemplo. Esto es una sola cosa —una frase— y
   * lo que hace falta es media línea y un molde que se pueda tocar. Metido
   * dentro del guía del paso quedaría enterrado bajo lo de las divisiones
   * simétricas, que es lo que el predicador está leyendo en ese momento.
   *
   * Las plantillas llevan la palabra clave EN MAYÚSCULAS (MOTIVE, PAȘI,
   * CONDIȚII) a propósito: es la pieza que hay que cambiar, y verla gritada
   * dice sin explicarlo que ahí va lo tuyo. Y acaban en puntos suspensivos
   * porque la frase se termina a mano; un molde que pareciera completo se
   * quedaría tal cual en la predicación.
   */
  import Icon from './Icon.svelte';
  import { _ } from '../services/i18n.service';
  import { sugerenciasDeTransicion } from '../config/homiletics';

  /** Se llama con la plantilla elegida. */
  export let onElegir = () => {};

  const CLAVE = 'robible:sermons:hint-open';

  let abierta = false;
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado !== null) abierta = guardado === '1';
  } catch { /* sin localStorage se queda cerrada */ }

  const alternar = () => {
    abierta = !abierta;
    try { localStorage.setItem(CLAVE, abierta ? '1' : '0'); } catch { /* da igual */ }
  };

  const sugerencias = sugerenciasDeTransicion();
</script>

<div class="sugestii" class:sugestii--abierta={abierta}>
  <button type="button" class="sugestii__boton" aria-expanded={abierta} on:click={alternar}>
    <span class="sugestii__icono"><Icon name="light" weight={abierta ? 'fill' : 'regular'} /></span>
    <span class="sugestii__etiqueta">{$_('app.homiletics.transition.title')}</span>
    <span class="sugestii__chevron"><Icon name="chevron-up" /></span>
  </button>

  {#if abierta}
    <div class="sugestii__cuerpo">
      <p class="sugestii__como">{$_('app.homiletics.transition.how')}</p>
      <p class="sugestii__pista">{$_('app.homiletics.transition.pick')}</p>
      <div class="sugestii__lista">
        {#each sugerencias as s (s)}
          <button type="button" class="sugestii__molde" on:click={() => onElegir($_(`app.homiletics.transition.${s}`))}>
            {$_(`app.homiletics.transition.${s}`)}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .sugestii {
    margin: 0 0 0.5rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--wash-accent);
    overflow: hidden;
  }

  .sugestii__boton {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 0;
    background: transparent;
    color: var(--color-accent-ink);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    --icon-size: 1rem;
  }

  .sugestii__icono {
    display: inline-flex;
    flex-shrink: 0;
  }

  .sugestii__etiqueta { flex: 1; }

  .sugestii__chevron {
    display: inline-flex;
    flex-shrink: 0;
    transform: rotate(180deg);
    transition: transform var(--motion-base) var(--ease-out);
    --icon-size: 0.9rem;
  }

  .sugestii--abierta .sugestii__chevron { transform: rotate(0deg); }

  .sugestii__cuerpo {
    padding: 0 0.75rem 0.75rem;
  }

  .sugestii__como {
    margin: 0 0 0.5rem;
    color: var(--color-ink);
    font-size: 0.84rem;
    line-height: 1.45;
  }

  .sugestii__pista {
    margin: 0 0 0.4rem;
    color: var(--color-ink-soft);
    font-size: 0.74rem;
  }

  .sugestii__lista {
    display: grid;
    gap: 0.35rem;
  }

  /* Cada molde es un botón de ancho completo y texto a la izquierda: son frases,
     no etiquetas, y en fila se partían en dos líneas cada una. */
  .sugestii__molde {
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: inherit;
    font-size: 0.84rem;
    line-height: 1.35;
    text-align: left;
    cursor: pointer;
    transition: var(--transition);

    &:hover { border-color: var(--color-accent); background: var(--wash-accent); }
  }
</style>
