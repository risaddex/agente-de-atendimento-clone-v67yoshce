routerAdd('POST', '/backend/v1/chat', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Content-Type')

  const body = e.requestInfo().body || {}

  let msgs = []
  if (body.messages && Array.isArray(body.messages)) {
    msgs = body.messages.filter((m) => (m || '').trim()).map((m) => m.trim())
  } else if (body.message) {
    msgs = [body.message.trim()]
  }
  if (msgs.length === 0) return e.badRequestError('message(s) is required')

  const joined = msgs.join(' ')
  const sessionId = body.session_id || $security.randomString(16)

  let userId = ''
  try {
    const existing = $app.findFirstRecordByData('users', 'email', sessionId + '@anon.skip')
    userId = existing.id
  } catch (_) {
    const col = $app.findCollectionByNameOrId('users')
    const user = new Record(col, {
      email: sessionId + '@anon.skip',
      password: $security.randomString(24),
      passwordConfirm: $security.randomString(24),
      verified: true,
    })
    $app.save(user)
    userId = user.id
  }

  const result = $ai.agent('support-agent').chat({
    user_id: userId,
    conversation_id: body.conversation_id || null,
    message: joined,
  })

  let content = result.content || ''
  let leadSaved = false

  const leadMatch = content.match(/\[LEAD:\s*(\{.*?\})\]/s)
  if (leadMatch) {
    try {
      const leadData = JSON.parse(leadMatch[1])
      content = content.replace(leadMatch[0], '').trim()

      const col = $app.findCollectionByNameOrId('leads')
      const record = new Record(col, {
        name: leadData.name || 'Anônimo',
        phone: leadData.phone || '',
        email: leadData.email || '',
        interest: leadData.interest || '',
        preferred_date: leadData.preferred_date || '',
        category: leadData.category || '',
        doctor: leadData.doctor || '',
        source: 'widget-chat',
        status: 'new',
        conversation_id: result.conversation_id || '',
      })
      $app.save(record)
      leadSaved = true
    } catch (_) {}
  }

  return e.json(200, {
    conversation_id: result.conversation_id,
    content: content,
    message_id: result.message_id,
    lead_saved: leadSaved,
  })
})

routerAdd('OPTIONS', '/backend/v1/chat', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Content-Type')
  return e.json(204, {})
})
