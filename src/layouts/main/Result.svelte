<script>
  import { filter } from "../../store/stores";
  import { getFilterResult } from "../../services/filter.service";

  export let bible;

  let result;

  filter.subscribe((e) => {
    result = getFilterResult(bible, e);
  });
</script>

<div class="result">
  <!-- Resultado Búsqueda {JSON.stringify(result)} -->
  <h4>REZULTATUL CAUTARII:</h4>

  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at,
      nesciunt dicta consectetur in veritatis itaque voluptas voluptatem
      doloremque distinctio aliquam quis ad perferendis hic, eius asperiores
      iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
</div>

<style>
  .result {
    padding: 2rem 6rem 4rem;
    background-color: #ffffff;
    flex-direction: column;

    border-radius: 0.3rem;
    box-shadow: 0 0 0.3rem 0px rgb(122 122 122 / 45%);
    border-top: 0.3rem solid rgb(45 150 205);
    border-bottom: 0.3rem solid rgb(45 150 205);
    margin: auto;
  }

  .divider {
    border-top: solid 1px #c3c3c3;
    margin: 0 10rem;
  }

  .verse {
    padding: 0.5rem 2rem;
  }
</style>
