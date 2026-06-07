

/**
 * Events used for communicating with Ulanzi Stream Deck
 */
const Events = Object.freeze({
	CONNECTED: 'connected',
	CLOSE: 'close',
	ERROR: 'error',
	ADD: 'add',
	RUN: 'run',
	PARAMFROMAPP: 'paramfromapp',
	PARAMFROMPLUGIN: 'paramfromplugin',
	SETACTIVE: 'setactive',
	CLEAR: 'clear',
	TOAST:'toast',
	STATE:'state',
	OPENURL:'openurl',
	OPENVIEW:'openview',
	SELECTDIALOG:'selectdialog',
	LOGMESSAGE:'logMessage',
	HOTKEY:'hotkey',
	SHOWALERT:'showAlert',
	SENDTOPROPERTYINSPECTOR:'sendToPropertyInspector',
	SENDTOPLUGIN:'sendToPlugin',
	GETSETTINGS:'getSettings',
	SETSETTINGS:'setSettings',
	DIDRECEIVESETTINGS:'didReceiveSettings',
	SETGLOBALSETTINGS:'setGlobalSettings',
	GETGLOBALSETTINGS:'getGlobalSettings',
	DIDRECEIVEGLOBALSETTINGS:'didReceiveGlobalSettings',
	KEYDOWN:'keydown',
	KEYUP:'keyup',
	DIALEDOWN:'dialdown',
	DIALEUP:'dialup',
	DIALROTATE:'dialrotate'
});

/**
 * Errors received from WebSocket
 */
const SocketErrors = {
	DEFAULT:'closed *****'
};


class ULANZIEventEmitter {
    constructor (id, debug = false) {

        const eventList = new Map();
        const ALLEVENTS = "*";

        eventList.hasWildcard = function(name, data) {
            for(const [key, value] of this) {
                if(key !== ALLEVENTS && key.includes(ALLEVENTS) && new RegExp(`^${key.split(/\*+/).join('.*')}$`).test(name)) {
                    if(data) value.pub(data, name);
                    else return true;
                }
            }
        };

        this.on = (name, fn) => {
            if(!eventList.has(name)) eventList.set(name, ULANZIEventEmitter.pubSub());
            return eventList.get(name).sub(fn);
        };

        this.has = name => eventList.has(name);
        this.hasMatch = name => eventList.has(name) || eventList.hasWildcard(name);
        this.emit = (name, data) => {
            eventList.has(name) && eventList.get(name).pub(data, name);
            eventList.has(ALLEVENTS) && eventList.get(ALLEVENTS).pub(data, name);
            eventList.hasWildcard(name, data);
        };

        return this;
    }

    static pubSub() {
        const subscribers = new Set();

        const sub = fn => {
            subscribers.add(fn);
            return () => {
                subscribers.delete(fn);
            };
        };

        const pub = (data, name) => subscribers.forEach(fn => fn(data, name));
        return Object.freeze({pub, sub});
    }
}

const EventEmitter = new ULANZIEventEmitter();
/* global USDTimerWorker */

let USDTimerWorker = new Worker(URL.createObjectURL(
    new Blob([timerFn.toString().replace(/^[^{]*{\s*/, '').replace(/\s*}[^}]*$/, '')], {type: 'text/javascript'})
));
USDTimerWorker.timerId = 1;
USDTimerWorker.timers = {};
const USDDefaultTimeouts = {
    timeout: 0,
    interval: 10
};

Object.freeze(USDDefaultTimeouts);

function _setTimer(callback, delay, type, params) {
    const id = USDTimerWorker.timerId++;
    USDTimerWorker.timers[id] = {callback, params};
    USDTimerWorker.onmessage = (e) => {
        if(USDTimerWorker.timers[e.data.id]) {
            if(e.data.type === 'clearTimer') {
                delete USDTimerWorker.timers[e.data.id];
            } else {
                const cb = USDTimerWorker.timers[e.data.id].callback;
                if(cb && typeof cb === 'function') cb(...USDTimerWorker.timers[e.data.id].params);
            }
        }
    };
    USDTimerWorker.postMessage({type, id, delay});
    return id;
}

function _setTimeoutUSD(...args) {
    let [callback, delay = 0, ...params] = [...args];
    return _setTimer(callback, delay, 'setTimeout', params);
}

function _setIntervalUSD(...args) {
    let [callback, delay = 0, ...params] = [...args];
    return _setTimer(callback, delay, 'setInterval', params);
}

function _clearTimeoutUSD(id) {
    USDTimerWorker.postMessage({type: 'clearTimeout', id}); //     USDTimerWorker.postMessage({type: 'clearInterval', id}); = same thing
    delete USDTimerWorker.timers[id];
}

window.setTimeout = _setTimeoutUSD;
window.setInterval = _setIntervalUSD;
window.clearTimeout = _clearTimeoutUSD; //timeout and interval share the same timer-pool
window.clearInterval = _clearTimeoutUSD;



function timerFn() {

    let timers = {};
    let debug = false;
    let supportedCommands = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'];

    function log(e) {console.log('Worker-Info::Timers', timers);}

    function clearTimerAndRemove(id) {
        if(timers[id]) {
            if(debug) console.log('clearTimerAndRemove', id, timers[id], timers);
            clearTimeout(timers[id]);
            delete timers[id];
            postMessage({type: 'clearTimer', id: id});
            if(debug) log();
        }
    }

    onmessage = function(e) {
        // first see, if we have a timer with this id and remove it
        // this automatically fulfils clearTimeout and clearInterval
        supportedCommands.includes(e.data.type) && timers[e.data.id] && clearTimerAndRemove(e.data.id);
        if(e.data.type === 'setTimeout') {
            timers[e.data.id] = setTimeout(() => {
                postMessage({id: e.data.id});
                clearTimerAndRemove(e.data.id); //cleaning up
            }, Math.max(e.data.delay || 0));
        } else if(e.data.type === 'setInterval') {
            timers[e.data.id] = setInterval(() => {
                postMessage({id: e.data.id});
            }, Math.max(e.data.delay || USDDefaultTimeouts.interval));
        }
    };
}
class UlanziUtils {

	/**
	 * 获取表单数据
	 * Returns the value from a form using the form controls name property
	 * @param {Element | string} form
	 * @returns
	 */
	getFormValue(form) {
		if (typeof form === 'string') {
			form = document.querySelector(form);
		}

		const elements = form ? form.elements : '';

		if (!elements) {
			console.error('Could not find form!');
		}

		const formData = new FormData(form);
		let formValue = {};

		formData.forEach((value, key) => {
			if (!Reflect.has(formValue, key)) {
				formValue[key] = value;
				return;
			}
			if (!Array.isArray(formValue[key])) {
				formValue[key] = [formValue[key]];
			}
			formValue[key].push(value);
		});

		return formValue;
	}

	/**
	 * 重载表单数据
	 * Sets the value of form controls using their name attribute and the jsn object key
	 * @param {*} jsn
	 * @param {Element | string} form
	 */
	setFormValue(jsn, form) {
		if (!jsn) {
			return;
		}

		if (typeof form === 'string') {
			form = document.querySelector(form);
		}

		const elements = form ? form.elements : '';

		if (!elements) {
			console.error('Could not find form!');
		}

		Array.from(elements)
			.filter((element) => element ? element.name : null)
			.forEach((element) => {
				const { name, type } = element;
				const value = name in jsn ? jsn[name] : null;
				const isCheckOrRadio = type === 'checkbox' || type === 'radio';

				if (value === null) return;

				if (isCheckOrRadio) {
					const isSingle = value === element.value;
					console.warn('-----setFormValue isSingle:', isSingle, value, element.value)
					if (isSingle || (Array.isArray(value) && value.includes(element.value))) {
						element.checked = true;
					}
				} else {
					element.value = value ? value : '';
				}
			});
	}

	/**
	 * 延迟触发
	 * This provides a slight delay before processing rapid events
	 * @param {function} fn
	 * @param {number} wait - delay before processing function (recommended time 150ms)
	 * @returns
	 */
	debounce(fn, wait = 150) {
		let timeoutId = null
		return (...args) => {
			window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(() => {
				fn.apply(null, args);
			}, wait);
		};
	}

	/**
	 * 返回url的查询参数
	*/
	getQueryParams(param) {
		const searchParams = new URLSearchParams(window.location.search);
		return searchParams.get(param);
	}

	/**
	   * 获取浏览器语言
	 * Returns the user language
	*/
	getLanguage() {
		let userLanguage = navigator.languages && navigator.languages.length ? navigator.languages[0] : (navigator.language || navigator.userLanguage);
		if (userLanguage == 'zh') {
			userLanguage = 'zh_CN'
		} else if (userLanguage.indexOf('zh-') >= 0) {
			userLanguage = userLanguage.split('-').join('_')
		} else if (userLanguage.indexOf('-') !== -1) {
			userLanguage = userLanguage.replace(/-/g, '_');
		}
		return this.adaptLanguage(userLanguage);
	}

	/**
	  * 适配语言环境
   */
	adaptLanguage(ln) {
		let userLanguage = ln;
		if (ln.indexOf('zh') == 0) {
			if(ln.indexOf('CN') > -1){
				userLanguage = 'zh_CN'
			}else{
				userLanguage = 'zh_HK'
			}
		} else if (ln.indexOf('en') == 0) {
			userLanguage = 'en'
		} else if (userLanguage.indexOf('-') !== -1) {
			userLanguage = userLanguage.replace(/-/g, '_');
		}

		return userLanguage
	}

	/**
	   * JSON.parse优化
	 * parse json
	 * @param {string} jsonString
	 * @returns {object} json
	*/
	parseJson(jsonString) {
		if (typeof jsonString === 'object') return jsonString;
		try {
			const o = JSON.parse(jsonString);
			if (o && typeof o === 'object') {
				return o;
			}
		} catch (e) { }

		return false;
	}

	/**
	   * 读取json文件
	 * Reads a json file 
	 * @param {string} path
	 * @returns {Promise<any>} json
	*/
	async readJson(path) {
		if (!path) {
			console.error('A path is required to readJson.');
		}

		return new Promise((resolve, reject) => {
			try {
				const req = new XMLHttpRequest();
				req.onerror = reject;
				req.overrideMimeType('application/json');
				req.open('GET', path, true);
				req.onreadystatechange = (response) => {
					if (req.readyState === 4) {
						const jsonString = response && response.target && response.target.response || '';
						if (jsonString) {
							try {
								resolve(JSON.parse(jsonString));
							} catch (e) {
								reject();
							}
						} else {
							reject();
						}
					}
				};

				req.send();

			} catch (e) {
				reject();
			}
		});
	}


	/**
   * 完整图片转base64
   * @param {string} url 图片地址
   * @param {number} width canvas宽度，默认196
   * @param {number} height canvas宽度，默认196
   * @param {HTMLCanvasElement} inCanvas canvas元素，默认创建
   * @param {boolean} returnCanvas 是否返回canvas，默认false。默认返回base64的图片路径，有些时候需要接着画布添加元素，所以我们添加这个变量
	 * @return { string | HTMLCanvasElement }  默认返回base64的图片路径，returnCanvas为true返回画布
   */
	async drawImage(url, width = 196, height = 196, inCanvas, returnCanvas) {
		const canvas = inCanvas && inCanvas instanceof HTMLCanvasElement ? inCanvas : document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');

		const imgData = await this.loadImagePromise(url)
		if (imgData.status == 'ok') {
			ctx.drawImage(imgData.img, 0, 0, canvas.width, canvas.height);
		}
		return returnCanvas ? canvas : canvas.toDataURL('image/png'); //需要是否需要返回画布或者直接返回base64
	}

	/**
   * 裁剪图片转base64
   * @param {string} url 图片地址
   * @param {number} offsetX 裁剪x的位置
   * @param {number} offsetY 裁剪y的位置
   * @param {number} width canvas宽度，默认196
   * @param {number} height canvas宽度，默认196
   * @param {HTMLCanvasElement} inCanvas canvas元素，默认创建
   * @param {boolean} returnCanvas 是否返回canvas，默认false。默认返回base64的图片路径，有些时候需要接着画布添加元素，所以我们添加这个变量
	 * @return { string | HTMLCanvasElement }  默认返回base64的图片路径，returnCanvas为true返回画布
   */
	async cropImage(url, offsetX, offsetY, width = 196, height = 196, inCanvas, returnCanvas) {
		const canvas = inCanvas && inCanvas instanceof HTMLCanvasElement ? inCanvas : document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		canvas.width = width;
		canvas.height = height;


		const imgData = await this.loadImagePromise(url)
		if (imgData.status == 'ok') {
			ctx.drawImage(imgData.img, offsetX, offsetY, width, height, 0, 0, canvas.width, canvas.height);
		}

		return returnCanvas ? canvas : canvas.toDataURL('image/png'); //需要是否需要返回画布或者直接返回base64

	};

	/**
   * 获取图片数据
   * @param {string} url 图片地址
	 * @return {object}  {url, status: 'ok', img} or {url, status: 'error'}  
   */
	loadImagePromise(url) {
		return new Promise(resolve => {
			const img = new Image();
			img.onload = () => resolve({ url, status: 'ok', img });
			img.onerror = () => resolve({ url, status: 'error' });
			img.src = url;
		});
	}


	getData(url, param) {

		param = Object.assign(param || {}, Utils.joinTimestamp());

		//若参数有数组，进行特殊拼接
		url = url + '?' + Object.keys(param).map(e => {
			let str = ''
			//判断数组拼接
			if (param[e] instanceof Array) {
				str = param[e].map((item) => {
					return `${e}=${item}`
				}).join('&')
			} else {
				str = `${e}=${param[e]}`
			}
			return str
		}).join('&');
		// console.warn('=====getData url:', url)
		return new Promise(function (resolve, reject) {
			var req = new XMLHttpRequest();

			req.timeout = 1500; // 设置超时时间为 5 秒

			req.ontimeout = function () {
				console.error('Request timed out');
			};

			req.onload = function () {
				// console.warn('=====getData onload:')
				if (req.status === 200) {
					// console.warn('=====getData success:')
					resolve(req.response);
				} else {
					// console.warn('=====getData not 200:')
					reject(Error(req.statusText));
				}
			};

			req.onerror = function () {
				// console.warn('=====getData error:')
				reject(Error('Network Error'));
			};

			req.open('GET', url, true);
			req.send();
		});
	};

	/**
   * 获取接口数据
   * @param {string} url 接口地址
	 * @param {object} param 接口参数
	 * @param {string} method 请求方式：GET/POST/PUT/DELETE
	 * @param {object} headers 请求头
   */
	fetchData(url, param, method = 'GET', headers = {}) {

		if (method.toUpperCase() === 'GET') {
			param = Object.assign(param || {}, Utils.joinTimestamp());

			const tag = url.indexOf('?') >= 0 ? '&':'?'

			//若参数有数组，进行特殊拼接
			url = url + tag + Object.keys(param).map(e => {
				let str = ''
				//判断数组拼接
				if (param[e] instanceof Array) {
					str = param[e].map((item) => {
						return `${e}=${item}`
					}).join('&')
				} else {
					str = `${e}=${param[e]}`
				}
				return str
			}).join('&');
		}

		const opts = {
			cache: 'no-cache',
			headers,
			method: method,
			body: ['GET', 'HEAD'].includes(method)
				? undefined
				: param,
		};
		return new Promise(function (resolve, reject) {
			Utils.fetchWithTimeout(url, opts)
				.then(async (resp) => {
					// console.warn('==fetch success:', url)
					if (!resp) {
						reject(new Error('No Resp'));
					}
					if (!resp.ok) {
						const errData = await resp.json();
						if (errData) {
							reject(errData);
						} else {
							reject(new Error(`{${resp.status}: ${await resp.text()}}`));
						}

					} else {
						resolve(await resp.json());
					}
				})
				.catch((err) => {
					// console.warn('==fetch error:', JSON.stringify(err))	
					reject(err);
				})
		});
	}

	/**
   * 封装fetch请求，设置超时时间
   */
	fetchWithTimeout(url, options = {}) {
		const { timeout = 15000 } = options; // 设置默认超时时间为8000ms
		// console.warn('====fetchWithTimeout timeout:', timeout)

		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), timeout);


		// console.warn('==fetchWithTimeout:', url, JSON.stringify(options))
		const response = fetch(url, {
			...options,
			signal: controller.signal
		}).then((response) => {
			// console.warn('==fetchWithTimeout success:', JSON.stringify(response))
			clearTimeout(id);
			return response;
		}).catch((error) => {
			// console.warn('==fetchWithTimeout error:', JSON.stringify(error))
			clearTimeout(id);
			throw error;
		});

		return response;

	}

	/**
   * 获取随机时间戳
   */
	joinTimestamp() {
		const now = new Date().getTime();
		return { _t: now };
	}


	//判断是否为文件类型
	isFile(variable) {
		return variable instanceof File;
	}

	/**
   * 浏览器file转base64
   */
	htmlFileToBase64(file) {
		if (!this.isFile(file)) {
			return Promise.reject(new Error('Not a file'));
		}
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => resolve(reader.result);
			reader.onerror = error => reject(error);
		});
	}

	drawText(text, stroke = "#fff", background = "#000", wh = 196, textLabel, inCanvas) {
		// console.log('==drawText:', text, textLabel)
		const canvas = inCanvas ? inCanvas : document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		
		if(!inCanvas){
			canvas.width = wh;
			canvas.height = wh;
			if (background == "transparent") {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			} else {
				ctx.fillStyle = background;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}

		}
	
		
		const font = `"Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
		const fSize = text.length > 6 ? 40 : 50;


		// ctx.strokeStyle = "#000";
		// ctx.lineWidth = 4;
		
		ctx.fillStyle = stroke;
		ctx.font = `bold ${fSize}px ${font}`;
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';

		ctx.strokeText(text, ctx.canvas.width / 2, ctx.canvas.height / 2);
		ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2 );
	
		if(textLabel){
			ctx.font = `bold 24px ${font}`;
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'left';
			ctx.fillText(textLabel, 10, 20);
		}
		
		
		return canvas.toDataURL('image/png')
	}

	getProperty(obj, dotSeparatedKeys, defaultValue) {
		if (arguments.length > 1 && typeof dotSeparatedKeys !== 'string') return undefined;
		if (typeof obj !== 'undefined' && typeof dotSeparatedKeys === 'string') {
			const pathArr = dotSeparatedKeys.split('.');
			pathArr.forEach((key, idx, arr) => {
				if (typeof key === 'string' && key.includes('[')) {
					try {
						// extract the array index as string
						const pos = /\[([^)]+)\]/.exec(key)[1];
						// get the index string length (i.e. '21'.length === 2)
						const posLen = pos.length;
						arr.splice(idx + 1, 0, Number(pos));

						// keep the key (array name) without the index comprehension:
						// (i.e. key without [] (string of length 2)
						// and the length of the index (posLen))
						arr[idx] = key.slice(0, -2 - posLen); // eslint-disable-line no-param-reassign
					} catch (e) {
						// do nothing
					}
				}
			});
			// eslint-disable-next-line no-param-reassign, no-confusing-arrow
			obj = pathArr.reduce((o, key) => (o && o[key] !== 'undefined' ? o[key] : undefined), obj);
		}
		return obj === undefined ? defaultValue : obj;
	};

	getProp(jsn, str, defaultValue = {}, sep = '.') {
		const arr = str.split(sep);
		return arr.reduce((obj, key) => (obj && obj.hasOwnProperty(key) ? obj[key] : defaultValue), jsn);
	};

	/**
   * 获取插件根目录路径
   */
	getPluginPath(){
		const currentFilePath = location.pathname;
		let split_tag = '/'
		if(currentFilePath.indexOf('\\') > -1){
			split_tag = '\\'
		}
		const pathArr = currentFilePath.split(split_tag);
		const idx = pathArr.findIndex(f => f.endsWith('ulanziPlugin'));
		const __folderpath = `${pathArr.slice(0, idx + 1).join("/")}`;
	
		return __folderpath;
	
	}

	/**
	 * Logs a message 
	 * @param {any} msg
	 */
	log(...msg) {
		console.warn(`[${new Date().toLocaleString('zh-CN', { hour12: false })}]`, ...msg);
		// this.getQueryParams('debug') && console.log(`[${new Date().toLocaleString('zh-CN', {hour12: false})}]`, ...msg);
	}

	/**
	 * Logs a warning message 
	 */
	warn(...msg) {
		console.warn(`[${new Date().toLocaleString('zh-CN', { hour12: false })}]`, ...msg);
	}

	/**
	 * Logs an error message
	*/
	error(...msg) {
		console.error(`[${new Date().toLocaleString('zh-CN', { hour12: false })}]`, ...msg);
	}
}

const Utils = new UlanziUtils()
/// <reference path="eventEmitter.js"/>
/// <reference path="utils.js"/>

class UlanziStreamDeck {
  constructor() {
    this.key = "";
    this.uuid = "";
    this.actionid = "";
    this.websocket = null;
    this.language = "en";
    this.localization = null;
    this.on = EventEmitter.on;
    this.emit = EventEmitter.emit;
    this.isMain = false;
  }

  connect(uuid) {
    // console.warn('===---connect:', window.location.search)
    this.port = Utils.getQueryParams("port") || 3906;
    this.address = Utils.getQueryParams("address") || "127.0.0.1";
    this.actionid = Utils.getQueryParams("actionid") || "";
    this.key = Utils.getQueryParams("key") || "";
    this.language =
      Utils.getQueryParams("language") || Utils.getLanguage() || "en";
    this.language = Utils.adaptLanguage(this.language);
    this.uuid = Utils.getQueryParams("uuid") || uuid;
    this.controller = Utils.getQueryParams("controller") || "Keypad"; //Keypad 按键 ,Encoder 旋钮
    this.device = Utils.getQueryParams("device") || "";

    this.mode = Utils.getQueryParams("mode") || "";
    if (this.mode == "simulate") {
      document.documentElement.style.backgroundColor = "#1E1F22";
      document.body.style.backgroundColor = "#1E1F22";
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    //判断是否为主服务,约定主服务 uuid 为4位，action应大于4位
    const isMain = this.uuid.split(".").length == 4;
    this.isMain = isMain;

    Utils.log(
      `[ULANZIDECK] ${this.isMain ? "MAIN" : "CLIENT"} WEBSOCKET CONNECT:${
        this.uuid
      }`
    );
    this.websocket = new WebSocket(`ws://${this.address}:${this.port}`);

    this.websocket.onopen = () => {
      Utils.log(
        `[ULANZIDECK] ${this.isMain ? "MAIN" : "CLIENT"} WEBSOCKET OPEN:${
          this.uuid
        }`
      );
      const json = {
        code: 0,
        cmd: Events.CONNECTED,
        actionid: this.actionid,
        key: this.key,
        uuid: this.uuid,
      };

      this.websocket.send(JSON.stringify(json));

      this.emit(Events.CONNECTED, {});

      //如果是主服务，则不进行本地化
      if (!isMain) {
        this.localizeUI();
      }
    };

    this.websocket.onerror = (evt) => {
      const error = `[ULANZIDECK] ${
        this.isMain ? "MAIN" : "CLIENT"
      } WEBSOCKET ERROR: ${evt}, ${evt.data}, ${SocketErrors["DEFAULT"]}`;
      Utils.warn(error);
      this.emit(Events.ERROR, error);
    };

    this.websocket.onclose = (evt) => {
      Utils.warn(
        `[ULANZIDECK] ${this.isMain ? "MAIN" : "CLIENT"} WEBSOCKET CLOSED:${
          SocketErrors["DEFAULT"]
        }`
      );
      this.emit(Events.CLOSE);
    };

    this.websocket.onmessage = (evt) => {
      Utils.log(
        `[ULANZIDECK] ${this.isMain ? "MAIN" : "CLIENT"} WEBSOCKET MESSGE `
      );

      const data = evt && evt.data ? JSON.parse(evt.data) : null;

      Utils.log(
        `[ULANZIDECK] ${
          this.isMain ? "MAIN" : "CLIENT"
        } WEBSOCKET MESSGE DATA:${JSON.stringify(data)}`
      );

      //没有数据或者有data.code属性,且cmdType不等于REQUEST，则返回
      if (
        !data ||
        (typeof data.code !== "undefined" && data.cmdType !== "REQUEST")
      )
        return;

      Utils.log(
        `[ULANZIDECK] ${this.isMain ? "MAIN" : "CLIENT"} WEBSOCKET MESSGE IN`
      );

      //没有key时，保存key
      if (!this.key && data.uuid == this.uuid && data.key) {
        this.key = data.key;
      }
      //没有actionid时，保存actionid
      if (!this.actionid && data.uuid == this.uuid && data.actionid) {
        this.actionid = data.actionid;
      }

      if (isMain) {
        //主服务回应上位机
        this.send(data.cmd, {
          code: 0,
          ...data,
        });
      }

      //特殊处理clear,因为clear事件变量是数组形式
      if (data.cmd == "clear") {
        if (data.param) {
          for (let i = 0; i < data.param.length; i++) {
            const context = this.encodeContext(data.param[i]);
            data.param[i].context = context;
          }
        }
      } else {
        //拼接唯一id给功能页
        const context = this.encodeContext(data);
        data.context = context;
      }

      //引发事件
      this.emit(data.cmd, data);
    };
  }

  /**
   * 本地化
   */
  async localizeUI() {
    const el = document.querySelector(".uspi-wrapper") || document.querySelector(".udpi-wrapper");
    if (!el) return Utils.warn("No element found to localize");

    // this.language = Utils.getLanguage() || 'en';
    if (!this.localization) {
      try {
        const localJson = await Utils.readJson(
          `${Utils.getPluginPath()}/${this.language}.json`
        );
        this.localization = localJson["Localization"]
          ? localJson["Localization"]
          : null;
      } catch (e) {
        Utils.log(`${Utils.getPluginPath()}/${this.language}.json`);
        Utils.warn(`No FILE found to localize: ${this.language}`);
      }
    }
    if (!this.localization) return;

    const selectorsList = "[data-localize]";
    el.querySelectorAll(selectorsList).forEach((e) => {
      const s = e.innerText.trim();
      let dl = e.dataset.localize;

      if (e.placeholder && e.placeholder.length) {
        // console.log('e.placeholder:',e.placeholder)
        e.placeholder =
          this.localization[dl ? dl : e.placeholder] || e.placeholder;
      }
      if (e.title && e.title.length) {
        // console.log('e.title:',e.title)
        e.title = this.localization[dl ? dl : e.title] || e.title;
      }
      if (e.label) {
        // console.log('e.label:',e.label)
        e.label = this.localization[dl ? dl : e.label] || e.label;
      }
      if (e.textContent) {
        // console.log('e.textContent:',e.textContent)
        e.textContent =
          this.localization[dl ? dl : e.textContent] || e.textContent;
      }

      if (s) {
        // console.log('s:',s)
        e.innerHTML = this.localization[dl ? dl : s] || e.innerHTML;
      }
    });
  }

  t(key) {
    return (this.localization && this.localization[key]) || key;
  }

  /**
   * 创建唯一值
   */
  encodeContext(jsn) {
    return jsn.uuid + "___" + jsn.key + "___" + jsn.actionid;
  }

  /**
   * 解构唯一值
   */
  decodeContext(context) {
    const de_ctx = context.split("___");
    return {
      uuid: de_ctx[0],
      key: de_ctx[1],
      actionid: de_ctx[2],
    };
  }

  /**
   * Send JSON params to StreamDeck
   * @param {string} cmd
   * @param {object} params
   */
  send(cmd, params) {
    // console.warn('===--send:', JSON.stringify({
    //   cmd,
    //   uuid: this.uuid,
    //   key: this.key,
    //   actionid: this.actionid,
    //   ...params,
    // }))
    this.websocket &&
      this.websocket.send(
        JSON.stringify({
          cmd,
          uuid: this.uuid,
          key: this.key,
          actionid: this.actionid,
          ...params,
        })
      );
  }

  /**
   * 向上位机发送配置参数
   * @param {object} settings 必传 | 配置参数
   * @param {object} context 可选 | 唯一id。非必传，由action页面发出时可以不传，由主服务发出必传
   */
  sendParamFromPlugin(settings, context) {
    const { uuid, key, actionid } = context ? this.decodeContext(context) : {};
    this.send(Events.PARAMFROMPLUGIN, {
      uuid: uuid || this.uuid,
      key: key || this.key,
      actionid: actionid || this.actionid,
      param: settings,
    });
  }

  /**
   * 请求上位机使⽤浏览器打开url
   * @param {string} url 必传 | 直接远程地址和本地地址，⽀持打开插件根⽬录下的url链接（以/ ./ 起始的链接）。
   *                            只能是基本路径，不能带参数，需要带参数请设置在param值里面
   * @param {local} boolean 可选 | 若为本地地址为true
   * @param {object} param 可选 | 路径的参数值
   */
  openUrl(url, local, param) {
    this.send(Events.OPENURL, {
      url,
      local: local ? true : false,
      param: param ? param : null,
    });
  }

  /**
   * 请求上位机机显⽰弹窗；弹窗后，test.html需要主动关闭，测试到window.close()可以通知弹窗关闭
   *  @param {string} url 必传 | 本地html路径，只能是基本路径，不能带参数，需要带参数请设置在param值里面
   * @param {string} width 可选 | 窗口宽度，默认200
   * @param {string} height 可选 | 窗口高度，默认200
   * @param {string} x 可选 | 窗口x坐标，不传值默认居中
   * @param {string} y 可选 | 窗口y坐标，不传值默认居中
   * @param {object} param 可选 | 路径的参数值
   */
  openView(url, width = 200, height = 200, x, y, param) {
    const params = {
      url,
      width,
      height,
    };
    if (x) {
      params.x = x;
    }
    if (y) {
      params.y = y;
    }
    if (param) {
      params.param = param;
    }
    this.send(Events.OPENVIEW, params);
  }

  /**
   * 请求上位机弹出Toast消息提⽰
   *  @param {string} msg 必传 | 窗口级消息提示
   */
  toast(msg) {
    this.send(Events.TOAST, {
      msg,
    });
  }

  /**
   * 请求上位机弹出快捷键
   *  @param {string} key 必传 | 快捷键
   */
  hotkey(key) {
    this.send(Events.HOTKEY, {
      keylist: key,
    });
  }

  /**
   * 请求上位机弹出日志消息提⽰
   *  @param {string} msg 必传 | 保存到插件UUID.txt中
   *  @param {string} level 可选 | 日志级别 info|debug|warn|error
   */
  logMessage(msg, level) {
    this.send(Events.LOGMESSAGE, {
      message: msg,
      level: level || "info",
    });
  }
  /**
   *  主服务发出，上位机透传参数到action页面，此透传参数上位机不保存
   *  @param {object} settings 必传 | 设置
   *  @param {string} context 必传 | 唯一id，需要指定发送到哪个action
   */
  sendToPropertyInspector(settings, context) {
    const { uuid, key, actionid } = context ? this.decodeContext(context) : {};
    this.send(Events.SENDTOPROPERTYINSPECTOR, {
      uuid: uuid,
      key: key,
      actionid: actionid,
      payload: settings,
    });
  }

  /**
   *  action页面发出，上位机透传参数到主服务，此透传参数上位机不保存
   *  @param {object} settings 必传 | 设置
   */
  sendToPlugin(settings) {
    this.send(Events.SENDTOPLUGIN, {
      uuid: this.uuid,
      key: this.key,
      actionid: this.actionid,
      payload: settings,
    });
  }

  /**
   * 请求上位机在按键上显示错误提示
   *  @param {string} context 可选 | 唯一id。非必传，由action页面发出时可以不传，由主服务发出必传
   */
  showAlert(context) {
    const { uuid, key, actionid } = context ? this.decodeContext(context) : {};
    this.send(Events.SHOWALERT, {
      uuid: uuid || this.uuid,
      key: key || this.key,
      actionid: actionid || this.actionid,
    });
  }

  /**
   * 请求上位机发送已保存的参数，上位机接收后会触发didReceiveSettings事件转发至另一端
   *  @param {string} context 可选 | 唯一id。非必传，由action页面发出时可以不传，由主服务发出必传
   */
  getSettings(context) {
    const { uuid, key, actionid } = context ? this.decodeContext(context) : {};
    this.send(Events.GETSETTINGS, {
      uuid: uuid || this.uuid,
      key: key || this.key,
      actionid: actionid || this.actionid,
    });
  }

  /**
   * 主动向上位机保存参数，上位机接收后会触发didReceiveSettings事件转发至另一端
   *  @param {object} settings 必传 | 配置参数
   *  @param {string} context 可选 | 唯一id。非必传，由action页面发出时可以不传，由主服务发出必传
   */
  setSettings(settings, context) {
    console.warn('===---setSettings:', JSON.stringify(settings), context)
    const { uuid, key, actionid } = context ? this.decodeContext(context) : {};
    this.send(Events.SETSETTINGS, {
      uuid: uuid || this.uuid,
      key: key || this.key,
      actionid: actionid || this.actionid,
      settings,
    });
  }

  
      /**
     * 请求上位机发送已保存的全局参数，上位机接收后会触发didReceiveGlobalSettings事件转发至另一端
     *  @param {string} context 可选 | 唯一id。非必传，由action页面发出时可以不传，由主服务发出必传
     */
    getGlobalSettings(context) {
      const { uuid, key, actionid } = context ? this.decodeContext(context) : {};
      this.send(Events.GETGLOBALSETTINGS, {
        uuid: uuid || this.uuid,
        key: key || this.key,
        actionid: actionid || this.actionid,
      });
    }
  
    /**
     * 主动向上位机保存参数，上位机接收后会触发didReceiveGlobalSettings事件转发至另一端
     *  @param {object} settings 必传 | 配置参数
     *  @param {string} context 可选 | 唯一id。非必传，由action页面发出时可以不传，由主服务发出必传
     */
    setGlobalSettings(settings, context) {
      const { uuid, key, actionid } = context ? this.decodeContext(context) : {};
      this.send(Events.SETGLOBALSETTINGS, {
        uuid: uuid || this.uuid,
        key: key || this.key,
        actionid: actionid || this.actionid,
        settings,
      });
    }

  /**
   * 请求上位机弹出选择对话框:选择文件
   *  @param {string} filter 可选 | 文件过滤器。筛选文件的类型，例如 "filter": "image(*.jpg *.png *.gif)" 或者 筛选文件 file(*.txt *.json) 等
   * 该请求的选择结果请通过 onSelectdialog 事件接收
   */
  selectFileDialog(filter) {
    this.send(Events.SELECTDIALOG, {
      type: "file",
      filter,
    });
  }

  /**
   * 请求上位机弹出选择对话框:选择文件夹
   * 该请求的选择结果请通过 onSelectdialog 事件接收
   */
  selectFolderDialog() {
    this.send(Events.SELECTDIALOG, {
      type: "folder",
    });
  }

  /**
   * 设置图标-使⽤配置⾥的图标列表编号，请对照manifest.json
   * @param {string} context 必传 |唯一id,每个message里面common库会自动拼接给出
   * @param {number} state 必传 | 图标列表编号，
   * @param {string} text 可选 | icon是否显示文字
   */
  setStateIcon(context, state, text) {
    const { uuid, key, actionid } = this.decodeContext(context);
    this.send(Events.STATE, {
      param: {
        statelist: [
          {
            uuid,
            key,
            actionid,
            type: 0,
            state,
            textData: text || "",
            showtext: text ? true : false,
          },
        ],
      },
    });
  }

  /**
   * 设置图标-使⽤⾃定义图标
   * @param {string} context 必传 |唯一id,每个message里面common库会自动拼接给出
   * @param {string} data 必传 | base64格式的icon
   * @param {string} text 可选 | icon是否显示文字
   */
  setBaseDataIcon(context, data, text) {
    const { uuid, key, actionid } = this.decodeContext(context);
    this.send(Events.STATE, {
      param: {
        statelist: [
          {
            uuid,
            key,
            actionid,
            type: 1,
            data,
            textData: text || "",
            showtext: text ? true : false,
          },
        ],
      },
    });
  }

  /**
   * 设置图标-使⽤本地图片文件
   * @param {string} context 必传 |唯一id,每个message里面common库会自动拼接给出
   * @param {string} path  必传 | 本地图片路径，⽀持打开插件根⽬录下的url链接（以/ ./ 起始的链接）
   * @param {string} text 可选 | icon是否显示文字
   */
  setPathIcon(context, path, text) {
    const { uuid, key, actionid } = this.decodeContext(context);
    this.send(Events.STATE, {
      param: {
        statelist: [
          {
            uuid,
            key,
            actionid,
            type: 2,
            path,
            textData: text || "",
            showtext: text ? true : false,
          },
        ],
      },
    });
  }

  /**
   * 设置图标-使⽤⾃定义的动图
   * @param {string} context 必传 |唯一id,每个message里面common库会自动拼接给出
   * @param {string} gifdata  必传 | ⾃定义gif的base64编码数据
   * @param {string} text 可选 | icon是否显示文字
   */
  setGifDataIcon(context, gifdata, text) {
    const { uuid, key, actionid } = this.decodeContext(context);
    this.send(Events.STATE, {
      param: {
        statelist: [
          {
            uuid,
            key,
            actionid,
            type: 3,
            gifdata,
            textData: text || "",
            showtext: text ? true : false,
          },
        ],
      },
    });
  }

  /**
   * 设置图标-使⽤本地gif⽂件
   * @param {string} context 必传 |唯一id,每个message里面common库会自动拼接给出，
   * @param {string} gifdata  必传 | 本地gif图片路径，⽀持打开插件根⽬录下的url链接（以/ ./ 起始的链接）
   * @param {string} text 可选 | icon是否显示文字
   */
  setGifPathIcon(context, gifpath, text) {
    const { uuid, key, actionid } = this.decodeContext(context);
    this.send(Events.STATE, {
      param: {
        statelist: [
          {
            uuid,
            key,
            actionid,
            type: 4,
            gifpath,
            textData: text || "",
            showtext: text ? true : false,
          },
        ],
      },
    });
  }

  /**
   * 监听socket连接事件
   */
  onConnected(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the connected event is required for onConnected."
      );
    }

    this.on(Events.CONNECTED, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 监听socket断开事件
   */
  onClose(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the close event is required for onClose."
      );
    }

    this.on(Events.CLOSE, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 监听socket错误事件
   */
  onError(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the error event is required for onError."
      );
    }

    this.on(Events.ERROR, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：add
   */
  onAdd(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the add event is required for onAdd."
      );
    }

    this.on(Events.ADD, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：paramfromapp
   */
  onParamFromApp(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the paramfromapp event is required for onParamFromApp."
      );
    }

    this.on(Events.PARAMFROMAPP, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：paramfromplugin
   */
  onParamFromPlugin(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the paramfromplugin event is required for onParamFromPlugin."
      );
    }

    this.on(Events.PARAMFROMPLUGIN, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：run
   */
  onRun(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the run event is required for onRun."
      );
    }

    this.on(Events.RUN, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：setactive
   */
  onSetActive(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the setactive event is required for onSetActive."
      );
    }

    this.on(Events.SETACTIVE, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：clear
   */
  onClear(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the clear event is required for onClear."
      );
    }

    this.on(Events.CLEAR, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：返回选择弹窗结果
   */
  onSelectdialog(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the selectdialog event is required for onSelectdialog."
      );
    }

    this.on(Events.SELECTDIALOG, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：didReceiveSettings, 接受上位机保存的参数
   */
  onDidReceiveSettings(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the didReceiveSettings event is required for onDidReceiveSettings."
      );
    }
    this.on(Events.DIDRECEIVESETTINGS, (jsn) => fn(jsn));
    return this;
  }

   /**
   * didReceiveGlobalSettings, 接受全局设置的参数
   */
  onDidReceiveGlobalSettings(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the didReceiveGlobalSettings event is required for onDidReceiveGlobalSettings."
      );
    }
    this.on(Events.DIDRECEIVEGLOBALSETTINGS, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 
   * 接收 主服务发给功能页的透传参数事件
   */
  onSendToPropertyInspector(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the sendToPropertyInspector event is required for onSendToPropertyInspector."
      );
    }
    this.on(Events.SENDTOPROPERTYINSPECTOR, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 
   * 接收 功能页发给主服务的透传参数事件
   */
  onSendToPlugin(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the sendToPlugin event is required for onSendToPlugin."
      );
    }
    this.on(Events.SENDTOPLUGIN, (jsn) => fn(jsn));
    return this;
  }

  /**
   * 接收上位机事件：keydown, 接收上位机按键按下事件
   */
  onKeyDown(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the keydown event is required for onKeyDown."
      );
    }
    this.on(Events.KEYDOWN, (jsn) => fn(jsn));
    return this;
  }
  /**
   * 接收上位机事件：keyup, 接收上位机按键松开事件
   */
  onKeyUp(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the keyup event is required for onKeyUp."
      );
    }
    this.on(Events.KEYUP, (jsn) => fn(jsn));
    return this;
  }
  /**
   * 接收上位机事件：dialdown, 接收上位机旋钮按下事件
   */
  onDialDown(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the dialdown event is required for onDialDown."
      );
    }
    this.on(Events.DIALEDOWN, (jsn) => fn(jsn));
    return this;
  }
  /**
   * 接收上位机事件：dialup, 接收上位机旋钮松开事件
   */
  onDialUp(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the dialup event is required for onDialUp."
      );
    }
    this.on(Events.DIALEUP, (jsn) => fn(jsn));
    return this;
  }
  /**
   * 接收上位机事件：dialrotate, 接收上位机旋钮向左旋转事件
   */
  onDialRotateLeft(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the dialrotate left event is required for onDialRotateLeft."
      );
    }
    this.on(Events.DIALROTATE, (jsn) => {
      if (jsn.rotateEvent === "left") {
        fn(jsn);
      }
    });
    return this;
  }

  /**
   * 接收上位机事件：dialrotate, 接收上位机旋钮向右旋转事件
   */
  onDialRotateRight(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the dialrotate right event is required for onDialRotateRight."
      );
    }
    this.on(Events.DIALROTATE, (jsn) => {
      if (jsn.rotateEvent === "right") {
        fn(jsn);
      }
    });
    return this;
  }

  /**
   * 接收上位机事件：dialrotate, 接收上位机旋钮按住向左旋转事件
   */
  onDialRotateHoldLeft(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the dialrotate hold-left event is required for onDialRotateHoldLeft."
      );
    }
    this.on(Events.DIALROTATE, (jsn) => {
      if (jsn.rotateEvent === "hold-left") {
        fn(jsn);
      }
    });
    return this;
  }

  /**
   * 接收上位机事件：dialrotate, 接收上位机旋钮按住向右旋转事件
   */
  onDialRotateHoldRight(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the dialrotate hold-right event is required for onDialRotateHoldRight."
      );
    }
    this.on(Events.DIALROTATE, (jsn) => {
      // 注意：原数据中有个拼写错误"hold—right"，这里使用正确的连字符
      if (jsn.rotateEvent === "hold-right") {
        fn(jsn);
      }
    });
    return this;
  }

  /**
   * 接收上位机事件：dialrotate, 接收上位机旋钮旋转事件
   */
  onDialRotate(fn) {
    if (!fn) {
      Utils.error(
        "A callback function for the dialrotate event is required for onDialRotate."
      );
    }
    this.on(Events.DIALROTATE, (jsn) => fn(jsn));
    return this;
  }
}

const $UD = new UlanziStreamDeck();
