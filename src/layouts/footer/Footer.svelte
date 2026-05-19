<script>
  import { _ } from '../../services/i18n.service';
  import { setupI18n } from '../../services/i18n.service';

  const changeLang = (lang) => {
    setupI18n({ withLocale: lang });
    localStorage.setItem('lang', lang);
  };
</script>

<div class="footer">
  <h4>{$_('app.footer.title')}</h4>
  <div class="lang">
    <button class="lang__button" type="button" aria-label="Romana" on:click={() => changeLang('ro')}>
      <img class="flag" src="/assets/img/ro.svg" alt="" />
    </button>
    <button class="lang__button" type="button" aria-label="Espanol" on:click={() => changeLang('es')}>
      <img class="flag" src="/assets/img/es.svg" alt="" />
    </button>
  </div>
</div>

<style>
  .footer {
    min-height: 4rem;
    box-shadow: var(--box-shadow-up);
    align-items: center;
    gap: 1rem;
    padding: 0.85rem clamp(1rem, 5vw, 5rem);
    display: flex;
    color: var(--color-bg-dark);
    justify-content: space-between;
    background-color: var(--color-white);
  }

  .footer h4 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.35;
  }

  .lang {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .lang__button {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    background: transparent;
    transition: var(--transition);
  }

  .lang__button:hover,
  .lang__button:focus-visible {
    border-color: var(--color-blue);
    box-shadow: 0 0 0 3px rgb(45 150 205 / 18%);
  }

  .flag {
    height: 1.15rem;
    max-width: 1.65rem;
    object-fit: fill;
  }

  @media (max-width: 32rem) {
    .footer {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
