<div class="header">
  <h2 class="logo"><img class="logo-img" src="assets/img/logo.png" alt="" /> Biblia</h2>
  <select class="select" name="version" id="version">
    <option class="select__option" value="vdc" selected>Cornilescu - VDC</option>
    <option class="select__option" value="ntr">Noua Traducere - NTR</option>
  </select>
</div>

<style>
  .header {
    height: 5rem;
    box-shadow: var(--box-shadow-down);
    align-items: center;
    padding: 0 10rem 0 5rem;
    justify-content: space-between;
  }

  .select {
    background: var(--color-blue);
    color: var(--color-white);
    border: 0.1rem var(--border-blue);
    height: var(--button-height);
    font-family: 'Open Sans';
    padding: 0 1.2rem;
  }

  .select__option {
    background: var(--color-white);
    color: var(--color-text-dark);
    font-size: var(--font-default-size);
  }

  .logo-img {
    height: 2.5rem;
  }

  .logo {
    align-items: center;
    display: flex;
    gap: 0.5rem;
  }
</style>
