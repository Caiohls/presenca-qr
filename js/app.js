(async () => {
  const el = (id) => document.getElementById(id);
  const dlgAjustes = el('dlg-ajustes');
  const abas = document.querySelectorAll('.abas button');
  let abaAtual = 'evento';

  el('splash').addEventListener('animationend', (e) => e.target.remove());

  async function renderAba() {
    if (abaAtual === 'evento') await renderEventos();
    if (abaAtual === 'relatorio') await Relatorio.render();
    if (abaAtual === 'alunos') {
      await Ui.lib('qr').catch(() => {});
      Alunos.render();
    }
  }

  abas.forEach((b) => b.addEventListener('click', async () => {
    abaAtual = b.dataset.tab;
    abas.forEach((x) => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${abaAtual}`));
    await renderAba();
  }));

  el('btn-ajustes').addEventListener('click', async () => {
    Leitor.desligarCamera();
    await renderAba();
    dlgAjustes.showModal();
  });
  dlgAjustes.addEventListener('close', () => Leitor.ligarCamera());

  function aplicarConfig() {
    const cfg = Config.get();
    el('evento-label').textContent = cfg.evento;
    const f = el('form-config');
    f.evento.value = cfg.evento;
    f.minimo.value = cfg.minimo;
  }

  async function renderEventos() {
    const atual = Config.get().evento;
    const entradas = new Map([[atual, 0]]);
    (await DB.todos('registros')).forEach((r) => entradas.set(r.evento, (entradas.get(r.evento) || 0) + 1));
    el('lista-eventos').innerHTML = [...entradas].map(([nome, n]) => `
      <li><button class="evento-item" data-evento="${Fmt.esc(nome)}"${nome === atual ? ' aria-current="true"' : ''}>
        <span>${Fmt.esc(nome)}</span><small>${n} ${n === 1 ? 'entrada' : 'entradas'}</small>
      </button></li>`).join('');
  }

  el('lista-eventos').addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-evento]');
    if (!botao) return;
    const evento = botao.dataset.evento;
    Config.set({ ...Config.get(), evento });
    aplicarConfig();
    await atualizarTudo();
    Ui.status(`Evento atual: ${evento}`);
  });

  el('form-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    Config.set({ evento: f.evento.value.trim(), minimo: Math.max(1, parseInt(f.minimo.value, 10) || 60) });
    aplicarConfig();
    await atualizarTudo();
    Ui.status('Configurações salvas.');
  });

  el('btn-demo').addEventListener('click', async () => {
    const ok = await Ui.confirmar({
      titulo: 'Carregar dados de exemplo?',
      texto: 'Isso substitui os registros de leitura atuais pelos de exemplo.',
      acao: 'Carregar',
    });
    if (!ok) return;
    await carregarExemplo();
    Ui.status('Dados de exemplo carregados.');
  });

  async function carregarExemplo() {
    await DB.limpar('registros');
    const nomes = [
      ['202210001', 'Ana Beatriz Souza', 'Engenharia de Computação'],
      ['202210002', 'Bruno Carvalho Lima', 'Engenharia Civil'],
      ['202210003', 'Carla Mendes Rocha', 'Engenharia Mecânica'],
      ['202210004', 'Diego Fernandes Alves', 'Engenharia Elétrica'],
      ['202210005', 'Eduarda Pires Nogueira', 'Engenharia de Produção'],
      ['202210006', 'Felipe Ramos Teixeira', 'Engenharia de Computação'],
      ['202210007', 'Gabriela Martins Costa', 'Engenharia Química'],
      ['202210008', 'Henrique Duarte Silva', 'Engenharia Civil'],
    ];
    await DB.salvarVarios('alunos', nomes.map(([ra, nome, curso]) => ({ ra, nome, curso })));

    const { evento } = Config.get();
    const atras = (min) => new Date(Date.now() - min * 60000).toISOString();
    const simulado = [
      ['202210001', 150, 40], ['202210002', 130, 55], ['202210003', 120, 90],
      ['202210004', 95, null], ['202210005', 80, 5], ['202210006', 45, null],
    ];
    await DB.salvarVarios('registros', simulado.map(([ra, e, s]) => ({
      ra, evento, entrada: atras(e), saida: s == null ? null : atras(s),
    })));
    await atualizarTudo();
  }

  const dlgDemo = el('dlg-demo');
  el('dlg-demo-nao').addEventListener('click', () => dlgDemo.close());
  el('dlg-demo-sim').addEventListener('click', async () => {
    dlgDemo.close();
    await carregarExemplo();
  });

  el('btn-backup').addEventListener('click', async () => {
    const dados = { alunos: await DB.todos('alunos'), registros: await DB.todos('registros'), config: Config.get() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    a.download = `backup_presenca_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });

  el('file-backup').addEventListener('change', async (e) => {
    const arq = e.target.files[0];
    if (!arq) return;
    try {
      const dados = JSON.parse(await arq.text());
      await DB.salvarVarios('alunos', dados.alunos || []);
      await DB.salvarVarios('registros', dados.registros || []);
      if (dados.config) Config.set(dados.config);
      aplicarConfig();
      await atualizarTudo();
      Ui.status('Backup restaurado.');
    } catch {
      Ui.status('Arquivo de backup inválido.');
    }
    e.target.value = '';
  });

  el('btn-limpar').addEventListener('click', async () => {
    const ok = await Ui.confirmar({
      titulo: 'Apagar todos os dados?',
      texto: 'Todos os alunos e registros deste aparelho serão apagados. Isso não pode ser desfeito.',
      acao: 'Apagar tudo',
      perigo: true,
    });
    if (!ok) return;
    await DB.limpar('alunos');
    await DB.limpar('registros');
    await atualizarTudo();
    Ui.status('Dados apagados.');
  });

  async function atualizarTudo() {
    await Alunos.carregar();
    await Leitor.atualizarPainel();
    if (dlgAjustes.open) await renderAba();
  }

  Alunos.iniciar();
  Relatorio.iniciar();
  aplicarConfig();
  await atualizarTudo();
  Leitor.iniciar();
  if (!Alunos.lista.length) dlgDemo.showModal();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
