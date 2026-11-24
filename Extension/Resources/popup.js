/* Quiz Coach — settings panel */
(function () {
  'use strict';

  const EXT = (typeof browser !== 'undefined' && browser) ||
              (typeof chrome !== 'undefined' && chrome);

  // Allow opening popup.html directly for preview: fall back to a no-op store.
  const STORE = (EXT && EXT.storage && EXT.storage.local) ||
    { get: async () => ({}), set: async () => {}, remove: async () => {} };

  const DEFAULTS = {
    apiBase: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-chat',
    lang: 'auto'
  };

  const I18N = {
    zh: {
      sub: '点开就出答案 · 学习辅助',
      language: '语言',
      langAuto: '自动（跟随浏览器）',
      langZh: '中文',
      langEn: 'English',
      apiBase: 'API 地址（OpenAI 兼容）',
      apiKey: 'API Key',
      model: '模型',
      test: '测试连接',
      save: '保存',
      clear: '清空标定',
      answered: '已答',
      hint: '默认走 DeepSeek，可以直接从浏览器请求。<br>' +
        '换别家时填各自的 <code>/v1/chat/completions</code> 端点。<br>' +
        'Key 只存在本机，不会上传到任何中转。<br>' +
        '仅用于自测、练习与对答案，请勿用于考试作弊。',
      saved: '已保存。回页面点一下右上角的小灰点就能用。',
      needKey: '先填 API Key。',
      testing: '测试中…',
      ok: (ms) => '连接正常，' + ms + ' ms。',
      fail: (e) => '失败：' + e,
      cleared: (n) => '已清空 ' + n + ' 条标定。',
      none: '还没有标定过任何网站。'
    },
    en: {
      sub: 'Open it, get the answer · Study aid',
      language: 'Language',
      langAuto: 'Auto (follow browser)',
      langZh: '中文',
      langEn: 'English',
      apiBase: 'API endpoint (OpenAI-compatible)',
      apiKey: 'API key',
      model: 'Model',
      test: 'Test connection',
      save: 'Save',
      clear: 'Clear calibrations',
      answered: 'Answered',
      hint: 'Uses DeepSeek by default and calls it directly from the browser.<br>' +
        'For other providers, use their <code>/v1/chat/completions</code> endpoint.<br>' +
        'The key is stored only on this device; there is no relay.<br>' +
        'For self-testing, practice and checking answers — not for exam cheating.',
      saved: 'Saved. Go back to the page and click the grey dot at the top-right.',
      needKey: 'Enter an API key first.',
      testing: 'Testing…',
      ok: (ms) => 'Connected in ' + ms + ' ms.',
      fail: (e) => 'Failed: ' + e,
      cleared: (n) => 'Cleared ' + n + ' calibration record(s).',
      none: 'No calibrations yet.'
    }
  };

  let LANG = 'zh';

  const $ = (id) => document.getElementById(id);
  const msgEl = $('msg');

  function say(text) {
    msgEl.textContent = text || '';
  }

  function detectLang(pref) {
    if (pref === 'zh' || pref === 'en') return pref;
    const nav = String(navigator.language || 'en').toLowerCase();
    return nav.indexOf('zh') === 0 ? 'zh' : 'en';
  }

  function t(key) {
    const args = Array.prototype.slice.call(arguments, 1);
    const table = (I18N[LANG] && Object.prototype.hasOwnProperty.call(I18N[LANG], key)) ? I18N[LANG] : I18N.zh;
    const v = table[key];
    return typeof v === 'function' ? v.apply(null, args) : (v == null ? key : v);
  }

  function applyLang(pref) {
    LANG = detectLang(pref);
    try { document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN'; } catch (e) {}
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    const hint = $('hint');
    if (hint) hint.innerHTML = t('hint');
  }

  async function load() {
    const all = await STORE.get(null);
    const st = Object.assign({}, DEFAULTS, all.settings || {});
    $('apiBase').value = st.apiBase;
    $('apiKey').value = st.apiKey;
    $('model').value = st.model;
    $('lang').value = st.lang || 'auto';
    applyLang(st.lang || 'auto');

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
    const all = await STORE.get(['settings']);
    const merged = Object.assign({}, (all.settings || {}), readForm(), {
      lang: $('lang').value || 'auto'
    });
    await STORE.set({ settings: merged });
    applyLang(merged.lang);
    say(t('saved'));
  }

  async function saveLang() {
    const pref = $('lang').value || 'auto';
    applyLang(pref);
    const all = await STORE.get(['settings']);
    const merged = Object.assign({}, (all.settings || {}), { lang: pref });
    await STORE.set({ settings: merged });
  }

  async function test() {
    const st = readForm();
    if (!st.apiKey) { say(t('needKey')); return; }
    say(t('testing'));
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
        const bodyText = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + ' ' + bodyText.slice(0, 160));
      }
      say(t('ok', cost));
    } catch (e) {
      say(t('fail', (e && e.message ? e.message : String(e))));
    } finally {
      $('test').disabled = false;
    }
  }

  async function clearSel() {
    const all = await STORE.get(null);
    const keys = Object.keys(all).filter((k) => k.indexOf('sel:') === 0 || k === 'calibrated');
    if (!keys.length) { say(t('none')); return; }
    await STORE.remove(keys);
    say(t('cleared', keys.length));
  }

  $('save').addEventListener('click', save);
  $('test').addEventListener('click', test);
  $('clear').addEventListener('click', clearSel);
  $('lang').addEventListener('change', saveLang);

  load();
})();
