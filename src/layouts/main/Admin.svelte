<script>
  /**
   * Panel de administración (`/admin`).
   *
   * El rol de admin vive en `is_admin` (D1), no en este archivo: la guarda de
   * abajo (`$currentUser?.isAdmin`) es una segunda línea de defensa por si
   * alguien teclea la URL a mano — el menú ya lo oculta, y el worker vuelve a
   * comprobarlo en cada petición (`requireAdminMw`), así que aunque esta
   * guarda fallara no se filtraría nada.
   *
   * Tres secciones independientes: analíticas (sólo lectura), usuarios y
   * predicaciones. Las dos últimas comparten el mismo patrón — buscar, actuar,
   * refrescar la lista — y cada acción destructiva pasa por un modal de
   * confirmación antes de tocar la red.
   */
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { currentUser } from '../../store/authStore';
  import * as adminService from '../../services/admin.service';
  import Modal from '../../components/Modal.svelte';
  import Icon from '../../components/Icon.svelte';

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: applySeoMetadata({
    title: $_('app.admin.title'),
    description: $_('app.admin.title'),
    canonicalPath: '/admin',
    versionConfig,
    robots: 'noindex, nofollow',
  });

  $: esAdmin = !!$currentUser?.isAdmin;

  let aviso = '';
  let avisoTimer;
  const mostrar = (texto) => {
    aviso = texto;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { aviso = ''; }, 3200);
  };

  // ── Analíticas ──────────────────────────────────────────────────────────
  let stats = null;
  let cargandoStats = true;

  const cargarStats = async () => {
    cargandoStats = true;
    const res = await adminService.getStats();
    if (res.ok) stats = res.stats;
    else mostrar($_(res.error));
    cargandoStats = false;
  };

  // ── Usuarios ────────────────────────────────────────────────────────────
  let queryUsuarios = '';
  let usuarios = [];
  let cargandoUsuarios = false;
  let accionUsuario = null; // { tipo: 'disable'|'enable'|'promote'|'demote'|'delete', user }
  let nickConfirmacion = '';
  let procesando = false;
  let contrasenaGenerada = null; // { nickname, password }

  const buscarUsuarios = async () => {
    cargandoUsuarios = true;
    const res = await adminService.searchUsers(queryUsuarios);
    if (res.ok) usuarios = res.users;
    else mostrar($_(res.error));
    cargandoUsuarios = false;
  };

  const abrirAccionUsuario = (tipo, user) => {
    accionUsuario = { tipo, user };
    nickConfirmacion = '';
  };

  const resetearContrasena = async (user) => {
    procesando = true;
    try {
      const res = await adminService.resetUserPassword(user.id);
      if (res.ok) contrasenaGenerada = { nickname: user.nickname, password: res.newPassword };
      else mostrar($_(res.error));
    } finally {
      procesando = false;
    }
  };

  const confirmarAccionUsuario = async () => {
    if (!accionUsuario || procesando) return;
    procesando = true;
    try {
      const { tipo, user } = accionUsuario;
      const res =
        tipo === 'disable' ? await adminService.setUserDisabled(user.id, true)
        : tipo === 'enable' ? await adminService.setUserDisabled(user.id, false)
        : tipo === 'promote' ? await adminService.setUserAdmin(user.id, true)
        : tipo === 'demote' ? await adminService.setUserAdmin(user.id, false)
        : await adminService.deleteUser(user.id);

      if (!res.ok) {
        mostrar($_(res.error));
        return;
      }
      mostrar($_(`app.admin.users.${tipo}_done`));
      accionUsuario = null;
      await buscarUsuarios();
    } finally {
      procesando = false;
    }
  };

  // ── Predicaciones ───────────────────────────────────────────────────────
  let querySermones = '';
  let sermones = [];
  let cargandoSermones = false;
  let accionSermon = null; // { tipo: 'unpublish'|'delete', sermon }

  const buscarSermones = async () => {
    cargandoSermones = true;
    const res = await adminService.searchSermons(querySermones);
    if (res.ok) sermones = res.sermons;
    else mostrar($_(res.error));
    cargandoSermones = false;
  };

  const abrirAccionSermon = (tipo, sermon) => { accionSermon = { tipo, sermon }; };

  const confirmarAccionSermon = async () => {
    if (!accionSermon || procesando) return;
    procesando = true;
    try {
      const { tipo, sermon } = accionSermon;
      const res = tipo === 'unpublish'
        ? await adminService.unpublishSermon(sermon.id)
        : await adminService.deleteSermon(sermon.id);
      if (!res.ok) {
        mostrar($_(res.error));
        return;
      }
      mostrar($_(`app.admin.sermons.${tipo}_done`));
      accionSermon = null;
      await buscarSermones();
    } finally {
      procesando = false;
    }
  };

  const copiarContrasena = async () => {
    if (!contrasenaGenerada) return;
    try {
      await navigator.clipboard.writeText(contrasenaGenerada.password);
      mostrar($_('app.admin.users.password_copied'));
    } catch { /* sin portapapeles no se puede hacer más */ }
  };

  onMount(() => {
    if (!esAdmin) return;
    cargarStats();
    buscarUsuarios();
    buscarSermones();
  });
</script>

<section class="admin">
  {#if !esAdmin}
    <div class="admin__vacio">
      <p>{$_('app.admin.unauthorized')}</p>
      <a class="admin__inicio" href="/">{$_('app.sermons.share.go_home')}</a>
    </div>
  {:else}
    <header class="admin__cabecera">
      <p class="admin__eyebrow">{$_('app.admin.eyebrow')}</p>
      <h1>{$_('app.admin.title')}</h1>
    </header>

    {#if aviso}
      <p class="admin__aviso" role="status">{aviso}</p>
    {/if}

    <!-- ── Analíticas ────────────────────────────────────────────────── -->
    <section class="admin__seccion">
      <h2>{$_('app.admin.stats.title')}</h2>
      {#if cargandoStats}
        <p class="admin__cargando">{$_('app.loading')}</p>
      {:else if stats}
        <div class="rejilla-stats">
          <article class="stat"><span class="stat__n">{stats.totalUsers}</span><span class="stat__etq">{$_('app.admin.stats.total_users')}</span></article>
          <article class="stat"><span class="stat__n">{stats.newUsersThisWeek}</span><span class="stat__etq">{$_('app.admin.stats.new_users_week')}</span></article>
          <article class="stat"><span class="stat__n">{stats.disabledUsers}</span><span class="stat__etq">{$_('app.admin.stats.disabled_users')}</span></article>
          <article class="stat"><span class="stat__n">{stats.totalSermons}</span><span class="stat__etq">{$_('app.admin.stats.total_sermons')}</span></article>
          <article class="stat"><span class="stat__n">{stats.publicSermons}</span><span class="stat__etq">{$_('app.admin.stats.public_sermons')}</span></article>
          <article class="stat"><span class="stat__n">{stats.totalTopics}</span><span class="stat__etq">{$_('app.admin.stats.total_topics')}</span></article>
          <article class="stat"><span class="stat__n">{stats.publicTopics}</span><span class="stat__etq">{$_('app.admin.stats.public_topics')}</span></article>
          <article class="stat"><span class="stat__n">{stats.viewsToday}</span><span class="stat__etq">{$_('app.admin.stats.views_today')}</span></article>
          <article class="stat"><span class="stat__n">{stats.uniqueVisitorsToday}</span><span class="stat__etq">{$_('app.admin.stats.unique_visitors_today')}</span></article>
          <article class="stat"><span class="stat__n">{stats.viewsTotal}</span><span class="stat__etq">{$_('app.admin.stats.views_total')}</span></article>
        </div>

        <div class="listas-stats">
          <article class="lista-stat">
            <h3>{$_('app.admin.stats.top_countries')}</h3>
            {#if stats.topCountriesToday?.length}
              <ol>
                {#each stats.topCountriesToday as p (p.country)}
                  <li><span>{p.country}</span><span>{p.count}</span></li>
                {/each}
              </ol>
            {:else}
              <p class="admin__vacio-lista">{$_('app.admin.stats.no_data_today')}</p>
            {/if}
          </article>
          <article class="lista-stat">
            <h3>{$_('app.admin.stats.top_pages')}</h3>
            {#if stats.topPagesToday?.length}
              <ol>
                {#each stats.topPagesToday as p (p.path)}
                  <li><span class="lista-stat__ruta">{p.path}</span><span>{p.count}</span></li>
                {/each}
              </ol>
            {:else}
              <p class="admin__vacio-lista">{$_('app.admin.stats.no_data_today')}</p>
            {/if}
          </article>
        </div>
      {/if}
    </section>

    <!-- ── Usuarios ──────────────────────────────────────────────────── -->
    <section class="admin__seccion">
      <h2>{$_('app.admin.users.title')}</h2>
      <form class="admin__buscador" on:submit|preventDefault={buscarUsuarios}>
        <input type="search" bind:value={queryUsuarios} placeholder={$_('app.admin.users.search_placeholder')} />
        <button type="submit">{$_('app.admin.search')}</button>
      </form>

      {#if cargandoUsuarios}
        <p class="admin__cargando">{$_('app.loading')}</p>
      {:else if !usuarios.length}
        <p class="admin__vacio-lista">{$_('app.admin.no_results')}</p>
      {:else}
        <ul class="admin__lista">
          {#each usuarios as u (u.id)}
            <li class="fila">
              <div class="fila__info">
                <span class="fila__nombre">{u.nickname}</span>
                {#if u.email}<span class="fila__detalle">{u.email}</span>{/if}
                {#if u.isAdmin}<span class="insignia insignia--admin">{$_('app.admin.users.badge_admin')}</span>{/if}
                {#if u.isDisabled}<span class="insignia insignia--desactivado">{$_('app.admin.users.badge_disabled')}</span>{/if}
              </div>
              <div class="fila__acciones">
                <button type="button" on:click={() => resetearContrasena(u)} disabled={procesando}>{$_('app.admin.users.reset_password')}</button>
                {#if u.isDisabled}
                  <button type="button" on:click={() => abrirAccionUsuario('enable', u)}>{$_('app.admin.users.enable')}</button>
                {:else}
                  <button type="button" on:click={() => abrirAccionUsuario('disable', u)}>{$_('app.admin.users.disable')}</button>
                {/if}
                {#if u.isAdmin}
                  <button type="button" on:click={() => abrirAccionUsuario('demote', u)}>{$_('app.admin.users.remove_admin')}</button>
                {:else}
                  <button type="button" on:click={() => abrirAccionUsuario('promote', u)}>{$_('app.admin.users.make_admin')}</button>
                {/if}
                <button type="button" class="fila__borrar" on:click={() => abrirAccionUsuario('delete', u)}>{$_('app.admin.users.delete')}</button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- ── Predicaciones ─────────────────────────────────────────────── -->
    <section class="admin__seccion">
      <h2>{$_('app.admin.sermons.title')}</h2>
      <form class="admin__buscador" on:submit|preventDefault={buscarSermones}>
        <input type="search" bind:value={querySermones} placeholder={$_('app.admin.sermons.search_placeholder')} />
        <button type="submit">{$_('app.admin.search')}</button>
      </form>

      {#if cargandoSermones}
        <p class="admin__cargando">{$_('app.loading')}</p>
      {:else if !sermones.length}
        <p class="admin__vacio-lista">{$_('app.admin.no_results')}</p>
      {:else}
        <ul class="admin__lista">
          {#each sermones as s (s.id)}
            <li class="fila">
              <div class="fila__info">
                <span class="fila__nombre">{s.title || $_('app.sermons.untitled')}</span>
                <span class="fila__detalle">{s.author}</span>
                {#if s.isPublic}<span class="insignia insignia--admin">{$_('app.admin.sermons.badge_public')}</span>{/if}
              </div>
              <div class="fila__acciones">
                {#if s.isPublic}
                  <button type="button" on:click={() => abrirAccionSermon('unpublish', s)}>{$_('app.admin.sermons.unpublish')}</button>
                {/if}
                <button type="button" class="fila__borrar" on:click={() => abrirAccionSermon('delete', s)}>{$_('app.admin.sermons.delete')}</button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</section>

<!-- ── Confirmación genérica (activar/desactivar/ascender/quitar admin) ──── -->
{#if accionUsuario && accionUsuario.tipo !== 'delete'}
  <Modal open={true} title={$_(`app.admin.users.confirm_${accionUsuario.tipo}_title`)} size="sm" fitContent onClose={() => (accionUsuario = null)}>
    <p>{$_(`app.admin.users.confirm_${accionUsuario.tipo}_text`, { nickname: accionUsuario.user.nickname })}</p>
    <svelte:fragment slot="footer">
      <button type="button" on:click={() => (accionUsuario = null)}>{$_('app.topics.cancel')}</button>
      <button type="button" disabled={procesando} on:click={confirmarAccionUsuario}>
        {procesando ? $_('auth.working') : $_(`app.admin.users.${accionUsuario.tipo}`)}
      </button>
    </svelte:fragment>
  </Modal>
{/if}

<!-- ── Borrar usuario: confirmación escribiendo el nickname ──────────────── -->
{#if accionUsuario && accionUsuario.tipo === 'delete'}
  <Modal open={true} title={$_('app.admin.users.confirm_delete_title')} size="sm" fitContent onClose={() => (accionUsuario = null)}>
    <p class="admin__aviso-fuerte">{$_('app.admin.users.confirm_delete_warning')}</p>
    <p>{$_('app.admin.users.confirm_delete_type', { nickname: accionUsuario.user.nickname })}</p>
    <input type="text" bind:value={nickConfirmacion} autocomplete="off" spellcheck="false" />
    <svelte:fragment slot="footer">
      <button type="button" on:click={() => (accionUsuario = null)}>{$_('app.topics.cancel')}</button>
      <button
        type="button"
        class="fila__borrar"
        disabled={procesando || nickConfirmacion.trim().toLowerCase() !== accionUsuario.user.nickname.toLowerCase()}
        on:click={confirmarAccionUsuario}
      >
        {procesando ? $_('auth.working') : $_('app.admin.users.delete')}
      </button>
    </svelte:fragment>
  </Modal>
{/if}

<!-- ── Contraseña nueva: se ve una sola vez ───────────────────────────────── -->
{#if contrasenaGenerada}
  <Modal open={true} title={$_('app.admin.users.new_password_title')} size="sm" fitContent onClose={() => (contrasenaGenerada = null)}>
    <p>{$_('app.admin.users.new_password_for', { nickname: contrasenaGenerada.nickname })}</p>
    <p class="admin__contrasena">{contrasenaGenerada.password}</p>
    <p class="admin__aviso-fuerte">{$_('app.admin.users.new_password_warning')}</p>
    <svelte:fragment slot="footer">
      <button type="button" on:click={copiarContrasena}>
        <Icon name="copy" size="0.9rem" />
        {$_('app.admin.users.copy')}
      </button>
      <button type="button" on:click={() => (contrasenaGenerada = null)}>{$_('auth.close')}</button>
    </svelte:fragment>
  </Modal>
{/if}

<!-- ── Confirmar acción sobre una predicación ─────────────────────────────── -->
{#if accionSermon}
  <Modal open={true} title={$_(`app.admin.sermons.confirm_${accionSermon.tipo}_title`)} size="sm" fitContent onClose={() => (accionSermon = null)}>
    <p>{$_(`app.admin.sermons.confirm_${accionSermon.tipo}_text`, { title: accionSermon.sermon.title || $_('app.sermons.untitled') })}</p>
    <svelte:fragment slot="footer">
      <button type="button" on:click={() => (accionSermon = null)}>{$_('app.topics.cancel')}</button>
      <button type="button" class="fila__borrar" disabled={procesando} on:click={confirmarAccionSermon}>
        {procesando ? $_('auth.working') : $_(`app.admin.sermons.${accionSermon.tipo}`)}
      </button>
    </svelte:fragment>
  </Modal>
{/if}

<style lang="scss">
  .admin {
    width: 100%;
    max-width: 62rem;
    margin: 0 auto;
    padding: 0 0 4rem;
  }

  .admin__vacio {
    padding: 4rem 1rem;
    text-align: center;
    color: var(--color-ink-soft);
  }

  .admin__inicio {
    display: inline-block;
    margin-top: 1rem;
    color: var(--color-accent-ink);
    font-weight: 700;
  }

  .admin__cabecera {
    margin-bottom: 1.5rem;

    h1 { margin: 0.2rem 0 0; }
  }

  .admin__eyebrow {
    margin: 0;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .admin__aviso {
    margin: 0 0 1rem;
    padding: 0.55rem 0.85rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  .admin__aviso-fuerte {
    color: var(--color-marked-favorite);
    font-weight: 700;
  }

  .admin__seccion {
    margin-bottom: 2.5rem;

    h2 { margin: 0 0 0.9rem; font-size: var(--font-size-h3); }
  }

  .admin__cargando,
  .admin__vacio-lista {
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
  }

  // ── Analíticas ────────────────────────────────────────────────────────────
  .rejilla-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.7rem;
    margin-bottom: 1rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .stat__n {
    color: var(--color-ink-strong);
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .stat__etq {
    color: var(--color-ink-soft);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .listas-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 0.9rem;
  }

  .lista-stat {
    padding: 0.85rem 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);

    h3 { margin: 0 0 0.5rem; font-size: 0.85rem; color: var(--color-ink-soft); }

    ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.35rem; }

    li {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: var(--font-size-small);
    }
  }

  .lista-stat__ruta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // ── Buscador y listas ─────────────────────────────────────────────────────
  .admin__buscador {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.9rem;

    input {
      flex: 1;
      min-height: 2.4rem;
      padding: 0.45rem 0.7rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-field);
      color: var(--color-ink);
      font: inherit;
    }

    button {
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      cursor: pointer;
    }
  }

  .admin__lista {
    display: grid;
    gap: 0.6rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .fila {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .fila__info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .fila__nombre { font-weight: 700; color: var(--color-ink-strong); }
  .fila__detalle { color: var(--color-ink-soft); font-size: var(--font-size-small); }

  .fila__acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;

    button {
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-pill);
      background: var(--color-surface-raised);
      color: var(--color-ink);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;

      &:hover { border-color: var(--color-accent); }
    }
  }

  .fila__borrar {
    border-color: var(--color-marked-favorite) !important;
    color: var(--color-marked-favorite) !important;
  }

  .insignia {
    padding: 0.15rem 0.55rem;
    border-radius: var(--radius-pill);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .insignia--admin {
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
  }

  .insignia--desactivado {
    background: var(--wash-subtle);
    color: var(--color-ink-soft);
  }

  .admin__contrasena {
    padding: 0.75rem 1rem;
    border: 1px dashed var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--wash-accent);
    color: var(--color-ink-strong);
    font-family: monospace;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-align: center;
    user-select: all;
  }
</style>
