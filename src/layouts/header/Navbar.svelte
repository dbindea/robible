<div class="header">
  <a class="logo" href="/" aria-label="RoBible">
    <img class="logo__img" src="/assets/img/logo.svg" alt="" width="48" height="48" />
    <span class="logo__text">Biblia</span>
  </a>

  <select class="select" name="version" id="version" aria-label="Versiunea Bibliei">
    <option class="select__option" value="vdc" selected>Cornilescu - VDC</option>
  </select>
</div>

<style lang="scss">
  .header {
    display: flex;
    min-height: 5rem;
    box-shadow: var(--box-shadow-down);
    align-items: center;
    gap: 1rem;
    padding: 0.75rem clamp(1rem, 5vw, 5rem);
    justify-content: space-between;
    background-color: var(--color-white);
    font-family: var(--font-family-base);
  }

  .select {
    background: var(--color-blue);
    color: var(--color-white);
    border: 0.1rem var(--border-blue);
    height: var(--button-height);
    max-width: 100%;
    border-radius: 0.25rem;
    padding: 0 2.2rem 0 0.8rem;
    cursor: pointer;
    outline: none;
    transition: var(--transition);

    &:hover {
      background: var(--color-blue-hover);
      border-color: var(--color-blue-hover);
    }

    &:focus-visible {
      box-shadow: 0 0 0 3px rgb(45 150 205 / 25%);
    }
  }

  .select__option {
    background: var(--color-white);
    color: var(--color-text-dark);
    font-size: var(--font-default-size);
  }

  .logo {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 0.65rem;

    &__img {
      width: 3rem;
      height: 3rem;
      flex: 0 0 auto;
    }

    &__text {
      color: var(--color-bg-dark);
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
    }
  }

  a.logo:hover {
    text-decoration: none;
  }
</style>
