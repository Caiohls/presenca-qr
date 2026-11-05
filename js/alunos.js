const Alunos = (() => {
  let cache = [];

  async function carregar() {
    cache = (await DB.todos('alunos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    render();
    return cache;
  }

  function render() {
    document.getElementById('count-alunos').textContent = cache.length;
    if (!document.getElementById('tab-alunos').classList.contains('active')) return;
    const termo = document.getElementById('busca').value.trim().toLowerCase();
    const lista = cache.filter((a) => !termo || a.nome.toLowerCase().includes(termo) || a.ra.includes(termo));
    document.getElementById('tb-alunos').innerHTML = lista.map((a) => `
      <tr>
        <td>${window.qrcode ? `<img src="${Codigo.imagem(a.ra, 2)}" alt="QR de ${Fmt.esc(a.nome)}">` : ''}</td>
        <td>${Fmt.esc(a.ra)}</td>
        <td>${Fmt.esc(a.nome)}</td>
        <td>${Fmt.esc(a.curso)}</td>
        <td class="acoes"><button class="btn sm" data-baixar="${Fmt.esc(a.ra)}">Baixar QR</button>
          <button class="btn sm danger" data-remover="${Fmt.esc(a.ra)}">Remover</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="hint">Nenhum aluno cadastrado.</td></tr>';
  }

  async function salvar(aluno) {
    const ra = String(aluno.ra ?? '').replace(/\D/g, '');
    const nome = String(aluno.nome ?? '').trim();
    if (!ra || !nome) return false;
    await DB.salvar('alunos', { ra, nome, curso: String(aluno.curso ?? '').trim() });
    return true;
  }

  async function importar(arquivo) {
    const wb = XLSX.read(await arquivo.arrayBuffer());
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const pega = (linha, nome) => {
      const k = Object.keys(linha).find((c) => c.trim().toLowerCase() === nome);
      return k ? linha[k] : '';
    };
    let ok = 0;
    for (const l of linhas) {
      if (await salvar({ ra: pega(l, 'ra'), nome: pega(l, 'nome'), curso: pega(l, 'curso') })) ok++;
    }
    await carregar();
    return { ok, total: linhas.length };
  }

  function carregarImagem(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }

  async function gerarPng(aluno) {
    const qr = await carregarImagem(Codigo.imagem(aluno.ra, 10));
    const largura = Math.max(qr.width + 80, 420);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = qr.height + 150;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qr, (largura - qr.width) / 2, 30);
    ctx.fillStyle = '#1b2330';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(aluno.nome, largura / 2, qr.height + 75, largura - 40);
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText(`RA ${aluno.ra}`, largura / 2, qr.height + 110);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  function nomeArquivo(aluno) {
    const nome = aluno.nome.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
    return `${aluno.ra}_${nome}.png`;
  }

  function salvarArquivo(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function baixar(ra) {
    const aluno = buscar(ra);
    if (aluno && await Ui.exigirLib('qr')) salvarArquivo(await gerarPng(aluno), nomeArquivo(aluno));
  }

  async function baixarTodos() {
    if (!cache.length) return Ui.status('Nenhum aluno cadastrado.');
    if (!(await Ui.exigirLib('qr')) || !(await Ui.exigirLib('zip'))) return;
    const zip = new JSZip();
    for (const a of cache) zip.file(nomeArquivo(a), await gerarPng(a));
    salvarArquivo(await zip.generateAsync({ type: 'blob' }), 'qrcodes_alunos.zip');
  }

  function buscar(ra) {
    return cache.find((a) => a.ra === ra);
  }

  function iniciar() {
    document.getElementById('form-aluno').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (await salvar(Object.fromEntries(new FormData(f)))) {
        f.reset();
        f.ra.focus();
        await carregar();
        await Leitor.atualizarPainel();
      }
    });
    document.getElementById('file-import').addEventListener('change', async (e) => {
      const arq = e.target.files[0];
      if (!arq) return;
      if (await Ui.exigirLib('xlsx')) {
        const r = await importar(arq);
        await Leitor.atualizarPainel();
        Ui.status(`${r.ok} de ${r.total} alunos importados.`);
      }
      e.target.value = '';
    });
    document.getElementById('busca').addEventListener('input', render);
    document.getElementById('btn-baixar-todos').addEventListener('click', baixarTodos);
    document.getElementById('tb-alunos').addEventListener('click', async (e) => {
      if (e.target.dataset.baixar) return baixar(e.target.dataset.baixar);
      const ra = e.target.dataset.remover;
      if (ra && await Ui.confirmar({ titulo: 'Remover aluno?', texto: `RA ${ra}`, acao: 'Remover', perigo: true })) {
        await DB.remover('alunos', ra);
        await carregar();
        await Leitor.atualizarPainel();
      }
    });
  }

  return { iniciar, carregar, render, salvar, buscar, get lista() { return cache; } };
})();
