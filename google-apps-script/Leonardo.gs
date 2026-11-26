/**
 * Lead della landing Istituti Leonardo Consulenza.
 * Chiamato da doPost solo se payload.target === 'istituti-leonardo'.
 * Il flusso YES Consulenza resta invariato.
 */

var LEONARDO_SPREADSHEET_ID = '1nk_0mD0nqDsfhXpKGGkVweKHyEL7ThtF7RlZuMTx8kE'
var LEONARDO_SHEET_NAME = 'Consulenza'
var LEONARDO_HEADERS = [
  'NOME',
  'COGNOME',
  'EMAIL',
  'NUMERO DI TELFONO',
  'PERCORSO STUDI',
  'NOTE',
]
var LEONARDO_PIPELINE_ID = 'c82d2483-6667-430c-af10-45944f86f5d7'
var LEONARDO_STAGE_ID = '43526eae-fea9-45be-88fa-0b24ddfd76de' // NUOVO CONTATTO
var LEONARDO_CUSTOM_FIELDS = {
  percorso: '13345987-9aa3-4f6c-8f7b-11f53ea3277b',
  note: 'e75a84fe-f9dc-4075-b829-53e907319772',
}

function handleLeonardoPost_(data) {
  var firstName = String(data.first_name || data.nome || '')
  var lastName = String(data.last_name || data.cognome || '')
  var email = String(data.email || '')
  var phone = String(data.phone || data.telefono || '')
  var percorso = String(data.percorso || '')
  var note = String(data.note || '')

  var sheet = getLeonardoSheet_()
  ensureLeonardoHeaders_(sheet)
  sheet.appendRow([firstName, lastName, email, phone, percorso, note])

  var relatia = null
  var relatiaError = null
  try {
    relatia = createLeonardoRelatiaLead_({
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
      percorso: percorso,
      note: note,
    })
  } catch (relatiaErr) {
    relatiaError = String(relatiaErr)
  }

  if (relatia && relatia.contact_id) markLeonardoRowSynced_(sheet)

  return json_({
    ok: true,
    sheet: true,
    relatia: relatia,
    relatia_error: relatiaError,
  })
}

/**
 * La landing online scrive sul foglio tramite n8n.
 * syncLeonardoNewRows porta in Relatia solo le righe arrivate dopo l'avvio.
 */
function syncLeonardoNewRows() {
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(20000)) return { ok: true, skipped: 'locked' }
  try {
    var sheet = getLeonardoSheet_()
    removeLeonardoProbeRows_(sheet)
    var lastRow = sheet.getLastRow()
    var props = PropertiesService.getScriptProperties()
    var cursor = Number(props.getProperty('LEONARDO_SYNC_ROW') || '0')
    if (!cursor || cursor < 1) {
      props.setProperty('LEONARDO_SYNC_ROW', String(lastRow))
      return { ok: true, initialized: lastRow }
    }
    if (cursor > lastRow) {
      props.setProperty('LEONARDO_SYNC_ROW', String(lastRow))
      cursor = lastRow
    }
    if (lastRow <= cursor) return { ok: true, cursor: cursor, lastRow: lastRow, created: [] }

    var values = sheet.getRange(cursor + 1, 1, lastRow - cursor, 6).getValues()
    var created = []
    var processedUntil = cursor
    for (var i = 0; i < values.length; i++) {
      var rowNumber = cursor + 1 + i
      var nome = String(values[i][0] || '').trim()
      var cognome = String(values[i][1] || '').trim()
      var email = String(values[i][2] || '').trim()
      var phone = values[i][3] === '' || values[i][3] === null ? '' : String(values[i][3]).trim()
      var percorso = String(values[i][4] || '').trim()
      var note = String(values[i][5] || '').trim()
      if (!email) {
        processedUntil = rowNumber
        continue
      }
      try {
        var relatia = createLeonardoRelatiaLead_({
          first_name: nome,
          last_name: cognome,
          email: email,
          phone: phone,
          percorso: percorso,
          note: note,
        })
        created.push({ row: rowNumber, email: email, contact_id: relatia.contact_id })
        processedUntil = rowNumber
      } catch (err) {
        var message = String(err)
        if (/unique|already|esiste|duplicate/i.test(message)) {
          processedUntil = rowNumber
        } else {
          props.setProperty('LEONARDO_SYNC_ROW', String(processedUntil))
          return { ok: false, cursor: processedUntil, error: message, created: created }
        }
      }
    }
    props.setProperty('LEONARDO_SYNC_ROW', String(processedUntil))
    return { ok: true, cursor: processedUntil, created: created }
  } finally {
    lock.releaseLock()
  }
}

function markLeonardoRowSynced_(sheet) {
  var props = PropertiesService.getScriptProperties()
  var cursor = Number(props.getProperty('LEONARDO_SYNC_ROW') || '0')
  var lastRow = sheet.getLastRow()
  if (cursor >= lastRow - 1) {
    props.setProperty('LEONARDO_SYNC_ROW', String(lastRow))
  }
}

function removeLeonardoProbeRows_(sheet) {
  var values = sheet.getDataRange().getValues()
  for (var r = values.length - 1; r >= 1; r--) {
    var email = String(values[r][2] || '')
    if (
      email.indexOf('prova-crm-leonardo-') === 0 ||
      email.indexOf('test-leonardo-sheet-') === 0 ||
      email.indexOf('verifica-relatia-') === 0 ||
      email.indexOf('prova-pipe-') === 0
    ) {
      sheet.deleteRow(r + 1)
    }
  }
}

function getLeonardoSheet_() {
  var ss = SpreadsheetApp.openById(LEONARDO_SPREADSHEET_ID)
  var sheet = ss.getSheetByName(LEONARDO_SHEET_NAME)
  if (!sheet) sheet = ss.insertSheet(LEONARDO_SHEET_NAME)
  return sheet
}

function ensureLeonardoHeaders_(sheet) {
  var current = String(sheet.getRange(1, 1).getValue() || '')
  if (current) return
  sheet.getRange(1, 1, 1, LEONARDO_HEADERS.length).setValues([LEONARDO_HEADERS])
}

function createLeonardoRelatiaLead_(lead) {
  var token = getRelatiaToken_()
  var payload = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
  }
  var customValues = []
  if (lead.percorso) {
    customValues.push({
      custom_field: LEONARDO_CUSTOM_FIELDS.percorso,
      value_text: lead.percorso,
    })
  }
  if (lead.note) {
    customValues.push({
      custom_field: LEONARDO_CUSTOM_FIELDS.note,
      value_text: lead.note,
    })
  }
  if (customValues.length) payload.custom_values_create = customValues

  var contactRes = relatiaFetch_('POST', '/api/contacts/', payload, token)
  var contactId = contactRes && contactRes.id
  if (!contactId) throw new Error('Relatia: contatto non creato')

  relatiaFetch_('POST', '/api/contacts/bulk-create-deals/', {
    contact_ids: [contactId],
    pipeline_id: LEONARDO_PIPELINE_ID,
    stage_id: LEONARDO_STAGE_ID,
  }, token)

  return { contact_id: contactId, pipeline_id: LEONARDO_PIPELINE_ID }
}
