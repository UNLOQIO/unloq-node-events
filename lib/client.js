'use strict';
/**
 * The Websocket client
 * Configuration arguments:
 *  - gateway: the UNLOQ.io events gateway URL (defaults to events.unloq.io)
 *  - key: The UNLOQ.io API Token to use, defaults to process.env.UNLOQ_KEY
 *  - options: additional socket.io-client options. For more, visit https://github.com/socketio/socket.io-client/blob/master/docs/API.md
 *
 * Events triggered by client
 *  - connect
 *  - disconnect
 *  - error
 */
const io = require('socket.io-client'),
  url = require('url'),
  util = require('./util'),
  EventEmitter = require('events').EventEmitter;

const config = Symbol(),
  sub = Symbol(),
  client = Symbol();

const DISPATCH_HANDLER = 'dispatch',
  EVENT_HANDLER = 'event',
  DEFAULT_GATEWAY = 'https://events.unloq.io',
  NAMESPACES = require('./namespace');

class UnloqClient extends EventEmitter {

  constructor(opt) {
    super();
    this[sub] = {}; // a map of {eventName:{opt:{},fn:[]}}
    this[config] = util.getOptions(opt, DEFAULT_GATEWAY);
    this.connected = false;
  }

  get NAMESPACE() {
    return NAMESPACES;
  }

  set NAMESPACE(v) {
  }

  /**
   * Handles event subscription
   * */
  subscribe(namespace, _action, fn) {
    if (typeof _action === 'function') {
      fn = _action;
    }
    if (typeof namespace !== 'string' || !namespace || typeof fn !== 'function') {
      return Promise.reject(new Error('unloq-namespaces: subscribe(namespace, fn) requires a namespace name and a callback function'));
    }
    let shouldCall = false;
    if (typeof this[sub][namespace] === 'undefined') {
      this[sub][namespace] = [];
      // we have to send the subscribe namespace to server.
      shouldCall = true;
    }
    let _opt = {
      namespace: namespace
    };
    if (typeof _action === 'string' || _action instanceof RegExp) {
      _opt.action = [_action];
    } else if (_action instanceof Array) {
      _opt.action = [];
      for (let j = 0; j < _action.length; j++) {
        if (typeof _action[j] === 'string' || _action[j] instanceof RegExp) {
          _opt.action.push(_action[j]);
        }
      }
    }
    let item = {
      opt: _opt,
      fn: fn
    };
    this[sub][namespace].push(item);
    if (!shouldCall) return Promise.resolve();
    return doDispatch(this, this[client], 'subscribe', {
      namespace: namespace
    });
  }

  /**
   * Handles event unsubscribing
   * */
  unsubscribe(namespace, _fn) {
    let shouldCall = false;
    if (typeof namespace !== 'string' || !namespace) {
      return Promise.reject(new Error('unloq-namespaces: unsubscribe(namespace, _fn) requires a namespace name and an optional callback function'));
    }
    // already unsubscribed.
    if (typeof this[sub][namespace] === 'undefined') {
      return Promise.resolve();
    }
    // CHECK if we have to unsubscribe every callback
    if (typeof _fn !== 'function') {
      shouldCall = true;
      delete this[sub][namespace];
    } else if (typeof _fn === 'function') {
      for (let i = 0; i < this[sub][namespace].length.length; i++) {
        if (this[sub][namespace][i].fn == _fn) {
          this[sub][namespace].splice(i, 1);
          if (this[sub][namespace].length === 0) {
            shouldCall = true;
            delete this[sub][namespace];
          }
          break;
        }
      }
    }
    if (!shouldCall) return Promise.resolve();
    return doDispatch(this, this[client], 'unsubscribe', {
      namespace: namespace
    });
  }


  /**
   * Initiates the connection to the server.
   * */
  connect() {
    if (this.connected) return Promise.resolve();
    if (!this[client]) { // connecting
      let socketObj = io(this[config].gateway, this[config].options),
        wasConnected = false,
        self = this;
      this[client] = socketObj;
      socketObj
        .on('connect', () => {
          wasConnected = true;
          this.connected = true;
          handleEvent(self, socketObj);
          this.emit('connect');
        })
        .on('disconnect', (msg) => {
          this.connected = false;
          let e;
          if (!wasConnected && msg === 'transport close') {
            e = util.error('AUTHORIZATION', 'Invalid API Key');
          }
          this.emit('disconnect', e);
          if (e) {
            try {
              socketObj.disconnect();
            } catch (e) {
              try {
                socketObj.destroy();
              } catch (e) {
              }
            }
          }
        })
        .on('error', (e) => {
          this.connected = false;
          if (typeof e === 'string' && e.indexOf('connection authorization') !== -1) {
            e = util.error('AUTHORIZATION', 'Invalid API Key');
            try {
              socketObj.disconnect();
            } catch (e) {
              try {
                socketObj.close();
              } catch (e) {
              }
            }
          }
          this.emit('disconnect', e);
        })
        .on('reconnect', () => {
          this.connected = true;
        });
    }

    let self = this;
    return new Promise((resolve, reject) => {
      self.once('connect', resolve);
      self.once('disconnect', reject);
    });
  }
}

UnloqClient.NAMESPACE = NAMESPACES;

/**
 * Handles incoming events from UNLOQ events
 * */
function handleEvent(clientObj, socketObj) {
  function onEvent(event) {
    const eventNs = event.namespace;
    if (typeof eventNs !== 'string') return;
    delete event.namespace;
    if (typeof clientObj[sub][eventNs] === 'undefined') return;
    for (let i = 0; i < clientObj[sub][eventNs].length; i++) {
      let item = clientObj[sub][eventNs][i];
      if (typeof item.opt.action !== 'undefined') {
        let matched = false;
        for (let j = 0; j < item.opt.action.length; j++) {
          if (typeof item.opt.action[j] === 'string' && event.type == item.opt.action[j]) {
            matched = true;
          } else if (item.opt.action[j] instanceof RegExp && item.opt.action[j].test(event.type)) {
            matched = true;
          }
        }
        if (!matched) continue;
      }
      try {
        clientObj[sub][eventNs][i].fn(event);
      } catch (e) {
        console.error(e);
      }
    }
  }

  socketObj.on(EVENT_HANDLER, onEvent);
  clientObj.once('disconnect', () => {
    socketObj.off(EVENT_HANDLER);
  });
  // re-subscribe on active ones.
  let namespaces = Object.keys(clientObj[sub]);
  namespaces.forEach((name) => {
    let payload = {
      namespace: name
    };
    doDispatch(clientObj, socketObj, 'subscribe', payload).catch((e) => {
      if (clientObj._errors['error']) {
        clientObj.emit('error', util.error(e));
      }
    });
  });
}

/**
 * Sends a specific event to the server.
 * This is private functionality
 * */
function doDispatch(clientObj, iObj, actionName, payload) {
  if (typeof actionName !== 'string' || !actionName) {
    return Promise.reject(util.error('DATA.INVALID', 'Missing or invalid action name'));
  }
  if (typeof payload !== 'object' || !payload) {
    payload = {};
  }
  let data = {
    type: actionName,
    payload: payload
  };
  if (clientObj.connected) {
    return new Promise((resolve, reject) => {
      iObj.emit(DISPATCH_HANDLER, data, (err, res) => {
        if (err) return reject(util.parseError(err));
        if (typeof res !== 'object' || !res) res = {};
        if (typeof res.type === 'string') delete res.type;
        resolve(res);
      });
    });
  }
  return clientObj.connect().then(() => {
    return new Promise((resolve, reject) => {
      iObj.emit(DISPATCH_HANDLER, data, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  });
}


module.exports = UnloqClient;
