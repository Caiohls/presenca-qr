const Leitor = (() => {
  const INTERVALO_REPETIDA = 10000; 
  const ultimas = new Map();
  let camera;

  const DURACAO_AVISO = 2000;
  let timerAviso;

  async function registrar(texto, manual = false) {
    if (!manual && avisoAberto()) return;
    const lido = Codigo.ler(texto);
    const chave = lido.ra ?? String(texto).trim();
    const agora = Date.now();
    if (!manual && agora - (ultimas.get(chave) || 0) < INTERVALO_REPETIDA) return;
    ultimas.set(chave, agora);

    if (lido.erro) {
      mostrar('erro', lido.erro, 'Peça para o aluno conferir o código.');
      return avisar('erro', 'CÓDIGO INVÁLIDO', lido.erro, 'Peça para o aluno conferir o código.');
    }

    const aluno = Alunos.buscar(lido.ra);
    if (!aluno) {
      mostrar('erro', 'Aluno não cadastrado', `RA ${lido.ra} não está na lista do evento.`);
      return avisar('erro', 'NÃO CADASTRADO', `RA ${lido.ra}`, 'Aluno não está na lista do evento.');
    }

    const { evento, minimo } = Config.get();
    const registros = await DB.todos('registros');
    const aberto = registros.find((r) => r.ra === aluno.ra && r.evento === evento && !r.saida);
    const iso = new Date(agora).toISOString();

    if (!aberto) {
      await DB.salvar('registros', { ra: aluno.ra, evento, entrada: iso, saida: null });
      const detalhe = `RA ${aluno.ra} · ${Fmt.hora(iso)}`;
      mostrar('entrada', `Entrada: ${aluno.nome}`, detalhe);
      avisar('entrada', 'ENTRADA', aluno.nome, detalhe);
    } else {
      aberto.saida = iso;
      await DB.salvar('registros', aberto);
      const min = Fmt.minutos(aberto.entrada, iso);
      const valida = min >= minimo;
      const detalhe = `Permanência de ${Fmt.duracao(min)}, ${valida ? 'presença válida' : `abaixo de ${minimo} min`}`;
      mostrar(valida ? 'saida' : 'aviso', `Saída: ${aluno.nome}`, detalhe);
      avisar(valida ? 'saida' : 'aviso', 'SAÍDA', aluno.nome, detalhe);
    }
    bip(aberto ? 660 : 880);
    await atualizarPainel();
  }

  function mostrar(tipo, titulo, detalhe) {
    const el = document.getElementById('feedback');
    el.className = `feedback ${tipo}`;
    el.innerHTML = `<div class="fb-title">${Fmt.esc(titulo)}</div><div class="fb-detail">${Fmt.esc(detalhe)}</div>`;
    if (tipo === 'erro') bip(220);
  }

  function avisar(tipo, rotulo, nome, detalhe) {
    const el = document.getElementById('aviso-leitura');
    el.className = `aviso-leitura ${tipo}`;
    el.querySelector('.al-tipo').textContent = rotulo;
    el.querySelector('.al-nome').textContent = nome;
    el.querySelector('.al-detalhe').textContent = detalhe;
    el.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(fecharAviso, DURACAO_AVISO);
  }

  function fecharAviso() {
    clearTimeout(timerAviso);
    document.getElementById('aviso-leitura').hidden = true;
  }

  function avisoAberto() {
    return !document.getElementById('aviso-leitura').hidden;
  }

  function bip(freq) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      o.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  async function atualizarPainel() {
    const { evento, minimo } = Config.get();
    const regs = (await DB.todos('registros')).filter((r) => r.evento === evento);
    document.getElementById('st-dentro').textContent = regs.filter((r) => !r.saida).length;
    document.getElementById('st-validos').textContent =
      regs.filter((r) => r.saida && Fmt.minutos(r.entrada, r.saida) >= minimo).length;
    document.getElementById('st-total').textContent = regs.length;

    const eventos = regs.flatMap((r) => [
      { t: r.entrada, tipo: 'Entrada', ra: r.ra },
      ...(r.saida ? [{ t: r.saida, tipo: 'Saída', ra: r.ra }] : []),
    ]).sort((a, b) => b.t.localeCompare(a.t)).slice(0, 15);

    document.getElementById('log').innerHTML = eventos.map((e) => {
      const nome = Alunos.buscar(e.ra)?.nome ?? e.ra;
      return `<li><span><b>${e.tipo}</b> · ${Fmt.esc(nome)}</span><time>${Fmt.hora(e.t)}</time></li>`;
    }).join('') || '<li class="hint">Nenhuma leitura ainda.</li>';
  }

  async function ligarCamera() {
    if (!window.Html5Qrcode) return mostrar('erro', 'Leitor indisponível', 'Verifique a conexão com a internet.');
    camera = new Html5Qrcode('reader');
    try {
      await camera.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, (texto) => registrar(texto), () => {});
      document.getElementById('btn-camera').hidden = true;
      document.getElementById('btn-camera-stop').hidden = false;
    } catch (err) {
      mostrar('erro', 'Não foi possível abrir a câmera', 'Permita o acesso à câmera (a página precisa estar em https ou localhost).');
    }
  }

  async function desligarCamera() {
    if (camera) { await camera.stop().catch(() => {}); camera.clear(); }
    document.getElementById('btn-camera').hidden = false;
    document.getElementById('btn-camera-stop').hidden = true;
  }

  function iniciar() {
    document.getElementById('btn-camera').addEventListener('click', ligarCamera);
    document.getElementById('aviso-leitura').addEventListener('click', fecharAviso);
    document.getElementById('btn-camera-stop').addEventListener('click', desligarCamera);
    document.getElementById('form-manual').addEventListener('submit', async (e) => {
      e.preventDefault();
      const campo = document.getElementById('manual-code');
      fecharAviso();
      await registrar(campo.value, true);
      campo.value = '';
      campo.focus();
    });
  }

  return { iniciar, atualizarPainel, desligarCamera };
})();
