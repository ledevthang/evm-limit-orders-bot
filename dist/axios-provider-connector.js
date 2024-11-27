"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OneInchClient", {
    enumerable: true,
    get: function() {
        return OneInchClient;
    }
});
const _axios = /*#__PURE__*/ _interop_require_default(require("axios"));
const _luxon = require("luxon");
const _tsretrypromise = require("ts-retry-promise");
const _utils = require("./utils.js");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class OneInchClient {
    async get(url, headers) {
        console.log("get url: ", url);
        console.log("get headers: ", headers);
        return this.handleLimitRequest(async ()=>{
            const response = await _axios.default.get(url, {
                headers
            });
            return response.data;
        });
    }
    async post(url, data, headers) {
        console.log("post url: ", url);
        console.log("post headers: ", headers);
        return this.handleLimitRequest(async ()=>{
            const response = await _axios.default.post(url, data, {
                headers
            });
            return response.data;
        });
    }
    async spotPrice(chainId, address) {
        return this.handleLimitRequest(async ()=>{
            const response = await _axios.default.get(`https://api.1inch.dev/price/v1.1/${chainId}/${address}?currency=USD`, {
                headers: {
                    Authorization: `Bearer ${this.oneInchApi}`,
                    accept: "application/json"
                }
            });
            return response.data;
        });
    }
    async handleLimitRequest(thunk) {
        while(_luxon.DateTime.now().toSeconds() - this.lastimeCalling.toSeconds() > this.restTimeInMiliSeconds)await (0, _utils.sleep)(1000);
        this.lastimeCalling = _luxon.DateTime.now();
        const result = await (0, _tsretrypromise.retry)(thunk, {
            retries: 6,
            delay: 1500,
            timeout: "INFINITELY"
        });
        await (0, _utils.sleep)(this.restTimeInMiliSeconds);
        return result;
    }
    constructor(oneInchApi){
        _define_property(this, "oneInchApi", void 0);
        _define_property(this, "lastimeCalling", void 0);
        _define_property(this, "restTimeInMiliSeconds", void 0);
        this.oneInchApi = oneInchApi;
        this.lastimeCalling = _luxon.DateTime.now();
        this.restTimeInMiliSeconds = 3000;
    }
}
