(() => {
  const TOTAL_POKEMON = 1025;

  const card        = document.getElementById('card');
  const prompt      = document.getElementById('prompt');
  const loading     = document.getElementById('loading');
  const pokemonView = document.getElementById('pokemon-view');
  const img         = document.getElementById('pokemon-img');
  const number      = document.getElementById('pokemon-number');
  const name        = document.getElementById('pokemon-name');
  const types       = document.getElementById('pokemon-types');

  let isFetching = false;

  async function fetchRandomPokemon() {
    if (isFetching) return;
    isFetching = true;

    prompt.classList.add('hidden');
    pokemonView.classList.add('hidden');
    loading.classList.remove('hidden');

    const id = Math.floor(Math.random() * TOTAL_POKEMON) + 1;

    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();

      const sprite =
        data.sprites.other?.['official-artwork']?.front_default ||
        data.sprites.front_default;

      img.src = sprite || '';
      img.alt = data.name;
      number.textContent = `No. ${String(data.id).padStart(4, '0')}`;
      name.textContent = data.name.replace(/-/g, ' ');

      types.innerHTML = data.types
        .map(t => `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`)
        .join('');

      loading.classList.add('hidden');
      pokemonView.classList.remove('hidden');
    } catch {
      loading.classList.add('hidden');
      prompt.classList.remove('hidden');
      prompt.textContent = '読み込みに失敗しました。もう一度クリック';
    } finally {
      isFetching = false;
    }
  }

  card.addEventListener('click', fetchRandomPokemon);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fetchRandomPokemon();
    }
  });
})();
