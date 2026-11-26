/* ============================================================
   성장 빙고 — 가족 확인 경계 (비밀번호 4자리 구현)

   이 파일만 갈아 끼우면 가족 확인 방식이 바뀐다. app.js는 비밀번호를 모른다.
   밖에 내놓는 것:
     currentActor()    지금 누르는 사람. 평소에는 본인(owner), 가족 확인 중에는 가족(verifier)
     requestVerifier() 가족 확인 절차를 띄우고 결과를 Promise<boolean>으로 알린다
     lock()            가족 모드를 닫는다
   (비밀번호 방식 특유의 설정 화면 renderSetup / renderManage / isConfigured 는
    이 파일과 한 벌이라 함께 갈아 끼운다.)

   ※ 이것은 보안 장치가 아니라 약속 장치다. 비밀번호는 localStorage에 평문으로 있고
     개발자 도구로 볼 수 있다. 본인이 스스로 도장을 찍지 않겠다는 약속을 한 번 더 떠올리게 할 뿐이다.
     진짜 계정 분리는 옮겨 갈 앱의 가족 계정이 맡는다.
   ============================================================ */
(function () {
  'use strict';

  var GB = window.GrowthBingo = window.GrowthBingo || {};

  var IDLE_LOCK_MS = 3 * 60 * 1000; // 3분 동안 조작이 없으면 잠근다
  var OWNER = { id: 'me', role: 'owner' };
  var VERIFIER = { id: 'family', role: 'verifier' };

  var host = null;       // { getPin(), setPin(pin, kind), openDialog(opts) }
  var unlocked = false;
  var idleTimer = null;
  var listeners = [];

  function init(h) {
    host = h;
    /* 탭을 옮기거나 화면을 가리면 바로 잠근다. */
    document.addEventListener('visibilitychange', function () { if (document.hidden) lock(); });
    var bump = function () { if (unlocked) armIdle(); };
    document.addEventListener('pointerdown', bump, true);
    document.addEventListener('keydown', bump, true);
  }

  function emit() { listeners.forEach(function (fn) { fn(unlocked); }); }
  function onChange(fn) { listeners.push(fn); }

  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { lock(); }, IDLE_LOCK_MS);
  }

  function lock() {
    clearTimeout(idleTimer);
    if (!unlocked) return;
    unlocked = false;
    emit();
  }

  function unlock() {
    unlocked = true;
    armIdle();
    emit();
  }

  function currentActor() { return unlocked ? VERIFIER : OWNER; }
  function isUnlocked() { return unlocked; }
  function isConfigured() { return !!(host && host.getPin()); }

  /* ── 숫자판 ────────────────────────────────────────
     입력 칸 하나(키보드·붙여넣기)와 화면 숫자 버튼을 같이 둔다. 버튼은 48px 이상. */
  function buildPad(root, opts) {
    var wrap = document.createElement('div');
    wrap.className = 'pin-pad';
    wrap.innerHTML =
      '<label class="pin-label">' + opts.label +
      '<input class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" ' +
      'autocomplete="off" aria-describedby="pin-msg"></label>' +
      '<p class="pin-msg" id="pin-msg" role="alert"></p>' +
      '<div class="pin-keys"></div>';
    var input = wrap.querySelector('.pin-input');
    var msg = wrap.querySelector('.pin-msg');
    var keys = wrap.querySelector('.pin-keys');

    function setMsg(t) { msg.textContent = t || ''; }
    function done() {
      if (input.value.length !== 4) return;
      var v = input.value;
      var res = opts.onSubmit(v);
      if (res === false) { input.value = ''; input.focus(); }
    }
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '확인'].forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn pin-key' + (/\d/.test(k) ? '' : ' pin-key-fn');
      b.textContent = k;
      b.addEventListener('click', function () {
        if (k === '지움') input.value = input.value.slice(0, -1);
        else if (k === '확인') done();
        else if (input.value.length < 4) input.value += k;
        setMsg('');
        if (/\d/.test(k) && input.value.length === 4) done();
      });
      keys.appendChild(b);
    });
    input.addEventListener('input', function () {
      input.value = input.value.replace(/\D/g, '').slice(0, 4);
      setMsg('');
      if (input.value.length === 4) done();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(); } });
    root.appendChild(wrap);
    return { input: input, setMsg: setMsg, focus: function () { input.focus(); } };
  }

  /* ── 가족 확인 요청 ────────────────────────────────── */
  function requestVerifier(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (unlocked) { resolve(true); return; }
      if (!isConfigured()) { resolve(false); return; }
      var result = false;
      host.openDialog({
        title: opts.title || '가족 확인',
        role: 'dialog',
        onClose: function () { resolve(result); },
        render: function (body, close) {
          var p = document.createElement('p');
          p.className = 'dialog-text';
          p.textContent = opts.text || '가족이 비밀번호 4자리를 눌러 주세요.';
          body.appendChild(p);
          var pad = buildPad(body, {
            label: '가족 비밀번호',
            onSubmit: function (v) {
              if (v === host.getPin()) {
                result = true;
                if (!opts.keepLocked) unlock();
                close();
                return true;
              }
              pad.setMsg('번호가 맞지 않습니다. 다시 눌러 주세요.');
              return false;
            }
          });
          var cancel = document.createElement('button');
          cancel.type = 'button';
          cancel.className = 'btn';
          cancel.textContent = '그만두기';
          cancel.addEventListener('click', function () { close(); });
          body.appendChild(cancel);
          return pad.input;
        }
      });
    });
  }

  /* ── 설정 화면에 들어가는 조각 ─────────────────────── */

  /** 첫 실행 마법사 2단계: 가족이 직접 4자리를 정한다 (두 번 입력). */
  function renderSetup(el, onPin) {
    var first = null;
    el.innerHTML = '';
    var title = document.createElement('p');
    title.className = 'dialog-text';
    el.appendChild(title);
    function ask() {
      title.textContent = first === null
        ? '가족이 직접 비밀번호 4자리를 정해 주세요. 도장을 찍을 때마다 이 번호를 누릅니다.'
        : '같은 번호를 한 번 더 눌러 주세요.';
    }
    ask();
    var padHost = document.createElement('div');
    el.appendChild(padHost);
    var pad = buildPad(padHost, {
      label: first === null ? '새 비밀번호' : '비밀번호 확인',
      onSubmit: function (v) {
        if (first === null) {
          first = v; ask();
          padHost.querySelector('.pin-label').firstChild.textContent = '비밀번호 확인';
          padHost.querySelector('.pin-input').value = '';
          padHost.querySelector('.pin-input').focus();
          return true;
        }
        if (v !== first) {
          first = null; ask();
          padHost.querySelector('.pin-label').firstChild.textContent = '새 비밀번호';
          pad.setMsg('두 번호가 달라요. 처음부터 다시 정해 주세요.');
          return false;
        }
        onPin(v);
        return true;
      }
    });
  }

  /** 설정 화면: 바꾸기(현재 번호 필요) / 다시 정하기(기록에 남음) */
  function renderManage(el, onChanged) {
    el.innerHTML = '';
    var change = document.createElement('button');
    change.type = 'button'; change.className = 'btn';
    change.textContent = '비밀번호 바꾸기';
    var reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'btn';
    reset.textContent = '비밀번호 다시 정하기';
    var note = document.createElement('p');
    note.className = 'help';
    note.textContent = '잊었을 때는 [다시 정하기]를 쓰세요. 현재 비밀번호 없이도 되지만 날짜와 함께 기록에 남고, 7일 동안 가족 확인 화면에 알림이 보입니다.';
    el.appendChild(change); el.appendChild(reset); el.appendChild(note);

    function askNew(kind) {
      host.openDialog({
        title: kind === 'reset' ? '비밀번호 다시 정하기' : '새 비밀번호',
        role: 'dialog',
        onClose: function () {},
        render: function (body, close) {
          var holder = document.createElement('div');
          body.appendChild(holder);
          renderSetup(holder, function (pin) {
            host.setPin(pin, kind);
            close();
            if (onChanged) onChanged(kind);
          });
          var cancel = document.createElement('button');
          cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = '그만두기';
          cancel.addEventListener('click', function () { close(); });
          body.appendChild(cancel);
          return holder.querySelector('.pin-input');
        }
      });
    }

    change.addEventListener('click', function () {
      requestVerifier({ title: '현재 비밀번호', text: '지금 쓰는 비밀번호를 눌러 주세요.', keepLocked: true })
        .then(function (ok) { if (ok) askNew('change'); });
    });
    reset.addEventListener('click', function () { askNew('reset'); });
  }

  GB.familyGate = {
    init: init, currentActor: currentActor, requestVerifier: requestVerifier, lock: lock,
    isUnlocked: isUnlocked, isConfigured: isConfigured, onChange: onChange,
    renderSetup: renderSetup, renderManage: renderManage,
    IDLE_LOCK_MS: IDLE_LOCK_MS
  };
})();
