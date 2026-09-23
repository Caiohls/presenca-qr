const Codigo = (() => {
  const CHAVE = 'usf-ppe-2026';

  function hash(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6).toUpperCase();
  }

  function gerar(ra) {
    return `USF:${ra}:${hash(ra + CHAVE)}`;
  }

  function ler(texto) {
    const t = String(texto).trim();
    if (/^\d{4,12}$/.test(t)) return { ra: t };
    const m = t.match(/^USF:(\d{4,12}):([0-9A-F]{6})$/i);
    if (!m) return { erro: 'Código não reconhecido' };
    if (hash(m[1] + CHAVE) !== m[2].toUpperCase()) return { erro: 'QR Code inválido ou adulterado' };
    return { ra: m[1] };
  }

  function imagem(ra, tamanhoCelula = 4) {
    const qr = qrcode(0, 'M');
    qr.addData(gerar(ra));
    qr.make();
    return qr.createDataURL(tamanhoCelula, 2);
  }

  return { gerar, ler, imagem };
})();

const Fmt = {
  hora: (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'),
  dataHora: (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'),
  minutos: (ini, fim) => Math.floor((new Date(fim) - new Date(ini)) / 60000),
  duracao(min) {
    if (min == null) return '-';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
  },
  esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
};
