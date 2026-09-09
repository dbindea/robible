<script>
  /**
   * Perfil del usuario (`/profil`).
   *
   * Reúne lo que hasta ahora estaba repartido o directamente no se podía
   * alcanzar: el versículo del día aunque ya lo hayas cerrado, por dónde ibas
   * leyendo, lo que llevas guardado y el tipo de cuenta.
   *
   * **Va con `noindex`.** Es una página privada: no hay nada que indexar y
   * anunciarla al buscador sólo produciría resultados vacíos para quien no ha
   * iniciado sesión. El trabajo de posicionamiento vive en `/predici`, `/teme`
   * y la landing, que sí son públicas.
   */
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { isAuthenticated, currentUser } from '../../store/authStore';
  import { openAuthMenu } from '../../store/authMenuStore';
  import { updateProfile } from '../../services/auth.service';
  import { getTodayVerse, isEnabled, setEnabled } from '../../services/daily-verse.service';
  import { getLastRead } from '../../services/reading-progress.service';
  import * as pushService from '../../services/push.service';
  import { buildBiblePath } from '../../services/bible-route.service';
  import { favoritesStore } from '../../store/favoritesStore';
  import { notesStore } from '../../store/notesStore';
  import { topicsStore } from '../../store/topicsStore';
  import { highlightsStore } from '../../store/highlightsStore';
  import { memorizeStore } from '../../store/memorizeStore';
  import { sermonsStore } from '../../store/sermonsStore';
  import Icon from '../../components/Icon.svelte';

  export let bible = [];
  export let map = {};

  let versetulZilei = null;      // { book, chapter, verse }
  let ultimaLectura = null;
  let avisoDiario = true;
  let cambiandoTipo = false;
  let aviso = '';
  let avisoTimer;

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  $: applySeoMetadata({
    title: $_('app.profile.seo_title'),
    description: $_('app.profile.seo_description'),
    canonicalPath: '/profil',
    versionConfig,
    robots: 'noindex, follow',
  });

  const mostrar = (texto) => {
    aviso = texto;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { aviso = ''; }, 2600);
  };

  // ── Versículo del día ───────────────────────────────────────────────────
  $: textoVersetul =
    versetulZilei && bible?.[versetulZilei.book]
      ? bible[versetulZilei.book][versetulZilei.chapter - 1]?.[versetulZilei.verse - 1] || ''
      : '';
  $: referinta = versetulZilei
    ? `${map[versetulZilei.book] || ''} ${versetulZilei.chapter}:${versetulZilei.verse}`.trim()
    : '';
  $: rutaVersetul = versetulZilei
    ? buildBiblePath({
        version: versionConfig?.value,
        map,
        book: versetulZilei.book,
        chapter: versetulZilei.chapter,
        verse: versetulZilei.verse,
      })
    : '';

  const alternarAviso = () => {
    avisoDiario = !avisoDiario;
    setEnabled(avisoDiario);
    mostrar($_(avisoDiario ? 'app.profile.daily_on' : 'app.profile.daily_off'));
  };

  // Se compara contra `$memorizeStore` escrito tal cual y no con un helper:
  // envuelto en una función, el compilador no ve la dependencia y el botón se
  // queda con la etiqueta vieja al pulsarlo (trampa 23).
  $: memorizandoElDelDia =
    !!versetulZilei &&
    $memorizeStore.some(
      (m) =>
        m.book === versetulZilei.book && m.chapter === versetulZilei.chapter && m.verse === versetulZilei.verse,
    );

  const alternarMemorizar = async () => {
    if (!versetulZilei) return;
    const { book, chapter, verse } = versetulZilei;
    // Se anota ANTES de llamar: tras el `await`, el bloque reactivo puede haberse
    // recalculado o no —depende del momento del flush— y leer la variable ahí
    // daría el mensaje contrario la mitad de las veces.
    const estaba = memorizandoElDelDia;
    const res = await memorizeStore.toggle(book, chapter, verse);
    if (!res.ok) {
      mostrar($_(res.error));
      return;
    }
    mostrar($_(estaba ? 'app.memorize.removed' : 'app.memorize.added'));
  };

  // ── Continuar leyendo ───────────────────────────────────────────────────
  //
  // OJO con el `+ 1`: es la conversión del índice de capítulo (base 0, como lo
  // guarda la lectura) al número que se enseña y que va en la URL. NO es «el
  // capítulo siguiente» — «continuar» significa volver a donde estabas, no
  // saltarte lo que quizá dejaste a medias.
  $: rutaContinuar =
    ultimaLectura && map[ultimaLectura.book]
      ? buildBiblePath({
          version: ultimaLectura.version || versionConfig?.value,
          map,
          book: ultimaLectura.book,
          chapter: ultimaLectura.chapter + 1,
        })
      : '';
  $: etiquetaContinuar =
    ultimaLectura && map[ultimaLectura.book]
      ? `${map[ultimaLectura.book]} ${ultimaLectura.chapter + 1}`
      : '';

  // ── Actividad ───────────────────────────────────────────────────────────
  $: esPredicator = $currentUser?.userType === 'preacher';
  $: actividad = [
    { clave: 'favorites', icono: 'star', n: ($favoritesStore || []).length, href: '/favorites' },
    { clave: 'notes', icono: 'note', n: ($notesStore || []).length, href: '/notes' },
    // `topicsStore` no es una lista: guarda `{ topics, verseRefs }`. Contarlo
    // como array daba `undefined` y la tarjeta salía sin número.
    { clave: 'topics', icono: 'bookmark', n: ($topicsStore?.topics || []).length, href: '/indice' },
    { clave: 'highlights', icono: 'highlight', n: ($highlightsStore || []).length, href: '/favorites' },
    { clave: 'memorize', icono: 'brain', n: ($memorizeStore || []).length, href: '/memorare' },
    ...(esPredicator
      ? [{ clave: 'sermons', icono: 'lectern', n: ($sermonsStore || []).length, href: '/predicile-mele' }]
      : []),
  ];

  // ── Aviso diario por notificación ───────────────────────────────────────
  //
  // El permiso se pide desde el clic y no al entrar: pedirlo de entrada es lo
  // que hace que la gente lo deniegue para siempre, y una vez denegado el
  // navegador ya no deja volver a preguntar desde el código.
  const HORAS = Array.from({ length: 24 }, (_, i) => i);

  let pushSoportado = false;
  let pushActivo = false;
  let pushDenegado = false;
  let pushHora = pushService.HORA_POR_DEFECTO;
  let cambiandoPush = false;

  const alternarPush = async () => {
    cambiandoPush = true;
    try {
      const res = pushActivo
        ? await pushService.desactivar()
        : await pushService.activar({
            horaLocal: pushHora,
            version: versionConfig?.value,
            locale: versionConfig?.locale,
          });

      if (!res.ok) {
        mostrar($_(res.error));
        // El permiso puede haber pasado a «denegado» en esta misma llamada.
        pushDenegado = pushService.permiso() === 'denied';
      } else {
        pushActivo = await pushService.estaActivo();
        mostrar($_(pushActivo ? 'app.push.enabled_msg' : 'app.push.disabled_msg'));
      }
    } finally {
      cambiandoPush = false;
    }
  };

  const cambiarHora = async () => {
    pushService.guardarHora(pushHora);
    // Sólo hay que avisar al servidor si ya está suscrito; si no, la hora queda
    // guardada para cuando lo active.
    if (!pushActivo) return;
    await pushService.refrescar({ version: versionConfig?.value, locale: versionConfig?.locale });
    mostrar($_('app.push.hour_saved'));
  };

  // ── Tipo de cuenta ──────────────────────────────────────────────────────
  //
  // Cambiarlo no toca ningún otro dato: una cuenta que vuelve a `user` conserva
  // sus predicaciones y las recupera al volver a `preacher`. Por eso se puede
  // ir y venir sin avisos dramáticos.
  const cambiarTipo = async (tipo) => {
    if (cambiandoTipo || $currentUser?.userType === tipo) return;
    cambiandoTipo = true;
    try {
      // `updateProfile` ya guarda el usuario nuevo en el token store; aquí sólo
      // se refleja en `currentUser`, del que cuelga el menú lateral: el item de
      // predicaciones aparece o desaparece sin recargar.
      const res = await updateProfile({ userType: tipo });
      if (res.ok) {
        currentUser.set(res.user);
        mostrar($_('app.profile.type_changed'));
      } else {
        mostrar($_(res.error || 'app.profile.type_failed'));
      }
    } catch {
      mostrar($_('app.profile.type_failed'));
    } finally {
      cambiandoTipo = false;
    }
  };

  const irA = (href) => {
    if (!href) return;
    window.history.pushState(null, '', href);
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  onMount(async () => {
    avisoDiario = isEnabled();
    ultimaLectura = getLastRead();
    versetulZilei = await getTodayVerse();

    // El soporte se comprueba una sola vez y no en un bloque reactivo: no
    // depende de nada que cambie y preguntarlo en cada repintado no aporta nada.
    pushSoportado = pushService.soportado();
    if (pushSoportado) {
      pushDenegado = pushService.permiso() === 'denied';
      pushHora = pushService.horaElegida();
      pushActivo = await pushService.estaActivo();
      // Reenvía la hora en UTC y el idioma. Es lo que hace que el cambio de
      // horario de verano se corrija solo, sin tocar la base de datos.
      pushService.refrescar({ version: versionConfig?.value, locale: versionConfig?.locale });
    }
  });
</script>

<section class="perfil">
  {#if !$isAuthenticated}
    <div class="perfil__vacio">
      <p class="perfil__vacio-icono" aria-hidden="true">👤</p>
      <p>{$_('app.profile.login_required')}</p>
      <button type="button" class="perfil__cta" on:click={openAuthMenu}>
        {$_('app.topics.login_prompt_action')}
      </button>
    </div>
  {:else}
    <!-- ── Cabecera ──────────────────────────────────────────────────── -->
    <header class="portada">
      <div class="portada__texto">
        <p class="portada__eyebrow">{$_('app.profile.eyebrow')}</p>
        <h1 class="portada__titulo">{$currentUser?.nickname}</h1>
        <p class="portada__lead">
          {esPredicator ? $_('app.profile.lead_preacher') : $_('app.profile.lead_user')}
        </p>
        <p class="portada__insignia" class:portada__insignia--predicator={esPredicator}>
          <Icon name={esPredicator ? 'lectern' : 'user'} size="0.9rem" />
          {$_(esPredicator ? 'auth.user_type_preacher' : 'auth.user_type_user')}
        </p>
      </div>
    </header>

    {#if aviso}
      <p class="perfil__aviso" role="status">{aviso}</p>
    {/if}

    <div class="perfil__rejilla">
      <!-- ── Versículo del día ──────────────────────────────────────── -->
      <article class="tarjeta tarjeta--versetul">
        <h2 class="tarjeta__titulo">
          <span class="tarjeta__icono" aria-hidden="true"><Icon name="sun" /></span>
          {$_('app.profile.daily_title')}
        </h2>

        {#if textoVersetul}
          <blockquote class="versetul__texto">{textoVersetul}</blockquote>
          <p class="versetul__ref">{referinta}</p>
          <div class="tarjeta__acciones">
            <a class="boton boton--primario" href={rutaVersetul} on:click|preventDefault={() => irA(rutaVersetul)}>
              {$_('app.profile.daily_open')}
            </a>
            <button type="button" class="boton" on:click={alternarMemorizar}>
              <Icon name="brain" />
              {$_(memorizandoElDelDia ? 'app.memorize.remove_short' : 'app.memorize.add')}
            </button>
            <button type="button" class="boton" on:click={alternarAviso}>
              {$_(avisoDiario ? 'app.profile.daily_disable' : 'app.profile.daily_enable')}
            </button>
          </div>
          <!-- El motivo de que esta tarjeta exista: el diálogo automático sólo
               sale una vez al día y, si lo cierras o lo desactivas, el
               versículo quedaba fuera de tu alcance. -->
          <p class="tarjeta__pista">{$_('app.profile.daily_hint')}</p>
        {:else}
          <p class="tarjeta__vacio">{$_('app.loading')}</p>
        {/if}
      </article>

      <!-- ── Continuar leyendo ──────────────────────────────────────── -->
      <article class="tarjeta">
        <h2 class="tarjeta__titulo">
          <span class="tarjeta__icono" aria-hidden="true"><Icon name="book-open" /></span>
          {$_('app.profile.continue_title')}
        </h2>

        {#if etiquetaContinuar}
          <p class="continuar__donde">{etiquetaContinuar}</p>
          <div class="tarjeta__acciones">
            <a class="boton boton--primario" href={rutaContinuar} on:click|preventDefault={() => irA(rutaContinuar)}>
              {$_('app.profile.continue_action')}
            </a>
          </div>
        {:else}
          <p class="tarjeta__vacio">{$_('app.profile.continue_empty')}</p>
          <div class="tarjeta__acciones">
            <a class="boton" href="/biblia" on:click|preventDefault={() => irA('/biblia')}>
              {$_('app.profile.continue_start')}
            </a>
          </div>
        {/if}
      </article>

      <!-- ── Aviso diario por notificación ──────────────────────────── -->
      <!-- Sólo se pinta donde el navegador lo soporta. Un interruptor que no
           puede hacer nada —en Safari sin instalar, por ejemplo— es peor que no
           tenerlo: parece un fallo de la aplicación. -->
      {#if pushSoportado}
        <article class="tarjeta">
          <h2 class="tarjeta__titulo">
            <span class="tarjeta__icono" aria-hidden="true"><Icon name="sun" /></span>
            {$_('app.push.title')}
          </h2>

          {#if pushDenegado}
            <p class="tarjeta__vacio">{$_('app.push.blocked')}</p>
          {:else}
            <p class="tarjeta__pista">{$_('app.push.lead')}</p>

            <label class="hora">
              <span>{$_('app.push.at_hour')}</span>
              <select bind:value={pushHora} on:change={cambiarHora} disabled={cambiandoPush}>
                {#each HORAS as h (h)}
                  <option value={h}>{String(h).padStart(2, '0')}:00</option>
                {/each}
              </select>
            </label>

            <div class="tarjeta__acciones">
              <button
                type="button"
                class="boton"
                class:boton--primario={!pushActivo}
                on:click={alternarPush}
                disabled={cambiandoPush}
              >
                {$_(pushActivo ? 'app.push.disable' : 'app.push.enable')}
              </button>
            </div>
          {/if}
        </article>
      {/if}

      <!-- ── Actividad ──────────────────────────────────────────────── -->
      <article class="tarjeta tarjeta--ancha">
        <h2 class="tarjeta__titulo">
          <span class="tarjeta__icono" aria-hidden="true"><Icon name="bookmark" /></span>
          {$_('app.profile.activity_title')}
        </h2>
        <ul class="actividad">
          {#each actividad as a (a.clave)}
            <li>
              <a class="actividad__item" href={a.href} on:click|preventDefault={() => irA(a.href)}>
                <span class="actividad__icono" aria-hidden="true"><Icon name={a.icono} /></span>
                <span class="actividad__n">{a.n}</span>
                <span class="actividad__nombre">{$_(`app.profile.activity_${a.clave}`)}</span>
              </a>
            </li>
          {/each}
        </ul>
      </article>

      <!-- ── Tipo de cuenta ─────────────────────────────────────────── -->
      <article class="tarjeta tarjeta--ancha">
        <h2 class="tarjeta__titulo">
          <span class="tarjeta__icono" aria-hidden="true"><Icon name="users" /></span>
          {$_('app.profile.type_title')}
        </h2>
        <p class="tarjeta__pista">{$_('app.profile.type_hint')}</p>

        <div class="tipos">
          {#each [['user', 'user'], ['preacher', 'lectern']] as [tipo, icono] (tipo)}
            <button
              type="button"
              class="tipo"
              class:tipo--activo={$currentUser?.userType === tipo}
              aria-pressed={$currentUser?.userType === tipo}
              disabled={cambiandoTipo}
              on:click={() => cambiarTipo(tipo)}
            >
              <span class="tipo__icono" aria-hidden="true"><Icon name={icono} /></span>
              <span class="tipo__nombre">{$_(`auth.user_type_${tipo}`)}</span>
              <span class="tipo__pista">{$_(`auth.user_type_${tipo}_hint`)}</span>
            </button>
          {/each}
        </div>
      </article>
    </div>
  {/if}
</section>

<style lang="scss">
  .perfil {
    width: 100%;
    max-width: 62rem;
    margin: 0 auto;
    padding: 0 0 4rem;
  }

  .perfil__vacio {
    padding: 4rem 1rem;
    text-align: center;
    color: var(--color-ink-soft);
  }

  .perfil__vacio-icono {
    margin: 0 0 0.5rem;
    font-size: 2.5rem;
  }

  .hora {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin: 0.75rem 0 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 600;

    select {
      min-height: 2.4rem;
      padding: 0.4rem 0.7rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-field);
      color: var(--color-ink);
      font: inherit;
      cursor: pointer;

      &:disabled { opacity: 0.5; cursor: default; }
    }
  }

  // OJO: `.perfil__cta` comparte estilos con `.boton`. No metas una regla nueva
  // entre las dos líneas del selector — se lleva el grupo y deja al CTA sin
  // estilo de botón. Ya ha pasado.
  .perfil__cta,
  .boton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    // El tamaño del icono se fija aquí, en el contenedor: una regla `.boton svg`
    // no le alcanza, porque el scoping de Svelte le pone al `<svg>` la clase de
    // Icon.svelte (trampa 28).
    gap: 0.4rem;
    --icon-size: 1rem;
    min-height: 2.4rem;
    padding: 0.55rem 1.15rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--font-size-small);
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: var(--transition);

    &:hover { border-color: var(--color-accent); color: var(--color-accent-ink); text-decoration: none; }
  }

  .boton--primario {
    border-color: var(--color-accent);
    // Relleno de acento porque lleva texto encima; `--color-accent` solo da 3:1.
    background: var(--color-accent-solid);
    color: var(--color-on-primary);

    &:hover { background: var(--color-accent-solid-hover); color: var(--color-on-primary); }
  }

  // ── Cabecera ──────────────────────────────────────────────────────────────
  // Misma portada que /predici y /teme: el sitio tiene que reconocerse.
  .portada {
    margin-bottom: clamp(1.25rem, 4vw, 2rem);
    padding: clamp(1.5rem, 5vw, 2.5rem);
    border: 1px solid var(--color-line);
    border-radius: 0.5rem;
    background: var(--color-surface);
    box-shadow: var(--box-shadow-lg);
    animation: portada-entra var(--motion-slow, 260ms) var(--ease-out) both;
  }

  @keyframes portada-entra {
    from { opacity: 0; transform: translateY(0.75rem); }
    to { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .portada { animation: none; }
  }

  .portada__eyebrow {
    margin: 0 0 0.3rem;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .portada__titulo {
    margin: 0 0 0.5rem;
    color: var(--color-ink-strong);
    font-size: clamp(1.9rem, 5vw, 2.6rem);
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .portada__lead {
    margin: 0 0 0.9rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  .portada__insignia {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-pill);
    background: var(--wash-subtle);
    color: var(--color-ink-soft);
    font-size: 0.78rem;
    font-weight: 700;
    --icon-size: 0.9rem;
  }

  .portada__insignia--predicator {
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
  }

  .perfil__aviso {
    margin: 0 0 1rem;
    padding: 0.55rem 0.85rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  // ── Rejilla de tarjetas ───────────────────────────────────────────────────
  .perfil__rejilla {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1rem;
  }

  /* Ocupan la fila entera: la actividad y el tipo de cuenta son listas anchas
     y en media columna quedan apretadas. */
  .tarjeta--ancha { grid-column: 1 / -1; }

  .tarjeta {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: clamp(1.1rem, 3vw, 1.5rem);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .tarjeta--versetul {
    border-color: var(--color-line-accent);
    background: var(--wash-accent);
  }

  .tarjeta__titulo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    color: var(--color-ink-strong);
    font-size: 1.05rem;
    line-height: 1.2;
  }

  .tarjeta__icono {
    display: inline-flex;
    color: var(--color-accent);
    --icon-size: 1.1rem;
  }

  .tarjeta__pista {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .tarjeta__vacio {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
  }

  .tarjeta__acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: auto;
  }

  .versetul__texto {
    margin: 0;
    padding: 0;
    border: 0;
    color: var(--color-ink-strong);
    font-size: 1.05rem;
    font-style: italic;
    line-height: 1.55;
  }

  .versetul__ref {
    margin: 0;
    color: var(--color-accent-ink);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .continuar__donde {
    margin: 0;
    color: var(--color-ink-strong);
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.2;
  }

  // ── Actividad ─────────────────────────────────────────────────────────────
  .actividad {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.6rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .actividad__item {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: 'icono numero' 'icono nombre';
    align-items: center;
    gap: 0 0.6rem;
    height: 100%;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    color: inherit;
    text-decoration: none;
    transition: var(--transition);

    &:hover { border-color: var(--color-accent); text-decoration: none; }
  }

  .actividad__icono {
    grid-area: icono;
    display: inline-flex;
    color: var(--color-accent);
    --icon-size: 1.2rem;
  }

  .actividad__n {
    grid-area: numero;
    color: var(--color-ink-strong);
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .actividad__nombre {
    grid-area: nombre;
    color: var(--color-ink-soft);
    font-size: 0.76rem;
    font-weight: 600;
  }

  // ── Tipo de cuenta ────────────────────────────────────────────────────────
  .tipos {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.7rem;
  }

  .tipo {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: 'icono nombre' 'icono pista';
    gap: 0 0.7rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: var(--color-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: var(--transition);

    &:disabled { opacity: 0.6; cursor: wait; }
    &:hover:not(:disabled):not(.tipo--activo) { border-color: var(--color-accent); }
  }

  .tipo--activo {
    border-color: var(--color-accent);
    background: var(--wash-accent);
    cursor: default;
  }

  .tipo__icono {
    grid-area: icono;
    display: inline-flex;
    align-self: center;
    color: var(--color-accent);
    --icon-size: 1.4rem;
  }

  .tipo__nombre {
    grid-area: nombre;
    color: var(--color-ink-strong);
    font-weight: 700;
  }

  .tipo__pista {
    grid-area: pista;
    color: var(--color-ink-soft);
    font-size: 0.8rem;
    line-height: 1.35;
  }
</style>
