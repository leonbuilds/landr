// Boss 投递助手 content script
// 触发：URL 包含 #__aija_apply=BASE64({appId, greeting, apiBase})
// 行为：
//   1. 解析 hash → 拿到 greeting + appId + apiBase
//   2. 等页面 hydrate（探到 .job-name 等）
//   3. 顶部注入黄色横幅：可编辑 greeting + [取消] [确认发送]
//   4. 点确认：模拟点 Boss "立即沟通" → 输入 greeting → 点发送
//   5. 监听 location 变化：跳到 /chat/* → 视为成功 → 通过 SW PATCH application 状态
;(function () {
  if (window.__aija_apply_initialized) return
  window.__aija_apply_initialized = true

  function parsePayload() {
    var m = location.hash.match(/#__aija_apply=([^&]+)/)
    if (!m) return null
    try {
      var json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))
      return JSON.parse(json)
    } catch (e) {
      console.warn("[aija-apply] decode failed", e)
      return null
    }
  }

  var payload = parsePayload()
  if (!payload || !payload.appId) return

  // 等页面 hydrate（最多 30s）
  function waitFor(predicate, timeoutMs) {
    return new Promise(function (resolve) {
      var t0 = Date.now()
      ;(function check() {
        try {
          var v = predicate()
          if (v) return resolve(v)
        } catch {}
        if (Date.now() - t0 > timeoutMs) return resolve(null)
        setTimeout(check, 500)
      })()
    })
  }

  function $(sel, root) { return (root || document).querySelector(sel) }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)) }

  function findChatBtn() {
    // Boss 详情页"立即沟通"按钮多种可能
    var labels = ["立即沟通", "继续沟通", "去聊聊"]
    for (var i = 0; i < labels.length; i++) {
      var els = $$("a, button, span")
      for (var j = 0; j < els.length; j++) {
        var t = (els[j].textContent || "").trim()
        if (t === labels[i] || (t.length < 8 && t.indexOf(labels[i]) === 0)) {
          // climb to clickable parent if span
          var el = els[j]
          while (el && el.tagName !== "A" && el.tagName !== "BUTTON") {
            if (el.onclick || el.getAttribute("role") === "button" || el.classList.contains("btn-startchat")) break
            el = el.parentElement
          }
          if (el) return el
        }
      }
    }
    return null
  }

  function findApplyBtn() {
    // "投简历" / "投递简历"
    var labels = ["投简历", "投递简历", "投递"]
    var els = $$("a, button, span")
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || "").trim()
      for (var j = 0; j < labels.length; j++) {
        if (t === labels[j]) return els[i]
      }
    }
    return null
  }

  function showBanner() {
    var existing = document.getElementById("aija-apply-banner")
    if (existing) existing.remove()

    var wrap = document.createElement("div")
    wrap.id = "aija-apply-banner"
    wrap.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:2147483647",
      "background:linear-gradient(135deg,#fef3c7,#fde68a)",
      "border-bottom:2px solid #f59e0b",
      "padding:12px 20px", "box-shadow:0 4px 12px rgba(0,0,0,.1)",
      "font-family:-apple-system,BlinkMacSystemFont,sans-serif",
    ].join(";")

    wrap.innerHTML =
      "<div style='max-width:960px;margin:0 auto;display:flex;gap:12px;align-items:start'>" +
      "  <div style='flex:1'>" +
      "    <div style='font-size:13px;font-weight:600;color:#92400e;margin-bottom:6px'>🤖 AI 求职 Agent · 投递助手</div>" +
      "    <textarea id='aija-greeting' rows='3' style='width:100%;border:1px solid #d97706;border-radius:6px;padding:8px;font-size:13px;color:#1f2937;background:#fffbeb;resize:vertical;'></textarea>" +
      "    <div style='font-size:11px;color:#92400e;margin-top:4px'>检查打招呼语，可以改两句更对得上你的风格。点确认后我帮你点 Boss 的"立即沟通"并发送。</div>" +
      "    <div id='aija-status' style='font-size:12px;color:#7c2d12;margin-top:4px'></div>" +
      "  </div>" +
      "  <div style='display:flex;flex-direction:column;gap:6px;flex-shrink:0'>" +
      "    <button id='aija-confirm' style='background:#f59e0b;color:#fff;border:0;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600'>确认发送</button>" +
      "    <button id='aija-cancel' style='background:#fff;color:#92400e;border:1px solid #d97706;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer'>取消</button>" +
      "  </div>" +
      "</div>"
    document.body.insertBefore(wrap, document.body.firstChild)
    document.getElementById("aija-greeting").value = payload.greeting || ""

    document.getElementById("aija-cancel").addEventListener("click", function () {
      wrap.remove()
      // 清除 hash，避免刷新重复触发
      try { history.replaceState(null, "", location.pathname + location.search) } catch {}
    })

    document.getElementById("aija-confirm").addEventListener("click", function () {
      var greeting = document.getElementById("aija-greeting").value.trim()
      if (!greeting) { setStatus("打招呼语不能为空"); return }
      doSend(greeting)
    })
  }

  function setStatus(text) {
    var el = document.getElementById("aija-status")
    if (el) el.textContent = text
  }

  async function doSend(greeting) {
    var confirmBtn = document.getElementById("aija-confirm")
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "处理中…" }
    setStatus("正在查找 Boss 立即沟通按钮…")

    // 1. find 立即沟通
    var chatBtn = findChatBtn()
    if (!chatBtn) {
      var applyBtn = findApplyBtn()
      if (applyBtn) {
        setStatus("⚠ 此岗位仅支持「投简历」（不支持立即沟通）。请确保你已在 Boss 上传简历，然后手动点击页面上的「投简历」按钮。")
      } else {
        setStatus("⚠ 没找到立即沟通/投简历按钮。可能 Boss 改了页面，请手动操作。")
      }
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "确认发送" }
      return
    }

    setStatus("点击立即沟通…")
    chatBtn.click()

    // 2. wait for chat dialog/textarea
    var textarea = await waitFor(function () {
      return $("textarea.input-area, textarea[placeholder*='打招呼'], .greet-dialog textarea, .dialog-container textarea, textarea")
    }, 8000)

    if (!textarea) {
      setStatus("⚠ 没有弹出打招呼输入框。可能 Boss 跳转太快或需要补全简历。请手动发送。")
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "确认发送" }
      return
    }

    // 3. fill textarea (need to fire React-friendly events)
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set
    nativeSetter.call(textarea, greeting)
    textarea.dispatchEvent(new Event("input", { bubbles: true }))
    textarea.dispatchEvent(new Event("change", { bubbles: true }))

    setStatus("已填入打招呼语，正在发送…")

    // 4. find send button (in modal context)
    var sendBtn = await waitFor(function () {
      var btns = $$("button, a")
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || "").trim()
        if (t === "发送" || t === "立即沟通" || t === "确定") return btns[i]
      }
      return null
    }, 3000)

    if (sendBtn) {
      sendBtn.click()
      setStatus("✓ 已发送，等待 Boss 跳转…")
      watchForChat()
    } else {
      setStatus("⚠ 没找到发送按钮。已为你填好打招呼语，请手动点页面里的"发送"。")
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "确认发送" }
    }
  }

  function watchForChat() {
    var startUrl = location.href
    var t0 = Date.now()
    var iv = setInterval(function () {
      if (location.href !== startUrl && /\/chat\b/.test(location.href)) {
        clearInterval(iv)
        notifyServerApplied()
        return
      }
      // also detect "已发送" toast as fallback
      var toast = $$("div, span").find(function (el) {
        var t = (el.textContent || "").trim()
        return t === "发送成功" || t === "已发送" || t.indexOf("已成功") === 0
      })
      if (toast) {
        clearInterval(iv)
        notifyServerApplied()
        return
      }
      if (Date.now() - t0 > 15000) {
        clearInterval(iv)
        setStatus("⚠ 未检测到投递成功跳转。如果你看到 Boss 提示发送成功，可以手动回看板把状态标为「已投递」。")
      }
    }, 500)
  }

  function notifyServerApplied() {
    setStatus("✓ 投递成功，正在更新申请状态…")
    chrome.runtime.sendMessage(
      { type: "APPLY_DONE", appId: payload.appId, apiBase: payload.apiBase },
      function (resp) {
        if (chrome.runtime.lastError) {
          setStatus("✓ 已发送，但回写状态失败：" + chrome.runtime.lastError.message)
          return
        }
        if (resp && resp.ok) {
          setStatus("✓ 投递完成，已自动标记为「已投递」。")
          var b = document.getElementById("aija-apply-banner")
          if (b) {
            b.style.background = "linear-gradient(135deg,#d1fae5,#a7f3d0)"
            b.style.borderBottomColor = "#059669"
          }
        } else {
          setStatus("✓ 已发送。状态回写失败：" + (resp && resp.error || "未知"))
        }
      },
    )
  }

  // 等岗位详情页元素出现再注入横幅（避免太早，DOM 还没渲染）
  waitFor(function () {
    return $(".name h1, [class*='job-name'], h1")
  }, 30000).then(function (el) {
    if (!el) return
    showBanner()
  })
})()
