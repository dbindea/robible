<script>
  /**
   * Modo Proyección (`/proiectie`) — fase 1.
   *
   * Para qué: poner versículos en la pantalla grande de la iglesia. Se lee a
   * diez o quince metros, de pie y con la luz de sala encendida, así que las
   * decisiones no son las de la aplicación normal:
   *
   * - **Un versículo por pantalla**, tan grande como quepa. Una lista de
   *   versículos a tamaño de lectura no se ve desde la cuarta fila.
   * - **Capa propia a pantalla completa** (`fixed inset:0; z-index:200`), como
   *   el Modo Amvon y por el mismo motivo: el modo inmersivo esconde el cromo
   *   pero deja debajo swipe, iconos y player, y cualquiera de esos apareciendo
   *   delante de la congregación es justo lo que no puede pasar.
   * - **Colores propios, no los de la paleta activa.** Es la única pantalla del
   *   proyecto que no sigue el tema del usuario, y es deliberado: la sala
   *   necesita fondo oscuro y texto claro tenga el operador puesto Sepia o
   *   Lumină. Como fija su fondo, fija también su color de texto — es la regla
   *   que ya obligó a existir a `--color-on-sidebar`.
   * - **Nada aparece solo aquí.** Ni el diálogo del versículo del día, ni el
   *   aviso de actualización de la PWA: los dos viven en App.svelte y no se
   *   montan sobre esta capa, que además va por encima de todo menos del Amvon.
   *
   * Control por teclado, porque el equipo que proyecta se maneja con un mando
   * de presentación, y esos mandos mandan exactamente las teclas de abajo.
   *
   * Lo que NO hace todavía (fases siguientes): segundo idioma en paralelo,
   * ventana de operador separada por `BroadcastChannel`, y proyectar
   * predicaciones. Esta pantalla está construida alrededor de una lista de
   * versículos (`pasajes`), así que añadir una segunda columna de texto es
   * meter otro campo en esa lista, no rehacerla.
   */
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { searchReferences, parseReference } from '../../services/referenceSearch.service';
  import { keepScreenAwake } from '../../services/sermon-pulpit.service';
  import { getLastRead } from '../../services/reading-progress.service';
  import Icon from '../../components/Icon.svelte';

  export let bible = [];
  export let map = {};

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  // `noindex` y sin traducir por idioma: es una herramienta del dispositivo, no
  // contenido que se comparta. Una sola URL para las cuatro versiones.
  $: applySeoMetadata({
    title: $_('app.projection.seo_title'),
    description: $_('app.projection.seo_description'),
    canonicalPath: '/proiectie',
    versionConfig,
    robots: 'noindex, nofollow',
  });

  // ── Estado ────────────────────────────────────────────────────────────────
  let proyectando = false;
  let pasajes = [];        // [{ book, chapter, verse, texto, referencia }]
  let indice = 0;
  let enNegro = false;
  let consulta = '';
  let sugerencias = [];
  let escala = 1;          // multiplicador del tamaño de letra
  let controlesVisibles = true;
  let ocultarControlesTimer;
  let soltarPantalla = null;

  $: actual = pasajes[indice] || null;
  // Se compara contra las variables directamente y no a través de un helper:
  // envuelto en una función, el compilador no ve la dependencia y la pantalla
  // deja de repintarse al cambiar de versículo (trampa 23).
  $: hayAnterior = indice > 0;
  $: haySiguiente = indice < pasajes.length - 1;

  // ── Preparación: elegir qué proyectar ─────────────────────────────────────
  //
  // Se reutiliza el buscador de referencias de la aplicación en vez de montar
  // un selector de libro y capítulo: en el atril se escribe «ioan 3» y ya está,
  // y ese buscador ya entiende abreviaturas desde dos letras.
  const buscar = () => {
    sugerencias = consulta.trim().length >= 2 ? searchReferences(consulta, map, 6) : [];
  };

  /** Convierte un capítulo entero en la lista de versículos a proyectar. */
  const construirPasajes = (book, chapter, desdeVerso = 1) => {
    const versos = bible?.[book]?.[chapter - 1] || [];
    const nombre = map[book] || '';
    return versos
      .map((texto, i) => ({
        book,
        chapter,
        verse: i + 1,
        texto: String(texto || '').trim(),
        referencia: `${nombre} ${chapter}:${i + 1}`,
      }))
      .filter((v) => v.texto)
      .slice(desdeVerso - 1);
  };

  const empezarDesde = (book, chapter, verse) => {
    const lista = construirPasajes(book, chapter, 1);
    if (!lista.length) return;
    pasajes = lista;
    indice = Number.isInteger(verse) && verse > 1 ? Math.min(verse - 1, lista.length - 1) : 0;
    proyectando = true;
    enNegro = false;
    mostrarControles();
  };

  const empezarDesdeSugerencia = (s) => {
    empezarDesde(s.book, s.chapter, s.verse);
  };

  const empezarDesdeConsulta = () => {
    const encontrado = parseReference(consulta, map) || sugerencias[0];
    if (encontrado) empezarDesdeSugerencia(encontrado);
  };

  // Atajo: seguir por donde se iba leyendo. Es lo que se quiere el 90 % de las
  // veces —se prepara el pasaje en el móvil y se proyecta el mismo—, y ahorra
  // teclear delante de la gente.
  let ultimaLectura = null;
  $: etiquetaUltima =
    ultimaLectura && map[ultimaLectura.book]
      // El `+ 1` convierte el índice de capítulo (base 0, como lo guarda la
      // lectura) al número que se enseña. NO es «el capítulo siguiente».
      ? `${map[ultimaLectura.book]} ${ultimaLectura.chapter + 1}`
      : '';

  // ── Navegación ────────────────────────────────────────────────────────────
  const siguiente = () => { if (haySiguiente) indice += 1; };
  const anterior = () => { if (hayAnterior) indice -= 1; };
  const alternarNegro = () => { enNegro = !enNegro; };
  const masGrande = () => { escala = Math.min(escala + 0.1, 2); };
  const masPequeno = () => { escala = Math.max(escala - 0.1, 0.5); };

  const salir = () => {
    proyectando = false;
    enNegro = false;
    pasajes = [];
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };

  const alternarPantallaCompleta = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Sin pantalla completa se proyecta igual: la capa ya ocupa todo el
      // viewport. En un navegador de televisor a veces no está permitido.
    }
  };

  /**
   * Teclas. Son las que mandan los mandos de presentación: el botón de avanzar
   * emite Flecha derecha o AvPág, y el de retroceder Flecha izquierda o RePág.
   * Por eso hay varias teclas para lo mismo — no es indecisión.
   */
  const alPulsarTecla = (e) => {
    if (!proyectando) return;
    // Si se está escribiendo en un campo, las teclas son texto y no atajos.
    //
    // No es teórico: el Enter que arranca la proyección desde el buscador
    // seguía burbujeando hasta aquí, y como para entonces `proyectando` ya era
    // `true`, avanzaba un versículo en el mismo gesto. Se empezaba siempre en
    // el segundo versículo del capítulo sin que nada lo explicara.
    const donde = e.target?.tagName;
    if (donde === 'INPUT' || donde === 'TEXTAREA' || e.target?.isContentEditable) return;

    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
        e.preventDefault(); siguiente(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); anterior(); break;
      case 'Home': e.preventDefault(); indice = 0; break;
      case 'End': e.preventDefault(); indice = pasajes.length - 1; break;
      case 'n': case 'N': case 'b': case 'B': case '.':
        e.preventDefault(); alternarNegro(); break;
      case 'f': case 'F': e.preventDefault(); alternarPantallaCompleta(); break;
      case '+': case '=': e.preventDefault(); masGrande(); break;
      case '-': case '_': e.preventDefault(); masPequeno(); break;
      case 'Escape': e.preventDefault(); salir(); break;
      default: break;
    }
  };

  // Los controles se esconden solos: un botón flotante en la esquina se ve
  // desde la última fila y estropea la proyección. Vuelven al mover el ratón.
  const mostrarControles = () => {
    controlesVisibles = true;
    clearTimeout(ocultarControlesTimer);
    ocultarControlesTimer = setTimeout(() => { controlesVisibles = false; }, 2600);
  };

  // ── Ciclo de vida ─────────────────────────────────────────────────────────
  //
  // El bloqueo de pantalla se pide al EMPEZAR a proyectar y no al entrar: en la
  // antesala no hace falta, y pedirlo sin necesidad gasta batería del portátil.
  $: if (proyectando && !soltarPantalla) {
    const bloqueo = keepScreenAwake();
    soltarPantalla = bloqueo.release;
  } else if (!proyectando && soltarPantalla) {
    soltarPantalla();
    soltarPantalla = null;
  }

  // Y se bloquea el scroll del documento. La capa es `fixed inset:0`, pero la
  // página que hay debajo sigue siendo alta, así que el navegador pintaba su
  // barra de desplazamiento **encima de la proyección**: una franja gris a la
  // derecha de la pantalla de la iglesia. Se reutiliza la clase que ya usa
  // `Modal.svelte` en vez de escribir otro `overflow: hidden`.
  let scrollBloqueado = false;
  $: if (typeof document !== 'undefined') {
    if (proyectando && !scrollBloqueado) {
      document.body.classList.add('drawer-open');
      scrollBloqueado = true;
    } else if (!proyectando && scrollBloqueado) {
      document.body.classList.remove('drawer-open');
      scrollBloqueado = false;
    }
  }

  onMount(() => {
    ultimaLectura = getLastRead();
    window.addEventListener('keydown', alPulsarTecla);
    return () => window.removeEventListener('keydown', alPulsarTecla);
  });

  onDestroy(() => {
    clearTimeout(ocultarControlesTimer);
    if (soltarPantalla) soltarPantalla();
    // Sin esto, salir de la proyección navegando (no con Escape) dejaría el
    // resto de la aplicación sin poder hacer scroll.
    if (typeof document !== 'undefined') document.body.classList.remove('drawer-open');
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  });
</script>

{#if !proyectando}
  <!-- ── Antesala: qué se va a proyectar ──────────────────────────────── -->
  <section class="antesala">
    <header class="antesala__cabecera">
      <p class="antesala__eyebrow">{$_('app.projection.eyebrow')}</p>
      <h1>{$_('app.projection.title')}</h1>
      <p class="antesala__lead">{$_('app.projection.lead')}</p>
    </header>

    <div class="antesala__buscador">
      <label class="antesala__campo">
        <span>{$_('app.projection.search_label')}</span>
        <input
          type="search"
          bind:value={consulta}
          on:input={buscar}
          on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); empezarDesdeConsulta(); } }}
          placeholder={$_('app.projection.search_placeholder')}
          autocomplete="off"
          spellcheck="false"
        />
      </label>

      {#if sugerencias.length}
        <ul class="sugerencias">
          {#each sugerencias as s (`${s.book}-${s.chapter}-${s.verse || 0}`)}
            <li>
              <button type="button" on:click={() => empezarDesdeSugerencia(s)}>
                {map[s.book]} {s.chapter}{s.verse ? `:${s.verse}` : ''}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if etiquetaUltima}
      <button
        type="button"
        class="antesala__continuar"
        on:click={() => empezarDesde(ultimaLectura.book, ultimaLectura.chapter + 1)}
      >
        <Icon name="book-open" />
        {$_('app.projection.continue', { reference: etiquetaUltima })}
      </button>
    {/if}

    <!-- Las teclas se enseñan ANTES de empezar, no durante: en mitad del culto
         no hay dónde mirarlas, y quien proyecta las repasa mientras prepara. -->
    <div class="atajos">
      <h2>{$_('app.projection.keys_title')}</h2>
      <ul>
        <li><kbd>→</kbd> <kbd>Space</kbd> <span>{$_('app.projection.key_next')}</span></li>
        <li><kbd>←</kbd> <span>{$_('app.projection.key_prev')}</span></li>
        <li><kbd>N</kbd> <span>{$_('app.projection.key_black')}</span></li>
        <li><kbd>F</kbd> <span>{$_('app.projection.key_fullscreen')}</span></li>
        <li><kbd>+</kbd> <kbd>−</kbd> <span>{$_('app.projection.key_size')}</span></li>
        <li><kbd>Esc</kbd> <span>{$_('app.projection.key_exit')}</span></li>
      </ul>
    </div>
  </section>
{:else}
  <!-- ── Proyectando ──────────────────────────────────────────────────── -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="proyeccion"
    class:proyeccion--negro={enNegro}
    style="--escala: {escala}"
    on:mousemove={mostrarControles}
    on:touchstart={mostrarControles}
  >
    {#if !enNegro && actual}
      <figure class="lamina">
        <blockquote class="lamina__texto">{actual.texto}</blockquote>
        <figcaption class="lamina__ref">
          {actual.referencia}
          <span class="lamina__version">{versionConfig?.bibleName || ''}</span>
        </figcaption>
      </figure>
    {/if}

    <!-- Zonas de toque para avanzar sin teclado: la mitad derecha avanza, la
         izquierda retrocede. Invisibles a propósito — es una pantalla, no una
         interfaz. -->
    <button
      type="button"
      class="zona zona--anterior"
      aria-label={$_('app.projection.key_prev')}
      on:click={anterior}
    ></button>
    <button
      type="button"
      class="zona zona--siguiente"
      aria-label={$_('app.projection.key_next')}
      on:click={siguiente}
    ></button>

    <div class="controles" class:controles--ocultos={!controlesVisibles}>
      <button type="button" on:click={salir} title={$_('app.projection.key_exit')} aria-label={$_('app.projection.key_exit')}>
        <Icon name="close" />
      </button>
      <button type="button" on:click={masPequeno} aria-label={$_('app.projection.key_size')}>
        <Icon name="minus" />
      </button>
      <button type="button" on:click={masGrande} aria-label={$_('app.projection.key_size')}>
        <Icon name="plus" />
      </button>
      <button type="button" on:click={alternarNegro} title={$_('app.projection.key_black')} aria-label={$_('app.projection.key_black')}>
        <Icon name="eye" />
      </button>
      <button type="button" on:click={alternarPantallaCompleta} title={$_('app.projection.key_fullscreen')} aria-label={$_('app.projection.key_fullscreen')}>
        <Icon name="expand" />
      </button>
      <span class="controles__posicion">{indice + 1} / {pasajes.length}</span>
    </div>
  </div>
{/if}

<style lang="scss">
  // ── Antesala ──────────────────────────────────────────────────────────────
  // Esta parte SÍ usa la paleta del usuario: se mira en el portátil, antes de
  // empezar. La que no la usa es la proyección.
  .antesala {
    width: 100%;
    max-width: 44rem;
    margin: 0 auto;
    padding: 0 0 4rem;
  }

  .antesala__cabecera {
    margin-bottom: 1.5rem;

    h1 { margin: 0.2rem 0 0.5rem; }
  }

  .antesala__eyebrow {
    margin: 0;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .antesala__lead {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  .antesala__buscador { margin-bottom: 1rem; }

  .antesala__campo {
    display: grid;
    gap: 0.35rem;
    font-size: var(--font-size-small);

    span { font-weight: 600; color: var(--color-ink); }

    input {
      min-height: 2.8rem;
      padding: 0.55rem 0.8rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-field);
      color: var(--color-ink);
      font: inherit;
      font-size: 1.05rem;
    }
  }

  .sugerencias {
    display: grid;
    gap: 0.35rem;
    margin: 0.6rem 0 0;
    padding: 0;
    list-style: none;

    button {
      width: 100%;
      min-height: 2.6rem;
      padding: 0.5rem 0.85rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;

      &:hover { border-color: var(--color-accent); color: var(--color-accent-ink); }
    }
  }

  .antesala__continuar {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.6rem;
    margin-bottom: 1.5rem;
    padding: 0.55rem 1.15rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    // Relleno de acento porque lleva texto encima: `--color-accent` a secas da
    // 3.30:1 y AA pide 4.5:1.
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    --icon-size: 1rem;

    &:hover { background: var(--color-accent-solid-hover); }
  }

  .atajos {
    padding: 1rem 1.15rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);

    h2 { margin: 0 0 0.6rem; font-size: 0.95rem; color: var(--color-ink-strong); }

    ul {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 0.45rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--color-ink-soft);
      font-size: var(--font-size-small);
    }

    kbd {
      min-width: 1.6rem;
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--color-line-strong);
      border-bottom-width: 2px;
      border-radius: 0.3rem;
      background: var(--color-surface-raised);
      color: var(--color-ink);
      font-family: monospace;
      font-size: 0.78rem;
      text-align: center;
    }
  }

  // ── Proyección ────────────────────────────────────────────────────────────
  //
  // Capa fija a pantalla completa, como el Modo Amvon: es lo que impide que se
  // cuele la cabecera, el menú o un botón flotante de otra parte.
  //
  // Los colores son PROPIOS y no salen de la paleta activa. Única excepción del
  // proyecto y deliberada: una pantalla de sala necesita fondo casi negro y
  // texto casi blanco tenga el operador puesto Sepia, Lumină o Nocturn. Y como
  // fija su fondo, fija también su color de texto — si no, heredaría la tinta
  // del body, que en las paletas claras es oscura, y saldría negro sobre negro.
  //
  // No es negro puro (#000) ni blanco puro (#fff) a propósito: en un proyector
  // el contraste máximo produce halo alrededor de las letras y cansa la vista
  // en un culto de una hora.
  .proyeccion {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: clamp(1.5rem, 5vw, 4rem);
    background: #0b0d10;
    color: #f2f4f7;
    cursor: default;
  }

  .proyeccion--negro { background: #000; }

  .lamina {
    max-width: 90vw;
    margin: 0;
    text-align: center;
  }

  // El tamaño se calcula con `vw` y `vh` a la vez: sólo con `vw`, un televisor
  // panorámico daba letras enormes que no cabían a lo alto, y sólo con `vh`
  // quedaban pequeñas en una pantalla ancha. `--escala` es el ajuste manual.
  .lamina__texto {
    margin: 0 0 clamp(1rem, 3vh, 2.5rem);
    font-size: calc(clamp(1.75rem, 4.2vw + 1.2vh, 5.5rem) * var(--escala, 1));
    font-weight: 600;
    line-height: 1.3;
    text-wrap: balance;
  }

  .lamina__ref {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 0.6rem;
    font-size: calc(clamp(1rem, 1.4vw + 0.6vh, 2rem) * var(--escala, 1));
    font-weight: 700;
    // Ámbar tenue: distingue la referencia del texto sin competir con él.
    color: #f0c674;
  }

  .lamina__version {
    color: #98a2b3;
    font-size: 0.72em;
    font-weight: 600;
  }

  // Mitades invisibles para avanzar con el ratón o el dedo. Van por debajo de
  // los controles, que necesitan recibir sus propios clics.
  .zona {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .zona--anterior { left: 0; }
  .zona--siguiente { right: 0; }

  .controles {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-pill);
    background: rgba(20, 24, 30, 0.86);
    transition: opacity var(--motion-base, 200ms) ease;

    button {
      display: inline-grid;
      place-items: center;
      // 2.25rem = 36px: por encima del mínimo de 24 px de objetivo táctil
      // (WCAG 2.5.8) y cómodo de acertar con prisa.
      width: 2.25rem;
      height: 2.25rem;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: #f2f4f7;
      cursor: pointer;
      --icon-size: 1.05rem;

      &:hover { background: rgba(255, 255, 255, 0.12); }
    }
  }

  .controles--ocultos {
    opacity: 0;
    // Sin esto seguirían recibiendo clics invisibles justo donde el operador
    // toca para avanzar.
    pointer-events: none;
  }

  .controles__posicion {
    padding: 0 0.35rem;
    color: #98a2b3;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .controles { transition: none; }
  }
</style>
