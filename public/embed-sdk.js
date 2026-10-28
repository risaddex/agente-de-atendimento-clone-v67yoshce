window.__SKIP_AGENT_READY = false
;(function () {
  'use strict'
  // No Skip o frontend e o backend sao hosts DIFERENTES e nao ha proxy entre
  // eles. Um POST no host do app (.goskip.app) volta 405 sem headers de CORS,
  // o navegador bloqueia, e o widget mostra "Erro de conexao".
  //
  //   frontend/app : <slug>.goskip.app          (serve este arquivo)
  //   backend      : <slug>.shrd00.internal.goskip.dev
  //
  // Este arquivo fica em public/, entao o Vite nao substitui nada nele em build
  // — se o host fosse fixo, todo clone continuaria gravando os leads no banco do
  // projeto original. Por isso o apiUrl e' resolvido em tempo de execucao.
  function currentScriptSrc() {
    try {
      if (document.currentScript && document.currentScript.src) {
        return document.currentScript.src
      }
    } catch (_) {}
    var all = document.getElementsByTagName('script')
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].src && all[i].src.indexOf('embed-sdk.js') !== -1) return all[i].src
    }
    return ''
  }

  // Deriva o backend a partir da origem de onde ESTE script foi carregado, que
  // e' sempre o frontend do projeto dono do widget — seja o template ou um clone.
  function deriveApiUrl() {
    var src = currentScriptSrc()
    if (!src) return ''
    var origin
    try {
      origin = new URL(src, location.href).origin
    } catch (_) {
      return ''
    }
    // Feito com operacoes de string em vez de uma regex com quantificador
    // preguicoso: o comportamento e' obvio de conferir e nao depende de
    // sutileza de backtracking.
    var SUFFIX = '.goskip.app'
    var host = origin.replace(/^https:\/\//i, '').toLowerCase()
    if (host.length <= SUFFIX.length) return ''
    if (host.slice(-SUFFIX.length) !== SUFFIX) return ''
    var slug = host.slice(0, -SUFFIX.length)
    // host de preview: <slug>--preview.goskip.app aponta para o mesmo backend
    if (slug.slice(-9) === '--preview') slug = slug.slice(0, -9)
    if (!/^[a-z0-9-]+$/.test(slug)) return ''
    return 'https://' + slug + '.shrd00.internal.goskip.dev/backend/v1/chat'
  }

  // Capturado ANTES de qualquer callback assincrono: document.currentScript so'
  // vale durante a execucao sincrona do proprio script.
  var derivedApiUrl = deriveApiUrl()

  var C = {
    // Vazio de proposito. Precedencia: __SKIP_AGENT_CONFIG__.apiUrl (o snippet
    // gerado pelo painel sempre o preenche) > derivado da origem do script.
    // Sem fallback para um host fixo: e' preferivel falhar visivelmente a gravar
    // os leads no banco de outro projeto.
    apiUrl: '',
    agentId: 'support-agent',
    primaryColor: '#0891B2',
    agentName: 'Assistente da Clinica',
    position: 'bottom-right',
    inputPlaceholder: 'Digite sua mensagem...',
    offsetBottom: 20,
    offsetSide: 20,
    showPoweredBy: true,
    width: 370,
    height: 560,
    accumulationWindow: 10,
  }
  var w = window.__SKIP_AGENT_CONFIG__ || {}
  for (var k in w) C[k] = w[k]
  if (!C.apiUrl) C.apiUrl = derivedApiUrl
  if (!C.apiUrl) {
    console.error(
      '[SKIP Agent] Nao foi possivel determinar a URL do backend. Defina ' +
        'window.__SKIP_AGENT_CONFIG__.apiUrl com <backend>/backend/v1/chat ' +
        '(o backend e o host .shrd00.internal.goskip.dev, nao o .goskip.app).',
    )
  }
  var isOpen = false,
    sessionId = '',
    convId = null,
    msgs = []
  var pendingMsgs = [],
    pendingTimer = null,
    waitingEl = null

  function boot() {
    var host = document.createElement('div')
    host.id = 'skip-agent-host'
    var sh = host.attachShadow({ mode: 'open' })
    sh.innerHTML =
      '<style>:host{all:initial;font-family:system-ui,-apple-system,sans-serif}*,*::before,*::after{box-sizing:border-box}@keyframes b{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes fI{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes wv{0%{transform:scaleY(0.3)}50%{transform:scaleY(1)}100%{transform:scaleY(0.3)}}#skip-w-root{position:fixed;z-index:999999;' +
      (C.position === 'bottom-left' ? 'left' : 'right') +
      ':' +
      C.offsetSide +
      'px;bottom:' +
      C.offsetBottom +
      'px;font-size:14px;line-height:1.5}#skip-w-btn{width:56px;height:56px;border-radius:50%;background:' +
      C.primaryColor +
      ';border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px ' +
      C.primaryColor +
      '40;position:relative;transition:transform .2s,box-shadow .2s;margin-left:auto}#skip-w-btn:hover{transform:scale(1.05);box-shadow:0 6px 24px ' +
      C.primaryColor +
      '60}#skip-w-btn svg{width:26px;height:26px;color:#fff}#skip-w-btn .close-icon{display:none}#skip-w-btn.open .chat-icon{display:none}#skip-w-btn.open .close-icon{display:block}#skip-w-chat{position:absolute;bottom:68px;' +
      (C.position === 'bottom-left' ? 'left' : 'right') +
      ':0;width:' +
      C.width +
      'px;height:' +
      C.height +
      'px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(16px) scale(.96);transition:opacity .25s,transform .25s}#skip-w-chat.open{display:flex;opacity:1;transform:translateY(0) scale(1)}#skip-w-header{background:' +
      C.primaryColor +
      ';color:#fff;padding:14px 18px;display:flex;align-items:center;gap:10px;flex-shrink:0}#skip-w-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}#skip-w-info{flex:1;min-width:0}#skip-w-name{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#skip-w-status{font-size:11px;opacity:.85;display:flex;align-items:center;gap:4px}#skip-w-status .dot{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block}#skip-w-close{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}#skip-w-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:6px;background:#f8f9fa}#skip-w-msgs::-webkit-scrollbar{width:4px}#skip-w-msgs::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:2px}.skip-w-msg{max-width:88%;padding:9px 13px;border-radius:14px;font-size:13.5px;line-height:1.5;word-break:break-word;white-space:pre-wrap;animation:fI .2s ease-out}.skip-w-msg.agent{align-self:flex-start;background:#fff;color:#1a1a2e;border:1px solid #e8e8ee;border-bottom-left-radius:4px}.skip-w-msg.user{align-self:flex-end;background:' +
      C.primaryColor +
      ';color:#fff;border-bottom-right-radius:4px}#skip-w-waiting{align-self:flex-start;display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fff;border:1px solid #e8e8ee;border-radius:14px;border-bottom-left-radius:4px;animation:fI .2s ease-out;margin-top:2px}.skip-w-waves{display:flex;align-items:center;gap:3px;height:22px}.skip-w-waves span{width:4px;background:' +
      C.primaryColor +
      ';border-radius:2px;animation:wv 0.8s ease-in-out infinite}.skip-w-waves span:nth-child(1){height:10px;animation-delay:0s}.skip-w-waves span:nth-child(2){height:16px;animation-delay:0.1s}.skip-w-waves span:nth-child(3){height:22px;animation-delay:0.2s}.skip-w-waves span:nth-child(4){height:14px;animation-delay:0.15s}.skip-w-waves span:nth-child(5){height:8px;animation-delay:0.05s}#skip-w-waiting .label{font-size:12px;color:#94a3b8;white-space:nowrap}#skip-w-typing{align-self:flex-start;display:flex;align-items:center;gap:4px;padding:12px 16px;background:#fff;border:1px solid #e8e8ee;border-radius:14px;border-bottom-left-radius:4px;animation:fI .2s ease-out}#skip-w-typing .dot{width:8px;height:8px;border-radius:50%;background:#94a3b8;animation:b 1s infinite}#skip-w-typing .dot:nth-child(2){animation-delay:.15s}#skip-w-typing .dot:nth-child(3){animation-delay:.3s}#skip-w-input-area{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid #eee;background:#fff;flex-shrink:0}#skip-w-input-area input{flex:1;border:1px solid #e0e0e8;border-radius:20px;padding:9px 14px;font-size:13.5px;font-family:inherit;outline:none;background:#f8f9fa;transition:border-color .15s}#skip-w-input-area input:focus{border-color:' +
      C.primaryColor +
      ';background:#fff}#skip-w-input-area button{width:38px;height:38px;border-radius:50%;background:' +
      C.primaryColor +
      ';border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;transition:opacity .15s}#skip-w-input-area button:disabled{opacity:.4;cursor:not-allowed}#skip-w-powered{text-align:center;padding:5px;font-size:10px;color:#aaa;border-top:1px solid #f0f0f0;flex-shrink:0}#skip-w-powered a{color:' +
      C.primaryColor +
      ';text-decoration:none}@media(max-width:480px){#skip-w-chat{width:calc(100vw - 16px);max-height:calc(100vh - 100px)}}</style><div id="skip-w-root"><div id="skip-w-btn"><span class="chat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span><span class="close-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></span></div><div id="skip-w-chat"><div id="skip-w-header"><div id="skip-w-avatar">🤖</div><div id="skip-w-info"><div id="skip-w-name">' +
      (C.agentName || 'Assistente') +
      '</div><div id="skip-w-status"><span class="dot"></span> Online</div></div><button id="skip-w-close">✕</button></div><div id="skip-w-msgs"></div><div id="skip-w-input-area"><input id="skip-w-input" type="text" placeholder="' +
      (C.inputPlaceholder || 'Digite sua mensagem...') +
      '" /><button id="skip-w-send" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div>' +
      (C.showPoweredBy
        ? '<div id="skip-w-powered">SKIP <a href="https://goskip.dev" target="_blank">AI Agent</a></div>'
        : '') +
      '</div></div>'

    function addMsg(r, c) {
      msgs.push({ role: r, content: c })
      var d = document.createElement('div')
      d.className = 'skip-w-msg ' + r
      d.textContent = c
      sh.getElementById('skip-w-msgs').appendChild(d)
      requestAnimationFrame(function () {
        sh.getElementById('skip-w-msgs').scrollTop = sh.getElementById('skip-w-msgs').scrollHeight
      })
    }

    function showWaiting() {
      if (waitingEl) return
      waitingEl = document.createElement('div')
      waitingEl.id = 'skip-w-waiting'
      waitingEl.innerHTML =
        '<div class="skip-w-waves"><span></span><span></span><span></span><span></span><span></span></div><span class="label">Pensando...</span>'
      sh.getElementById('skip-w-msgs').appendChild(waitingEl)
      requestAnimationFrame(function () {
        sh.getElementById('skip-w-msgs').scrollTop = sh.getElementById('skip-w-msgs').scrollHeight
      })
    }
    function hideWaiting() {
      if (waitingEl) {
        waitingEl.remove()
        waitingEl = null
      }
    }

    function flushPending() {
      if (pendingTimer) {
        clearTimeout(pendingTimer)
        pendingTimer = null
      }
      if (pendingMsgs.length === 0) return
      hideWaiting()
      var texts = pendingMsgs.map(function (m) {
        return m.text
      })
      pendingMsgs = []
      var typ = document.createElement('div')
      typ.id = 'skip-w-typing'
      typ.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>'
      sh.getElementById('skip-w-msgs').appendChild(typ)
      requestAnimationFrame(function () {
        sh.getElementById('skip-w-msgs').scrollTop = sh.getElementById('skip-w-msgs').scrollHeight
      })
      if (!C.apiUrl) {
        var te0 = sh.getElementById('skip-w-typing')
        if (te0) te0.remove()
        addMsg('agent', 'Widget sem apiUrl configurado. Veja o console (F12).')
        return
      }
      if (!sessionId) sessionId = 's' + Date.now() + Math.random().toString(36).slice(2, 8)
      var x = new XMLHttpRequest()
      x.open('POST', C.apiUrl, true)
      x.setRequestHeader('Content-Type', 'application/json')
      x.onload = function () {
        var te = sh.getElementById('skip-w-typing')
        if (te) te.remove()
        if (x.status >= 200 && x.status < 300) {
          try {
            var d = JSON.parse(x.responseText)
            convId = d.conversation_id
            addMsg('agent', d.content)
          } catch (e) {
            addMsg('agent', 'Erro')
          }
        } else {
          try {
            var e = JSON.parse(x.responseText)
            addMsg('agent', e.error || 'Erro ' + x.status)
          } catch (e) {
            addMsg('agent', 'Erro ' + x.status)
          }
        }
      }
      x.onerror = function () {
        var te = sh.getElementById('skip-w-typing')
        if (te) te.remove()
        addMsg('agent', 'Erro de conexao')
      }
      x.send(JSON.stringify({ messages: texts, session_id: sessionId, conversation_id: convId }))
    }

    function enqueueMsg(text) {
      pendingMsgs.push({ text: text })
      hideWaiting()
      addMsg('user', text)
      if (pendingTimer) clearTimeout(pendingTimer)
      showWaiting()
      pendingTimer = setTimeout(flushPending, C.accumulationWindow * 1000)
    }

    function doSend() {
      var t = sh.getElementById('skip-w-input').value.trim()
      if (!t) return
      sh.getElementById('skip-w-input').value = ''
      sh.getElementById('skip-w-send').disabled = true
      enqueueMsg(t)
    }

    sh.getElementById('skip-w-btn').onclick = function () {
      if (!isOpen) {
        isOpen = true
        sh.getElementById('skip-w-btn').classList.add('open')
        sh.getElementById('skip-w-chat').classList.add('open')
      } else {
        isOpen = false
        sh.getElementById('skip-w-btn').classList.remove('open')
        sh.getElementById('skip-w-chat').classList.remove('open')
      }
    }
    sh.getElementById('skip-w-close').onclick = function () {
      isOpen = false
      sh.getElementById('skip-w-btn').classList.remove('open')
      sh.getElementById('skip-w-chat').classList.remove('open')
    }
    sh.getElementById('skip-w-send').onclick = doSend
    sh.getElementById('skip-w-input').oninput = function () {
      var v = this.value.trim()
      sh.getElementById('skip-w-send').disabled = !v
      if (v && pendingMsgs.length > 0) {
        if (pendingTimer) clearTimeout(pendingTimer)
        hideWaiting()
        showWaiting()
        pendingTimer = setTimeout(flushPending, C.accumulationWindow * 1000)
      }
    }
    sh.getElementById('skip-w-input').onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        doSend()
      }
    }

    document.body.appendChild(host)
    window.__SKIP_AGENT__ = {
      open: function () {
        isOpen = false
        sh.getElementById('skip-w-btn').click()
      },
      close: function () {
        sh.getElementById('skip-w-close').click()
      },
    }
    window.__SKIP_AGENT_READY = true
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
