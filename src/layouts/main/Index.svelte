<script>
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { topicsStore } from '../../store/topicsStore';
  import {
    selectedBibleVersion,
    getBibleVersionConfigOrDefault,
  } from '../../store/stores';
  import { getBookSlug } from '../../services/bible-route.service';
  import { buildPublicTopicUrl } from '../../services/topics.service';
  import { isAuthenticated } from '../../store/authStore';
  import { openAuthMenu } from '../../store/authMenuStore';
  import IconPicker from '../../components/IconPicker.svelte';
  import Icon from '../../components/Icon.svelte';
  import Modal from '../../components/Modal.svelte';
  import { resolveTopicIcon } from '../../config/topic-icons.js';

  export let bible = [];
  export let map = {};


  let view = 'list'; // 'list' | 'detail'
  let selectedTopicId = null;
  let isCreateOpen = false;
  let editForm = { name: '', description: '', icon: 'bookmark', color: '#2E7D9B' };
  let isSubmitting = false;

  $: topics = $topicsStore.topics;
  $: verseRefs = $topicsStore.verseRefs;
  $: primaryConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: indexPath = primaryConfig?.indexPath || 'indice';

  $: selectedTopic = selectedTopicId ? topics.find((t) => t.id === selectedTopicId) : null;
  $: selectedVerses = selectedTopic
    ? (verseRefs[selectedTopic.id] || []).map((ref) => ({
        ...ref,
        text: bible[ref.book]?.[ref.chapter - 1]?.[ref.verse - 1] || '',
        bookName: map[ref.book] || `Book ${ref.book}`,
        reference: `${map[ref.book] || ''} ${ref.chapter}:${ref.verse}`,
      }))
    : [];

  $: copyVerseLabel = $_('app.topics.delete_verse');
  $: createTopicLabel = $_('app.topics.create_topic');
  // Se compara contra `editandoId` directamente y no a través de un helper:
  // Svelte sólo sigue lo que ve escrito en la expresión (trampa 23).
  $: tituloDialogo = editandoId ? $_('app.topics.edit_topic') : $_('app.topics.create_topic');
  $: accionDialogo = editandoId ? $_('app.topics.save') : $_('app.topics.create');

  // ── Publicar un tema ────────────────────────────────────
  let publicando = false;
  let avisoCompartir = '';
  let avisoTimer;

  const mostrarAviso = (mensaje) => {
    avisoCompartir = mensaje;
    window.clearTimeout(avisoTimer);
    avisoTimer = window.setTimeout(() => { avisoCompartir = ''; }, 2600);
  };

  $: enlacePublico = selectedTopic?.isPublic && selectedTopic?.publicSlug
    ? buildPublicTopicUrl(selectedTopic.publicSlug)
    : '';

  const alternarPublicacion = async () => {
    if (!selectedTopic || publicando) return;
    // Publicar un tema vacío daría una página en blanco a quien abra el enlace.
    if (!selectedTopic.isPublic && selectedVerses.length === 0) {
      mostrarAviso($_('app.topics.share.needs_verses'));
      return;
    }
    publicando = true;
    try {
      const res = selectedTopic.isPublic
        ? await topicsStore.unpublish(selectedTopic.id)
        : await topicsStore.publish(selectedTopic.id, $selectedBibleVersion);
      if (res.ok) {
        mostrarAviso(res.topic?.isPublic ? $_('app.topics.share.published') : $_('app.topics.share.unpublished'));
      } else {
        mostrarAviso($_(res.error));
      }
    } finally {
      publicando = false;
    }
  };

  const copiarEnlace = async () => {
    if (!enlacePublico) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(enlacePublico);
      } else {
        const campo = document.createElement('textarea');
        campo.value = enlacePublico;
        campo.setAttribute('readonly', '');
        campo.style.position = 'fixed';
        campo.style.opacity = '0';
        document.body.appendChild(campo);
        campo.select();
        document.execCommand('copy');
        campo.remove();
      }
      mostrarAviso($_('app.topics.share.copied'));
    } catch {
      mostrarAviso($_('app.topics.share.copy_failed'));
    }
  };

  const compartirEnlace = async () => {
    if (!enlacePublico) return;
    // En móvil abre la hoja del sistema; en escritorio casi nunca existe, así
    // que se cae a copiar, que es lo que el usuario quería de todos modos.
    if (navigator.share) {
      try {
        await navigator.share({ title: selectedTopic.name, url: enlacePublico });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    copiarEnlace();
  };

  const openTopic = (id) => {
    selectedTopicId = id;
    view = 'detail';
    updateUrl();
  };

  const backToList = () => {
    view = 'list';
    selectedTopicId = null;
    updateUrl();
  };

  const updateUrl = () => {
    if (typeof window === 'undefined') return;
    let path = `/${indexPath}`;
    if (view === 'detail' && selectedTopicId) {
      path = `/${indexPath}/${selectedTopicId}`;
    }
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new CustomEvent('robibile:navigate'));
    }
  };

  const parseUrl = () => {
    if (typeof window === 'undefined') return;
    const match = window.location.pathname.match(
      new RegExp(`^/${indexPath}(?:/([a-z0-9-]+))?/?$`, 'i'),
    );
    if (!match) {
      view = 'list';
      selectedTopicId = null;
      return;
    }
    const topicId = match[1];
    if (topicId && topics.some((t) => t.id === topicId)) {
      selectedTopicId = topicId;
      view = 'detail';
    } else {
      view = 'list';
      selectedTopicId = null;
    }
  };

  // El mismo diálogo crea y edita: los campos son los mismos y mantener dos
  // copias del formulario garantizaba que un campo nuevo se añadiera sólo a
  // uno. `editandoId` a null significa «estoy creando».
  let editandoId = null;

  const openCreate = () => {
    if (!$isAuthenticated) {
      openAuthMenu();
      return;
    }
    editandoId = null;
    editForm = { name: '', description: '', icon: 'bookmark', color: '#2E7D9B' };
    isCreateOpen = true;
  };

  const openEdit = (topic) => {
    editandoId = topic.id;
    editForm = {
      name: topic.name,
      description: topic.description || '',
      // Pasa por `resolveTopicIcon` para que el selector marque el icono
      // correcto también en los temas antiguos, que guardan un emoji: con el
      // valor crudo no coincidía con ninguna opción, el selector salía sin nada
      // marcado y guardar convertía el emoji en el icono por defecto sin avisar.
      icon: resolveTopicIcon(topic.icon),
      color: topic.color || '#2E7D9B',
    };
    isCreateOpen = true;
  };

  const closeCreate = () => {
    isCreateOpen = false;
    editandoId = null;
  };

  const submitCreate = async () => {
    if (!editForm.name.trim() || isSubmitting) return;
    isSubmitting = true;
    try {
      // `updateTopic` existía en el servicio y en el store desde el principio,
      // sin que ninguna pantalla lo llamara: el diálogo sólo sabía crear, así
      // que un tema mal nombrado o con el icono equivocado había que borrarlo y
      // rehacerlo, perdiendo los versículos guardados dentro.
      if (editandoId) {
        await topicsStore.update(editandoId, {
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          icon: editForm.icon,
          color: editForm.color,
        });
      } else {
        await topicsStore.create(editForm);
      }
      closeCreate();
    } finally {
      isSubmitting = false;
    }
  };

  // ── Borrar un tema, siempre con confirmación ──────────────────────────────
  //
  // Era el `confirm()` del navegador: un diálogo del sistema, sin estilo, sin
  // el nombre del tema y —lo que importa— sin decir cuántos versículos se
  // llevaba por delante. Ahora usa el mismo patrón que el de predicaciones.
  let temaABorrar = null;
  let borrandoTema = false;

  const handleDeleteTopic = (topic) => { temaABorrar = topic; };

  const confirmarBorradoTema = async () => {
    if (!temaABorrar || borrandoTema) return;
    borrandoTema = true;
    const id = temaABorrar.id;
    try {
      await topicsStore.remove(id);
      temaABorrar = null;
      if (selectedTopicId === id) backToList();
    } finally {
      borrandoTema = false;
    }
  };

  const removeVerse = (ref) => {
    if (!selectedTopic) return;
    topicsStore.removeVerse(selectedTopic.id, {
      book: ref.book,
      chapter: ref.chapter,
      verse: ref.verse,
    });
  };

  const goToVerse = (ref) => {
    if (!ref || ref.book === null || ref.book === undefined) return;
    const bookSlug = getBookSlug(map, ref.book);
    const path = `/biblia/${$selectedBibleVersion}/${bookSlug}/${ref.chapter}`;
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new CustomEvent('robibile:navigate'));
    }
  };

  onMount(() => {
    parseUrl();
  });
</script>

<div class="index-page">
  <!-- Sticky header -->
  <div class="index-header">
    <div class="index-header__inner">
      {#if view === 'detail'}
        <button
          type="button"
          class="index-back-btn"
          on:click={backToList}
          title={$_('app.topics.back_to_topics')}
          aria-label={$_('app.topics.back_to_topics')}
        >
          <Icon name="arrow-left" />
          <span>{$_('app.topics.back_to_topics')}</span>
        </button>
      {:else}
        <div class="index-header__title">
          <h1>{$_('app.topics.title')}</h1>
          <p>{$_('app.topics.subtitle')}</p>
        </div>
        <button
          type="button"
          class="index-create-btn"
          on:click={openCreate}
          title={createTopicLabel}
          aria-label={createTopicLabel}
        >
          <span aria-hidden="true">+</span>
          <span>{createTopicLabel}</span>
        </button>
      {/if}
    </div>
  </div>

  <div class="index-content">
    {#if !$isAuthenticated}
      <div class="auth-prompt">
        <p class="auth-prompt__icon" aria-hidden="true">📋</p>
        <p class="auth-prompt__text">{$_('app.topics.login_required')}</p>
        <p class="auth-prompt__hint">{$_('app.topics.login_required_hint')}</p>
        <button type="button" class="auth-prompt__btn" on:click={openAuthMenu}>
          {$_('app.topics.login_prompt_action')}
        </button>
      </div>
    {:else if view === 'list'}
      {#if topics.length === 0}
        <div class="index-empty">
          <p>{$_('app.topics.empty_topics')}</p>
          <button type="button" class="index-create-btn" on:click={openCreate}>
            <span aria-hidden="true">+</span>
            <span>{$_('app.topics.create_first_topic')}</span>
          </button>
        </div>
      {:else}
        <div class="topics-grid">
          {#each topics as topic, i (topic.id)}
            {@const count = (verseRefs[topic.id] || []).length}
            <button
              type="button"
              class="topic-card"
              style:--topic-color={topic.color}
              on:click={() => openTopic(topic.id)}
            >
              <span class="topic-card__icon" aria-hidden="true"><Icon name={resolveTopicIcon(topic.icon)} size="1.1rem" /></span>
              <span class="topic-card__name">{topic.name}</span>
              {#if topic.description}
                <span class="topic-card__desc">{topic.description}</span>
              {/if}
              <span class="topic-card__count">
                {count === 1
                  ? $_('app.topics.verse_count', { count })
                  : $_('app.topics.verses_count_plural', { count })}
              </span>
              <!-- También en los temas por defecto. Son sugerencias que se
                   siembran al crear la cuenta, no datos del sistema: a quien no
                   le sirvan, obligarle a tenerlos en el índice para siempre no
                   tiene sentido. El worker dejó de devolver 403 por lo mismo. -->
              <span class="topic-card__acciones">
                <!-- Flechas y no arrastrar: arrastrar dentro de una rejilla que
                     hace scroll es incómodo en el móvil y falla mucho, y esto
                     funciona igual en los dos sitios. Mismo criterio que la
                     estructura de las predicaciones. -->
                <span
                  class="topic-card__accion"
                  class:topic-card__accion--inerte={i === 0}
                  role="button"
                  tabindex={i === 0 ? -1 : 0}
                  aria-disabled={i === 0}
                  title={$_('app.topics.move_up')}
                  aria-label={$_('app.topics.move_up')}
                  on:click|stopPropagation={() => i > 0 && topicsStore.move(topic.id, -1)}
                  on:keydown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && i > 0) {
                      e.preventDefault();
                      topicsStore.move(topic.id, -1);
                    }
                  }}
                >
                  <Icon name="chevron-up" size="0.8rem" />
                </span>
                <span
                  class="topic-card__accion topic-card__accion--abajo"
                  class:topic-card__accion--inerte={i === topics.length - 1}
                  role="button"
                  tabindex={i === topics.length - 1 ? -1 : 0}
                  aria-disabled={i === topics.length - 1}
                  title={$_('app.topics.move_down')}
                  aria-label={$_('app.topics.move_down')}
                  on:click|stopPropagation={() => i < topics.length - 1 && topicsStore.move(topic.id, 1)}
                  on:keydown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && i < topics.length - 1) {
                      e.preventDefault();
                      topicsStore.move(topic.id, 1);
                    }
                  }}
                >
                  <Icon name="chevron-up" size="0.8rem" />
                </span>
                <span
                  class="topic-card__accion"
                  role="button"
                  tabindex="0"
                  title={$_('app.topics.edit_topic')}
                  aria-label={$_('app.topics.edit_topic')}
                  on:click|stopPropagation={() => openEdit(topic)}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEdit(topic);
                    }
                  }}
                >
                  <Icon name="pencil" size="0.8rem" />
                </span>
                <span
                  class="topic-card__accion topic-card__accion--borrar"
                  role="button"
                  tabindex="0"
                  title={$_('app.topics.delete_topic')}
                  aria-label={$_('app.topics.delete_topic')}
                  on:click|stopPropagation={() => handleDeleteTopic(topic)}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDeleteTopic(topic);
                    }
                  }}
                >
                  <Icon name="close" size="0.8rem" />
                </span>
              </span>
            </button>
          {/each}
        </div>
      {/if}
    {:else if view === 'detail' && selectedTopic}
      <div class="topic-detail">
        <header class="topic-detail__header" style:--topic-color={selectedTopic.color}>
          <span class="topic-detail__icon" aria-hidden="true"><Icon name={resolveTopicIcon(selectedTopic.icon)} size="1.35rem" /></span>
          <div class="topic-detail__meta">
            <h2>{selectedTopic.name}</h2>
            <p>
              {selectedVerses.length === 1
                ? $_('app.topics.verse_count', { count: selectedVerses.length })
                : $_('app.topics.verses_count_plural', { count: selectedVerses.length })}
            </p>
          </div>
        </header>

        <!-- Compartir el tema: publicar le da una URL que se abre sin cuenta -->
        <div class="topic-share" class:topic-share--activo={selectedTopic.isPublic}>
          <div class="topic-share__fila">
            <button
              type="button"
              class="topic-share__toggle"
              class:topic-share__toggle--activo={selectedTopic.isPublic}
              aria-pressed={!!selectedTopic.isPublic}
              disabled={publicando}
              on:click={alternarPublicacion}
            >
              <!-- Globo si el tema es público, candado si es privado: el estado
                   se lee del icono sin tener que abrir nada. -->
              <Icon name={selectedTopic.isPublic ? 'globe' : 'lock'} />
              <span>
                {selectedTopic.isPublic
                  ? $_('app.topics.share.unpublish')
                  : $_('app.topics.share.publish')}
              </span>
            </button>

            {#if selectedTopic.isPublic && enlacePublico}
              <button type="button" class="topic-share__accion" on:click={copiarEnlace}>
                {$_('app.topics.share.copy_link')}
              </button>
              <button type="button" class="topic-share__accion topic-share__accion--principal" on:click={compartirEnlace}>
                {$_('app.topics.share.share')}
              </button>
            {/if}
          </div>

          {#if selectedTopic.isPublic && enlacePublico}
            <p class="topic-share__enlace"><code>{enlacePublico}</code></p>
          {/if}

          <p class="topic-share__nota">
            {selectedTopic.isPublic
              ? $_('app.topics.share.public_hint')
              : $_('app.topics.share.private_hint')}
          </p>

          {#if avisoCompartir}
            <p class="topic-share__aviso" role="status">{avisoCompartir}</p>
          {/if}
        </div>

        {#if selectedVerses.length === 0}
          <div class="index-empty">
            <p>{$_('app.topics.empty_verses')}</p>
          </div>
        {:else}
          <ul class="verse-list">
            {#each selectedVerses as ref (ref.addedAt)}
              <li class="verse-item">
                <button
                  type="button"
                  class="verse-item__ref"
                  on:click={() => goToVerse(ref)}
                  title={ref.reference}
                >
                  {ref.reference}
                </button>
                <p class="verse-item__text">{ref.text || '...'}</p>
                <button
                  type="button"
                  class="verse-item__remove"
                  on:click={() => removeVerse(ref)}
                  title={copyVerseLabel}
                  aria-label={copyVerseLabel}
                >
                  <span aria-hidden="true">&#10005;</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Create topic modal -->
  {#if isCreateOpen}
    <div class="modal-backdrop" on:click={closeCreate} role="presentation">
      <div class="modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeCreate()} role="dialog" tabindex="-1" aria-modal="true" aria-label={tituloDialogo}>
        <h3 class="modal__title">{tituloDialogo}</h3>
        <form class="modal__form" on:submit|preventDefault={submitCreate}>
          <label class="modal__field">
            <span class="modal__label">{$_('app.topics.topic_name')}</span>
            <input spellcheck="false"
              type="text"
              bind:value={editForm.name}
              placeholder={$_('app.topics.new_topic_placeholder')}
              required
              maxlength="40"
              autofocus
            />
          </label>
          <label class="modal__field">
            <span class="modal__label">{$_('app.topics.topic_description')}</span>
            <!-- Opcional a propósito: un tema sin descripción se ve igual que
                 antes. 200 caracteres es una o dos frases, lo que cabe bajo el
                 título sin empujar el recuento de versículos fuera de la vista. -->
            <textarea
              spellcheck="false"
              rows="2"
              maxlength="200"
              bind:value={editForm.description}
              placeholder={$_('app.topics.topic_description_hint')}
            ></textarea>
          </label>
          <label class="modal__field modal__field--row">
            <div class="modal__field-col">
              <span class="modal__label">{$_('app.topics.topic_icon')}</span>
              <IconPicker
                value={editForm.icon}
                onChange={(icon) => { editForm = { ...editForm, icon }; }}
              />
            </div>
            <div class="modal__field-col">
              <span class="modal__label">{$_('app.topics.topic_color')}</span>
              <div role="presentation" on:click|stopPropagation on:mousedown|stopPropagation>
                <input type="color" bind:value={editForm.color} />
              </div>
            </div>
          </label>
          <div class="modal__actions">
            <button type="button" class="modal__btn modal__btn--ghost" on:click={closeCreate}>
              {$_('app.topics.cancel')}
            </button>
            <button type="submit" class="modal__btn modal__btn--primary" disabled={isSubmitting || !editForm.name.trim()}>
              {accionDialogo}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<!-- ── Confirmar el borrado de un tema ─────────────────────────────────────
     Con `Modal`, que es el diálogo de la aplicación (el de crear/editar de
     arriba es anterior y sigue escrito a mano). `fitContent` porque son dos
     líneas y sin él la hoja de móvil ocupa 92 dvh a medio llenar. -->
{#if temaABorrar}
  <Modal
    open={true}
    title={$_('app.topics.delete_topic')}
    size="sm"
    fitContent
    onClose={() => (temaABorrar = null)}
  >
    {@const versiculos = (verseRefs[temaABorrar.id] || []).length}
    <div class="borrar-tema">
      <p class="borrar-tema__pregunta">{$_('app.topics.delete_confirm')}</p>
      <p class="borrar-tema__cual" style:--topic-color={temaABorrar.color}>
        <span class="borrar-tema__icono" aria-hidden="true">
          <Icon name={resolveTopicIcon(temaABorrar.icon)} size="1rem" />
        </span>
        <strong>{temaABorrar.name}</strong>
      </p>
      <!-- Cuántos versículos se lleva. Es el dato que decide: borrar una
           categoría vacía no cuesta nada y borrar una con cuarenta sí. -->
      {#if versiculos > 0}
        <p class="borrar-tema__aviso">
          {versiculos === 1
            ? $_('app.topics.delete_verses_warning', { count: versiculos })
            : $_('app.topics.delete_verses_warning_plural', { count: versiculos })}
        </p>
      {/if}
      {#if temaABorrar.isPublic}
        <p class="borrar-tema__aviso">{$_('app.topics.delete_public_warning')}</p>
      {/if}
    </div>

    <svelte:fragment slot="footer">
      <!-- Clases propias y no `.modal__btn`: aquélla está anidada bajo `.modal`,
           que es el diálogo escrito a mano de arriba. Dentro de `<Modal>` el
           `.modal` lleva el hash de scope de *ese* componente, así que el
           selector anidado de este fichero no llega — los botones saldrían sin
           estilo ninguno. -->
      <button type="button" class="borrar-tema__boton" on:click={() => (temaABorrar = null)}>
        {$_('app.topics.cancel')}
      </button>
      <button type="button" class="borrar-tema__boton borrar-tema__boton--peligro" disabled={borrandoTema} on:click={confirmarBorradoTema}>
        {borrandoTema ? $_('auth.working') : $_('app.topics.delete_topic')}
      </button>
    </svelte:fragment>
  </Modal>
{/if}

<style lang="scss">
  // === BORRAR UN TEMA ===
  .borrar-tema {
    display: grid;
    gap: 0.7rem;
    font-size: var(--font-size-small);
    line-height: var(--line-height-body);
  }

  .borrar-tema__pregunta {
    margin: 0;
    color: var(--color-ink);
  }

  .borrar-tema__cual {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 3px solid var(--topic-color, var(--color-accent));
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--color-surface-sunken);
    color: var(--color-ink-strong);
  }

  .borrar-tema__icono {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--topic-color, var(--color-accent));
  }

  .borrar-tema__aviso {
    margin: 0;
    color: var(--color-danger-ink);
    font-weight: 600;
  }

  .borrar-tema__boton {
    padding: 0.5rem 1.1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink);
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);

    &:hover { border-color: var(--color-accent); color: var(--color-accent); }

    /* Veladura y tinta de peligro, no rojo macizo: no hay token de relleno para
       `danger` y en las paletas oscuras es claro. Mismo patrón que el diálogo
       de borrar una predicación. */
    &--peligro {
      border-color: color-mix(in srgb, var(--color-danger) 55%, transparent);
      background: var(--color-danger-wash);
      color: var(--color-danger-ink);

      &:hover:not(:disabled) {
        border-color: var(--color-danger);
        background: color-mix(in srgb, var(--color-danger) 26%, transparent);
      }

      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  }

  .index-page {
    width: 100%;
    max-width: 96rem;
    margin-inline: auto;
    padding: 0 clamp(1rem, 5vw, 5rem) 3rem;
  }

  .index-header {
    background: var(--color-bg-light);
    border-bottom: 2px solid var(--color-blue);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 12px var(--shadow-tint);
    margin: 0 calc(-1 * clamp(1rem, 5vw, 5rem)) 1.5rem;

    &__inner {
      max-width: 96rem;
      margin-inline: auto;
      padding: 0.75rem clamp(1rem, 5vw, 5rem);
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    &__title {
      flex: 1 1 auto;
      min-width: 0;

      h1 {
        margin: 0;
        font-size: clamp(1.4rem, 3vw, 1.9rem);
        line-height: 1.15;
        color: var(--color-bg-dark);
      }

      p {
        margin: 0.2rem 0 0;
        font-size: 0.85rem;
        color: var(--color-ink-soft);
      }
    }
  }

  .index-back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid color-mix(in srgb, var(--color-accent) 42%, transparent);
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-bg-dark);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
    }
  }

  .index-create-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.95rem;
    border: 1px solid var(--color-blue);
    border-radius: 999px;
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);
    white-space: nowrap;

    span[aria-hidden] {
      font-size: 1.1rem;
      line-height: 1;
    }

    &:hover,
    &:focus-visible {
      background: var(--color-blue-hover);
      border-color: var(--color-blue-hover);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 35%, transparent), var(--box-shadow-down);
    }

    &:focus-visible {
      outline: 2px solid var(--color-white);
      outline-offset: 2px;
    }
  }

  .index-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 40vh;
    text-align: center;
    padding: 2rem;
    color: var(--color-bg-dark);

    p {
      margin: 0;
      font-size: 1rem;
      max-width: 28rem;
      color: var(--color-ink-soft);
    }
  }

  .auth-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 40vh;
    text-align: center;
    padding: 3rem 1.5rem;
    border: 2px dashed var(--color-line-strong);
    border-radius: 0.75rem;
    background: var(--wash-subtle);

    &__icon {
      margin: 0;
      font-size: 3rem;
      opacity: 0.6;
    }

    &__text {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--color-bg-dark);
    }

    &__hint {
      margin: 0;
      font-size: 0.9rem;
      color: var(--color-ink-soft);
    }

    &__btn {
      margin-top: 0.5rem;
      padding: 0.6rem 1.4rem;
      border: 1px solid var(--color-blue);
      border-radius: 0.4rem;
      background: var(--color-accent-solid);
      color: var(--color-on-primary);
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition);

      &:hover,
      &:focus-visible {
        background: var(--color-blue-hover);
        border-color: var(--color-blue-hover);
      }
    }
  }

  // === TOPICS GRID ===
  .topics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
    gap: 1rem;
  }

  .topic-card {
    --topic-color: #2E7D9B;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 1.1rem 1rem 1rem;
    border: 1px solid color-mix(in srgb, var(--topic-color) 28%, transparent);
    border-radius: 0.6rem;
    background: var(--color-white);
    color: var(--color-bg-dark);
    text-align: left;
    cursor: pointer;
    transition: var(--transition);
    overflow: hidden;
    min-height: 8.5rem;
    box-shadow: var(--box-shadow-up);

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--topic-color);
    }

    &__icon {
      display: grid;
      place-items: center;
      width: 2.2rem;
      height: 2.2rem;

      :global(svg) {
        width: 1.6rem;
        height: 1.6rem;
        color: var(--topic-color);
      }
    }

    &__name {
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.2;
      word-break: break-word;
    }

    &__count {
      font-size: 0.78rem;
      color: color-mix(in srgb, var(--topic-color) 85%, var(--color-bg-dark));
      font-weight: 600;
    }

    &__acciones {
      position: absolute;
      top: 0.4rem;
      right: 0.4rem;
      display: flex;
      gap: 0.15rem;
      /* Apagadas hasta que se pasa por encima: son acciones secundarias y la
         tarjeta entera ya es un botón. En táctil se muestran siempre — ver la
         media query de abajo. */
      opacity: 0;
      transition: opacity var(--motion-base) var(--ease-out);
    }

    /* La descripción bajo el título. Dos líneas como mucho: pasado eso la
       tarjeta crece y la rejilla deja de leerse de un vistazo, que es para lo
       que sirve esta pantalla. */
    &__desc {
      margin-top: 0.15rem;
      color: var(--color-ink-soft);
      font-size: 0.78rem;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    &__accion {
      display: grid;
      place-items: center;
      /* 1.75rem = 28 px: por encima del mínimo de 24 de la WCAG 2.5.8, que es
         lo que hay que respetar en cuanto se ven en el móvil. */
      width: 1.75rem;
      height: 1.75rem;
      border: 0;
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-ink-soft);
      cursor: pointer;
      transition: var(--transition);

      &:hover,
      &:focus-visible {
        background: var(--wash-accent);
        color: var(--color-accent);
      }

      &--borrar:hover,
      &--borrar:focus-visible {
        background: var(--color-danger-wash);
        color: var(--color-danger);
      }

      /* La flecha de bajar es la de subir girada: `Icon` no trae `chevron-down`
         y añadir un trazo al fichero generado por un giro de 180° no compensa. */
      &--abajo :global(svg) { transform: rotate(180deg); }

      /* En el primero y en el último la flecha no lleva a ninguna parte.
         Se apaga en vez de esconderse: si desapareciera, los botones de
         debajo cambiarían de sitio entre tarjetas y habría que buscarlos. */
      &--inerte {
        opacity: 0.3;
        cursor: default;

        &:hover { background: var(--color-surface); color: var(--color-ink-soft); }
      }

      &:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
      }
    }

    &:hover,
    &:focus-visible {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px color-mix(in srgb, var(--topic-color) 18%, transparent);
      border-color: color-mix(in srgb, var(--topic-color) 50%, transparent);
    }

    &:hover &__acciones,
    &:focus-within &__acciones {
      opacity: 1;
    }
  }

  /* En un móvil no hay `hover`: con las acciones apagadas hasta pasar el ratón,
     editar y borrar un tema eran sencillamente inalcanzables desde el teléfono
     —que es donde más se usa esta pantalla—. `hover: none` distingue el táctil
     del escritorio sin mirar el ancho, que es lo correcto: un portátil con
     pantalla táctil tiene las dos cosas y no debe perder el ratón. */
  @media (hover: none) {
    .topic-card__acciones { opacity: 1; }
  }

  // === COMPARTIR TEMA ===
  .topic-share {
    display: grid;
    gap: 0.6rem;
    margin: 0 0 1.25rem;
    padding: 0.9rem 1rem;
    border: 1px dashed var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);

    // Publicado: el borde deja de ser punteado y toma el color del acento,
    // para que se vea de un vistazo que el tema está fuera.
    &--activo {
      border-style: solid;
      border-color: color-mix(in srgb, var(--color-accent) 45%, transparent);
    }
  }

  .topic-share__fila {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .topic-share__toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    color: var(--color-ink);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 0.95rem;

    &:hover:not(:disabled) {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    &:disabled { opacity: 0.55; cursor: not-allowed; }

    &--activo {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
      color: var(--color-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .topic-share__accion {
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    &:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    &--principal {
      border-color: var(--color-accent);
      background: var(--color-accent-solid);
      color: var(--color-on-primary);

      &:hover {
        background: var(--color-accent-hover);
        border-color: var(--color-accent-hover);
        color: var(--color-on-primary);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .topic-share__enlace {
    margin: 0;
    overflow-wrap: anywhere;

    code {
      font-size: var(--font-size-tiny);
      color: var(--color-ink-soft);
    }
  }

  .topic-share__nota,
  .topic-share__aviso {
    margin: 0;
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);
  }

  .topic-share__aviso {
    font-weight: 600;
    color: var(--color-accent);
  }

  // === TOPIC DETAIL ===
  .topic-detail {
    &__header {
      --topic-color: #2E7D9B;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-radius: 0.6rem;
      background: color-mix(in srgb, var(--topic-color) 8%, var(--color-white));
      border-left: 4px solid var(--topic-color);
      margin-bottom: 1.5rem;
    }

    &__icon {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;

      :global(svg) {
        width: 2rem;
        height: 2rem;
        color: var(--topic-color);
      }
    }

    &__meta {
      flex: 1 1 auto;
      min-width: 0;

      h2 {
        margin: 0;
        font-size: clamp(1.3rem, 3vw, 1.7rem);
        line-height: 1.2;
        color: var(--color-bg-dark);
      }

      p {
        margin: 0.2rem 0 0;
        font-size: 0.85rem;
        color: color-mix(in srgb, var(--topic-color) 80%, var(--color-bg-dark));
        font-weight: 600;
      }
    }
  }

  .verse-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .verse-item {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem 1rem;
    align-items: start;
    padding: 0.85rem 1rem;
    border: 1px solid color-mix(in srgb, var(--color-accent) 14%, transparent);
    border-radius: 0.45rem;
    background: var(--color-white);
    transition: var(--transition);

    &:hover {
      border-color: color-mix(in srgb, var(--color-accent) 38%, transparent);
      background: color-mix(in srgb, var(--color-blue) 4%, var(--color-white));

      .verse-item__remove {
        opacity: 1;
      }
    }

    &__ref {
      flex: 0 0 auto;
      align-self: start;
      padding: 0.2rem 0.5rem;
      border: 1px solid color-mix(in srgb, var(--color-accent) 28%, transparent);
      border-radius: 0.25rem;
      background: color-mix(in srgb, var(--color-accent) 8%, transparent);
      color: var(--color-link);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition);
      line-height: 1.4;

      &:hover,
      &:focus-visible {
        background: var(--color-accent-solid);
        color: var(--color-on-primary);
        border-color: var(--color-blue);
      }
    }

    &__text {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.55;
      color: var(--color-bg-dark);
    }

    &__remove {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--color-ink-soft);
      cursor: pointer;
      transition: var(--transition);
      opacity: 0;
      align-self: start;
      font-size: 0.9rem;

      &:hover,
      &:focus-visible {
        background: var(--color-danger-wash);
        color: var(--color-danger);
        opacity: 1;
      }

      &:focus-visible {
        outline: 2px solid var(--color-blue);
        outline-offset: 2px;
      }
    }
  }

  // === MODAL ===
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 100dvh;
    background: var(--color-scrim);
    backdrop-filter: blur(2px);
    animation: fadeIn var(--motion-fast) var(--ease-out);
    overflow-y: auto;
  }

  .modal {
    width: 100%;
    max-width: 24rem;
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    background: var(--color-white);
    border-radius: 0.6rem;
    box-shadow: var(--box-shadow-down);
    padding: 1.25rem;
    color: var(--color-bg-dark);
    animation: scaleIn var(--motion-fast) var(--ease-out);
    margin: auto;

    &__title {
      margin: 0 0 1rem;
      font-size: 1.15rem;
      font-weight: 700;
    }

    &__form {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    &__field {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;

      &--row {
        flex-direction: row;
        gap: 0.85rem;

        /* En una pantalla estrecha el selector de iconos no cabe al lado del
           color: la rejilla de catorce iconos tiene un ancho mínimo que no
           cede, así que se comía la fila entera y la columna del color se
           quedaba en 11 px — con «CULOARE» saliendo en vertical, una letra por
           línea, y la muestra reducida a una raya. Apilados caben los dos. */
        @media (max-width: 30rem) {
          flex-direction: column;
          gap: 0.5rem;
        }
      }

      &-col {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
    }

    &__label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--color-ink-soft);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* El `textarea` va con el `input`: la regla era sólo `input[type='text']`,
       así que el campo de descripción salía con el estilo del navegador —fondo
       blanco, borde fino y tipografía distinta— al lado de un nombre que sí
       estaba maquetado. */
    input[type='text'],
    textarea {
      width: 100%;
      padding: 0.55rem 0.75rem;
      border: 1px solid color-mix(in srgb, var(--color-accent) 32%, transparent);
      border-radius: 0.3rem;
      background: var(--color-white);
      color: var(--color-bg-dark);
      font-size: 0.95rem;
      transition: var(--transition);

      &:focus {
        outline: none;
        border-color: var(--color-blue);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 16%, transparent);
      }
    }

    /* Un `textarea` no hereda la fuente del contenedor: sin esto se queda en la
       monoespaciada del navegador. Y sólo se estira a lo alto — a lo ancho
       podría salirse del diálogo. */
    textarea {
      font-family: inherit;
      line-height: 1.45;
      resize: vertical;
      min-height: 3.5rem;
    }

    input[type='color'] {
      width: 100%;
      height: 2.4rem;
      padding: 0.15rem;
      border: 1px solid color-mix(in srgb, var(--color-accent) 32%, transparent);
      border-radius: 0.3rem;
      background: var(--color-white);
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--color-blue);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 16%, transparent);
      }
    }

    &__actions {
      display: flex;
      gap: 0.6rem;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }

    &__btn {
      padding: 0.5rem 1rem;
      border-radius: 999px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition);

      &--ghost {
        background: transparent;
        border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
        color: var(--color-bg-dark);

        &:hover {
          background: color-mix(in srgb, var(--color-accent) 8%, transparent);
        }
      }

      &--primary {
        background: var(--color-accent-solid);
        border: 1px solid var(--color-accent-solid);
        color: var(--color-on-primary);

        &:hover:not(:disabled) {
          background: var(--color-accent-solid-hover);
          border-color: var(--color-accent-solid-hover);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  // === DARK MODE ===

  // === MOBILE ===
  @media (max-width: 38rem) {
    .index-page {
      padding: 0 0.5rem 3rem;
    }

    .index-header {
      margin: 0 -0.5rem 1rem;

      &__inner {
        padding: 0.6rem 0.75rem;
        flex-wrap: wrap;
      }

      &__title h1 {
        font-size: 1.2rem;
      }
    }

    .index-create-btn span:not([aria-hidden]) {
      display: none;
    }

    .topics-grid {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
      gap: 0.75rem;
    }

    .topic-card {
      min-height: 7rem;
      padding: 0.85rem 0.75rem 0.75rem;

      &__icon { font-size: 1.5rem; }
      &__name { font-size: 0.95rem; }
    }

    .verse-item {
      grid-template-columns: 1fr auto;
      gap: 0.5rem;

      &__ref {
        grid-column: 1 / -1;
      }

      &__text {
        grid-column: 1;
      }

      &__remove {
        grid-column: 2;
        grid-row: 2;
        opacity: 1;
      }
    }
  }
</style>
