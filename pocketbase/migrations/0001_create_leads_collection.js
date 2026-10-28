migrate(
  (app) => {
    // Campos gravados por pocketbase/hooks/chat.js (ao parsear o marcador
    // [LEAD: {...}] da resposta do agente) e lidos por src/pages/LeadsPipeline.tsx.
    //
    // `status` e' text, nao select, para manter paridade com os projetos que ja
    // rodam em producao — o tipo de um campo e' imutavel no PocketBase. Os
    // valores aceitos (new, contacted, qualified, converted, lost) sao
    // controlados pelo hook e pelo painel.
    const TEXT_FIELDS = [
      'name',
      'phone',
      'email',
      'interest',
      'preferred_date',
      'category',
      'doctor',
      'source',
      'status',
      'conversation_id',
    ]

    let col = null
    try {
      col = app.findCollectionByNameOrId('leads')
    } catch (_) {}

    if (!col) {
      const fields = TEXT_FIELDS.map((name) => ({ name: name, type: 'text' }))
      fields.push({ name: 'created', type: 'autodate', onCreate: true, onUpdate: false })
      fields.push({ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true })

      app.save(
        new Collection({
          name: 'leads',
          type: 'base',
          // Somente superusuarios: leads contem dados pessoais (nome, telefone,
          // e-mail). O widget nunca le a colecao — quem grava e' o hook, que roda
          // server-side e ignora as regras. O painel /leads exige login de admin.
          listRule: null,
          viewRule: null,
          createRule: null,
          updateRule: null,
          deleteRule: null,
          fields: fields,
          indexes: [
            'CREATE INDEX idx_leads_created ON leads (created DESC)',
            'CREATE INDEX idx_leads_status ON leads (status)',
            'CREATE INDEX idx_leads_conversation_id ON leads (conversation_id)',
          ],
        }),
      )
      return
    }

    // A colecao ja existe: repara o que falta sem tocar nos registros.
    TEXT_FIELDS.forEach((name) => {
      if (!col.fields.getByName(name)) {
        col.fields.add(new TextField({ name: name }))
      }
    })

    let addedCreated = false
    let addedUpdated = false

    if (!col.fields.getByName('created')) {
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      addedCreated = true
    }
    if (!col.fields.getByName('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
      addedUpdated = true
    }

    app.save(col)

    // Os indices sao criados num segundo save para garantir que as colunas
    // acima ja existam na tabela.
    col = app.findCollectionByNameOrId('leads')
    col.addIndex('idx_leads_created', false, 'created DESC', '')
    col.addIndex('idx_leads_status', false, 'status', '')
    col.addIndex('idx_leads_conversation_id', false, 'conversation_id', '')
    app.save(col)

    // autodate so preenche em novos registros. Sem backfill os leads ja
    // capturados ficam com created/updated vazios, e tanto o sort '-created'
    // quanto o new Date(lead.created) do painel quebram.
    if (addedCreated) {
      app
        .db()
        .newQuery(
          "UPDATE leads SET created = strftime('%Y-%m-%d %H:%M:%fZ', 'now') WHERE created IS NULL OR created = ''",
        )
        .execute()
    }
    if (addedUpdated) {
      app
        .db()
        .newQuery(
          "UPDATE leads SET updated = strftime('%Y-%m-%d %H:%M:%fZ', 'now') WHERE updated IS NULL OR updated = ''",
        )
        .execute()
    }
  },
  (app) => {
    // Esta e' a migration base da colecao: reverte-la remove a tabela inteira,
    // incluindo os leads capturados.
    app.delete(app.findCollectionByNameOrId('leads'))
  },
)
