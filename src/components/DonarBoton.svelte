<script>
  /**
   * Botón de donación por PayPal.
   *
   * Es un enlace, no un formulario ni un SDK: no carga nada de paypal.com
   * hasta que alguien decide pulsarlo. El porqué, en `src/config/site.js`.
   *
   * Se pinta en los dos pies —el de la aplicación y el de la landing— y sirve
   * para cualquier otra página que lo quiera: es una línea. Si el usuario de
   * PayPal no está configurado, el componente **no pinta nada**, así que se
   * puede colocar sin condiciones alrededor.
   *
   * `variante`:
   *   'bloque'   → título, botón y el para qué de los fondos. El de los pies.
   *   'compacto' → sólo el botón. Para una barra o el final de una sección,
   *                donde el párrafo explicativo no cabe.
   *
   * El destino de los fondos va con el botón y no en una página aparte a
   * propósito: quien dona decide en el momento de pulsar, y mandarlo a leer
   * otra pantalla para saber adónde va su dinero es pedirle un acto de fe que
   * no hace falta pedirle.
   */
  import Icon from './Icon.svelte';
  import { _ } from '../services/i18n.service';
  import { enlaceDonacion, hayDonaciones } from '../config/site';

  /** 'bloque' | 'compacto' */
  export let variante = 'bloque';

  const url = enlaceDonacion();
  const activo = hayDonaciones();
</script>

{#if activo}
  <div class="donar" class:donar--compacto={variante === 'compacto'}>
    {#if variante === 'bloque'}
      <p class="donar__titulo">{$_('app.donate.title')}</p>
    {/if}

    <!-- `noopener` es obligatorio con `_blank`: sin él la pestaña de PayPal
         recibe `window.opener` y puede reescribir la nuestra. -->
    <a class="donar__boton" href={url} target="_blank" rel="noopener noreferrer">
      <Icon name="heart" weight="fill" size="0.95rem" />
      {$_('app.donate.action')}
    </a>

    {#if variante === 'bloque'}
      <p class="donar__nota">{$_('app.donate.note')}</p>
    {/if}
  </div>
{/if}

<style lang="scss">
  /* La alineación se controla desde fuera con `--donar-align`, y no con una
     prop ni con `:global()`: el scoping de Svelte impide que el padre alcance
     estas clases, pero las variables CSS sí cruzan esa frontera. Es el mismo
     mecanismo que `--icon-size` en `Icon.svelte`. En el pie, la versión de
     móvil lo pone a `center` y en escritorio se queda alineado a la izquierda
     con el resto de la columna. */
  .donar {
    display: grid;
    gap: 0.5rem;
    justify-items: var(--donar-align, start);
    text-align: var(--donar-text-align, left);
  }

  .donar--compacto {
    display: inline-grid;
  }

  .donar__titulo {
    margin: 0;
    color: var(--color-ink-strong);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  /* Relleno de acento y no contorno: es la única acción del pie que pide algo
     al visitante, y con el aspecto de un enlace más se perdía entre los doce
     que tiene al lado. `--color-accent-solid` y no `--color-accent` porque
     lleva texto encima y el acento pelado se queda en 3.30:1 (CLAUDE.md, la
     trampa del sistema de diseño). */
  .donar__boton {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.35rem;
    padding: 0 1rem;
    border-radius: var(--radius-pill);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      background: var(--color-accent-solid-hover);
    }
  }

  /* El tamaño va aquí y no en `.donar`: `global.css` da `p { font-size: 1rem }`
     a todo párrafo, y eso le gana a la herencia del contenedor. Sobre la clase
     del propio `<p>` sí manda, porque una clase pesa más que un elemento. */
  .donar__nota {
    max-width: 32ch;
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.76rem;
    line-height: 1.45;
  }
</style>
