var Faye = (typeof Faye === 'object') ? Faye : {};
if (typeof window !== 'undefined') window.Faye = Faye;

Faye.extend = function(dest, source, overwrite) {
  if (!source) return dest;
  for (var key in source) {
    if (!source.hasOwnProperty(key)) continue;
    if (dest.hasOwnProperty(key) && overwrite === false) continue;
    if (dest[key] !== source[key])
      dest[key] = source[key];
  }
  return dest;
};

Faye.extend(Faye, {
  VERSION:          '0.8.0',
  
  BAYEUX_VERSION:   '1.0',
  ID_LENGTH:        128,
  JSONP_CALLBACK:   'jsonpcallback',
  CONNECTION_TYPES: ['long-polling', 'cross-origin-long-polling', 'callback-polling', 'websocket', 'eventsource', 'in-process'],
  
  MANDATORY_CONNECTION_TYPES: ['long-polling', 'callback-polling', 'in-process'],
  
  ENV: (function() { return this })(),
  
  random: function(bitlength) {
    bitlength = bitlength || this.ID_LENGTH;
    if (bitlength > 32) {
      var parts  = Math.ceil(bitlength / 32),
          string = '';
      while (parts--) string += this.random(32);
      return string;
    }
    var limit   = Math.pow(2, bitlength) - 1,
        maxSize = limit.toString(36).length,
        string  = Math.floor(Math.random() * limit).toString(36);
    
    while (string.length < maxSize) string = '0' + string;
    return string;
  },
  
  copyObject: function(object) {
    var clone, i, key;
    if (object instanceof Array) {
      clone = [];
      i = object.length;
      while (i--) clone[i] = Faye.copyObject(object[i]);
      return clone;
    } else if (typeof object === 'object') {
      clone = {};
      for (key in object) clone[key] = Faye.copyObject(object[key]);
      return clone;
    } else {
      return object;
    }
  },
  
  commonElement: function(lista, listb) {
    for (var i = 0, n = lista.length; i < n; i++) {
      if (this.indexOf(listb, lista[i]) !== -1)
        return lista[i];
    }
    return null;
  },
  
  indexOf: function(list, needle) {
    if (list.indexOf) return list.indexOf(needle);
    
    for (var i = 0, n = list.length; i < n; i++) {
      if (list[i] === needle) return i;
    }
    return -1;
  },
  
  map: function(object, callback, context) {
    if (object.map) return object.map(callback, context);
    var result = [];
    
    if (object instanceof Array) {
      for (var i = 0, n = object.length; i < n; i++) {
        result.push(callback.call(context || null, object[i], i));
      }
    } else {
      for (var key in object) {
        if (!object.hasOwnProperty(key)) continue;
        result.push(callback.call(context || null, key, object[key]));
      }
    }
    return result;
  },
  
  filter: function(array, callback, context) {
    var result = [];
    for (var i = 0, n = array.length; i < n; i++) {
      if (callback.call(context || null, array[i], i))
        result.push(array[i]);
    }
    return result;
  },
  
  asyncEach: function(list, iterator, callback, context) {
    var n       = list.length,
        i       = -1,
        calls   = 0,
        looping = false;

    var iterate = function() {
      calls -= 1;
      i += 1;
      if (i === n) return callback && callback.call(context);
      iterator(list[i], resume);
    };

    var loop = function() {
      if (looping) return;
      looping = true;
      while (calls > 0) iterate();
      looping = false;
    };

    var resume = function() {
      calls += 1;
      loop();
    };
    resume();
  },
  
  // http://assanka.net/content/tech/2009/09/02/json2-js-vs-prototype/
  toJSON: function(object) {
    if (this.stringify)
      return this.stringify(object, function(key, value) {
        return (this[key] instanceof Array)
            ? this[key]
            : value;
      });
    
    return JSON.stringify(object);
  },
  
  timestamp: function() {
    var date   = new Date(),
        year   = date.getFullYear(),
        month  = date.getMonth() + 1,
        day    = date.getDate(),
        hour   = date.getHours(),
        minute = date.getMinutes(),
        second = date.getSeconds();
    
    var pad = function(n) {
      return n < 10 ? '0' + n : String(n);
    };
    
    return pad(year) + '-' + pad(month) + '-' + pad(day) + ' ' +
           pad(hour) + ':' + pad(minute) + ':' + pad(second);
  }
});


Faye.Class = function(parent, methods) {
  if (typeof parent !== 'function') {
    methods = parent;
    parent  = Object;
  }
  
  var klass = function() {
    if (!this.initialize) return this;
    return this.initialize.apply(this, arguments) || this;
  };
  
  var bridge = function() {};
  bridge.prototype = parent.prototype;
  
  klass.prototype = new bridge();
  Faye.extend(klass.prototype, methods);
  
  return klass;
};


Faye.Namespace = Faye.Class({
  initialize: function() {
    this._used = {};
  },
  
  exists: function(id) {
    return this._used.hasOwnProperty(id);
  },
  
  generate: function() {
    var name = Faye.random();
    while (this._used.hasOwnProperty(name))
      name = Faye.random();
    return this._used[name] = name;
  },
  
  release: function(id) {
    delete this._used[id];
  }
});


Faye.Error = Faye.Class({
  initialize: function(code, params, message) {
    this.code    = code;
    this.params  = Array.prototype.slice.call(params);
    this.message = message;
  },
  
  toString: function() {
    return this.code + ':' +
           this.params.join(',') + ':' +
           this.message;
  }
});

Faye.Error.parse = function(message) {
  message = message || '';
  if (!Faye.Grammar.ERROR.test(message)) return new this(null, [], message);

  var parts   = message.split(':'),
      code    = parseInt(parts[0]),
      params  = parts[1].split(','),
      message = parts[2];

  return new this(code, params, message);
};


Faye.Error.versionMismatch = function() {
  return new this(300, arguments, "Version mismatch").toString();
};

Faye.Error.conntypeMismatch = function() {
  return new this(301, arguments, "Connection types not supported").toString();
};

Faye.Error.extMismatch = function() {
  return new this(302, arguments, "Extension mismatch").toString();
};

Faye.Error.badRequest = function() {
  return new this(400, arguments, "Bad request").toString();
};

Faye.Error.clientUnknown = function() {
  return new this(401, arguments, "Unknown client").toString();
};

Faye.Error.parameterMissing = function() {
  return new this(402, arguments, "Missing required parameter").toString();
};

Faye.Error.channelForbidden = function() {
  return new this(403, arguments, "Forbidden channel").toString();
};

Faye.Error.channelUnknown = function() {
  return new this(404, arguments, "Unknown channel").toString();
};

Faye.Error.channelInvalid = function() {
  return new this(405, arguments, "Invalid channel").toString();
};

Faye.Error.extUnknown = function() {
  return new this(406, arguments, "Unknown extension").toString();
};

Faye.Error.publishFailed = function() {
  return new this(407, arguments, "Failed to publish").toString();
};

Faye.Error.serverError = function() {
  return new this(500, arguments, "Internal server error").toString();
};



Faye.Deferrable = {
  callback: function(callback, context) {
    if (!callback) return;
    
    if (this._deferredStatus === 'succeeded')
      return callback.apply(context, this._deferredArgs);
    
    this._callbacks = this._callbacks || [];
    this._callbacks.push([callback, context]);
  },
  
  timeout: function(seconds, message) {
    var _this = this;
    var timer = Faye.ENV.setTimeout(function() {
      _this.setDeferredStatus('failed', message);
    }, seconds * 1000);
    this._timer = timer;
  },
  
  errback: function(callback, context) {
    if (!callback) return;

    if (this._deferredStatus === 'failed')
      return callback.apply(context, this._deferredArgs);

    this._errbacks = this._errbacks || [];
    this._errbacks.push([callback, context]);
  },

  setDeferredStatus: function() {
    if (this._timer)
      Faye.ENV.clearTimeout(this._timer);

    var args   = Array.prototype.slice.call(arguments),
        status = args.shift(),
        callbacks;
    
    this._deferredStatus = status;
    this._deferredArgs = args;
    
    if (status === 'succeeded')
      callbacks = this._callbacks;
    else if (status === 'failed')
      callbacks = this._errbacks;
    
    if (!callbacks) return;
    
    var callback;
    while (callback = callbacks.shift())
      callback[0].apply(callback[1], this._deferredArgs);
  }
};


Faye.Publisher = {
  countListeners: function(eventType) {
    if (!this._subscribers || !this._subscribers[eventType]) return 0;
    return this._subscribers[eventType].length;
  },
  
  bind: function(eventType, listener, context) {
    this._subscribers = this._subscribers || {};
    var list = this._subscribers[eventType] = this._subscribers[eventType] || [];
    list.push([listener, context]);
  },
  
  unbind: function(eventType, listener, context) {
    if (!this._subscribers || !this._subscribers[eventType]) return;
    
    if (!listener) {
      delete this._subscribers[eventType];
      return;
    }
    var list = this._subscribers[eventType],
        i    = list.length;
    
    while (i--) {
      if (listener !== list[i][0]) continue;
      if (context && list[i][1] !== context) continue;
      list.splice(i,1);
    }
  },
  
  trigger: function() {
    var args = Array.prototype.slice.call(arguments),
        eventType = args.shift();
    
    if (!this._subscribers || !this._subscribers[eventType]) return;
    
    var listeners = this._subscribers[eventType],
        listener;
    
    for (var i = 0, n = listeners.length; i < n; i++) {
      listener = listeners[i];
      listener[0].apply(listener[1], args);
    }
  }
};


Faye.Timeouts = {
  addTimeout: function(name, delay, callback, context) {
    this._timeouts = this._timeouts || {};
    if (this._timeouts.hasOwnProperty(name)) return;
    var self = this;
    this._timeouts[name] = Faye.ENV.setTimeout(function() {
      delete self._timeouts[name];
      callback.call(context);
    }, 1000 * delay);
  },
  
  removeTimeout: function(name) {
    this._timeouts = this._timeouts || {};
    var timeout = this._timeouts[name];
    if (!timeout) return;
    clearTimeout(timeout);
    delete this._timeouts[name];
  }
};


Faye.Logging = {
  LOG_LEVELS: {
    error:  3,
    warn:   2,
    info:   1,
    debug:  0
  },
  
  logLevel: 'error',
  
  log: function(messageArgs, level) {
    if (!Faye.logger) return;
    
    var levels = Faye.Logging.LOG_LEVELS;
    if (levels[Faye.Logging.logLevel] > levels[level]) return;
    
    var messageArgs = Array.prototype.slice.apply(messageArgs),
        banner = ' [' + level.toUpperCase() + '] [Faye',
        klass  = this.className,
        
        message = messageArgs.shift().replace(/\?/g, function() {
          try {
            return Faye.toJSON(messageArgs.shift());
          } catch (e) {
            return '[Object]';
          }
        });
    
    for (var key in Faye) {
      if (klass) continue;
      if (typeof Faye[key] !== 'function') continue;
      if (this instanceof Faye[key]) klass = key;
    }
    if (klass) banner += '.' + klass;
    banner += '] ';
    
    Faye.logger(Faye.timestamp() + banner + message);
  }
};

(function() {
  for (var key in Faye.Logging.LOG_LEVELS)
    (function(level, value) {
      Faye.Logging[level] = function() {
        this.log(arguments, level);
      };
    })(key, Faye.Logging.LOG_LEVELS[key]);
})();


Faye.Grammar = {

  LOWALPHA:     /^[a-z]$/,

  UPALPHA:     /^[A-Z]$/,

  ALPHA:     /^([a-z]|[A-Z])$/,

  DIGIT:     /^[0-9]$/,

  ALPHANUM:     /^(([a-z]|[A-Z])|[0-9])$/,

  MARK:     /^(\-|\_|\!|\~|\(|\)|\$|\@)$/,

  STRING:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*$/,

  TOKEN:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+$/,

  INTEGER:     /^([0-9])+$/,

  CHANNEL_SEGMENT:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+$/,

  CHANNEL_SEGMENTS:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*$/,

  CHANNEL_NAME:     /^\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*$/,

  WILD_CARD:     /^\*{1,2}$/,

  CHANNEL_PATTERN:     /^(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*\/\*{1,2}$/,

  VERSION_ELEMENT:     /^(([a-z]|[A-Z])|[0-9])(((([a-z]|[A-Z])|[0-9])|\-|\_))*$/,

  VERSION:     /^([0-9])+(\.(([a-z]|[A-Z])|[0-9])(((([a-z]|[A-Z])|[0-9])|\-|\_))*)*$/,

  CLIENT_ID:     /^((([a-z]|[A-Z])|[0-9]))+$/,

  ID:     /^((([a-z]|[A-Z])|[0-9]))+$/,

  ERROR_MESSAGE:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*$/,

  ERROR_ARGS:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*(,(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)*$/,

  ERROR_CODE:     /^[0-9][0-9][0-9]$/,

  ERROR:     /^([0-9][0-9][0-9]:(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*(,(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)*:(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*|[0-9][0-9][0-9]::(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)$/

};


Faye.Extensible = {
  addExtension: function(extension) {
    this._extensions = this._extensions || [];
    this._extensions.push(extension);
    if (extension.added) extension.added(this);
  },
  
  removeExtension: function(extension) {
    if (!this._extensions) return;
    var i = this._extensions.length;
    while (i--) {
      if (this._extensions[i] !== extension) continue;
      this._extensions.splice(i,1);
      if (extension.removed) extension.removed(this);
    }
  },
  
  pipeThroughExtensions: function(stage, message, callback, context) {
    this.debug('Passing through ? extensions: ?', stage, message);

    if (!this._extensions) return callback.call(context, message);
    var extensions = this._extensions.slice();
    
    var pipe = function(message) {
      if (!message) return callback.call(context, message);
      
      var extension = extensions.shift();
      if (!extension) return callback.call(context, message);
      
      if (extension[stage]) extension[stage](message, pipe);
      else pipe(message);
    };
    pipe(message);
  }
};

Faye.extend(Faye.Extensible, Faye.Logging);


Faye.Channel = Faye.Class({
  initialize: function(name) {
    this.id = this.name = name;
  },
  
  push: function(message) {
    this.trigger('message', message);
  },
  
  isUnused: function() {
    return this.countListeners('message') === 0;
  }
});

Faye.extend(Faye.Channel.prototype, Faye.Publisher);

Faye.extend(Faye.Channel, {
  HANDSHAKE:    '/meta/handshake',
  CONNECT:      '/meta/connect',
  SUBSCRIBE:    '/meta/subscribe',
  UNSUBSCRIBE:  '/meta/unsubscribe',
  DISCONNECT:   '/meta/disconnect',
  
  META:         'meta',
  SERVICE:      'service',
  
  expand: function(name) {
    var segments = this.parse(name),
        channels = ['/**', name];
    
    var copy = segments.slice();
    copy[copy.length - 1] = '*';
    channels.push(this.unparse(copy));
    
    for (var i = 1, n = segments.length; i < n; i++) {
      copy = segments.slice(0, i);
      copy.push('**');
      channels.push(this.unparse(copy));
    }
    
    return channels;
  },
  
  isValid: function(name) {
    return Faye.Grammar.CHANNEL_NAME.test(name) ||
           Faye.Grammar.CHANNEL_PATTERN.test(name);
  },
  
  parse: function(name) {
    if (!this.isValid(name)) return null;
    return name.split('/').slice(1);
  },
  
  unparse: function(segments) {
    return '/' + segments.join('/');
  },
  
  isMeta: function(name) {
    var segments = this.parse(name);
    return segments ? (segments[0] === this.META) : null;
  },
  
  isService: function(name) {
    var segments = this.parse(name);
    return segments ? (segments[0] === this.SERVICE) : null;
  },
  
  isSubscribable: function(name) {
    if (!this.isValid(name)) return null;
    return !this.isMeta(name) && !this.isService(name);
  },
  
  Set: Faye.Class({
    initialize: function() {
      this._channels = {};
    },
    
    getKeys: function() {
      var keys = [];
      for (var key in this._channels) keys.push(key);
      return keys;
    },
    
    remove: function(name) {
      delete this._channels[name];
    },
    
    hasSubscription: function(name) {
      return this._channels.hasOwnProperty(name);
    },
    
    subscribe: function(names, callback, context) {
      if (!callback) return;
      var name;
      for (var i = 0, n = names.length; i < n; i++) {
        name = names[i];
        var channel = this._channels[name] = this._channels[name] || new Faye.Channel(name);
        channel.bind('message', callback, context);
      }
    },
    
    unsubscribe: function(name, callback, context) {
      var channel = this._channels[name];
      if (!channel) return false;
      channel.unbind('message', callback, context);
      
      if (channel.isUnused()) {
        this.remove(name);
        return true;
      } else {
        return false;
      }
    },
    
    distributeMessage: function(message) {
      var channels = Faye.Channel.expand(message.channel);
      
      for (var i = 0, n = channels.length; i < n; i++) {
        var channel = this._channels[channels[i]];
        if (channel) channel.trigger('message', message.data);
      }
    }
  })
});


Faye.Publication = Faye.Class(Faye.Deferrable);


Faye.Subscription = Faye.Class({
  initialize: function(client, channels, callback, context) {
    this._client    = client;
    this._channels  = channels;
    this._callback  = callback;
    this._context     = context;
    this._cancelled = false;
  },
  
  cancel: function() {
    if (this._cancelled) return;
    this._client.unsubscribe(this._channels, this._callback, this._context);
    this._cancelled = true;
  },
  
  unsubscribe: function() {
    this.cancel();
  }
});

Faye.extend(Faye.Subscription.prototype, Faye.Deferrable);


Faye.Client = Faye.Class({
  UNCONNECTED:          1,
  CONNECTING:           2,
  CONNECTED:            3,
  DISCONNECTED:         4,
  
  HANDSHAKE:            'handshake',
  RETRY:                'retry',
  NONE:                 'none',
  
  CONNECTION_TIMEOUT:   60.0,
  DEFAULT_RETRY:        5.0,
  
  DEFAULT_ENDPOINT:     '/bayeux',
  INTERVAL:             0.0,
  
  initialize: function(endpoint, options) {
    this.info('New client created for ?', endpoint);
    
    this.endpoint   = endpoint || this.DEFAULT_ENDPOINT;
    this._cookies   = Faye.CookieJar && new Faye.CookieJar();
    this._headers   = {};
    this._options   = options || {};
    this._disabled  = [];
    this.retry      = this._options.retry || this.DEFAULT_RETRY;
    
    this._selectTransport(Faye.MANDATORY_CONNECTION_TYPES);
    
    this._state     = this.UNCONNECTED;
    this._channels  = new Faye.Channel.Set();
    this._messageId = 0;
    
    this._responseCallbacks = {};
    
    this._advice = {
      reconnect: this.RETRY,
      interval:  1000 * (this._options.interval || this.INTERVAL),
      timeout:   1000 * (this._options.timeout  || this.CONNECTION_TIMEOUT)
    };
    
    if (Faye.Event)
      Faye.Event.on(Faye.ENV, 'beforeunload', function() {
        if (Faye.indexOf(this._disabled, 'autodisconnect') < 0)
          this.disconnect();
      }, this);
  },
  
  disable: function(feature) {
    this._disabled.push(feature);
  },
  
  setHeader: function(name, value) {
    this._headers[name] = value;
  },
  
  getClientId: function() {
    return this._clientId;
  },

  getState: function() {
    switch (this._state) {
      case this.UNCONNECTED:  return 'UNCONNECTED';
      case this.CONNECTING:   return 'CONNECTING';
      case this.CONNECTED:    return 'CONNECTED';
      case this.DISCONNECTED: return 'DISCONNECTED';
    }
  },

  // Request
  // MUST include:  * channel
  //                * version
  //                * supportedConnectionTypes
  // MAY include:   * minimumVersion
  //                * ext
  //                * id
  // 
  // Success Response                             Failed Response
  // MUST include:  * channel                     MUST include:  * channel
  //                * version                                    * successful
  //                * supportedConnectionTypes                   * error
  //                * clientId                    MAY include:   * supportedConnectionTypes
  //                * successful                                 * advice
  // MAY include:   * minimumVersion                             * version
  //                * advice                                     * minimumVersion
  //                * ext                                        * ext
  //                * id                                         * id
  //                * authSuccessful
  handshake: function(callback, context) {
    if (this._advice.reconnect === this.NONE) return;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    var self = this;
    
    this.info('Initiating handshake with ?', this.endpoint);
    
    this._send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: [this._transport.connectionType]
      
    }, function(response) {
      
      if (response.successful) {
        this._state     = this.CONNECTED;
        this._clientId  = response.clientId;
        
        var connectionTypes = Faye.filter(response.supportedConnectionTypes, function(connType) {
          return Faye.indexOf(this._disabled, connType) < 0;
        }, this);
        this._selectTransport(connectionTypes);
        
        this.info('Handshake successful: ?', this._clientId);
        
        this.subscribe(this._channels.getKeys(), true);
        if (callback) callback.call(context);
        
      } else {
        this.info('Handshake unsuccessful');
        Faye.ENV.setTimeout(function() { self.handshake(callback, context) }, this._advice.interval);
        this._state = this.UNCONNECTED;
      }
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * connectionType                     * clientId
  // MAY include:   * ext                 MAY include:   * error
  //                * id                                 * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  connect: function(callback, context) {
    if (this._advice.reconnect === this.NONE) return;
    if (this._state === this.DISCONNECTED) return;
    
    if (this._state === this.UNCONNECTED)
      return this.handshake(function() { this.connect(callback, context) }, this);
    
    this.callback(callback, context);
    if (this._state !== this.CONNECTED) return;
    
    this.info('Calling deferred actions for ?', this._clientId);
    this.setDeferredStatus('succeeded');
    this.setDeferredStatus('deferred');
    
    if (this._connectRequest) return;
    this._connectRequest = true;
    
    this.info('Initiating connection for ?', this._clientId);
    
    this._send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType
      
    }, this._cycleConnection, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  // MAY include:   * ext                                * clientId
  //                * id                  MAY include:   * error
  //                                                     * ext
  //                                                     * id
  disconnect: function() {
    if (this._state !== this.CONNECTED) return;
    this._state = this.DISCONNECTED;
    
    this.info('Disconnecting ?', this._clientId);
    
    this._send({
      channel:    Faye.Channel.DISCONNECT,
      clientId:   this._clientId
      
    }, function(response) {
      if (response.successful) this._transport.close();
    }, this);
    
    this.info('Clearing channel listeners for ?', this._clientId);
    this._channels = new Faye.Channel.Set();
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * subscription                       * clientId
  // MAY include:   * ext                                * subscription
  //                * id                  MAY include:   * error
  //                                                     * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  subscribe: function(channel, callback, context) {
    if (channel instanceof Array) {
      for (var i = 0, n = channel.length; i < n; i++) {
        this.subscribe(channel[i], callback, context);
      }
      return;
    }
    
    var subscription = new Faye.Subscription(this, channel, callback, context),
        force        = (callback === true),
        hasSubscribe = this._channels.hasSubscription(channel);
    
    if (!force) {
      this._channels.subscribe([channel], callback, context);
      if (hasSubscribe) {
        subscription.setDeferredStatus('succeeded');
        return subscription;
      }
    }
    
    this.connect(function() {
      this.info('Client ? attempting to subscribe to ?', this._clientId, channel);
      
      this._send({
        channel:      Faye.Channel.SUBSCRIBE,
        clientId:     this._clientId,
        subscription: channel
        
      }, function(response) {
        if (!response.successful) {
          subscription.setDeferredStatus('failed', Faye.Error.parse(response.error));
          return this._channels.unsubscribe(channel, callback, context);
        }
        
        var channels = [].concat(response.subscription);
        this.info('Subscription acknowledged for ? to ?', this._clientId, channels);
        subscription.setDeferredStatus('succeeded');
      }, this);
    }, this);
    
    return subscription;
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * subscription                       * clientId
  // MAY include:   * ext                                * subscription
  //                * id                  MAY include:   * error
  //                                                     * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  unsubscribe: function(channel, callback, context) {
    if (channel instanceof Array) {
      for (var i = 0, n = channel.length; i < n; i++) {
        this.unsubscribe(channel[i], callback, context);
      }
      return;
    }
    
    var dead = this._channels.unsubscribe(channel, callback, context);
    if (!dead) return;
    
    this.connect(function() {
      this.info('Client ? attempting to unsubscribe from ?', this._clientId, channel);
      
      this._send({
        channel:      Faye.Channel.UNSUBSCRIBE,
        clientId:     this._clientId,
        subscription: channel
        
      }, function(response) {
        if (!response.successful) return;
        
        var channels = [].concat(response.subscription);
        this.info('Unsubscription acknowledged for ? from ?', this._clientId, channels);
      }, this);
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * data                               * successful
  // MAY include:   * clientId            MAY include:   * id
  //                * id                                 * error
  //                * ext                                * ext
  publish: function(channel, data) {
    var publication = new Faye.Publication();
    
    this.connect(function() {
      this.info('Client ? queueing published message to ?: ?', this._clientId, channel, data);
      
      this._send({
        channel:      channel,
        data:         data,
        clientId:     this._clientId
      }, function(response) {
        if (response.successful)
          publication.setDeferredStatus('succeeded');
        else
          publication.setDeferredStatus('failed', Faye.Error.parse(response.error));
      }, this);
    }, this);
    
    return publication;
  },
  
  receiveMessage: function(message) {
    this.pipeThroughExtensions('incoming', message, function(message) {
      if (!message) return;
      
      if (message.advice) this._handleAdvice(message.advice);
      
      var callback = this._responseCallbacks[message.id];
      if (callback) {
        delete this._responseCallbacks[message.id];
        callback[0].call(callback[1], message);
      }
      
      this._deliverMessage(message);
    }, this);
  },
  
  _selectTransport: function(transportTypes) {
    Faye.Transport.get(this, transportTypes, function(transport) {
      this._transport = transport;
      this._transport.cookies = this._cookies;
      this._transport.headers = this._headers;
      
      transport.bind('down', function() {
        if (this._transportUp !== undefined && !this._transportUp) return;
        this._transportUp = false;
        this.trigger('transport:down');
      }, this);
      
      transport.bind('up', function() {
        if (this._transportUp !== undefined && this._transportUp) return;
        this._transportUp = true;
        this.trigger('transport:up');
      }, this);
    }, this);
  },
  
  _send: function(message, callback, context) {
    message.id = this._generateMessageId();
    if (callback) this._responseCallbacks[message.id] = [callback, context];

    this.pipeThroughExtensions('outgoing', message, function(message) {
      if (!message) return;
      this._transport.send(message, this._advice.timeout / 1000);
    }, this);
  },
  
  _generateMessageId: function() {
    this._messageId += 1;
    if (this._messageId >= Math.pow(2,32)) this._messageId = 0;
    return this._messageId.toString(36);
  },

  _handleAdvice: function(advice) {
    Faye.extend(this._advice, advice);
    
    if (this._advice.reconnect === this.HANDSHAKE && this._state !== this.DISCONNECTED) {
      this._state    = this.UNCONNECTED;
      this._clientId = null;
      this._cycleConnection();
    }
  },
  
  _deliverMessage: function(message) {
    if (!message.channel || message.data === undefined) return;
    this.info('Client ? calling listeners for ? with ?', this._clientId, message.channel, message.data);
    this._channels.distributeMessage(message);
  },
  
  _teardownConnection: function() {
    if (!this._connectRequest) return;
    this._connectRequest = null;
    this.info('Closed connection for ?', this._clientId);
  },
  
  _cycleConnection: function() {
    this._teardownConnection();
    var self = this;
    Faye.ENV.setTimeout(function() { self.connect() }, this._advice.interval);
  }
});

Faye.extend(Faye.Client.prototype, Faye.Deferrable);
Faye.extend(Faye.Client.prototype, Faye.Publisher);
Faye.extend(Faye.Client.prototype, Faye.Logging);
Faye.extend(Faye.Client.prototype, Faye.Extensible);


Faye.Transport = Faye.extend(Faye.Class({
  MAX_DELAY: 0.0,
  batching:  true,

  initialize: function(client, endpoint) {
    this.debug('Created new ? transport for ?', this.connectionType, endpoint);
    this._client   = client;
    this._endpoint = endpoint;
    this._outbox   = [];
  },
  
  close: function() {},
  
  send: function(message, timeout) {
    this.debug('Client ? sending message to ?: ?',
               this._client._clientId, this._endpoint, message);

    if (!this.batching) return this.request([message], timeout);

    this._outbox.push(message);
    this._timeout = timeout;

    if (message.channel === Faye.Channel.HANDSHAKE)
      return this.flush();

    if (message.channel === Faye.Channel.CONNECT)
      this._connectMessage = message;

    this.addTimeout('publish', this.MAX_DELAY, this.flush, this);
  },

  flush: function() {
    this.removeTimeout('publish');

    if (this._outbox.length > 1 && this._connectMessage)
      this._connectMessage.advice = {timeout: 0};

    this.request(this._outbox, this._timeout);
    
    this._connectMessage = null;
    this._outbox = [];
  },
  
  receive: function(responses) {
    this.debug('Client ? received from ?: ?',
               this._client._clientId, this._endpoint, responses);
    
    for (var i = 0, n = responses.length; i < n; i++) {
      this._client.receiveMessage(responses[i]);
    }
  },
  
  retry: function(message, timeout) {
    var called = false,
        retry  = this._client.retry * 1000,
        self   = this;
    
    return function() {
      if (called) return;
      called = true;
      Faye.ENV.setTimeout(function() { self.request(message, timeout) }, retry);
    };
  }
  
}), {
  get: function(client, connectionTypes, callback, context) {
    var endpoint = client.endpoint;
    if (connectionTypes === undefined) connectionTypes = this.supportedConnectionTypes();
    
    Faye.asyncEach(this._transports, function(pair, resume) {
      var connType = pair[0], klass = pair[1];
      if (Faye.indexOf(connectionTypes, connType) < 0) return resume();
      
      klass.isUsable(endpoint, function(isUsable) {
        if (isUsable) callback.call(context, new klass(client, endpoint));
        else resume();
      });
    }, function() {
      throw new Error('Could not find a usable connection type for ' + endpoint);
    });
  },
  
  register: function(type, klass) {
    this._transports.push([type, klass]);
    klass.prototype.connectionType = type;
  },
  
  _transports: [],
  
  supportedConnectionTypes: function() {
    return Faye.map(this._transports, function(pair) { return pair[0] });
  }
});

Faye.extend(Faye.Transport.prototype, Faye.Logging);
Faye.extend(Faye.Transport.prototype, Faye.Publisher);
Faye.extend(Faye.Transport.prototype, Faye.Timeouts);


Faye.Set = Faye.Class({
  initialize: function() {
    this._index = {};
  },
  
  add: function(item) {
    var key = (item.id !== undefined) ? item.id : item;
    if (this._index.hasOwnProperty(key)) return false;
    this._index[key] = item;
    return true;
  },
  
  forEach: function(block, context) {
    for (var key in this._index) {
      if (this._index.hasOwnProperty(key))
        block.call(context, this._index[key]);
    }
  },
  
  isEmpty: function() {
    for (var key in this._index) {
      if (this._index.hasOwnProperty(key)) return false;
    }
    return true;
  },
  
  member: function(item) {
    for (var key in this._index) {
      if (this._index[key] === item) return true;
    }
    return false;
  },
  
  remove: function(item) {
    var key = (item.id !== undefined) ? item.id : item;
    var removed = this._index.hasOwnProperty(key);
    delete this._index[key];
    return removed;
  },
  
  toArray: function() {
    var array = [];
    this.forEach(function(item) { array.push(item) });
    return array;
  }
});


Faye.Engine = {
  get: function(options) {
    return new Faye.Engine.Proxy(options);
  },
  
  METHODS: ['createClient', 'clientExists', 'destroyClient', 'ping', 'subscribe', 'unsubscribe']
};

Faye.Engine.Proxy = Faye.Class({
  MAX_DELAY:  0.0,
  INTERVAL:   0.0,
  TIMEOUT:    60.0,
  
  className: 'Engine',
  
  initialize: function(options) {
    this._options     = options || {};
    this._connections = {};
    this.interval     = this._options.interval || this.INTERVAL;
    this.timeout      = this._options.timeout  || this.TIMEOUT;
    
    var engineClass = this._options.type || Faye.Engine.Memory;
    this._engine    = engineClass.create(this, this._options);
    
    this.debug('Created new engine: ?', this._options);
  },
  
  connect: function(clientId, options, callback, context) {
    this.debug('Accepting connection from ?', clientId);
    this._engine.ping(clientId);
    var conn = this.connection(clientId, true);
    conn.connect(options, callback, context);
    this._engine.emptyQueue(clientId);
  },
  
  hasConnection: function(clientId) {
    return this._connections.hasOwnProperty(clientId);
  },
  
  connection: function(clientId, create) {
    var conn = this._connections[clientId];
    if (conn || !create) return conn;
    return this._connections[clientId] = new Faye.Engine.Connection(this, clientId);
  },
  
  closeConnection: function(clientId) {
    this.debug('Closing connection for ?', clientId);
    delete this._connections[clientId];
  },
  
  openSocket: function(clientId, socket) {
    var conn = this.connection(clientId, true);
    conn.socket = socket;
  },
  
  deliver: function(clientId, messages) {
    if (!messages || messages.length === 0) return false;
    
    var conn = this.connection(clientId, false);
    if (!conn) return false;
    
    for (var i = 0, n = messages.length; i < n; i++) {
      conn.deliver(messages[i]);
    }
    return true;
  },
  
  generateId: function() {
    return Faye.random();
  },
  
  flush: function(clientId) {
    this.debug('Flushing connection queue for ?', clientId);
    var conn = this.connection(clientId, false);
    if (conn) conn.flush(true);
  },
  
  disconnect: function() {
    if (this._engine.disconnect) return this._engine.disconnect();
  },
  
  publish: function(message) {
    var channels = Faye.Channel.expand(message.channel);
    return this._engine.publish(message, channels);
  }
});

Faye.Engine.METHODS.forEach(function(method) {
  Faye.Engine.Proxy.prototype[method] = function() {
    return this._engine[method].apply(this._engine, arguments);
  };
})

Faye.extend(Faye.Engine.Proxy.prototype, Faye.Publisher);
Faye.extend(Faye.Engine.Proxy.prototype, Faye.Logging);


Faye.Engine.Connection = Faye.Class({
  initialize: function(engine, id, options) {
    this._engine  = engine;
    this._id      = id;
    this._options = options;
    this._inbox   = [];
  },
  
  deliver: function(message) {
    if (this.socket) return this.socket.send(JSON.stringify([message]));
    this._inbox.push(message);
    this._beginDeliveryTimeout();
  },
  
  connect: function(options, callback, context) {
    options = options || {};
    var timeout = (options.timeout !== undefined) ? options.timeout / 1000 : this._engine.timeout;
    
    this.setDeferredStatus('deferred');
    this.callback(callback, context);
    
    this._beginDeliveryTimeout();
    this._beginConnectionTimeout(timeout);
  },
  
  flush: function(force) {
    this._releaseConnection(force);
    this.setDeferredStatus('succeeded', this._inbox);
    this._inbox = [];
  },
  
  _releaseConnection: function(force) {
    if (force || !this.socket) this._engine.closeConnection(this._id);
    this.removeTimeout('connection');
    this.removeTimeout('delivery');
  },
  
  _beginDeliveryTimeout: function() {
    if (this._inbox.length === 0) return;
    this.addTimeout('delivery', this._engine.MAX_DELAY, this.flush, this);
  },
  
  _beginConnectionTimeout: function(timeout) {
    this.addTimeout('connection', timeout, this.flush, this);
  }
});

Faye.extend(Faye.Engine.Connection.prototype, Faye.Deferrable);
Faye.extend(Faye.Engine.Connection.prototype, Faye.Timeouts);


Faye.Engine.Memory = function(server, options) {
  this._server    = server;
  this._options   = options || {};
  this._namespace = new Faye.Namespace();
  this._clients   = {};
  this._channels  = {};
  this._messages  = {};
};

Faye.Engine.Memory.create = function(server, options) {
  return new this(server, options);
};

Faye.Engine.Memory.prototype = {
  createClient: function(callback, context) {
    var clientId = this._namespace.generate();
    this._server.debug('Created new client ?', clientId);
    this.ping(clientId);
    this._server.trigger('handshake', clientId);
    callback.call(context, clientId);
  },
  
  destroyClient: function(clientId, callback, context) {
    if (!this._namespace.exists(clientId)) return;
    var clients = this._clients;
    
    if (clients[clientId])
      clients[clientId].forEach(function(channel) { this.unsubscribe(clientId, channel) }, this);
    
    this.removeTimeout(clientId);
    this._namespace.release(clientId);
    delete this._messages[clientId];
    this._server.debug('Destroyed client ?', clientId);
    this._server.trigger('disconnect', clientId);
    if (callback) callback.call(context);
  },
  
  clientExists: function(clientId, callback, context) {
    callback.call(context, this._namespace.exists(clientId));
  },
  
  ping: function(clientId) {
    var timeout = this._server.timeout;
    if (typeof timeout !== 'number') return;
    
    this._server.debug('Ping ?, ?', clientId, timeout);
    this.removeTimeout(clientId);
    this.addTimeout(clientId, 2 * timeout, function() {
      this.destroyClient(clientId);
    }, this);
  },
  
  subscribe: function(clientId, channel, callback, context) {
    var clients = this._clients, channels = this._channels;
    
    clients[clientId] = clients[clientId] || new Faye.Set();
    var trigger = clients[clientId].add(channel);
    
    channels[channel] = channels[channel] || new Faye.Set();
    channels[channel].add(clientId);
    
    this._server.debug('Subscribed client ? to channel ?', clientId, channel);
    if (trigger) this._server.trigger('subscribe', clientId, channel);
    if (callback) callback.call(context, true);
  },
  
  unsubscribe: function(clientId, channel, callback, context) {
    var clients  = this._clients,
        channels = this._channels,
        trigger  = false;
    
    if (clients[clientId]) {
      trigger = clients[clientId].remove(channel);
      if (clients[clientId].isEmpty()) delete clients[clientId];
    }
    
    if (channels[channel]) {
      channels[channel].remove(clientId);
      if (channels[channel].isEmpty()) delete channels[channel];
    }
    
    this._server.debug('Unsubscribed client ? from channel ?', clientId, channel);
    if (trigger) this._server.trigger('unsubscribe', clientId, channel);
    if (callback) callback.call(context, true);
  },
  
  publish: function(message, channels) {
    this._server.debug('Publishing message ?', message);

    var messages = this._messages,
        clients  = new Faye.Set(),
        subs;
    
    for (var i = 0, n = channels.length; i < n; i++) {
      subs = this._channels[channels[i]];
      if (!subs) continue;
      subs.forEach(clients.add, clients);
    }
    
    clients.forEach(function(clientId) {
      this._server.debug('Queueing for client ?: ?', clientId, message);
      messages[clientId] = messages[clientId] || [];
      messages[clientId].push(Faye.copyObject(message));
      this.emptyQueue(clientId);
    }, this);
    
    this._server.trigger('publish', message.clientId, message.channel, message.data);
  },
  
  emptyQueue: function(clientId) {
    if (!this._server.hasConnection(clientId)) return;
    this._server.deliver(clientId, this._messages[clientId]);
    delete this._messages[clientId];
  }
};
Faye.extend(Faye.Engine.Memory.prototype, Faye.Timeouts);


Faye.Server = Faye.Class({
  initialize: function(options) {
    this._options  = options || {};
    var engineOpts = this._options.engine || {};
    engineOpts.timeout = this._options.timeout;
    this._engine   = Faye.Engine.get(engineOpts);

    this.info('Created new server: ?', this._options);
  },
  
  flushConnection: function(messages) {
    var clientId = [].concat(messages)[0].clientId;
    if (!clientId) return;
    this.info('Flushing connection for ?', clientId);
    this._engine.flush(clientId);
  },
  
  openSocket: function(clientId, socket) {
    this._engine.openSocket(clientId, socket);
  },
  
  closeSocket: function(clientId) {
    this._engine.flush(clientId);
  },
  
  process: function(messages, local, callback, context) {
    messages = [].concat(messages);
    this.info('Processing messages: ? (local: ?)', messages, local);

    if (messages.length === 0) return callback.call(context, []);
    var processed = 0, responses = [], self = this;
    
    var gatherReplies = function(replies) {
      responses = responses.concat(replies);
      processed += 1;
      if (processed < messages.length) return;
      
      var n = responses.length;
      while (n--) {
        if (!responses[n]) responses.splice(n,1);
      }
      self.info('Returning replies: ?', responses);
      callback.call(context, responses);
    };
    
    var handleReply = function(replies) {
      var extended = 0, expected = replies.length;
      if (expected === 0) gatherReplies(replies);
      
      for (var i = 0, n = replies.length; i < n; i++) {
        this.debug('Processing reply: ?', replies[i]);
        this.pipeThroughExtensions('outgoing', replies[i], function(message) {
          replies[i] = message;
          extended  += 1;
          if (extended === expected) gatherReplies(replies);
        });
      }
    };
    
    for (var i = 0, n = messages.length; i < n; i++) {
      this.pipeThroughExtensions('incoming', messages[i], function(pipedMessage) {
        this._handle(pipedMessage, local, handleReply, this);
      }, this);
    }
  },
  
  _makeResponse: function(message) {
    var response = {};
    
    if (message.id)       response.id       = message.id;
    if (message.clientId) response.clientId = message.clientId;
    if (message.channel)  response.channel  = message.channel;
    if (message.error)    response.error    = message.error;
    
    response.successful = !response.error;
    return response;
  },
  
  _handle: function(message, local, callback, context) {
    if (!message) return callback.call(context, []);
    this.info('Handling message: ? (local: ?)', message, local);
    
    var channelName = message.channel,
        error       = message.error,
        response;
    
    if (Faye.Channel.isMeta(channelName))
      return this._handleMeta(message, local, callback, context);
    
    if (!Faye.Grammar.CHANNEL_NAME.test(channelName))
      error = Faye.Error.channelInvalid(channelName);
    
    if (!error) this._engine.publish(message);
    
    response = this._makeResponse(message);
    if (error) response.error = error;
    response.successful = !response.error;
    callback.call(context, [response]);
  },
  
  _handleMeta: function(message, local, callback, context) {
    var method   = Faye.Channel.parse(message.channel)[1],
        clientId = message.clientId;
    
    this[method](message, local, function(responses) {
      responses = [].concat(responses);
      for (var i = 0, n = responses.length; i < n; i++) this._advize(responses[i], message.connectionType);
      callback.call(context, responses);
    }, this);
  },
  
  _advize: function(response, connectionType) {
    if (Faye.indexOf([Faye.Channel.HANDSHAKE, Faye.Channel.CONNECT], response.channel) < 0)
      return;
    
    var interval, timeout;
    if (connectionType === 'eventsource') {
      interval = Math.floor(this._engine.timeout * 1000);
      timeout  = 0;
    } else {
      interval = Math.floor(this._engine.interval * 1000);
      timeout  = Math.floor(this._engine.timeout * 1000);
    }
    
    response.advice = response.advice || {};
    if (response.error) {
      Faye.extend(response.advice, {reconnect:  'handshake'}, false);
    } else {
      Faye.extend(response.advice, {
        reconnect:  'retry',
        interval:   interval,
        timeout:    timeout
      }, false);
    }
  },
  
  // MUST contain  * version
  //               * supportedConnectionTypes
  // MAY contain   * minimumVersion
  //               * ext
  //               * id
  handshake: function(message, local, callback, context) {
    var response = this._makeResponse(message);
    response.version = Faye.BAYEUX_VERSION;
    
    if (!message.version)
      response.error = Faye.Error.parameterMissing('version');
    
    var clientConns = message.supportedConnectionTypes,
        commonConns;
    
    response.supportedConnectionTypes = Faye.CONNECTION_TYPES;
    
    if (clientConns) {
      commonConns = Faye.filter(clientConns, function(conn) {
        return Faye.indexOf(Faye.CONNECTION_TYPES, conn) >= 0;
      });
      if (commonConns.length === 0)
        response.error = Faye.Error.conntypeMismatch(clientConns);
    } else {
      response.error = Faye.Error.parameterMissing('supportedConnectionTypes');
    }
    
    response.successful = !response.error;
    if (!response.successful) return callback.call(context, response);
    
    this._engine.createClient(function(clientId) {
      response.clientId = clientId;
      callback.call(context, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * connectionType
  // MAY contain   * ext
  //               * id
  connect: function(message, local, callback, context) {
    var response       = this._makeResponse(message),
        clientId       = message.clientId,
        connectionType = message.connectionType;
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)         response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)       response.error = Faye.Error.parameterMissing('clientId');
      
      if (Faye.indexOf(Faye.CONNECTION_TYPES, connectionType) < 0)
        response.error = Faye.Error.conntypeMismatch(connectionType);
      
      if (!connectionType) response.error = Faye.Error.parameterMissing('connectionType');
      
      response.successful = !response.error;
      
      if (!response.successful) {
        delete response.clientId;
        return callback.call(context, response);
      }
      
      if (message.connectionType === 'eventsource') {
        message.advice = message.advice || {};
        message.advice.timeout = 0;
      }
      this._engine.connect(response.clientId, message.advice, function(events) {
        callback.call(context, [response].concat(events));
      });
    }, this);
  },
  
  // MUST contain  * clientId
  // MAY contain   * ext
  //               * id
  disconnect: function(message, local, callback, context) {
    var response = this._makeResponse(message),
        clientId = message.clientId;
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)   response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId) response.error = Faye.Error.parameterMissing('clientId');
      
      response.successful = !response.error;
      if (!response.successful) delete response.clientId;
      
      if (response.successful) this._engine.destroyClient(clientId);
      callback.call(context, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  subscribe: function(message, local, callback, context) {
    var response     = this._makeResponse(message),
        clientId     = message.clientId,
        subscription = message.subscription,
        channel;
    
    subscription = subscription ? [].concat(subscription) : [];
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)               response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
      if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
      
      response.subscription = message.subscription || [];
      
      for (var i = 0, n = subscription.length; i < n; i++) {
        channel = subscription[i];
        
        if (response.error) return;
        if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
        if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
        
        if (response.error) return;
        this._engine.subscribe(clientId, channel);
      }
      
      response.successful = !response.error;
      callback.call(context, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  unsubscribe: function(message, local, callback, context) {
    var response     = this._makeResponse(message),
        clientId     = message.clientId,
        subscription = message.subscription,
        channel;
    
    subscription = subscription ? [].concat(subscription) : [];
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)               response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
      if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
      
      response.subscription = message.subscription || [];
      
      for (var i = 0, n = subscription.length; i < n; i++) {
        channel = subscription[i];
        
        if (response.error) return;
        if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
        if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
        
        if (response.error) return;
        this._engine.unsubscribe(clientId, channel);
      }
      
      response.successful = !response.error;
      callback.call(context, response);
    }, this);
  }
});

Faye.extend(Faye.Server.prototype, Faye.Logging);
Faye.extend(Faye.Server.prototype, Faye.Extensible);


Faye.Transport.NodeLocal = Faye.extend(Faye.Class(Faye.Transport, {
  batching: false,
  
  request: function(message, timeout) {
    message = Faye.copyObject(message);
    this._endpoint.process(message, true, function(responses) {
      this.receive(Faye.copyObject(responses));
    }, this);
  }
}), {
  isUsable: function(endpoint, callback, context) {
    callback.call(context, endpoint instanceof Faye.Server);
  }
});

Faye.Transport.register('in-process', Faye.Transport.NodeLocal);


Faye.Transport.WebSocket = Faye.extend(Faye.Class(Faye.Transport, {
  UNCONNECTED:  1,
  CONNECTING:   2,
  CONNECTED:    3,

  batching:     false,
  
  request: function(messages, timeout) {
    this._messages = this._messages || {};
    for (var i = 0, n = messages.length; i < n; i++) {
      this._messages[messages[i].id] = messages[i];
    }
    this.withSocket(function(socket) { socket.send(Faye.toJSON(messages)) });
  },
  
  withSocket: function(callback, context) {
    this.callback(callback, context);
    this.connect();
  },
  
  close: function() {
    if (this._closed) return;
    this._closed = true;
    if (this._socket) this._socket.close();
  },
  
  connect: function() {
    if (this._closed) return;
    
    this._state = this._state || this.UNCONNECTED;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    
    var ws = Faye.Transport.WebSocket.getClass();
    this._socket = new ws(Faye.Transport.WebSocket.getSocketUrl(this._endpoint));
    var self = this;
    
    this._socket.onopen = function() {
      self._state = self.CONNECTED;
      self.setDeferredStatus('succeeded', self._socket);
      self.trigger('up');
    };
    
    this._socket.onmessage = function(event) {
      var messages = [].concat(JSON.parse(event.data));
      for (var i = 0, n = messages.length; i < n; i++) {
        delete self._messages[messages[i].id];
      }
      self.receive(messages);
    };
    
    this._socket.onclose = function() {
      var wasConnected = (self._state === self.CONNECTED);
      self.setDeferredStatus('deferred');
      self._state = self.UNCONNECTED;
      delete self._socket;
      
      if (wasConnected) return self.resend();
      
      var retry = self._client.retry * 1000;
      Faye.ENV.setTimeout(function() { self.connect() }, retry);
      self.trigger('down');
    };
  },
  
  resend: function() {
    var messages = Faye.map(this._messages, function(id, msg) { return msg });
    this.request(messages);
  }
}), {
  WEBSOCKET_TIMEOUT: 1000,
  
  getSocketUrl: function(endpoint) {
    if (Faye.URI) endpoint = Faye.URI.parse(endpoint).toURL();
    return endpoint.replace(/^http(s?):/ig, 'ws$1:');
  },
  
  getClass: function() {
    return (Faye.WebSocket && Faye.WebSocket.Client) ||
            Faye.ENV.WebSocket ||
            Faye.ENV.MozWebSocket;
  },
  
  isUsable: function(endpoint, callback, context) {
    var ws = this.getClass();
    if (!ws) return callback.call(context, false);
    
    var connected = false,
        called    = false,
        socketUrl = this.getSocketUrl(endpoint),
        socket    = new ws(socketUrl);
    
    socket.onopen = function() {
      connected = true;
      socket.close();
      callback.call(context, true);
      called = true;
      socket = null;
    };
    
    var notconnected = function() {
      if (!called && !connected) callback.call(context, false);
      called = true;
    };
    
    socket.onclose = socket.onerror = notconnected;
    Faye.ENV.setTimeout(notconnected, this.WEBSOCKET_TIMEOUT);
  }
});

Faye.extend(Faye.Transport.WebSocket.prototype, Faye.Deferrable);
Faye.Transport.register('websocket', Faye.Transport.WebSocket);


Faye.Transport.NodeHttp = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var uri      = url.parse(this._endpoint),
        secure   = (uri.protocol === 'https:'),
        client   = secure ? https : http,
        content  = new Buffer(JSON.stringify(message), 'utf8'),
        retry    = this.retry(message, timeout),
        self     = this;
    
    var cookies = this.cookies.getCookies({domain: uri.hostname, path: uri.pathname}),
        params  = this._buildParams(uri, content, cookies, secure),
        request = client.request(params);
    
    request.addListener('response', function(response) {
      self._handleResponse(response, retry);
      self._storeCookies(uri.hostname, response.headers['set-cookie']);
    });
    
    request.addListener('error', function() {
      retry();
      self.trigger('down');
    });
    request.write(content);
    request.end();
  },
  
  _buildParams: function(uri, content, cookies, secure) {
    return {
      method:   'POST',
      host:     uri.hostname,
      port:     uri.port || (secure ? 443 : 80),
      path:     uri.pathname,
      headers:  Faye.extend({
        'Content-Length': content.length,
        'Content-Type':   'application/json',
        'Cookie':         cookies.toValueString(),
        'Host':           uri.hostname
      }, this.headers)
    };
  },
  
  _handleResponse: function(response, retry) {
    var message = null,
        body    = '',
        self    = this;
    
    response.addListener('data', function(c) { body += c.toString('utf8', 0, c.length) });
    response.addListener('end', function() {
      try {
        message = JSON.parse(body);
      } catch (e) {}
      
      if (message) {
        self.receive(message);
        self.trigger('up');
      } else {
        retry();
        self.trigger('down');
      }
    });
  },
  
  _storeCookies: function(hostname, cookies) {
    if (!cookies) return;
    var cookie;
    
    for (var i = 0, n = cookies.length; i < n; i++) {
      cookie = this.cookies.setCookie(cookies[i]);
      cookie = cookie[0] || cookie;
      cookie.domain = cookie.domain || hostname;
    }
  }
  
}), {
  isUsable: function(endpoint, callback, context) {
    callback.call(context, typeof endpoint === 'string');
  }
});

Faye.Transport.register('long-polling', Faye.Transport.NodeHttp);


var crypto = require('crypto'),
    fs     = require('fs'),
    http   = require('http'),
    https  = require('https'),
    net    = require('net'),
    path   = require('path'),
    tls    = require('tls'),
    url    = require('url'),
    querystring = require('querystring');

Faye.WebSocket   = require('faye-websocket');
Faye.EventSource = Faye.WebSocket.EventSource;
Faye.CookieJar   = require('cookiejar').CookieJar;

Faye.logger = function(message) {
  console.log(message);
};

Faye.withDataFor = function(transport, callback, context) {
  var data = '';
  transport.addListener('data', function(chunk) { data += chunk });
  transport.addListener('end', function() {
    callback.call(context, data);
  });
};

Faye.NodeAdapter = Faye.Class({
  DEFAULT_ENDPOINT: '/bayeux',
  SCRIPT_PATH:      path.dirname(__filename) + '/faye-browser-min.js',
  
  TYPE_JSON:    {'Content-Type': 'application/json'},
  TYPE_SCRIPT:  {'Content-Type': 'text/javascript'},
  TYPE_TEXT:    {'Content-Type': 'text/plain'},
  
  initialize: function(options) {
    this._options    = options || {};
    this._endpoint   = this._options.mount || this.DEFAULT_ENDPOINT;
    this._endpointRe = new RegExp('^' + this._endpoint + '(/[^/]*)*(\\.js)?$');
    this._server     = new Faye.Server(this._options);
    
    var extensions = this._options.extensions;
    if (!extensions) return;
    
    extensions = [].concat(extensions);
    for (var i = 0, n = extensions.length; i < n; i++)
      this.addExtension(extensions[i]);
  },
  
  addExtension: function(extension) {
    return this._server.addExtension(extension);
  },
  
  removeExtension: function(extension) {
    return this._server.removeExtension(extension);
  },
  
  bind: function() {
    return this._server._engine.bind.apply(this._server._engine, arguments);
  },
  
  unbind: function() {
    return this._server._engine.unbind.apply(this._server._engine, arguments);
  },
  
  getClient: function() {
    return this._client = this._client || new Faye.Client(this._server);
  },
  
  listen: function(port, sslOptions, callback, context) {
    var ssl = sslOptions && sslOptions.cert
            ? { key:  fs.readFileSync(sslOptions.key),
                cert: fs.readFileSync(sslOptions.cert)
              }
            : null;
    
    if (ssl && sslOptions.ca)
      ssl.ca = Faye.map(sslOptions.ca, function(ca) { return fs.readFileSync(ca) });
    
    var httpServer = ssl
                   ? https.createServer(ssl, function() {})
                   : http.createServer(function() {});
    
    this.attach(httpServer);
    httpServer.listen(port, function() {
      if (callback) callback.call(context);
    });
    this._httpServer = httpServer;
  },
  
  stop: function(callback, context) {
    this._httpServer.addListener('close', function() {
      if (callback) callback.call(context);
    });
    this._httpServer.close();
  },
  
  attach: function(httpServer) {
    this._overrideListeners(httpServer, 'request', 'handle');
    this._overrideListeners(httpServer, 'upgrade', 'handleUpgrade');
  },
  
  _overrideListeners: function(httpServer, event, method) {
    var listeners = httpServer.listeners(event),
        self      = this;
    
    httpServer.removeAllListeners(event);
    
    httpServer.addListener(event, function(request) {
      if (self.check(request)) return self[method].apply(self, arguments);
      
      for (var i = 0, n = listeners.length; i < n; i++)
        listeners[i].apply(this, arguments);
    });
  },
  
  check: function(request) {
    var path = url.parse(request.url, true).pathname;
    return !!this._endpointRe.test(path);
  },
  
  handle: function(request, response) {
    var requestUrl    = url.parse(request.url, true),
        requestMethod = request.method,
        self          = this;
    
    if (/\.js$/.test(requestUrl.pathname))
      return this._serveClientScript(request, response);
    
    if (requestMethod === 'OPTIONS')
      return this._handleOptions(request, response);
    
    if (Faye.EventSource.isEventSource(request))
      return this.handleEventSource(request, response);
    
    if (requestMethod === 'GET')
      return this._callWithParams(request, response, requestUrl.query);
    
    if (requestMethod === 'POST')
      return Faye.withDataFor(request, function(data) {
        var type   = (request.headers['content-type'] || '').split(';')[0],
            params = (type === 'application/json')
                   ? {message: data}
                   : querystring.parse(data);
        
        self._callWithParams(request, response, params);
      });
    
    this._returnError(response);
  },
  
  handleUpgrade: function(request, socket, head) {
    var ws       = new Faye.WebSocket(request, socket, head, null, {ping: this._options.ping}),
        clientId = null,
        self     = this;
    
    ws.onmessage = function(event) {
      try {
        var message = JSON.parse(event.data);
        clientId = [].concat(message)[0].clientId;
        
        self.debug('Received via WebSocket[' + ws.version + ']: ?', message);
        self._server.openSocket(clientId, ws);
        
        self._server.process(message, false, function(replies) {
          if (ws) ws.send(JSON.stringify(replies));
        });
      } catch (e) {
        self.error(e.message + '\nBacktrace:\n' + e.stack);
      }
    };
    
    ws.onclose = function(event) {
      self._server.closeSocket(clientId);
      ws = null;
    };
  },
  
  handleEventSource: function(request, response) {
    var es       = new Faye.EventSource(request, response, {ping: this._options.ping}),
        clientId = es.url.split('/').pop(),
        self     = this;
    
    this.debug('Opened EventSource connection for ?', clientId);
    this._server.openSocket(clientId, es);
    
    es.onclose = function(event) {
      self._server.closeSocket(clientId);
      es = null;
    };
  },
  
  _serveClientScript: function(request, response) {
    this._clientScript = this._clientScript || fs.readFileSync(this.SCRIPT_PATH);
    this._clientDigest = this._clientDigest || crypto.createHash('sha1').update(this._clientScript).digest('hex');
    this._clientMtime  = this._clientMtime  || fs.statSync(this.SCRIPT_PATH).mtime;
    
    var headers = Faye.extend({}, this.TYPE_SCRIPT),
        ims     = request.headers['if-modified-since'];
    
    headers['ETag'] = this._clientDigest;
    headers['Last-Modified'] = this._clientMtime.toGMTString();
    
    if (request.headers['if-none-match'] === this._clientDigest) {
      response.writeHead(304, headers);
      response.end();
    } else if (ims && this._clientMtime <= new Date(ims)) {
      response.writeHead(304, headers);
      response.end();
    } else {
      response.writeHead(200, headers);
      response.write(this._clientScript);
      response.end();
    }
  },
  
  _callWithParams: function(request, response, params) {
    try {
      var message = JSON.parse(params.message),
          jsonp   = params.jsonp || Faye.JSONP_CALLBACK,
          isGet   = (request.method === 'GET'),
          type    = isGet ? this.TYPE_SCRIPT : this.TYPE_JSON;

      this.debug('Received ?: ?', request.method, message);
      if (isGet) this._server.flushConnection(message);
      
      this._server.process(message, false, function(replies) {
        var body    = JSON.stringify(replies),
            headers = Faye.extend({}, type),
            origin  = request.headers.origin;
        
        if (isGet) {
          body = jsonp + '(' + body + ');';
          headers['Cache-Control'] = 'no-cache, no-store';
        }
        if (origin) headers['Access-Control-Allow-Origin'] = origin;
        
        this.debug('Returning ?', body);
        response.writeHead(200, headers);
        response.write(body);
        response.end();
      }, this);
    } catch (e) {
      this.error(e.message + '\nBacktrace:\n' + e.stack);
      this._returnError(response);
    }
  },
  
  _handleOptions: function(request, response) {
    var headers = {
      'Access-Control-Allow-Origin':      '*',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Max-Age':           '86400',
      'Access-Control-Allow-Methods':     'POST, GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':     'Accept, Content-Type, X-Requested-With'
    };
    response.writeHead(200, headers);
    response.write('');
    response.end();
  },
  
  _returnError: function(response) {
    response.writeHead(400, this.TYPE_TEXT);
    response.write('Bad request');
    response.end();
  }
});

Faye.extend(Faye.NodeAdapter.prototype, Faye.Logging);

module.exports = Faye;