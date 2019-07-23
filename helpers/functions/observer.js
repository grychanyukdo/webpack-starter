const isNode = new Function("try {return this===global;}catch(e){return false;}")();

const sizes = {
  height: Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
};

const once = function(fn, context) {
    var result;
    return function() {
        if (fn) {
            result = fn.apply(context || this, arguments);
            fn = null;
        }
        return result;
    };
}

const safeOptions = {
  enumerable: false,
  configurable: false,
  writable: false,
};

const errors = {
  CREATE_NOT_VALID_CALLED: "CREATE_NOT_VALID_CALLED",
  NOT_VALID_ARGUMENTS: "%arg IS_NOT_VALID_ARGUMENT",
  GLOBAL_ERROR: "ERROR_IN_INTERSECTION_OBSERVER",
  SSR_ERROR: "SSR_MODE_NOT_SUPPORT",
}

const defaultParams = {
  percentObserve: 0.15,
  observeClass: "ob",
  observedClass: 'vis',
  threshold: 0.01,
  /*
  **  Bool
  */
  returns: false,
  callbackMode: false,
  callbackOnce: false,
  setClassMode: false,
  lazyMode: false,

  dataAttrObserve: 'observe',
  dataAttrStartValue: '',
  dataAttrCompleteValue: 'vis',
  imgLoadClass: 'ob-load',
  imgWrapLoadClass: 'ob-load-wrap',
  imgLoadComplete: 'ob-load-c',
  imgWrapLoadComplete: 'ob-load-wrap-c',
};

class Observer {
  constructor(
    params = {},
  ) {
    let errorParams;
    if(isNode) throw new Error(errors.SSR_ERROR);

    const me = this;

    if(Object.keys(params).some(i => {
      errorParams = i;
      return !Object.keys(defaultParams).includes(i);
    })) throw new Error(errors.NOT_VALID_ARGUMENTS.replace('%arg', errorParams));
    /*
    ** observe settings
    */

    this.params = Object.assign({}, defaultParams, params);
    this.items = [];
    this.ob = null;
    this.init = false;
    this.config = {
      threshold: this.params.threshold,
      rootMargin: `-${Math.floor(sizes.height * this.params.percentObserve)}px`,
    };
    /*
    ** functional settings
    */
    this.cbs = {};

    Object.defineProperty(this.cbs, 'create', Object.assign(safeOptions, {
      value(name, callback) {
        if(!name || typeof callback !== 'function') {
          throw new Error(errors.CREATE_NOT_VALID_CALLED);
        }
        me.params.callbackOnce ?
          this[name] = once(callback) :
          this[name] = callback;
        return {
          delete: () => delete this[name]
        };
      }
    }));
  }

  disconnect() {
    this.ob ? this.ob.disconnect() : this.ob = null;
    this.cbs = {};
    this.items = [];
    this.init = false;

    return this;
  }

  watch() {
    const me = this;
    const config = this.config;

    return new Promise((res, rej) => {
      try {
        // create the observer
        me.ob = new IntersectionObserver((entries, ob) => {
          entries.forEach(entry => processingObserved.call(me, entry, ob));
          setTimeout(res.bind(null, me.ob));
          me.init = true;
        }, config);

        me.items.forEach(item => {

          if(me.params.setClassMode) {
            item.dataset[me.params.dataAttrObserve] = me.params.dataAttrStartValue;
            item.classList.add(me.params.observeClass);
          }

          if(me.params.lazyMode) {
            item.classList.add(me.params.imgLoadClass);
            item.parentElement.classList.add(me.params.imgWrapLoadClass);
          }
          me.ob.observe(item);
        });

      } catch (e) {
        rej(errors.GLOBAL_ERROR);
        console.error(e.message);
      }
    });
  }

  simple(ref) {
    if(typeof refs === "string") {
        refs = document.querySelector(ref);
    }

    this.items.push(ref);
    return this;
  }

  collection(refs) {
    if(typeof refs === "string") {
        refs = document.querySelectorAll(refs);
    }

    this.items = this.items.concat(Array.from(refs));
    return this;
  }

  static get default() {
    return Observer.new`classes.callback.lazy`;
  }

  static get zero() {
    return Observer.new`zero`;
  }

  static get infinity() {
    return Observer.new`infinity`;
  }

  static get callback() {
    return Observer.new`callback`;
  }

  static get callbackOnce() {
    return Observer.new`callback.once`;
  }

  static get callbackInfinity() {
    return Observer.new`callback.infinity`;
  }

  static get classes() {
    return Observer.new`classes`;
  }

  static get lazy() {
    return Observer.new`lazy`;
  }

  static new(strings, ...values) {
    let str = "";
    for(let i=0; i<values.length; i++) {
      str += strings[i];
      str += values[i];
    }
    str += strings[strings.length-1];
    const string = str;

    let errorParams;
    const relative = {
      "zero": ["percentObserve", 0],
      "infinity": ["returns", true],
      "callback": ["callbackMode", true],
      "classes": ["setClassMode", true],
      "lazy": ["lazyMode", true],
      "once": ["callbackOnce", true],
    };

    const paramsForGet = string.trim().split(".").filter(Boolean);

    if(Object.values(paramsForGet).some(i => {
      errorParams = i;
      return !Object.keys(relative).includes(i);
    })) throw new Error(errors.NOT_VALID_ARGUMENTS.replace('%arg', errorParams));

    const settingParams = paramsForGet.reduce((acc, item) => {
      const [name, value] = relative[item];
      acc[name] = value;
      return acc;
    }, {});
    return new Observer(settingParams);
  }
};

function processingObserved (entry, ob) {
  const me = this;
  const target = entry.target;

  const isCallback = Boolean(target.dataset.callback && /*me.init &&*/
    me.cbs[target.dataset.callback] && me.params.callbackMode);

  const callbackArg = isCallback ? {
    target,
    name: target.dataset.callback
  } : {};

  if (entry.intersectionRatio > me.params.threshold) {
    /*
    **  There are visible here
    */
    if(me.params.lazyMode) {
      (() => {
        if(target.dataset.loaded === "1") return;

        target.src = target.dataset.lazy;
        target.addEventListener("load", function() {
          this.classList.add(me.params.imgLoadComplete);
          this.dataset.loaded = "1";
          delete this.dataset.lazy;
          this.parentElement.classList.add(me.params.imgWrapLoadComplete);
        }, {once: true});
      })();
    }

    if(me.params.setClassMode) {
      target.classList.add(me.params.observedClass);
      target.dataset[me.params.dataAttrObserve] = me.params.dataAttrCompleteValue;
    }

    if (isCallback) {
      me.cbs[target.dataset.callback](Object.assign(callbackArg, {
        visible: true
      }));
    }
  }
  else {
    if (me.params.returns) {

      if(me.params.setClassMode) {
        target.classList.remove(me.params.observedClass);
        target.dataset[me.params.dataAttrObserve] = me.params.dataAttrStartValue;
      }

      if (isCallback) {
        me.cbs[target.dataset.callback](Object.assign(callbackArg, {
          visible: false
        }));
      }
    } else {
      /*
      ** unwatch DOM element after first watching
      */
      if (me.init && ob) {
        console.log('unobserve');
        ob.unobserve(target);
      }
    }
  }
}

/*
**  Custom configs
*/
export { Observer };
/*
**  Global observer
*/
const defaultObserver = Observer.default;
export default defaultObserver;
