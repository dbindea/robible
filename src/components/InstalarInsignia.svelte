<script>
  /**
   * La insignia de descarga, al estilo de las de Play Store y App Store.
   *
   * Por qué con esa forma: RoBible no está en ninguna tienda —es una PWA— y
   * «instalar desde el navegador» no es un gesto que la gente tenga aprendido.
   * La pastilla con icono a la izquierda, la línea pequeña arriba y el nombre
   * grande abajo SÍ está aprendida, y dice «esto se descarga» sin explicarlo.
   *
   * No copia los logotipos de Google ni de Apple, claro: son marcas
   * registradas y además mentirían sobre de dónde viene la aplicación. El
   * icono es el de RoBible.
   *
   * Sirve para las dos cosas que se piden desde fuera: instalarla la primera
   * vez, y volver a instalarla encima de lo que ya hay. En las dos el
   * navegador hace lo mismo, así que es el mismo botón.
   */
  import { _ } from '../services/i18n.service';

  /** Qué hacer al pulsar. Lo decide quien la coloca. */
  export let onClick = () => {};
  /** `true` mientras el navegador no ofrezca instalar nada. */
  export let disabled = false;
  /** Línea pequeña de arriba. Por defecto, «Descarga gratis». */
  export let eyebrow = '';
</script>

<button type="button" class="insignia" {disabled} on:click={onClick}>
  <img class="insignia__icono" src="/assets/img/logo.svg" alt="" width="32" height="32" />
  <span class="insignia__texto">
    <span class="insignia__eyebrow">{eyebrow || $_('app.pwa.badge_eyebrow')}</span>
    <span class="insignia__nombre">{$_('app.pwa.badge_action')}</span>
  </span>
</button>

<style lang="scss">
  /* Colores fijos y no los de la paleta: es una insignia, y una insignia que
     cambia de color con el tema deja de reconocerse como tal. El contraste
     está comprobado contra su propio fondo, no contra la página. */
  .insignia {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 3.1rem;
    padding: 0.4rem 1.1rem 0.4rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 0.6rem;
    background: #1d3040;
    color: #f2f4f7;
    font-family: inherit;
    cursor: pointer;
    transition: var(--transition);

    &:hover:not(:disabled) {
      background: #24394c;
      border-color: rgba(255, 255, 255, 0.38);
    }

    // Deshabilitada cuando el navegador no ofrece instalar: o ya está
    // instalada, o es un navegador que no lo permite. Apagada y no escondida,
    // para que el pie no cambie de forma según el navegador.
    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  .insignia__icono {
    flex: 0 0 auto;
    border-radius: 0.35rem;
  }

  .insignia__texto {
    display: grid;
    gap: 0.05rem;
    text-align: left;
  }

  .insignia__eyebrow {
    color: #aeb6c2;
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    line-height: 1.2;
  }

  .insignia__nombre {
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.15;
  }
</style>
