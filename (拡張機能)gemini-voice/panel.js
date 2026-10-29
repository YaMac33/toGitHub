// 操作パネル（読み上げの操作・録音の状態）を描く部品。
// ポップアップと、ページ上に出す小さなパネルの両方で使う。
(function () {
  'use strict';
  const GV = globalThis.GV;

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k);
    return el;
  }

  function icon(name) {
    const s = h('span', { class: 'ic' });
    s.innerHTML = GV.ICONS[name] || '';
    return s;
  }

  function button(label, onClick, opts = {}) {
    const b = h('button', {
      type: 'button',
      class: opts.cls || '',
      title: opts.title || label,
      'aria-label': opts.title || label,
    });
    if (opts.icon) b.append(icon(opts.icon));
    if (!opts.iconOnly) b.append(h('span', { class: 'lbl' }, label));
    // ページの入力欄からカーソルが外れないよう、押したときにフォーカスを奪わない
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(b);
    });
    return b;
  }

  const spinner = () => h('span', { class: 'spin', 'aria-hidden': 'true' });
  const iconBtn = (name, title, onClick, cls = '') => button(title, onClick, { icon: name, iconOnly: true, cls: 'icon ' + cls, title });

  function header(title, lead, closeBtn) {
    return h('div', { class: 'top' }, h('div', { class: 'title', role: 'status', 'aria-live': 'polite' }, lead, title), closeBtn);
  }

  function render(box, st, ctx) {
    box.replaceChildren();
    box.classList.toggle('err', st.state === 'error');
    return st.mode === 'dict' ? dict(box, st, ctx) : read(box, st, ctx);
  }

  function read(box, st, ctx) {
    const busy = GV.isBusy(st);
    const total = st.total || 0;
    const cur = total ? Math.min((st.index || 0) + 1, total) : 0;
    const labels = {
      loading: '音声を準備中…',
      waiting: '順番待ち…',
      playing: '読み上げ中',
      paused: '一時停止中',
      done: '読み上げが終わりました',
      error: '読み上げできませんでした',
    };
    const lead =
      st.state === 'loading' || st.state === 'waiting' ? spinner()
        : st.state === 'error' ? icon('alert')
        : st.state === 'done' ? icon('check')
        : icon('speaker');
    const title = h('span', null, labels[st.state] || '', busy && total ? h('span', { class: 'count' }, `${cur} / ${total}`) : null);
    const close = busy
      ? iconBtn('close', '停止して閉じる', () => ctx.send('stop'))
      : iconBtn('close', '閉じる', () => ctx.dismiss());
    box.append(header(title, lead, close));

    if (st.state === 'error') {
      box.append(h('div', { class: 'msg' }, st.message || 'エラーが発生しました'));
      return { autoHide: 0 };
    }
    if (st.state === 'done') return { autoHide: 2500 };

    if (st.state === 'waiting' && st.message) box.append(h('div', { class: 'hint' }, st.message));
    if (st.preview) box.append(h('div', { class: 'preview' }, st.preview));

    const fill = h('i');
    fill.style.width = (total ? Math.round((cur / total) * 100) : 0) + '%';
    box.append(h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': cur }, fill));

    const playing = st.state !== 'paused';
    const speed = Number(st.speed) || 1;
    const setSpeed = (d) => ctx.send('speed', Math.round(Math.min(2, Math.max(0.5, speed + d)) * 10) / 10);
    box.append(
      h('div', { class: 'row' },
        iconBtn('prev', '前の段落へ', () => ctx.send('prev')),
        iconBtn(playing ? 'pause' : 'play', playing ? '一時停止' : '再開', () => ctx.send(playing ? 'pause' : 'resume'), 'primary'),
        iconBtn('next', '次の段落へ', () => ctx.send('next')),
        iconBtn('stop', '停止', () => ctx.send('stop')),
        h('span', { class: 'spacer' }),
        iconBtn('minus', '遅くする', () => setSpeed(-0.1), 'sm'),
        h('span', { class: 'speed', title: '再生速度' }, speed.toFixed(1) + 'x'),
        iconBtn('plus', '速くする', () => setSpeed(0.1), 'sm'),
      ),
    );
    if (st.truncated) {
      box.append(h('div', { class: 'hint' }, `長いページのため、先頭${GV.LIMITS.readChars.toLocaleString()}文字まで読みます`));
    }
    return { autoHide: 0 };
  }

  function dict(box, st, ctx) {
    const cancel = () => iconBtn('close', 'キャンセル', () => ctx.send('cancel'));
    switch (st.state) {
      case 'starting':
        box.append(header('マイクを準備中…', spinner(), cancel()));
        return {};

      case 'recording': {
        const time = h('span', { class: 'elapsed' }, '0:00');
        const max = st.maxSeconds || GV.LIMITS.recordSeconds;
        const tick = () => {
          const sec = (Date.now() - (st.startedAt || Date.now())) / 1000;
          const left = max - sec;
          time.textContent = GV.formatDuration(sec) + (left < 60 ? `（残り${Math.max(0, Math.ceil(left))}秒）` : '');
        };
        tick();
        box.append(header(h('span', null, '録音中 ', time), h('span', { class: 'dot', 'aria-hidden': 'true' }), cancel()));
        if (ctx.level) box.append(h('div', { class: 'level', 'aria-hidden': 'true' }, h('i')));
        box.append(
          h('div', { class: 'row' },
            button('停止して文字にする', () => ctx.send('finish'), { icon: 'check', cls: 'primary grow' }),
            button('キャンセル', () => ctx.send('cancel')),
          ),
        );
        box.append(h('div', { class: 'hint' }, ctx.overlay ? 'Esc でキャンセル' : '話し終わったら「停止して文字にする」を押してください'));
        return { tick };
      }

      case 'transcribing':
        box.append(header('文字にしています…', spinner(), cancel()));
        if (st.message) box.append(h('div', { class: 'hint' }, st.message));
        return {};

      case 'done': {
        const t = st.inserted
          ? st.copied ? '入力しました（コピーもしました）' : '入力しました'
          : st.copied ? 'クリップボードにコピーしました' : '文字にしました';
        box.append(header(t, icon('check'), iconBtn('close', '閉じる', () => ctx.dismiss())));
        if (!st.inserted || ctx.showResult) {
          box.append(h('div', { class: 'msg result' }, st.text || ''));
          box.append(
            h('div', { class: 'row' },
              button('コピー', async (b) => {
                const ok = await ctx.copy(st.text || '');
                b.querySelector('.lbl').textContent = ok ? 'コピーしました' : 'コピーできませんでした';
              }, { icon: 'copy' }),
            ),
          );
        }
        return { autoHide: st.inserted ? 3000 : 20000 };
      }

      case 'error':
        box.append(header('音声入力できませんでした', icon('alert'), iconBtn('close', '閉じる', () => ctx.dismiss())));
        box.append(h('div', { class: 'msg' }, st.message || 'エラーが発生しました'));
        return { autoHide: 0 };
    }
    return {};
  }

  GV.panel = { render, h, icon };
})();
