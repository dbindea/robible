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
    solicitarCorreoRecuperacion,
    resetPassword,
    nombreVisible,
    apodoSecundario,
  } from '../../store/authStore';
  import { closeAuthMenu, tokenRecuperacion } from '../../store/authMenuStore';
  import { LEGACY_SECURITY_QUESTIONS, USER_TYPES, validators } from '../../services/auth.service';
  import { onMount } from 'svelte';

  // Vistas: 'login' | 'register' | 'recover-question' | 'recover-reset'
  //       | 'recover-sent' (ya se mandó el correo) | 'recover-link' (se llegó
  //         desde el enlace del correo y toca escribir la contraseña nueva)
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
  // Si la cuenta tiene correo, la pantalla 2 ofrece además el enlace por email.
  let tieneCorreo = false;
  let pistaCorreo = '';

  // ── Llegada desde el enlace del correo ──────────────────────────────────
  //
  // Se comprueba `$tokenRecuperacion` directamente y no a través de un helper:
  // envuelto en una función, el compilador no ve la dependencia y la pantalla no
  // se repinta (CLAUDE.md, trampa 23).
  $: if ($tokenRecuperacion && view !== 'recover-link') {
    view = 'recover-link';
    error = '';
    message = '';
  }

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
    // Soltar el token del correo al salir de su pantalla es obligatorio, no
    // limpieza: el bloque reactivo de arriba devuelve la vista a
    // 'recover-link' mientras valga algo, así que sin esto el botón «volver a
    // iniciar sesión» no haría nada visible.
    if (next !== 'recover-link') tokenRecuperacion.set('');
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
    // `isValidIdentifier` y no `isValidNickname`: el campo acepta también el
    // correo, y con el validador de apodos la `@` se rechazaba AQUÍ, sin llegar
    // nunca al servidor.
    if (!validators.isValidIdentifier(nickname)) {
      error = $_('auth.errors.invalid_identifier');
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
    if (!validators.isValidIdentifier(nickname)) {
      error = $_('auth.errors.invalid_identifier');
      return;
    }
    busy = true;
    const result = await getSecurityQuestion(nickname);
    busy = false;
    if (result.ok) {
      view = 'recover-reset';
      tieneCorreo = !!result.hasEmail;
      pistaCorreo = result.emailHint || '';
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

  // ── Recuperar por correo ──
  //
  // Sólo se ofrece cuando la cuenta tiene dirección (`tieneCorreo`): el worker
  // responde lo mismo en todos los casos para no delatar qué cuentas existen,
  // así que sin esta comprobación el botón podría prometer un correo que nadie
  // va a mandar.
  const pedirCorreo = async () => {
    error = '';
    message = '';
    busy = true;
    const result = await solicitarCorreoRecuperacion(nickname);
    busy = false;
    if (result.ok) {
      view = 'recover-sent';
    } else {
      error = $_(result.error);
    }
  };

  // ── Contraseña nueva desde el enlace del correo ──
  const submitRecoverLink = async () => {
    error = '';
    message = '';
    if (!validators.isValidPassword(newPassword)) {
      error = $_('auth.errors.invalid_password');
      return;
    }
    busy = true;
    const result = await resetPassword($tokenRecuperacion, newPassword);
    busy = false;
    if (result.ok) {
      message = $_('auth.password_reset_ok');
      setTimeout(() => close(), 1200);
    } else {
      error = $_(result.error);
    }
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
        <h2 id="auth-title" class="auth-modal__title">{nombreVisible($currentUser)}</h2>
        {#if apodoSecundario($currentUser)}
          <p class="auth-modal__apodo">@{apodoSecundario($currentUser)}</p>
        {/if}
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
          <!-- Un solo campo para las dos cosas: la persona escribe lo que
               recuerda. El `maxlength` tiene que dar para una dirección
               entera (254), no para un apodo (24). -->
          <label class="auth-field">
            <span>{$_('auth.identifier')}</span>
            <input
              type="text"
              bind:value={nickname}
              autocomplete="username"
              autocapitalize="off"
              spellcheck="false"
              required
              minlength="3"
              maxlength="254"
              disabled={busy}
            />
            <small class="auth-field__hint">{$_('auth.identifier_hint')}</small>
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
            <span>{$_('auth.identifier')}</span>
            <!-- `autocomplete` para que el gestor de contraseñas ofrezca lo
                 guardado también aquí: quien recupera la cuenta suele recordar
                 el correo pero no el apodo. -->
            <input
              type="text"
              bind:value={nickname}
              autocomplete="username"
              autocapitalize="off"
              spellcheck="false"
              required
              minlength="3"
              maxlength="254"
              disabled={busy}
            />
            <small class="auth-field__hint">{$_('auth.identifier_hint')}</small>
          </label>
          <button class="auth-modal__primary" type="submit" disabled={busy}>
            {busy ? $_('auth.working') : $_('auth.continue')}
          </button>
        </form>
        <!-- Última salida, ya sólo para quien no tiene correo en la cuenta Y no
             recuerda su respuesta de seguridad: entonces sigue haciendo falta
             hacerlo a mano contra la base de datos. Decirlo aquí evita que se dé
             por perdido y cree otra cuenta. -->
        <p class="auth-modal__rescue">
          {$_('auth.recover_manual')}
          <a href="mailto:dbindea@gmail.com?subject=RoBible%20-%20recuperare%20cont">dbindea@gmail.com</a>
        </p>
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

        <!-- El otro camino, para quien no recuerda la respuesta: un enlace al
             correo de la cuenta. Sólo aparece si hay dirección guardada. -->
        {#if tieneCorreo}
          <div class="auth-modal__alternativa">
            <span class="auth-modal__o">{$_('auth.recover_or')}</span>
            <button class="auth-modal__secundario" type="button" disabled={busy} on:click={pedirCorreo}>
              {busy ? $_('auth.recover_email_sending') : $_('auth.recover_by_email')}
            </button>
            {#if pistaCorreo}
              <p class="auth-modal__pista">{$_('auth.recover_email_hint', { email: pistaCorreo })}</p>
            {/if}
          </div>
        {/if}

        <div class="auth-modal__footer">
          <button class="auth-modal__link" type="button" on:click={() => switchView('login')}>
            {$_('auth.back_to_login')}
          </button>
        </div>
        {#if error}<p class="auth-modal__message auth-modal__message--err">{error}</p>{/if}
      {:else if view === 'recover-sent'}
        <!-- RECOVER por correo: ya se mandó -->
        <p class="auth-modal__eyebrow">{$_('auth.recover_eyebrow')}</p>
        <h2 id="auth-title" class="auth-modal__title">{$_('auth.recover_email_sent_title')}</h2>
        <p class="auth-modal__lead">{$_('auth.recover_email_sent')}</p>
        <p class="auth-modal__lead">{$_('auth.recover_email_spam')}</p>
        <div class="auth-modal__footer">
          <button class="auth-modal__link" type="button" on:click={() => switchView('login')}>
            {$_('auth.back_to_login')}
          </button>
        </div>
        {#if error}<p class="auth-modal__message auth-modal__message--err">{error}</p>{/if}
      {:else if view === 'recover-link'}
        <!-- RECOVER por correo: se llegó desde el enlace, toca la contraseña.
             Esta rama va después de la del perfil en la cadena de {#if}, pero
             se alcanza igual con la sesión abierta porque esa primera exige
             `view === 'login'`. Hace falta: si alguien pincha el enlace en el
             dispositivo donde ya está dentro, tiene que poder cambiarla. -->
        <p class="auth-modal__eyebrow">{$_('auth.recover_eyebrow')}</p>
        <h2 id="auth-title" class="auth-modal__title">{$_('auth.recover_link_title')}</h2>
        <p class="auth-modal__lead">{$_('auth.recover_link_lead')}</p>
        <form on:submit|preventDefault={submitRecoverLink} class="auth-form">
          <label class="auth-field">
            <span>{$_('auth.new_password')}</span>
            <input
              type="password"
              bind:value={newPassword}
              autocomplete="new-password"
              required
              minlength="6"
              maxlength="128"
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

  /* El apodo bajo el nombre. Sólo aparece cuando hay nombre puesto: si no, el
     título ya ES el apodo. */
  .auth-modal__apodo {
    margin: -0.15rem 0 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
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

  // ── El otro camino de recuperación ────────────────────────────────────────
  // Separado con un filete y un «o» para que se lea como una alternativa y no
  // como el siguiente paso del formulario de arriba.
  .auth-modal__alternativa {
    display: grid;
    gap: 0.5rem;
    justify-items: center;
    padding-top: 0.85rem;
    border-top: 1px solid var(--color-line);
  }

  .auth-modal__o {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-soft);
  }

  // Botón de acción secundaria: contorno en vez de relleno. El relleno de
  // acento es del botón principal de cada pantalla y tener dos iguales deja sin
  // saber cuál es el camino normal.
  .auth-modal__secundario {
    width: 100%;
    min-height: 2.6rem;
    border: 1px solid var(--color-accent);
    border-radius: 0.3rem;
    background: transparent;
    color: var(--color-accent-ink);
    font: inherit;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: var(--transition);

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
      background: var(--wash-accent);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .auth-modal__pista {
    margin: 0;
    font-size: 0.78rem;
    color: var(--color-ink-soft);
    text-align: center;
    word-break: break-word;
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

  .auth-modal__rescue {
    margin: 0.85rem 0 0;
    padding-top: 0.85rem;
    border-top: 1px solid var(--color-line);
    color: var(--color-ink-soft);
    font-size: 0.8rem;
    line-height: 1.5;
    text-align: center;

    a {
      color: var(--color-accent-ink);
      font-weight: 600;
      // Enlace dentro de una frase: la norma de 24 px exime los objetivos en
      // línea, y forzarle altura rompería el flujo del texto (WCAG 2.5.8).
      word-break: break-word;
    }
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
