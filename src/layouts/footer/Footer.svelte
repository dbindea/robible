<script>
  import { _ } from 'svelte-i18n';
  import { setupI18n } from '../../services/i18n.service';

  const changeLang = (lang) => {
    setupI18n({ withLocale: lang });
    localStorage.setItem('lang', lang);
  };
</script>

<div class="footer">
  <h4>{$_('app.footer.title')}</h4>
  <div class="lang">
    <img class="flag" src="assets/img/ro.svg" alt="ro" on:click={() => changeLang('ro')} />
    <img class="flag" src="assets/img/es.svg" alt="es" on:click={() => changeLang('es')} />
  </div>
</div>

<style>
  .footer {
    height: 4rem;
    box-shadow: var(--box-shadow-up);
    align-items: center;
    padding: 0 10rem 0 5rem;
    display: flex;
    color: var(--color-bg-dark);
    justify-content: space-between;
  }

  .lang {
    display: flex;
    gap: 1rem;
  }
  .flag {
    cursor: pointer;
    height: 1.2rem;
    object-fit: fill;
  }
</style>
