const {json, send} = require('micro')
const FCM = require('fcm-node')
require('console-stamp')(console, {pattern: 'dd/mm/yyyy HH:MM:ss.l'})

const serverKey = process.env.FCM_API_KEY
if (!serverKey) console.warn('FCM_API_KEY is not set')
const fcm = new FCM(serverKey)

/*
Micro error handling
https://github.com/zeit/micro#error-handling
 */
const handleErrors = fn => async (req, res) => {
  try {
    return await fn(req, res)
  } catch (err) {
    console.error(err.stack)
    send(res, 500, {error: 'internal-error', message: 'Internal server error'})
  }
}

/*
Callback for:
https://github.com/jlcvp/fcm-node#subscribe-device-tokens-to-topics
 */
function fcmCallback(err, res) {
  if (err) {
    console.error('fail:', err)
    return
  }

  const errors = res.results.filter(obj => ('error' in obj))
  if (errors.length) {
    errors.forEach(obj => {console.error('error:', obj.error)})
  } else {
    console.info('success:', res.results)
  }
}

const FCM_MAX_RECIPIENTS = 1000

/**
 * Produces batches of a given chunk size
 * @param {Object[]} data
 * @param {number} chunk_size
 */
function* get_chunk(data, chunk_size = FCM_MAX_RECIPIENTS) {
  chunk_size = chunk_size && chunk_size >= 1 ? Math.floor(chunk_size) : FCM_MAX_RECIPIENTS
  const len = data.length
  const chunk_number = Math.ceil(len / chunk_size)
  for (let i = 0; i < chunk_number; i++) {
    yield data.slice(i * chunk_size, Math.min((i + 1) * chunk_size, len))
  }
}

/*
Main

accepts HTTP POST with following JSON data:

{
  "subscribe": ['topic-a', 'topic-b'],
  "unsubscribe": ['topic-c', 'topic-d'],
  "registrationTokens": ['123']
}

->

Firebase:
  subscribe 'topic-a'
  subscribe 'topic-b'
  unsubscribe 'topic-c'
  unsubscribe 'topic-d'

 */

module.exports = handleErrors(async (req, res) => {
  const data = await json(req)
  const subscribe = data['subscribe'] || []
  const unsubscribe = data['unsubscribe'] || []
  const registrationTokens = data['registrationTokens'] || []

  // sanity checks

  const isTopicsValid = Array.isArray(subscribe) && Array.isArray(unsubscribe)
  if (!isTopicsValid) {
    return send(res, 400, {
      error: 'invalid-data',
      message: 'subscribe and unsubscribe should be lists of topics.'
    })
  }

  if (!Array.isArray(registrationTokens)) {
    return send(res, 400, {
      error: 'invalid-data',
      message: 'registrationTokens should be a list of Firebase registration tokens'
    })
  }

  // call firebase asynchronously & return 200 OK
  // some requests might fail but we can periodically
  // diff state of topics with our own backend to prevent corruptions in data

  subscribe.map(topic => {
    for (let registrationTokens_chunk of get_chunk(registrationTokens)) {
      fcm.subscribeToTopic(registrationTokens_chunk, topic, fcmCallback)
    }
  })

  unsubscribe.map(topic => {
    for (let registrationTokens_chunk of get_chunk(registrationTokens)) {
      fcm.unsubscribeToTopic(registrationTokens_chunk, topic, fcmCallback)
    }
  })

  // early return, fcm calls are still pending
  return send(res, 200, {})
})
