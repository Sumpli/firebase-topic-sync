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
    fcm.subscribeToTopic(registrationTokens, topic, fcmCallback)
  })

  unsubscribe.map(topic => {
    fcm.unsubscribeToTopic(registrationTokens, topic, fcmCallback)
  })

  // early return, fcm calls are still pending
  return send(res, 200, {})
})
