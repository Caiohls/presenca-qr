(async () => {
  const abas = document.querySelectorAll('.tabs button');
  abas.forEach((b) => b.addEventListener('click', async () => {
    abas.forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${b.dataset.tab}`));
    if (b.dataset.tab !== 'leitura') Leitor.desligarCamera();
    if (b.dataset.tab === 'relatorio') await Relatorio.render();
  }));

  function aplicarConfig() {
    const cfg = Config.get();
    document.getElementById('evento-label').textContent = cfg.evento;
    const f = document.getElementById('form-config');
    f.evento.value = cfg.evento;
    f.minimo.value = cfg.minimo;
  }

  document.getElementById('form-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    Config.set({ evento: f.evento.value.trim(), minimo: Math.max(1, parseInt(f.minimo.value, 10) || 60) });
    aplicarConfig();
    await atualizarTudo();
    alert('Configurações salvas.');
  });

  document.getElementById('btn-demo').addEventListener('click', async () => {
    if (!confirm('Isso substitui os registros de leitura atuais pelos de exemplo. Continuar?')) return;
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
    alert('Dados de exemplo carregados.');
  });

  document.getElementById('btn-backup').addEventListener('click', async () => {
    const dados = { alunos: await DB.todos('alunos'), registros: await DB.todos('registros'), config: Config.get() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    a.download = `backup_presenca_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });

  document.getElementById('file-backup').addEventListener('change', async (e) => {
    const arq = e.target.files[0];
    if (!arq) return;
    try {
      const dados = JSON.parse(await arq.text());
      await DB.salvarVarios('alunos', dados.alunos || []);
      await DB.salvarVarios('registros', dados.registros || []);
      if (dados.config) Config.set(dados.config);
      aplicarConfig();
      await atualizarTudo();
      alert('Backup restaurado.');
    } catch {
      alert('Arquivo de backup inválido.');
    }
    e.target.value = '';
  });

  document.getElementById('btn-limpar').addEventListener('click', async () => {
    if (!confirm('Apagar TODOS os alunos e registros deste aparelho?')) return;
    await DB.limpar('alunos');
    await DB.limpar('registros');
    await atualizarTudo();
  });

  async function atualizarTudo() {
    await Alunos.carregar();
    await Leitor.atualizarPainel();
    await Relatorio.render();
  }

  Alunos.iniciar();
  Leitor.iniciar();
  Relatorio.iniciar();
  aplicarConfig();
  await atualizarTudo();
})();
