/* Quiz Coach — 设置面板 */
(function () {
  'use strict';

  const EXT = (typeof browser !== 'undefined' && browser) ||
              (typeof chrome !== 'undefined' && chrome);
  const S = EXT.storage.local;

  const DEFAULTS = {
    apiBase: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-chat'
  };

  const $ = (id) => document.getElementById(id);
  const msgEl = $('msg');

  function say(text) {
    msgEl.textContent = text || '';
  }

  async function load() {
    const all = await S.get(null);
    const st = Object.assign({}, DEFAULTS, all.settings || {});
    $('apiBase').value = st.apiBase;
    $('apiKey').value = st.apiKey;
    $('model').value = st.model;

    const stats = all.stats || { total: 0 };
    $('total').textContent = stats.total || 0;
  }

  function readForm() {
    return {
      apiBase: $('apiBase').value.trim() || DEFAULTS.apiBase,
      apiKey: $('apiKey').value.trim(),
      model: $('model').value.trim() || DEFAULTS.model
    };
  }

  async function save() {
    const all = await S.get(['settings']);
    const merged = Object.assign({}, (all.settings || {}), readForm());
    await S.set({ settings: merged });
    say('已保存。回页面点一下右上角的小灰点就能用。');
  }

  async function test() {
    const st = readForm();
    if (!st.apiKey) { say('先填 API Key。'); return; }
    say('测试中…');
    $('test').disabled = true;
    const t0 = Date.now();
    try {
      const res = await fetch(st.apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + st.apiKey
        },
        body: JSON.stringify({
          model: st.model,
          max_tokens: 4,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });
      const cost = Date.now() - t0;
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 160));
      }
      say('连接正常，' + cost + ' ms。');
    } catch (e) {
      say('失败：' + (e && e.message ? e.message : String(e)));
    } finally {
      $('test').disabled = false;
    }
  }

  async function clearSel() {
    const all = await S.get(null);
    const keys = Object.keys(all).filter((k) => k.indexOf('sel:') === 0 || k === 'calibrated');
    if (!keys.length) { say('还没有标定过任何网站。'); return; }
    await S.remove(keys);
    say('已清空 ' + keys.length + ' 条标定。');
  }

  $('save').addEventListener('click', save);
  $('test').addEventListener('click', test);
  $('clear').addEventListener('click', clearSel);

  load();
})();
