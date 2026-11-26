/**
 * Lead di yesdiploma.it.
 * Chiamato da doPost solo se payload.target === 'yes-diploma'.
 * I flussi YES Consulenza e Istituti Leonardo restano invariati.
 *
 * Moduli del sito (tutti verso send-form.php):
 * - hero: nome e cognome in un solo campo, telefono, richiesta
 * - consulenza_home: nome, cognome, email, telefono, messaggio
 * - consulenza_contatti: come sopra, più richiesta (include il preventivo)
 * - newsletter: solo email
 *
 * "Di cosa hai bisogno?" (campo richiesta) va nel campo Extra "interesse".
 */

var DIPLOMA_PIPELINE_ID = 'bcaadf7e-5de7-4cbf-a56a-61ceacadc81f' // YES DIPLOMA
var DIPLOMA_STAGE_ID = '1e4f3977-8bd6-419b-890b-009f94ff2255' // NUOVO CONTATTO
var DIPLOMA_CUSTOM_FIELDS = {
  interesse: 'da068d85-ce7f-471c-997b-0c92db38f539',
  note: 'e75a84fe-f9dc-4075-b829-53e907319772',
}

var DIPLOMA_FORM_LABELS = {
  hero: 'Parla con un consulente (homepage)',
  consulenza_home: 'Consulenza gratuita (homepage)',
  consulenza_contatti: 'Consulenza e preventivo (pagina Contatti)',
  newsletter: 'Newsletter',
}

function handleYesDiplomaPost_(data) {
  if (String(data.website || '').trim()) {
    return json_({ ok: true, ignored: 'honeypot' })
  }

  var formName = String(data.form_name || data.form || '').trim()
  var parsed = diplomaNames_(formName, data)
  var email = String(data.email || '').trim()
  var phone = String(data.phone || data.telefono || '').trim()
  var interesse = String(data.richiesta || data.interesse || '').trim()
  var note = diplomaNote_(formName, data)

  if (!parsed.first_name && !parsed.last_name && !email && !phone) {
    return json_({ ok: false, error: 'Contatto vuoto' })
  }

  var relatia = null
  var relatiaError = null
  try {
    relatia = createYesDiplomaRelatiaLead_({
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      email: email,
      phone: phone,
      interesse: interesse,
      note: note,
    })
  } catch (relatiaErr) {
    relatiaError = String(relatiaErr)
  }

  return json_({
    ok: !relatiaError,
    form: formName,
    relatia: relatia,
    relatia_error: relatiaError,
  })
}

function diplomaNames_(formName, data) {
  var nome = String(data.nome || data.first_name || '').trim()
  var cognome = String(data.cognome || data.last_name || '').trim()

  if (formName === 'newsletter') {
    var local = emailLocalPart_(String(data.email || ''))
    return { first_name: local || 'Newsletter', last_name: '' }
  }

  if (formName === 'hero' && nome && !cognome) {
    var parts = nome.split(/\s+/)
    if (parts.length === 1) return { first_name: parts[0], last_name: '' }
    return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
  }

  return { first_name: nome, last_name: cognome }
}

function emailLocalPart_(email) {
  var at = email.indexOf('@')
  if (at <= 0) return ''
  return email.slice(0, at).replace(/[._+-]+/g, ' ').trim()
}

function diplomaNote_(formName, data) {
  var lines = []
  var label = DIPLOMA_FORM_LABELS[formName] || formName || 'Sito yesdiploma.it'
  lines.push('Modulo: ' + label)
  var messaggio = String(data.messaggio || data.note || '').trim()
  if (messaggio) lines.push(messaggio)
  var marketing = data.marketing
  if (marketing === true || marketing === 'on' || marketing === '1' || marketing === 'si' || marketing === 'sì') {
    lines.push('Consenso comunicazioni: sì')
  }
  return lines.join('\n')
}

function createYesDiplomaRelatiaLead_(lead) {
  var token = getRelatiaToken_()
  var payload = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
  }
  var customValues = []
  if (lead.interesse) {
    customValues.push({
      custom_field: DIPLOMA_CUSTOM_FIELDS.interesse,
      value_text: lead.interesse,
    })
  }
  if (lead.note) {
    customValues.push({
      custom_field: DIPLOMA_CUSTOM_FIELDS.note,
      value_text: lead.note,
    })
  }
  if (customValues.length) payload.custom_values_create = customValues

  var contactId = null
  try {
    var contactRes = relatiaFetch_('POST', '/api/contacts/', payload, token)
    contactId = contactRes && contactRes.id
  } catch (createErr) {
    var message = String(createErr)
    if (lead.email && message.indexOf('esiste') !== -1) {
      contactId = findDiplomaContactIdByEmail_(lead.email, token)
    }
    if (!contactId) throw createErr
  }
  if (!contactId) throw new Error('Relatia: contatto non creato')

  if (!diplomaContactHasPipelineDeal_(contactId, token)) {
    relatiaFetch_('POST', '/api/contacts/bulk-create-deals/', {
      contact_ids: [contactId],
      pipeline_id: DIPLOMA_PIPELINE_ID,
      stage_id: DIPLOMA_STAGE_ID,
    }, token)
  }

  return { contact_id: contactId, pipeline_id: DIPLOMA_PIPELINE_ID }
}

function findDiplomaContactIdByEmail_(email, token) {
  var found = relatiaFetch_(
    'GET',
    '/api/contacts/?email=' + encodeURIComponent(email),
    null,
    token,
  )
  var results = found && found.results ? found.results : found
  if (!results || !results.length) return null
  return results[0].id || null
}

function diplomaContactHasPipelineDeal_(contactId, token) {
  var found = relatiaFetch_(
    'GET',
    '/api/deals/?contact=' + encodeURIComponent(contactId),
    null,
    token,
  )
  var results = found && found.results ? found.results : found
  if (!results || !results.length) return false
  for (var i = 0; i < results.length; i++) {
    var deal = results[i]
    if (deal.pipeline_name === 'YES DIPLOMA') return true
    if (deal.pipeline === DIPLOMA_PIPELINE_ID || deal.pipeline_id === DIPLOMA_PIPELINE_ID) return true
  }
  return false
}
