/**
 * YES! Consulenza — Webhook
 * - Scrive sul foglio Google "consulenza"
 * - Crea contatto + deal nella pipeline Relatia "YES GROUP"
 *
 * Deploy: clasp push && clasp deploy
 * Il token Relatia sta in Config.gs (gitignored).
 */

var SPREADSHEET_ID = '1EF7cya3KMguCli6UaddXMAg-H7FBW5EfdNdpKRAoeU4'
var SHEET_NAME = 'consulenza'
var HEADERS = [
  'nome',
  'cognome',
  'email',
  'numero di telefono',
  'sede',
  'interesse',
  'lingua di interesse',
]

var RELATIA_BASE = 'https://yesgroup.relatiacrm.com'
var RELATIA_PIPELINE_ID = 'c48f8c37-6163-448d-a0da-7451e174232d'
var RELATIA_STAGE_ID = '6db9e34b-0823-42c6-b22e-4cdec5716233' // NUOVO CONTATTO

// Campi Extra Relatia (scheda contatto) — key → id
var RELATIA_CUSTOM_FIELDS = {
  sede: '04dee82c-dbd7-4af6-84e4-b30cda48fb5e',
  interesse: 'da068d85-ce7f-471c-997b-0c92db38f539',
  lingua_interesse: 'ed954358-9ffc-461c-b7d2-1618ccb3582d',
  meta_campaign_name: '8072d34a-8941-41bf-afb4-12573bba66f8',
  meta_adset_name: '2481f792-73dd-40f7-b841-1bdff7f28dad',
  meta_ad_name: '19db6baf-b702-4021-ae51-ac191d2a5b9a',
}

var META_UTM_SOURCES = {
  fb: true,
  ig: true,
  facebook: true,
  instagram: true,
  meta: true,
  an: true,
  msg: true,
  th: true,
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}'
    var data = JSON.parse(raw)

    if (data.target === 'istituti-leonardo-sync') {
      return json_(syncLeonardoNewRows())
    }

    if (data.target === 'istituti-leonardo') {
      return handleLeonardoPost_(data)
    }

    if (data.target === 'yes-diploma') {
      return handleYesDiplomaPost_(data)
    }

    var firstName = String(data.first_name || data.nome || '')
    var lastName = String(data.last_name || data.cognome || '')
    var email = String(data.email || '')
    var phone = String(data.phone || data.numero || data['numero di telefono'] || '')
    var sede = String(data.sede || '')
    var interesse = String(data.interesse || '')
    var lingua = String(data.lingua || data['lingua di interesse'] || '')

    var sheet = getConsulenzaSheet_()
    ensureHeaders_(sheet)
    sheet.appendRow([firstName, lastName, email, phone, sede, interesse, lingua])

    // Il foglio Google resta sempre la fonte primaria: se Relatia fallisce
    // il lead è comunque salvato e la landing riceve ok.
    var relatia = null
    var relatiaError = null
    try {
      relatia = createRelatiaLead_({
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        sede: sede,
        interesse: interesse,
        lingua: lingua,
        source: String(data.source || 'landing-consulenza'),
        campaign: String(data.campaign || ''),
        utm_source: String(data.utm_source || ''),
        utm_campaign: String(data.utm_campaign || ''),
        utm_term: String(data.utm_term || ''),
        utm_content: String(data.utm_content || ''),
        fbclid: String(data.fbclid || ''),
        gclid: String(data.gclid || ''),
      })
    } catch (relatiaErr) {
      relatiaError = String(relatiaErr)
    }

    return json_({ ok: true, sheet: true, relatia: relatia, relatia_error: relatiaError })
  } catch (err) {
    return json_({ ok: false, error: String(err) })
  }
}

function doGet() {
  return json_({
    ok: true,
    service: 'yes-consulenza-leads',
    sheet: SHEET_NAME,
    pipeline: 'YES GROUP',
  })
}

function getConsulenzaSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  var sheet = ss.getSheetByName(SHEET_NAME)
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME)
  return sheet
}

function ensureHeaders_(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
}

function getRelatiaToken_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('RELATIA_TOKEN')
  if (fromProps) return fromProps
  if (typeof RELATIA_TOKEN !== 'undefined' && RELATIA_TOKEN) return RELATIA_TOKEN
  throw new Error('RELATIA_TOKEN mancante: configura Config.gs o Script Properties')
}

function isMetaLead_(lead) {
  if (lead.fbclid) return true
  var source = String(lead.utm_source || '')
    .trim()
    .toLowerCase()
  return Boolean(source && META_UTM_SOURCES[source])
}

function buildCustomValues_(lead) {
  var values = []
  if (lead.sede) {
    values.push({
      custom_field: RELATIA_CUSTOM_FIELDS.sede,
      value_text: lead.sede,
    })
  }
  if (lead.interesse) {
    values.push({
      custom_field: RELATIA_CUSTOM_FIELDS.interesse,
      value_text: lead.interesse,
    })
  }
  if (lead.lingua) {
    values.push({
      custom_field: RELATIA_CUSTOM_FIELDS.lingua_interesse,
      value_text: lead.lingua,
    })
  }
  if (isMetaLead_(lead)) {
    if (lead.utm_campaign) {
      values.push({
        custom_field: RELATIA_CUSTOM_FIELDS.meta_campaign_name,
        value_text: lead.utm_campaign,
      })
    }
    if (lead.utm_term) {
      values.push({
        custom_field: RELATIA_CUSTOM_FIELDS.meta_adset_name,
        value_text: lead.utm_term,
      })
    }
    if (lead.utm_content) {
      values.push({
        custom_field: RELATIA_CUSTOM_FIELDS.meta_ad_name,
        value_text: lead.utm_content,
      })
    }
  }
  return values
}

function createRelatiaLead_(lead) {
  var token = getRelatiaToken_()
  var payload = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
  }
  if (lead.gclid) {
    payload.gclid = lead.gclid
  }
  var customValues = buildCustomValues_(lead)
  if (customValues.length) {
    payload.custom_values_create = customValues
  }

  var contactRes = relatiaFetch_('POST', '/api/contacts/', payload, token)

  var contactId = contactRes && contactRes.id
  if (!contactId) throw new Error('Relatia: contatto non creato')

  relatiaFetch_('POST', '/api/contacts/bulk-create-deals/', {
    contact_ids: [contactId],
    pipeline_id: RELATIA_PIPELINE_ID,
    stage_id: RELATIA_STAGE_ID,
  }, token)

  return { contact_id: contactId, pipeline_id: RELATIA_PIPELINE_ID }
}

function relatiaFetch_(method, path, body, token) {
  var res = UrlFetchApp.fetch(RELATIA_BASE + path, {
    method: method,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
    },
    payload: body ? JSON.stringify(body) : undefined,
    muteHttpExceptions: true,
  })
  var code = res.getResponseCode()
  var text = res.getContentText()
  var parsed = {}
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    parsed = { raw: text }
  }
  if (code < 200 || code >= 300) {
    throw new Error('Relatia ' + method + ' ' + path + ' → HTTP ' + code + ' ' + text)
  }
  return parsed
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
