<script>
  import { filter } from '../../store/stores';
  import { getFilterResult } from '../../services/filter.service';

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
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
  <div class="verse">
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat at, nesciunt dicta consectetur in veritatis itaque voluptas voluptatem doloremque
      distinctio aliquam quis ad perferendis hic, eius asperiores iure laboriosam id.
    </p>
  </div>
  <div class="divider" />
</div>

<style>
  .result {
    padding: 2rem 6rem 4rem;
    background-color: var(--color-white);
    flex-direction: column;

    border-radius: 0.3rem;
    box-shadow: var(--box-shadow-up);
    border-top: 0.3rem var(--border-blue);
    border-bottom: 0.3rem var(--border-blue);
    margin: auto;
  }

  .divider {
    border-top: 0.1rem var(--border-gray);
    margin: 0 10rem;
  }

  .verse {
    padding: 0.5rem 2rem;
  }
</style>
