const micro = require('micro')
const test = require('ava')
const listen = require('test-listen')
const request = require('request-promise')
const mockery = require('mockery')

let subscribeCallCounter = 0
let unsubscribeCallCounter = 0


/*
  Mocking, setup, helpers
 */

function FCM() { }
FCM.prototype.subscribeToTopic = (tokens, topic) => {
  console.log('subscribeToTopic called!')
  subscribeCallCounter++
}
FCM.prototype.unsubscribeToTopic = (tokens, topic) => {
  console.log('unsubscribeFromTopic called!')
  unsubscribeCallCounter++
}

mockery.registerMock('firebase-admin', firebaseMock)
mockery.registerMock('fcm-node', FCM)
mockery.registerAllowables(['./server.js', 'micro'])
mockery.enable()


// require server after mocks in place
const server = require('./server.js')
const service = micro(server)


// helper for posting with request-promise
const post = (uri, body) => request({
  method: 'POST', json: true, uri, body,
})


/*
  Tests
 */

test('input data is validated I', async t => {
  mockery.enable()
  const url = await listen(service)
  try {
    const body = await post(url, { subscribe: 'fail' })
  } catch (e) {
    t.is(e.response.statusCode, 400)
    t.deepEqual(e.response.body, {
      error: 'invalid-data',
      message: 'subscribe and unsubscribe should be lists of topics.',
    })
  }
  service.close()
})


test('input data is validated II', async t => {
  mockery.enable()
  const url = await listen(service)
  try {
    const body = await post(url, {
      subscribe: ['a'],
      unsubscribe: ['b'],
      registrationTokens: 'fail'
    })
  } catch (e) {
    t.is(e.response.statusCode, 400)
    t.deepEqual(e.response.body, {
      error: 'invalid-data',
      message: 'registrationTokens should be a list of Firebase registration tokens',
    })
  }
  service.close()
})


test('valid data -> 200', async t => {
  const url = await listen(service)
  const body = await post(url, {
    subscribe: ['a', 'b', 'c'],
    unsubscribe: ['a', 'b'],
    registrationTokens: ['c'],
  }) // no error -> 200 OK

  t.deepEqual(body, {})
  t.is(subscribeCallCounter, 3)
  t.is(unsubscribeCallCounter, 2)
})
