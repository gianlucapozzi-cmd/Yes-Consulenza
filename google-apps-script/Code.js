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

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}'
    var data = JSON.parse(raw)

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

    var relatia = createRelatiaLead_({
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
      sede: sede,
      interesse: interesse,
      lingua: lingua,
      source: String(data.source || 'landing-consulenza'),
      campaign: String(data.campaign || ''),
    })

    return json_({ ok: true, relatia: relatia })
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

function createRelatiaLead_(lead) {
  var token = getRelatiaToken_()
  var contactRes = relatiaFetch_('POST', '/api/contacts/', {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
  }, token)

  var contactId = contactRes && contactRes.id
  if (!contactId) throw new Error('Relatia: contatto non creato')

  relatiaFetch_('POST', '/api/contacts/bulk-create-deals/', {
    contact_ids: [contactId],
    pipeline_id: RELATIA_PIPELINE_ID,
    stage_id: RELATIA_STAGE_ID,
  }, token)

  var noteLines = []
  if (lead.sede) noteLines.push('Sede: ' + lead.sede)
  if (lead.interesse) noteLines.push('Interesse: ' + lead.interesse)
  if (lead.lingua) noteLines.push('Lingua: ' + lead.lingua)
  if (lead.source) noteLines.push('Source: ' + lead.source)
  if (lead.campaign) noteLines.push('Campaign: ' + lead.campaign)
  if (noteLines.length) {
    relatiaFetch_('POST', '/api/notes/', {
      contact: contactId,
      content: noteLines.join('\n'),
    }, token)
  }

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
