const EventEmitter = require('events').EventEmitter
    , bl           = require('bl')

function create (options) {
  if (typeof options != 'object')
    throw new TypeError('must provide an options object')

  if (typeof options.path != 'string')
    throw new TypeError('must provide a \'path\' option')

  if (typeof options.token != 'string')
    throw new TypeError('must provide a \'token\' option')

  var events

  if (typeof options.events == 'string' && options.events != '*')
    events = [ options.events ]

  else if (Array.isArray(options.events) && options.events.indexOf('*') == -1)
    events = options.events

  // make it an EventEmitter, sort of
  handler.__proto__ = EventEmitter.prototype
  EventEmitter.call(handler)

  return handler

  function handler (req, res, callback) {
    if (req.url.split('?').shift() !== options.path || req.method !== 'POST')
      return callback()

    function hasError (msg) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: msg }))

      var err = new Error(msg)

      handler.emit('error', err, req)
      callback(err)
    }

    var agent   = req.headers['User-Agent']
      , token = req.headers['X-Gitee-Token']
      , event    = req.headers['X-Gitee-Event']

    if (agent !== 'git-oschina-hook')
      return hasError('Invalid User-Agent')

    if (!event)
      return hasError('No X-Gitee-Event found on request')

    if (token !== options.token)
      return hasError('The token does not match')

    if (events && events.indexOf(event) == -1)
      return hasError('X-Gitee-Event is not acceptable')

    req.pipe(bl(function (err, data) {
      if (err) {
        return hasError(err.message)
      }

      var obj

      try {
        obj = JSON.parse(data.toString())
      } catch (e) {
        return hasError(e)
      }

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')

      var emitData = {
          event   : event
        , payload : obj
        , protocol: req.protocol
        , host    : req.headers['host']
        , url     : req.url
      }

      handler.emit(event, emitData)
      handler.emit('*', emitData)
    }))
  }
}


module.exports = create
