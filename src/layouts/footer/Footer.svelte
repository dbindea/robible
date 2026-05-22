<script>
  import { _ } from '../../services/i18n.service';
</script>

<div class="footer">
  <span>{$_('app.footer.text')}</span>
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
    justify-content: center;
    background-color: var(--color-white);
  }

  @media (max-width: 32rem) {
    .footer {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
