<div class="header">
  <div>
    <a class="logo" href="/">
      <img class="logo__img" src="assets/img/logo.png" alt="" />
      <h2 class="logo__text">Biblia</h2>
    </a>
  </div>
  <select class="select" name="version" id="version">
    <option class="select__option" value="vdc" selected>Cornilescu - VDC</option>
  </select>
</div>

<style type="scss">
  .header {
    display: flex;
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
    cursor: pointer;
    outline: none;
    &:hover {
      background: var(--color-blue-hover);
      border-color: var(--color-blue-hover);
    }
  }

  .select__option {
    background: var(--color-white);
    color: var(--color-text-dark);
    font-size: var(--font-default-size);
  }

  .logo {
    display: flex;

    &__img {
      height: 2.5rem;
      margin-top: 1.5rem;
    }

    &__text {
      padding: 0.5rem;
      color: var(--color-bg-dark);
    }
  }

  a.logo:hover {
    text-decoration: none;
  }
</style>
