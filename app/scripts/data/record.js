
(function() {

  var TTLCache = function() {
    this.cache = {};
  };

  TTLCache.prototype = {
    set: function(key, val, ttl) {
      this.cache[key] = {
        ttl: Date.now() + ((ttl || 30) * 1000),
        val: val
      };
    },
    get: function(key) {
      if (this.cache[key] && this.cache[key].ttl > Date.now()) {
        return this.cache[key].val;
      } else {
        delete this.cache[key];
        return null;
      }
    }
  };

  var globalFailedCache = new TTLCache();

  angular.module('BlurAdmin.data.record').factory('createRecordClass', function(uuid4) {
    return function createRecordClass(model) {
      var META = uuid4.generate();
      var relations = [];
      Object.keys(model.relations.belongsTo || {}).forEach(function(k) {
        var localField = model.relations.belongsTo[k].localField;
        model.relations.belongsTo[k].localField = '__' + localField;
        relations.push(localField);
      });
      Object.keys(model.relations.hasMany || {}).forEach(function(k) {
        var localField = model.relations.hasMany[k].localField;
        model.relations.hasMany[k].localField = '__' + localField;
        relations.push(localField);
      });

      function wrapPromise(_this, promise, rel, value) {
        promise.value = value;
        promise.reload = function() {
          _this[META].loaded[rel] = false;
          _this[META].reload = true;
          return _this[rel];
        };
        promise.clear = function() {
          _this[META].loaded[rel] = false;
          _this[META].reload = true;
        };
        return promise;
      }

      return JSData.Record.extend({
        save(opts) {
          opts = opts || {};
          if (opts.changesOnly === undefined) {
            opts.changesOnly = true;
          }
          return JSData.Record.prototype.save.call(this, opts);
        },
        constructor: function(props, opts) {
          JSData.Record.call(this, props, opts);
          Object.defineProperty(this, META, {
            enumerable: false,
            value: { loaded: {}, reload: false }
          });
          var _this = this;
          relations.forEach(function(rel) {
            Object.defineProperty(_this, rel, {
              get() {
                var id, key = ((model.relations.belongsTo || {})[rel] || {}).localKey;
                if (key) {
                  id = _this[key];
                  var failed = globalFailedCache.get(rel + ':' + id);
                  if (failed === true) {
                    var p = Promise.reject();
                    wrapPromise(_this, p, rel, null);
                    p.catch(function() {});
                    return p;
                  }
                }
                var value = _this['__' + rel];
                var promise = Promise.resolve(value);
                promise = wrapPromise(_this, promise, rel, value);
                if (!_this[META].reload) {
                  if (_this[META].loaded[rel]) {
                    return promise;
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return promise;
                  }
                  if (!Array.isArray(value) && value && Object.keys(value).length > 0) {
                    return promise;
                  }
                }
                promise = _this.loadRelations(['__' + rel]).then(function(record) {
                  _this[META].loaded[rel] = true;
                  _this[META].reload = false;
                  wrapPromise(_this, promise, rel, record['__' + rel]);
                  return record['__' + rel];
                });
                promise.catch(function(err) {
                  if (key && err.request.status === 404) {
                    globalFailedCache.set(rel + ':' + id, true);
                  }
                });
                return promise;
              },
              set(val) {
                if (val.then) {
                  if (val.value) {
                    _this['__' + rel] = val.value;
                    return;
                  }
                  val.then(function(v) {
                    _this['__' + rel] = v;
                  });
                  return;
                }
                _this['__' + rel] = val;
              }
            });
          });
        }
      });
    };
  });
}());
