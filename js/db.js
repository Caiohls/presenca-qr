const DB = (() => {
  const NOME = 'presenca-qr';
  let conexao;

  function abrir() {
    if (conexao) return conexao;
    conexao = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('alunos', { keyPath: 'ra' });
        const reg = db.createObjectStore('registros', { keyPath: 'id', autoIncrement: true });
        reg.createIndex('ra', 'ra');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return conexao;
  }

  async function tx(store, modo, fn) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, modo);
      const resultado = fn(t.objectStore(store));
      t.oncomplete = () => resolve(resultado && 'result' in resultado ? resultado.result : resultado);
      t.onerror = () => reject(t.error);
    });
  }

  return {
    todos: (store) => tx(store, 'readonly', (s) => s.getAll()),
    obter: (store, chave) => tx(store, 'readonly', (s) => s.get(chave)),
    salvar: (store, obj) => tx(store, 'readwrite', (s) => s.put(obj)),
    remover: (store, chave) => tx(store, 'readwrite', (s) => s.delete(chave)),
    limpar: (store) => tx(store, 'readwrite', (s) => s.clear()),
    salvarVarios: (store, lista) => tx(store, 'readwrite', (s) => { lista.forEach((o) => s.put(o)); }),
  };
})();

const Config = {
  padrao: { evento: 'Feira de Projetos | Campus Swift', minimo: 60 },
  get() {
    try { return { ...this.padrao, ...JSON.parse(localStorage.getItem('presenca-config') || '{}') }; }
    catch { return { ...this.padrao }; }
  },
  set(c) {
    try { localStorage.setItem('presenca-config', JSON.stringify(c)); } catch {}
  },
};
