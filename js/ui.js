const Ui = (() => {
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const LIBS = {
    leitor: `${CDN}html5-qrcode@2.3.8/html5-qrcode.min.js`,
    qr: `${CDN}qrcode-generator@1.4.4/qrcode.js`,
    xlsx: `${CDN}xlsx@0.18.5/dist/xlsx.full.min.js`,
    zip: `${CDN}jszip@3.10.1/dist/jszip.min.js`,
  };
  const cargas = {};
  let timerStatus;

  function lib(nome) {
    cargas[nome] ??= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LIBS[nome];
      s.onload = resolve;
      s.onerror = () => {
        delete cargas[nome];
        reject(new Error(`Falha ao carregar ${nome}`));
      };
      document.head.append(s);
    });
    return cargas[nome];
  }

  async function exigirLib(nome) {
    try {
      await lib(nome);
      return true;
    } catch {
      status('Não foi possível carregar este recurso. Verifique a conexão com a internet.');
      return false;
    }
  }

  function odometro(el, valor) {
    const digitos = String(valor).split('');
    while (el.children.length < digitos.length) {
      const coluna = document.createElement('span');
      coluna.className = 'od-dig';
      const fita = document.createElement('span');
      fita.className = 'od-fita';
      fita.textContent = '0\n1\n2\n3\n4\n5\n6\n7\n8\n9';
      coluna.append(fita);
      el.prepend(coluna);
    }
    while (el.children.length > digitos.length) el.firstElementChild.remove();
    digitos.forEach((d, i) => {
      el.children[i].firstElementChild.style.transform = `translateY(${-d * 10}%)`;
    });
  }

  function confirmar({ titulo, texto, acao = 'Confirmar', perigo = false }) {
    const dlg = document.getElementById('dlg-confirmar');
    const botao = document.getElementById('confirmar-acao');
    document.getElementById('confirmar-titulo').textContent = titulo;
    document.getElementById('confirmar-texto').textContent = texto;
    botao.textContent = acao;
    botao.className = perigo ? 'btn danger' : 'btn primary';
    dlg.returnValue = '';
    return new Promise((resolve) => {
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'sim'), { once: true });
      dlg.showModal();
    });
  }

  function status(mensagem) {
    const el = document.getElementById('ajustes-status');
    el.textContent = mensagem;
    el.classList.add('visivel');
    clearTimeout(timerStatus);
    timerStatus = setTimeout(() => {
      el.textContent = '';
      el.classList.remove('visivel');
    }, 3000);
  }

  return { lib, exigirLib, odometro, confirmar, status };
})();
