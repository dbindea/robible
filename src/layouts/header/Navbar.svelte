<div class="header">
  <h2 class="logo"><img class="logo-img" src="assets/img/logo.png" alt="" /> Biblia</h2>
  <select class="select" name="version" id="version">
    <option class="select__option" value="vdc" selected>Cornilescu - VDC</option
    >
    <option class="select__option" value="ntr">Noua Traducere - NTR</option>
  </select>
</div>

<style>
  .header {
    height: 5rem;
    box-shadow: 3px 1px 12px 4px rgb(66 89 104 / 20%);
    align-items: center;
    padding: 0 10rem 0 5rem;
    justify-content: space-between;
  }

  .select {
    background: #2d96cd;
    color: #ffffff;
    border: 1px solid #2d96cd;
    height: 2rem;
    font-family: "Open Sans";
    padding: 0 1.2rem;
  }

  .select__option {
    background: #ffffff;
    color: #131313;
    font-size: 14px;
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
