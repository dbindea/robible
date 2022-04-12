<script>
  import { _ } from 'svelte-i18n';
</script>

<div class="footer">
  <h4>{$_('app.footer.title')}</h4>
</div>

<style>
  .footer {
    height: 4rem;
    box-shadow: var(--box-shadow-up);
    align-items: center;
    padding: 0 5rem;
    display: flex;
  }
</style>
