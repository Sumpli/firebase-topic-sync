# firebase-topic-sync

Batch (un)subscribe to/from Firebase topics 

Sometimes you want to delegate sending N non-critical http calls - especially when using a blocking language. This microservice handles FCM (un)subscriptions for you.

* setup

```
npm install
```

* run project (prod)

```
npm start
```

* run project (dev)

```
npm run dev
```

#### API Documentation

* HTTP API

```
HTTP POST
{
  "unsubscribe": ["testtopic1", "testtopic2"], 
  "registrationTokens": ["<fcm token>"]
}
```

* Curl example
```
curl -X POST \
-H "content-type: application/json" \
-d '{"unsubscribe": ["testtopic"], "registrationTokens": ["<token>"]}' \
localhost:3000
```

* response is 200 OK, 400 if invalid input or 500 in case of errors.

#### Docker

```
docker build -t sumpli/firebase-topic-sync .
docker run -it -e FCM_API_KEY="" -p 3000:3000 sumpli/firebase-topic-sync
```
