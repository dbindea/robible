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
  import { SECURITY_QUESTIONS, validators } from '../../services/auth.service';
  import { onMount } from 'svelte';

  // Vistas: 'login' | 'register' | 'recover-question' | 'recover-reset'
  let view = 'login';
  let message = '';
  let error = '';
  let busy = false;
  let nickname = '';
  let password = '';
  let securityQuestion = SECURITY_QUESTIONS[0].key;
  let customQuestion = '';
  let securityAnswer = '';
  let newPassword = '';

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
    const finalQuestion = securityQuestion === 'custom' ? customQuestion.trim() : securityQuestion;
    const result = await register({
      nickname,
      password,
      securityQuestion: finalQuestion,
      securityAnswer,
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
      // Guardamos la pregunta resuelta en una variable local
      recoveredQuestion = result.securityQuestion;
    } else {
      error = $_(result.error);
    }
  };

  let recoveredQuestion = '';

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
          <label class="auth-field">
            <span>{$_('auth.security_question')}</span>
            <select bind:value={securityQuestion} disabled={busy}>
              {#each SECURITY_QUESTIONS as q}
                <option value={q.key}>{$_(q.i18nKey)}</option>
              {/each}
              <option value="custom">{$_('auth.custom_question')}</option>
            </select>
            {#if securityQuestion === 'custom'}
              <input
                type="text"
                bind:value={customQuestion}
                maxlength="120"
                placeholder={$_('auth.custom_question_placeholder')}
                required
                disabled={busy}
              />
            {/if}
          </label>
          <label class="auth-field">
            <span>{$_('auth.security_answer')}</span>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              bind:value={securityAnswer}
              maxlength="6"
              required
              placeholder={$_('auth.security_answer_hint')}
              disabled={busy}
            />
            <small class="auth-field__hint">{$_('auth.security_answer_help')}</small>
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
              inputmode="numeric"
              pattern="[0-9]*"
              bind:value={securityAnswer}
              maxlength="6"
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
    background: rgb(0 0 0 / 50%);
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
    background: var(--color-white);
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 10%, transparent);
    border-radius: 0.6rem;
    box-shadow: var(--box-shadow-down);
    color: var(--color-bg-dark);
  }

  .auth-modal__close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 18%, transparent);
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
      background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
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
    color: color-mix(in srgb, var(--color-bg-dark) 65%, transparent);
  }

  .auth-modal__meta {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0.5rem 0.65rem;
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 10%, transparent);
    border-radius: 0.3rem;
    background: color-mix(in srgb, var(--color-bg-dark) 4%, var(--color-white));
    list-style: none;

    div { display: grid; gap: 0.1rem; }
    dt {
      font-size: 0.7rem;
      font-weight: 600;
      color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
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
    color: color-mix(in srgb, var(--color-bg-dark) 65%, transparent);
    letter-spacing: 0.04em;
  }
  .auth-modal__question-text {
    margin: 0 0 0.25rem;
    padding: 0.5rem 0.65rem;
    background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
    border-radius: 0.3rem;
    font-weight: 600;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .auth-field {
    display: grid;
    gap: 0.3rem;
    font-size: 0.85rem;

    > span {
      font-weight: 600;
      color: var(--color-bg-dark);
    }

    input, select {
      min-height: 2.5rem;
      padding: 0.45rem 0.65rem;
      border: 1px solid color-mix(in srgb, var(--color-bg-dark) 18%, transparent);
      border-radius: 0.3rem;
      background: var(--color-white);
      color: var(--color-bg-dark);
      font: inherit;
      font-size: 0.95rem;
      transition: var(--transition);

      &:focus-visible {
        outline: none;
        border-color: var(--color-blue);
        box-shadow: 0 0 0 3px rgb(45 150 205 / 18%);
      }
    }

    select { padding-right: 2rem; }
  }

  .auth-field__hint {
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
  }

  .auth-modal__primary {
    min-height: 2.6rem;
    border: 0;
    border-radius: 0.3rem;
    background: var(--color-blue);
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
      background: rgb(40 167 69 / 14%);
      color: rgb(20 110 45);
    }
    &--err {
      background: rgb(220 53 69 / 14%);
      color: rgb(150 25 40);
    }
  }

  // Dark mode
  :global(html[data-theme='dark']) .auth-modal__panel {
    background: #1a2733;
    color: #e5edf3;
    border-color: rgb(255 255 255 / 8%);
  }
  :global(html[data-theme='dark']) .auth-modal__close {
    border-color: rgb(255 255 255 / 18%);
    color: #ffffff;
  }
  :global(html[data-theme='dark']) .auth-modal__meta {
    background: rgb(255 255 255 / 4%);
    border-color: rgb(255 255 255 / 8%);
    dt { color: rgb(255 255 255 / 55%); }
    dd { color: #ffffff; }
  }
  :global(html[data-theme='dark']) .auth-modal__question-text {
    background: rgb(45 150 205 / 16%);
    color: #ffffff;
  }
  :global(html[data-theme='dark']) .auth-modal__lead {
    color: rgb(255 255 255 / 60%);
  }
  :global(html[data-theme='dark']) .auth-field {
    > span { color: #ffffff; }
    input, select {
      background: #243442;
      border-color: rgb(255 255 255 / 12%);
      color: #ffffff;
    }
  }
  :global(html[data-theme='dark']) .auth-field__hint {
    color: rgb(255 255 255 / 50%);
  }
  :global(html[data-theme='dark']) .auth-modal__message--ok {
    background: rgb(40 167 69 / 18%);
    color: #7ee79a;
  }
  :global(html[data-theme='dark']) .auth-modal__message--err {
    background: rgb(220 53 69 / 18%);
    color: #ff8b95;
  }
</style>
