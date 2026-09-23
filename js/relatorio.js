const Relatorio = (() => {
  async function consolidar() {
    const { evento, minimo } = Config.get();
    const regs = (await DB.todos('registros')).filter((r) => r.evento === evento);
    return Alunos.lista.map((a) => {
      const meus = regs.filter((r) => r.ra === a.ra).sort((x, y) => x.entrada.localeCompare(y.entrada));
      const fechados = meus.filter((r) => r.saida);
      const total = fechados.reduce((s, r) => s + Fmt.minutos(r.entrada, r.saida), 0);
      let situacao;
      if (!meus.length) situacao = 'Ausente';
      else if (total >= minimo) situacao = 'Válida';
      else if (meus.some((r) => !r.saida)) situacao = 'Sem saída';
      else situacao = 'Insuficiente';
      return {
        ra: a.ra, nome: a.nome, curso: a.curso,
        entrada: meus[0]?.entrada ?? null,
        saida: fechados.at(-1)?.saida ?? null,
        minutos: fechados.length ? total : null,
        situacao,
      };
    });
  }

  const classe = { 'Válida': 'ok', 'Insuficiente': 'warn', 'Sem saída': 'warn', 'Ausente': 'err' };

  async function render() {
    document.getElementById('min-label').textContent = Config.get().minimo;
    const linhas = await consolidar();
    document.getElementById('tb-relatorio').innerHTML = linhas.map((l) => `
      <tr>
        <td>${Fmt.esc(l.ra)}</td>
        <td>${Fmt.esc(l.nome)}</td>
        <td>${Fmt.hora(l.entrada)}</td>
        <td>${Fmt.hora(l.saida)}</td>
        <td>${Fmt.duracao(l.minutos)}</td>
        <td><span class="tag ${classe[l.situacao]}">${l.situacao}</span></td>
      </tr>`).join('') || '<tr><td colspan="6" class="hint">Sem dados.</td></tr>';
  }

  async function exportar() {
    const { evento, minimo } = Config.get();
    const linhas = await consolidar();
    const presenca = linhas.map((l) => ({
      'RA': l.ra,
      'Nome': l.nome,
      'Curso': l.curso,
      'Entrada': Fmt.dataHora(l.entrada),
      'Saída': Fmt.dataHora(l.saida),
      'Permanência (min)': l.minutos ?? '',
      'Situação': l.situacao,
    }));
    const registros = (await DB.todos('registros')).filter((r) => r.evento === evento).map((r) => ({
      'RA': r.ra,
      'Nome': Alunos.buscar(r.ra)?.nome ?? '',
      'Entrada': Fmt.dataHora(r.entrada),
      'Saída': Fmt.dataHora(r.saida),
      'Minutos': r.saida ? Fmt.minutos(r.entrada, r.saida) : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(presenca);
    ws['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 26 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 13 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Presença');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(registros), 'Registros');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Evento', evento],
      ['Tempo mínimo (min)', minimo],
      ['Gerado em', Fmt.dataHora(new Date().toISOString())],
    ]), 'Evento');

    const slug = evento.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
    XLSX.writeFile(wb, `presenca_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function encerrar() {
    const { evento } = Config.get();
    const abertos = (await DB.todos('registros')).filter((r) => r.evento === evento && !r.saida);
    if (!abertos.length) return alert('Ninguém está com entrada em aberto.');
    if (!confirm(`Registrar saída agora para ${abertos.length} aluno(s)?`)) return;
    const agora = new Date().toISOString();
    await DB.salvarVarios('registros', abertos.map((r) => ({ ...r, saida: agora })));
    await render();
    await Leitor.atualizarPainel();
  }

  function iniciar() {
    document.getElementById('btn-export').addEventListener('click', exportar);
    document.getElementById('btn-fechar').addEventListener('click', encerrar);
  }

  return { iniciar, render };
})();
