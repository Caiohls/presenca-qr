const Leitor = (() => {
  const INTERVALO_REPETIDA = 10000;
  const DURACAO_SUCESSO = 1500;
  const DURACAO_ERRO = 2500;
  const FORA_DE_QUADRO = 800;
  const DETECCAO = 300;
  const SONS = { entrada: 880, saida: 660, aviso: 660, duplicada: 220, erro: 220 };

  const el = (id) => document.getElementById(id);
  const ultimas = new Map();
  const vistos = new Map();
  const repeticoes = new Map();

  let camera = null;
  let filaCamera = Promise.resolve();
  let audio;
  let timerAviso;
  let timerDeteccao;
  let timerResize;
  let larguraTela = window.innerWidth;

  async function registrar(texto, manual = false) {
    const lido = Codigo.ler(texto);
    const chave = lido.ra ?? String(texto).trim();
    const agora = Date.now();
    const voltouAoQuadro = agora - (vistos.get(chave) || 0) > FORA_DE_QUADRO;
    vistos.set(chave, agora);

    if (!manual && agora - (ultimas.get(chave) || 0) < INTERVALO_REPETIDA) {
      if (voltouAoQuadro && repeticoes.has(chave)) sinalizar(...repeticoes.get(chave));
      return;
    }
    ultimas.set(chave, agora);

    if (lido.erro) {
      return recusar(chave, 'CÓDIGO INVÁLIDO', lido.erro, 'Peça para o aluno conferir o código.');
    }

    const aluno = Alunos.buscar(lido.ra);
    if (!aluno) {
      return recusar(chave, 'NÃO CADASTRADO', `RA ${lido.ra}`, 'Aluno não está na lista do evento.');
    }

    const { evento, minimo } = Config.get();
    const registros = await DB.todos('registros');
    const aberto = registros.find((r) => r.ra === aluno.ra && r.evento === evento && !r.saida);
    const iso = new Date(agora).toISOString();

    if (!aberto) {
      await DB.salvar('registros', { ra: aluno.ra, evento, entrada: iso, saida: null });
      sinalizar('entrada', 'ENTRADA', aluno.nome, `RA ${aluno.ra} · ${Fmt.hora(iso)}`);
      repeticoes.set(chave, ['duplicada', 'JÁ REGISTRADA', aluno.nome, `Entrada já registrada às ${Fmt.hora(iso)}`]);
    } else {
      aberto.saida = iso;
      await DB.salvar('registros', aberto);
      const min = Fmt.minutos(aberto.entrada, iso);
      const valida = min >= minimo;
      const detalhe = `Permanência de ${Fmt.duracao(min)}, ${valida ? 'presença válida' : `abaixo de ${minimo} min`}`;
      sinalizar(valida ? 'saida' : 'aviso', 'SAÍDA', aluno.nome, detalhe);
      repeticoes.set(chave, ['duplicada', 'JÁ REGISTRADA', aluno.nome, `Saída já registrada às ${Fmt.hora(iso)}`]);
    }
    await atualizarPainel();
  }

  function recusar(chave, rotulo, nome, detalhe) {
    const resposta = ['erro', rotulo, nome, detalhe];
    repeticoes.set(chave, resposta);
    sinalizar(...resposta);
  }

  function sinalizar(tipo, rotulo, nome, detalhe) {
    const problema = tipo === 'erro' || tipo === 'duplicada';
    vibrar(problema ? [40, 60, 40] : 40);
    bip(SONS[tipo]);
    if (problema) piscarBordas(tipo);

    el('mira').dataset.estado = tipo;
    const card = el('aviso-leitura');
    card.dataset.tipo = tipo;
    card.querySelector('.al-tipo').textContent = rotulo;
    card.querySelector('.al-nome').textContent = nome;
    card.querySelector('.al-detalhe').textContent = detalhe;
    card.classList.add('visivel');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(fecharAviso, problema ? DURACAO_ERRO : DURACAO_SUCESSO);
  }

  function fecharAviso() {
    clearTimeout(timerAviso);
    el('aviso-leitura').classList.remove('visivel');
    delete el('mira').dataset.estado;
  }

  function piscarBordas(tipo) {
    const flash = el('flash');
    flash.dataset.tipo = tipo;
    flash.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-out' });
  }

  // O navegador só libera som e vibração depois do primeiro toque na página.
  const liberado = () => navigator.userActivation?.hasBeenActive !== false;

  function vibrar(padrao) {
    if (liberado()) navigator.vibrate?.(padrao);
  }

  function bip(freq) {
    if (!liberado()) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state !== 'running') {
        audio.resume();
        return;
      }
      const t = audio.currentTime;
      const osc = audio.createOscillator();
      const ganho = audio.createGain();
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, t);
      ganho.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(ganho).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } catch {}
  }

  async function atualizarPainel() {
    const { evento, minimo } = Config.get();
    const regs = (await DB.todos('registros')).filter((r) => r.evento === evento);
    const dentro = regs.filter((r) => !r.saida).length;
    const cadastrados = Alunos.lista.length;

    Ui.odometro(el('contador-presentes'), dentro);
    el('contador-total').textContent = `/ ${cadastrados}`;
    el('contador-sr').textContent = `${dentro} no local de ${cadastrados} cadastrados`;

    el('st-dentro').textContent = dentro;
    el('st-validos').textContent =
      regs.filter((r) => r.saida && Fmt.minutos(r.entrada, r.saida) >= minimo).length;
    el('st-total').textContent = regs.length;

    const eventos = regs.flatMap((r) => [
      { t: r.entrada, tipo: 'Entrada', classe: 'entrada', ra: r.ra },
      ...(r.saida ? [{ t: r.saida, tipo: 'Saída', classe: 'saida', ra: r.ra }] : []),
    ]).sort((a, b) => b.t.localeCompare(a.t)).slice(0, 3);

    el('log').innerHTML = eventos.map((e) => {
      const nome = Alunos.buscar(e.ra)?.nome ?? e.ra;
      return `<li><span class="log-tipo ${e.classe}">${e.tipo}</span><span class="log-nome">${Fmt.esc(nome)}</span><time>${Fmt.hora(e.t)}</time></li>`;
    }).join('') || '<li class="vazio">Nenhuma leitura ainda.</li>';
  }

  function aoDetectar(texto) {
    const mira = el('mira');
    mira.classList.add('detectando');
    clearTimeout(timerDeteccao);
    timerDeteccao = setTimeout(() => mira.classList.remove('detectando'), DETECCAO);
    registrar(texto);
  }

  // O centro do vídeo acompanha o centro da mira, porque a biblioteca lê o centro do vídeo.
  function enquadrar(largura, altura) {
    const mira = el('mira').getBoundingClientRect();
    const sobe = window.innerHeight / 2 - (mira.top + mira.height / 2);
    const escala = Math.max(window.innerWidth / largura, (window.innerHeight + 2 * sobe) / altura);
    el('cobertura').style.transform = `translateY(calc(-50% - ${sobe}px)) scale(${escala})`;
    return escala;
  }

  // A biblioteca chama esta função quando o vídeo começa a rodar, já com o tamanho real.
  function regiaoDeLeitura(largura, altura) {
    const escala = enquadrar(largura, altura);
    const lado = Math.floor(Math.min(largura, altura, Math.max(el('mira').clientWidth / escala, 200)));
    estadoCamera('');
    return { width: lado, height: lado };
  }

  function estadoCamera(mensagem, comBotao = false) {
    el('camera-status').hidden = !mensagem;
    el('camera-msg').textContent = mensagem;
    el('btn-camera').hidden = !comBotao;
  }

  function naFilaDaCamera(acao) {
    filaCamera = filaCamera.then(acao, acao);
    return filaCamera;
  }

  function ligarCamera() {
    return naFilaDaCamera(async () => {
      if (camera || document.hidden || el('dlg-ajustes').open) return;
      estadoCamera('Iniciando câmera…');
      try {
        await Ui.lib('leitor');
      } catch {
        return estadoCamera('Leitor indisponível. Verifique a conexão ou digite o RA abaixo.', true);
      }
      const instancia = new Html5Qrcode('reader', {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      try {
        await instancia.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            disableFlip: true,
            qrbox: regiaoDeLeitura,
            videoConstraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          },
          aoDetectar,
          () => {},
        );
        camera = instancia;
      } catch {
        estadoCamera('Não foi possível abrir a câmera. Permita o acesso ou digite o RA abaixo.', true);
      }
    });
  }

  function desligarCamera() {
    return naFilaDaCamera(async () => {
      if (!camera) return;
      const instancia = camera;
      camera = null;
      try {
        await instancia.stop();
        instancia.clear();
      } catch {}
      el('cobertura').style.transform = '';
    });
  }

  function atualizarRede() {
    const online = navigator.onLine;
    const texto = online ? 'Conectado à internet' : 'Sem internet. As leituras continuam salvas neste aparelho.';
    el('rede').classList.toggle('online', online);
    el('rede').title = texto;
    el('rede').setAttribute('aria-label', texto);
  }

  function prepararSomEVibracao() {
    const dica = el('dica-som');
    dica.hidden = liberado();
    const liberar = () => {
      dica.hidden = true;
      try {
        audio ??= new (window.AudioContext || window.webkitAudioContext)();
        audio.resume();
      } catch {}
    };
    ['pointerup', 'touchend', 'click', 'keydown'].forEach((tipo) => {
      window.addEventListener(tipo, liberar, { once: true, capture: true });
    });
  }

  function iniciar() {
    el('btn-camera').addEventListener('click', ligarCamera);
    el('aviso-leitura').addEventListener('click', fecharAviso);
    el('form-manual').addEventListener('submit', async (e) => {
      e.preventDefault();
      const campo = el('manual-code');
      if (!campo.value.trim()) return;
      await registrar(campo.value, true);
      campo.value = '';
      campo.focus();
    });
    el('painel-alca').addEventListener('click', () => {
      const recolhido = el('painel').classList.toggle('recolhido');
      el('painel-alca').setAttribute('aria-expanded', String(!recolhido));
      el('painel-corpo').inert = recolhido;
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) desligarCamera();
      else ligarCamera();
    });
    window.addEventListener('resize', () => {
      clearTimeout(timerResize);
      timerResize = setTimeout(async () => {
        if (!camera) return;
        if (window.innerWidth === larguraTela) {
          const video = el('reader').querySelector('video');
          if (video?.clientHeight) enquadrar(video.clientWidth, video.clientHeight);
          return;
        }
        larguraTela = window.innerWidth;
        await desligarCamera();
        await ligarCamera();
      }, 200);
    });
    window.addEventListener('online', atualizarRede);
    window.addEventListener('offline', atualizarRede);
    atualizarRede();
    prepararSomEVibracao();

    if (matchMedia('(hover: hover) and (pointer: fine)').matches) el('manual-code').focus();
    ligarCamera();
  }

  return { iniciar, atualizarPainel, ligarCamera, desligarCamera };
})();
