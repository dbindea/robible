<script>
  import { onDestroy } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import {
    currentUser,
    isAuthenticated,
    login,
    register,
    logout,
    getSecurityQuestion,
    verifySecurityAnswer,
    resetPassword,
  } from '../../store/authStore';
  import { closeAuthMenu } from '../../store/authMenuStore';
  import { LEGACY_SECURITY_QUESTIONS, USER_TYPES, validators } from '../../services/auth.service';
  import { onMount } from 'svelte';

  // Vistas: 'login' | 'register' | 'recover-question' | 'recover-reset'
  let view = 'login';
  let message = '';
  let error = '';
  let busy = false;
  let nickname = '';
  let password = '';
  let customQuestion = '';
  let securityAnswer = '';
  let newPassword = '';
  let userType = 'user';
  let email = '';

  // Si ya está logueado, mostramos el perfil + logout
  $: if ($isAuthenticated) {
    // Mantener view pero mostrar perfil
  }

  const switchView = (next) => {
    view = next;
    message = '';
    error = '';
    securityAnswer = '';
    newPassword = '';
    customQuestion = '';
  };

  const close = () => {
    closeAuthMenu();
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') close();
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });
  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });

  // ── Login ──
  const submitLogin = async () => {
    error = '';
    message = '';
    if (!validators.isValidNickname(nickname)) {
      error = $_('auth.errors.invalid_nickname');
      return;
    }
    if (!password) {
      error = $_('auth.errors.invalid_password');
      return;
    }
    busy = true;
    const result = await login(nickname, password);
    busy = false;
    if (result.ok) {
      message = $_('auth.welcome_back', { nickname: result.user.nickname });
      // Cierra el modal después de un breve feedback
      setTimeout(() => close(), 900);
    } else {
      error = $_(result.error);
    }
  };

  // ── Register ──
  const submitRegister = async () => {
    error = '';
    message = '';
    const result = await register({
      nickname,
      password,
      securityQuestionText: customQuestion,
      securityAnswer,
      userType,
      email,
    });
    if (result.ok) {
      message = $_('auth.welcome_new', { nickname: result.user.nickname });
      setTimeout(() => close(), 900);
    } else {
      error = $_(result.error);
    }
  };

  // ── Recover ──
  const submitRecoverQuestion = async () => {
    error = '';
    message = '';
    if (!validators.isValidNickname(nickname)) {
      error = $_('auth.errors.invalid_nickname');
      return;
    }
    busy = true;
    const result = await getSecurityQuestion(nickname);
    busy = false;
    if (result.ok) {
      view = 'recover-reset';
      // Dos formas posibles según cuándo se creó la cuenta:
      //   - 'custom' (todas las nuevas): la pregunta la escribió el usuario y
      //     viene en `securityQuestionText`; se muestra tal cual.
      //   - una clave antigua ('siblings', 'pets_count'…): hay que traducirla.
      // Sin esta distinción, a los usuarios nuevos les salía la palabra
      // "custom" en pantalla en vez de su pregunta.
      recoveredQuestion = result.securityQuestion === 'custom'
        ? (result.securityQuestionText || '')
        : traducirPreguntaAntigua(result.securityQuestion);
    } else {
      error = $_(result.error);
    }
  };

  let recoveredQuestion = '';

  const traducirPreguntaAntigua = (clave) => {
    const conocida = LEGACY_SECURITY_QUESTIONS.find((q) => q.key === clave);
    return conocida ? $_(conocida.i18nKey) : clave || '';
  };

  const submitRecoverReset = async () => {
    error = '';
    message = '';
    busy = true;
    const verify = await verifySecurityAnswer(nickname, securityAnswer);
    if (!verify.ok) {
      busy = false;
      error = $_(verify.error);
      return;
    }
    const result = await resetPassword(verify.resetToken, newPassword);
    busy = false;
    if (result.ok) {
      message = $_('auth.password_reset_ok');
      setTimeout(() => close(), 900);
    } else {
      error = $_(result.error);
    }
  };

  // ── Logout ──
  const handleLogout = () => {
    logout();
    message = $_('auth.logged_out');
    setTimeout(() => close(), 700);
  };
</script>

{#if $isAuthenticated === false || $isAuthenticated}
  <div class="auth-modal" role="presentation" on:click={close}>
    <div
      class="auth-modal__panel"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="auth-title"
      on:click|stopPropagation
      on:keydown={(e) => e.key === 'Escape' && close()}
    >
      <button class="auth-modal__close" type="button" aria-label={$_('auth.close')} on:click={close}>
        <span class="icon-cross" aria-hidden="true"></span>
      </button>

      {#if $isAuthenticated && view === 'login'}
        <!-- PERFIL LOGUEADO -->
        <p class="auth-modal__eyebrow">{$_('auth.signed_in')}</p>
        <h2 id="auth-title" class="auth-modal__title">{$currentUser?.nickname}</h2>
        <p class="auth-modal__lead">{$_('auth.profile_lead')}</p>
        <dl class="auth-modal__meta">
          <div>
            <dt>{$_('auth.member_since')}</dt>
            <dd>{new Date($currentUser?.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
        <button class="auth-modal__primary" type="button" on:click={handleLogout}>
          {$_('auth.logout')}
        </button>
        {#if message}
          <p class="auth-modal__message auth-modal__message--ok">{message}</p>
        {/if}
      {:else if view === 'login'}
        <!-- LOGIN -->
        <p class="auth-modal__eyebrow">{$_('auth.welcome')}</p>
        <h2 id="auth-title" class="auth-modal__title">{$_('auth.login_title')}</h2>
        <form on:submit|preventDefault={submitLogin} class="auth-form">
          <label class="auth-field">
            <span>{$_('auth.nickname')}</span>
            <input
              type="text"
              bind:value={nickname}
              autocomplete="username"
              autocapitalize="off"
              spellcheck="false"
              required
              minlength="3"
              maxlength="24"
              disabled={busy}
            />
          </label>
          <label class="auth-field">
            <span>{$_('auth.password')}</span>
            <input
              type="password"
              bind:value={password}
              autocomplete="current-password"
              required
              minlength="6"
              disabled={busy}
            />
          </label>
          <button class="auth-modal__primary" type="submit" disabled={busy}>
            {busy ? $_('auth.working') : $_('auth.login_action')}
          </button>
        </form>
        <div class="auth-modal__footer">
          <button class="auth-modal__link" type="button" on:click={() => switchView('recover-question')}>
            {$_('auth.forgot_password')}
          </button>
          <span class="auth-modal__sep">·</span>
          <button class="auth-modal__link" type="button" on:click={() => switchView('register')}>
            {$_('auth.no_account')}
          </button>
        </div>
        {#if error}<p class="auth-modal__message auth-modal__message--err">{error}</p>{/if}
      {:else if view === 'register'}
        <!-- REGISTER -->
        <p class="auth-modal__eyebrow">{$_('auth.create_account')}</p>
        <h2 id="auth-title" class="auth-modal__title">{$_('auth.register_title')}</h2>
        <form on:submit|preventDefault={submitRegister} class="auth-form">
          <label class="auth-field">
            <span>{$_('auth.nickname')}</span>
            <input
              type="text"
              bind:value={nickname}
              autocomplete="username"
              autocapitalize="off"
              spellcheck="false"
              required
              minlength="3"
              maxlength="24"
              disabled={busy}
            />
            <small class="auth-field__hint">{$_('auth.nickname_hint')}</small>
          </label>
          <label class="auth-field">
            <span>{$_('auth.password')}</span>
            <input
              type="password"
              bind:value={password}
              autocomplete="new-password"
              required
              minlength="6"
              disabled={busy}
            />
          </label>
          <!-- Tipo de cuenta. Un predicador es un usuario normal más las
               herramientas de predicación: no pierde nada, así que se puede
               cambiar después sin consecuencias. -->
          <fieldset class="auth-field auth-usertype">
            <legend>{$_('auth.user_type')}</legend>
            <div class="auth-usertype__options">
              {#each USER_TYPES as tipo}
                <label class="auth-usertype__option" class:auth-usertype__option--active={userType === tipo}>
                  <input type="radio" name="userType" value={tipo} bind:group={userType} disabled={busy} />
                  <span class="auth-usertype__name">{$_(`auth.user_type_${tipo}`)}</span>
                  <span class="auth-usertype__hint">{$_(`auth.user_type_${tipo}_hint`)}</span>
                </label>
              {/each}
            </div>
          </fieldset>

          <!-- La pregunta la escribe el usuario. Antes se elegía de una lista
               de cinco y mucha gente acababa compartiendo la misma. -->
          <label class="auth-field">
            <span>{$_('auth.security_question')}</span>
            <input
              type="text"
              bind:value={customQuestion}
              maxlength="120"
              placeholder={$_('auth.custom_question_placeholder')}
              required
              disabled={busy}
            />
            <small class="auth-field__hint">{$_('auth.security_question_help')}</small>
          </label>
          <label class="auth-field">
            <span>{$_('auth.security_answer')}</span>
            <input
              type="text"
              bind:value={securityAnswer}
              maxlength="100"
              required
              placeholder={$_('auth.security_answer_hint')}
              disabled={busy}
            />
            <small class="auth-field__hint">{$_('auth.security_answer_help')}</small>
          </label>

          <!-- Email opcional de verdad: sin asterisco, sin `required`, y el
               texto lo dice. No se vuelve a pedir más adelante. -->
          <label class="auth-field">
            <span>{$_('auth.email_optional')}</span>
            <input
              type="email"
              bind:value={email}
              maxlength="254"
              autocomplete="email"
              placeholder={$_('auth.email_placeholder')}
              disabled={busy}
            />
            <small class="auth-field__hint">{$_('auth.email_help')}</small>
          </label>
          <button class="auth-modal__primary" type="submit" disabled={busy}>
            {busy ? $_('auth.working') : $_('auth.register_action')}
          </button>
        </form>
        <div class="auth-modal__footer">
          <button class="auth-modal__link" type="button" on:click={() => switchView('login')}>
            {$_('auth.have_account')}
          </button>
        </div>
        {#if error}<p class="auth-modal__message auth-modal__message--err">{error}</p>{/if}
      {:else if view === 'recover-question'}
        <!-- RECOVER STEP 1: nickname -->
        <p class="auth-modal__eyebrow">{$_('auth.recover_eyebrow')}</p>
        <h2 id="auth-title" class="auth-modal__title">{$_('auth.recover_title')}</h2>
        <form on:submit|preventDefault={submitRecoverQuestion} class="auth-form">
          <label class="auth-field">
            <span>{$_('auth.nickname')}</span>
            <input
              type="text"
              bind:value={nickname}
              autocapitalize="off"
              spellcheck="false"
              required
              minlength="3"
              maxlength="24"
              disabled={busy}
            />
          </label>
          <button class="auth-modal__primary" type="submit" disabled={busy}>
            {busy ? $_('auth.working') : $_('auth.continue')}
          </button>
        </form>
        <div class="auth-modal__footer">
          <button class="auth-modal__link" type="button" on:click={() => switchView('login')}>
            {$_('auth.back_to_login')}
          </button>
        </div>
        {#if error}<p class="auth-modal__message auth-modal__message--err">{error}</p>{/if}
      {:else if view === 'recover-reset'}
        <!-- RECOVER STEP 2: respuesta + nueva password -->
        <p class="auth-modal__eyebrow">{$_('auth.recover_eyebrow')}</p>
        <h2 id="auth-title" class="auth-modal__title">{$_('auth.recover_title')}</h2>
        <form on:submit|preventDefault={submitRecoverReset} class="auth-form">
          <p class="auth-modal__question">{$_('auth.your_question')}</p>
          <p class="auth-modal__question-text">{recoveredQuestion}</p>
          <label class="auth-field">
            <span>{$_('auth.security_answer')}</span>
            <input
              type="text"
              bind:value={securityAnswer}
              maxlength="100"
              required
              placeholder={$_('auth.security_answer_hint')}
              disabled={busy}
            />
          </label>
          <label class="auth-field">
            <span>{$_('auth.new_password')}</span>
            <input
              type="password"
              bind:value={newPassword}
              autocomplete="new-password"
              required
              minlength="6"
              disabled={busy}
            />
          </label>
          <button class="auth-modal__primary" type="submit" disabled={busy}>
            {busy ? $_('auth.working') : $_('auth.reset_password')}
          </button>
        </form>
        <div class="auth-modal__footer">
          <button class="auth-modal__link" type="button" on:click={() => switchView('login')}>
            {$_('auth.back_to_login')}
          </button>
        </div>
        {#if error}<p class="auth-modal__message auth-modal__message--err">{error}</p>{/if}
      {/if}
      {#if message && view !== 'login'}
        <p class="auth-modal__message auth-modal__message--ok">{message}</p>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  .auth-modal {
    position: fixed;
    inset: 0;
    z-index: 110;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 100dvh;
    background: var(--color-scrim);
    backdrop-filter: blur(3px);
    overflow-y: auto;
  }

  .auth-modal__panel {
    position: relative;
    display: grid;
    gap: 0.85rem;
    width: min(26rem, 100%);
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    padding: 1.5rem 1.4rem;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-line);
    border-radius: 0.6rem;
    box-shadow: var(--box-shadow-down);
    color: var(--color-ink);
  }

  .auth-modal__close {
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
    cursor: pointer;
    transition: var(--transition);

    .icon-cross {
      position: relative;
      width: 0.85rem;
      height: 0.85rem;
      &::before, &::after {
        content: '';
        position: absolute;
        inset: 50% 0 auto 0;
        height: 1.5px;
        background: currentcolor;
      }
      &::before { transform: translateY(-50%) rotate(45deg); }
      &::after { transform: translateY(-50%) rotate(-45deg); }
    }

    &:hover, &:focus-visible {
      border-color: var(--color-blue);
      background: var(--wash-accent);
    }
  }

  .auth-modal__eyebrow {
    margin: 0;
    color: var(--color-blue);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .auth-modal__title {
    margin: 0;
    font-size: 1.4rem;
    line-height: 1.2;
  }

  .auth-modal__lead {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-ink-soft);
  }

  .auth-modal__meta {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem;
    background: var(--wash-subtle);
    list-style: none;

    div { display: grid; gap: 0.1rem; }
    dt {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--color-ink-soft);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    dd { margin: 0; font-size: 0.85rem; font-weight: 600; }
  }

  .auth-modal__question {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-ink-soft);
    letter-spacing: 0.04em;
  }
  .auth-modal__question-text {
    margin: 0 0 0.25rem;
    padding: 0.5rem 0.65rem;
    background: var(--wash-accent);
    border-radius: 0.3rem;
    font-weight: 600;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  // ── Tipo de cuenta ────────────────────────────────────────────────────────
  // Dos tarjetas y no un desplegable: son sólo dos opciones y cada una necesita
  // una línea de explicación para que se entienda la diferencia sin abrir nada.
  .auth-usertype {
    margin: 0;
    padding: 0;
    border: 0;

    legend {
      padding: 0 0 0.3rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-bg-dark);
    }
  }

  .auth-usertype__options {
    display: grid;
    gap: 0.45rem;
  }

  .auth-usertype__option {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: baseline;
    gap: 0.15rem 0.55rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);

    input {
      grid-row: span 2;
      align-self: center;
      min-height: 0;
      margin: 0;
      accent-color: var(--color-accent);
    }

    &:hover {
      border-color: var(--color-accent);
    }

    &--active {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 8%, transparent);
    }

    &:focus-within {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .auth-usertype__name {
    font-weight: 600;
    color: var(--color-bg-dark);
  }

  .auth-usertype__hint {
    grid-column: 2;
    font-size: var(--font-size-tiny);
    line-height: 1.35;
    color: var(--color-ink-soft);
  }

  .auth-field {
    display: grid;
    gap: 0.3rem;
    font-size: 0.85rem;

    > span {
      font-weight: 600;
      color: var(--color-bg-dark);
    }

    // Ya no hay ningún `select` en este formulario: la pregunta de seguridad se
    // elegía de una lista y ahora la escribe el usuario.
    input {
      min-height: 2.5rem;
      padding: 0.45rem 0.65rem;
      border: 1px solid var(--color-line-strong);
      border-radius: 0.3rem;
      background: var(--color-field);
      color: var(--color-ink);
      font: inherit;
      font-size: 0.95rem;
      transition: var(--transition);

      &:focus-visible {
        outline: none;
        border-color: var(--color-blue);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
      }
    }
  }

  .auth-field__hint {
    font-size: 0.75rem;
    color: var(--color-ink-soft);
  }

  .auth-modal__primary {
    min-height: 2.6rem;
    border: 0;
    border-radius: 0.3rem;
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: var(--transition);

    &:hover:not(:disabled), &:focus-visible:not(:disabled) {
      background: var(--color-blue-hover);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .auth-modal__footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
  }

  .auth-modal__sep {
    color: color-mix(in srgb, var(--color-bg-dark) 35%, transparent);
  }

  .auth-modal__link {
    background: none;
    border: 0;
    padding: 0.25rem 0.4rem;
    color: var(--color-blue);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.2em;

    &:hover, &:focus-visible {
      color: var(--color-blue-hover);
    }
  }

  .auth-modal__message {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 0.3rem;
    font-size: 0.85rem;
    font-weight: 600;

    &--ok {
      background: var(--color-success-wash);
      color: var(--color-success-ink);
    }
    &--err {
      background: var(--color-danger-wash);
      color: var(--color-danger-ink);
    }
  }


  // ── Cristal ───────────────────────────────────────────────────────────
  // El fondo opaco de la regla de arriba es la base y se queda: si el
  // navegador no desenfoca, el texto se lee sobre color sólido en vez de
  // sobre el contenido de la página. La transparencia sólo entra donde hay
  // desenfoque real.
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .auth-modal__panel {
      background: var(--glass-tint);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      border-color: var(--glass-line);
    }
  }
</style>
