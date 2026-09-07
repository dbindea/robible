<script>
  import { onDestroy, onMount } from 'svelte';
  import packageInfo from '../../../package.json';
  import { _ } from '../../services/i18n.service';
  import { themeMode, setThemeMode, PALETTES } from '../../store/stores';
  import { getPalette } from '../../config/palettes';
  import Modal from '../../components/Modal.svelte';
  import { isAuthenticated, currentUser, logout } from '../../store/authStore';
  import { openAuthMenu } from '../../store/authMenuStore';

  let isAboutOpen = false;
  const appVersion = packageInfo.version;
  let swVersion = '—';

  let isPaletteOpen = false;
  $: paletaActiva = getPalette($themeMode);

  // Botón auth del footer: muestra nickname o "Login" según estado
  const handleAuthClick = () => {
    if ($isAuthenticated) {
      logout();
    } else {
      openAuthMenu();
    }
  };

  // Lee la versión del SW desde /sw.js (línea CACHE_NAME = 'robible-vXX')
  const fetchSwVersion = async () => {
    try {
      const response = await fetch('/sw.js', { cache: 'no-store' });
      if (!response.ok) return;
      const text = await response.text();
      const match = text.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
      if (match) swVersion = match[1];
    } catch {
      // Si falla, dejamos el placeholder
    }
  };

  const closeAbout = () => {
    isAboutOpen = false;
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      closeAbout();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    fetchSwVersion();
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="footer">
  <div class="footer__content">
    <p class="footer__meta">
      <span>{$_('app.footer.made_with_love')}</span>
      <span class="only-desktop">·</span>
      <strong>{$_('app.footer.maranata')}</strong>
    </p>
  </div>

  <div class="footer__actions">
    <button
      type="button"
      class="footer__auth"
      class:footer__auth--signed={$isAuthenticated}
      on:click={handleAuthClick}
      title={$isAuthenticated ? $_('auth.logout') : $_('app.app_menu.items.auth.label')}
    >
      {#if $isAuthenticated}
        <span class="online-dot online-dot--inline" aria-hidden="true"></span>
        {$currentUser?.nickname}
        <span class="footer__auth-action">· {$_('auth.logout')}</span>
      {:else}
        {$_('app.app_menu.items.auth.label')}
      {/if}
    </button>
    <button type="button" class="footer__about" on:click={() => (isAboutOpen = true)}>
      {$_('app.footer.about_action')}
      <span>v{appVersion} · {swVersion}</span>
    </button>
    <button
      type="button"
      class="theme-toggle"
      aria-label={$_('app.palette.open')}
      title={$_('app.palette.open')}
      on:click={() => (isPaletteOpen = true)}
    >
      <!-- Fondo, acento y tinta, no fondo/superficie/acento: en las paletas
           claras el fondo y la superficie son dos blancos casi iguales, y el
           botón acababa pareciendo la media luna del interruptor que sustituye. -->
      <span class="theme-toggle__swatch" aria-hidden="true">
        {#each ['page', 'accent', 'ink'] as capa (capa)}
          <span style="background: {paletaActiva.swatch[capa]}"></span>
        {/each}
      </span>
    </button>
  </div>
</div>

<Modal open={isPaletteOpen} title={$_('app.palette.title')} eyebrow={$_('app.palette.eyebrow')} size="sm" fitContent onClose={() => (isPaletteOpen = false)}>
  <ul class="palette-list">
    {#each PALETTES as paleta (paleta.id)}
      <li>
        <button
          type="button"
          class="palette-option"
          class:palette-option--active={$themeMode === paleta.id}
          aria-pressed={$themeMode === paleta.id}
          on:click={() => setThemeMode(paleta.id)}
        >
          <!-- La muestra usa los colores reales de la paleta, no los de la
               activa: hay que poder compararlas sin aplicarlas una a una. -->
          <span class="palette-option__swatch" style="background: {paleta.swatch.page}; border-color: {paleta.swatch.ink}33" aria-hidden="true">
            <span class="palette-option__card" style="background: {paleta.swatch.surface}">
              <span class="palette-option__line" style="background: {paleta.swatch.ink}"></span>
              <span class="palette-option__line palette-option__line--short" style="background: {paleta.swatch.accent}"></span>
            </span>
          </span>
          <span class="palette-option__text">
            <span class="palette-option__name">{$_(paleta.labelKey)}</span>
            <!-- "Nocturn" no dice nada por sí solo: la pista es lo que permite
                 elegir sin ir probando las cinco. -->
            <span class="palette-option__hint">{$_(`${paleta.labelKey}_hint`)}</span>
          </span>
          {#if $themeMode === paleta.id}
            <span class="palette-option__check" aria-hidden="true">✓</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</Modal>

{#if isAboutOpen}
  <div class="footer-modal" role="presentation" on:click={closeAbout}>
    <div
      class="footer-modal__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="footer-about-title"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <button type="button" class="footer-modal__close" aria-label={$_('app.footer.close_about')} on:click={closeAbout}>
        <span aria-hidden="true"></span>
      </button>
      <p class="footer-modal__eyebrow">RoBible v{appVersion}</p>
      <h2 id="footer-about-title">{$_('app.footer.about_title')}</h2>
      <p>{$_('app.footer.about_text')}</p>
      <a class="footer-modal__repo" href="https://github.com/dbindea/robible" target="_blank" rel="noreferrer">
        dbindea/robible
      </a>
      <dl class="footer-modal__versions">
        <div>
          <dt>{$_('app.footer.version_app')}</dt>
          <dd>v{appVersion}</dd>
        </div>
        <div>
          <dt>{$_('app.footer.version_sw')}</dt>
          <dd>{swVersion}</dd>
        </div>
      </dl>
      <p class="footer-modal__blessing">{$_('app.footer.maranata')}</p>
    </div>
  </div>
{/if}

<style lang="scss">
  .footer {
    min-height: 5.25rem;
    box-shadow: var(--box-shadow-up);
    align-items: center;
    gap: 1.25rem;
    // El relleno inferior reserva la franja de los botones flotantes (ver
    // `--floating-band` en global.css). Sin él, al llegar al final de la página
    // «Subir» y «pantalla completa» caían justo encima de «Autentificare» y del
    // selector de paleta, y no había forma de pulsarlos.
    padding: 1rem clamp(1rem, 5vw, 5rem) calc(1rem + var(--floating-band) + var(--player-offset, 0px));
    display: flex;
    color: var(--color-bg-dark);
    justify-content: space-between;
    background-color: var(--color-white);
    border-top: 1px solid color-mix(in srgb, var(--color-bg-dark) 10%, transparent);
  }

  .footer__content {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }

  .footer__meta {
    margin: 0;
  }

  .footer__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    color: var(--color-ink-soft);
    font-size: 0.82rem;
  }

  .footer__actions {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex: 0 0 auto;
  }

  .footer__about {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.35rem;
    border: 1px solid color-mix(in srgb, var(--color-accent) 28%, transparent);
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--color-blue) 9%, var(--color-white));
    color: var(--color-bg-dark);
    padding: 0 0.75rem;
    transition: var(--transition);
    font-size: 0.78rem;
    font-weight: 600;

    span {
      color: var(--color-ink-soft);
      font-size: 0.78rem;
      font-weight: 600;
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 15%, var(--color-white));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent);
    }
  }

  .footer__auth {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.35rem;
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 14%, transparent);
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);
    padding: 0 0.75rem;
    transition: var(--transition);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;

    .footer__auth-action {
      color: var(--color-ink-soft);
      font-weight: 500;
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent);
    }

    &--signed {
      border-color: #28a74566;
      background: #28a7451a;
      color: var(--color-success-ink);

      &:hover,
      &:focus-visible {
        border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
        background: var(--color-danger-wash);
        color: var(--color-danger-ink);
        box-shadow: 0 0 0 3px var(--color-danger-wash);
      }
    }
  }

  // .online-dot (clase global) — sin estilos locales

  .theme-toggle {
    display: grid;
    place-items: center;
    width: 2.35rem;
    height: 2.35rem;
    flex: 0 0 auto;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent);
    }
  }

  // Tres franjas con los colores reales de la paleta activa: el botón dice de
  // un vistazo cuál está puesta, que es lo que un icono de sol/luna no podría
  // hacer con cinco opciones.
  .theme-toggle__swatch {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 999px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px var(--color-line-strong);

    span {
      display: block;
      transition: background var(--motion-base) ease;
    }
  }

  // === SELECTOR DE PALETA ===
  .palette-list {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .palette-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    text-align: left;
    font-size: 0.9rem;
    font-weight: 600;
    transition: border-color var(--motion-base) ease, background var(--motion-base) ease,
      transform var(--motion-fast) var(--ease-out);

    &:hover,
    &:focus-visible {
      border-color: var(--color-accent);
      background: var(--wash-accent);
    }

    // Un desplazamiento de 1px al pulsar: suficiente para que el dedo note que
    // el botón responde, y no tanto como para que el texto salte.
    &:active {
      transform: translateY(1px);
    }

    &--active {
      border-color: var(--color-accent);
      background: var(--wash-accent);
    }
  }

  // Miniatura de la paleta: una página con una tarjeta encima y dos renglones.
  // Es el mínimo que deja ver de golpe fondo, superficie, tinta y acento.
  .palette-option__swatch {
    display: grid;
    place-items: center;
    width: 2.6rem;
    height: 2rem;
    flex: 0 0 auto;
    border: 1px solid;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .palette-option__card {
    display: grid;
    align-content: center;
    gap: 0.22rem;
    width: 1.75rem;
    height: 1.25rem;
    padding: 0 0.2rem;
    border-radius: 0.15rem;
    // Sin borde, la tarjeta se funde con la página en las paletas donde ambas
    // son casi del mismo tono (Sepia y Cald), y las dos muestras se veían
    // iguales. La línea las separa aunque los colores estén a un paso.
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 8%);
  }

  .palette-option__line {
    height: 0.16rem;
    border-radius: 999px;
    opacity: 0.8;

    // El acento es lo que de verdad distingue una paleta de otra —teja contra
    // cobre, azul contra cian—, así que va más grueso que la línea de tinta.
    &--short {
      width: 68%;
      height: 0.26rem;
      opacity: 1;
    }
  }

  .palette-option__text {
    display: grid;
    gap: 0.1rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .palette-option__hint {
    color: var(--color-ink-soft);
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1.35;
  }

  .palette-option__check {
    color: var(--color-accent);
    font-weight: 700;
  }

  .footer-modal {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: var(--color-scrim);
  }

  .footer-modal__panel {
    position: relative;
    display: grid;
    gap: 0.75rem;
    width: min(30rem, 100%);
    padding: 1.25rem;
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 14%, transparent);
    border-radius: 0.45rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);
    color: var(--color-bg-dark);

    h2,
    p {
      margin: 0;
    }

    h2 {
      padding-right: 2rem;
      font-size: clamp(1.25rem, 3vw, 1.55rem);
      line-height: 1.2;
    }
  }

  .footer-modal__eyebrow {
    color: var(--color-blue);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .footer-modal__repo {
    justify-self: start;
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
    padding: 0.45rem 0.65rem;
    font-weight: 700;
  }

  .footer-modal__blessing {
    color: color-mix(in srgb, var(--color-bg-dark) 76%, var(--color-white));
    font-weight: 700;
  }

  .footer-modal__versions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
    margin: 0;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem;
    background: color-mix(in srgb, var(--color-bg-dark) 4%, var(--color-white));
    list-style: none;

    div {
      display: grid;
      gap: 0.1rem;
      min-width: 0;
    }

    dt {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--color-ink-soft);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    dd {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--color-blue);
      font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    }
  }

  .footer-modal__close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);

    span,
    span::after {
      width: 0.9rem;
      height: 2px;
      border-radius: 999px;
      background: currentcolor;
    }

    span {
      transform: rotate(45deg);

      &::after {
        content: '';
        display: block;
        transform: rotate(90deg);
      }
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
    }
  }

  // Dark mode auth button

  @media (max-width: 32rem) {
    .footer {
      align-items: stretch;
      flex-direction: column;
      font-size: 14px;
    }

    .footer__actions {
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .only-desktop {
      display: none;
    }
  }
</style>
