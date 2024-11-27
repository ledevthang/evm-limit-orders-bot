"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AxiosProviderConnector", {
    enumerable: true,
    get: function() {
        return AxiosProviderConnector;
    }
});
const _axios = /*#__PURE__*/ _interop_require_wildcard(require("axios"));
const _errors = require("./errors");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
class AxiosProviderConnector {
    async get(url, headers) {
        try {
            const res = await _axios.default.get(url, {
                headers
            });
            return res.data;
        } catch (error) {
            if ((0, _axios.isAxiosError)(error) && error.response?.status === 401) {
                throw new _errors.AuthError();
            }
            throw error;
        }
    }
    async post(url, data, headers) {
        try {
            const res = await _axios.default.post(url, data, {
                headers
            });
            return res.data;
        } catch (error) {
            if ((0, _axios.isAxiosError)(error) && error.response?.status === 401) {
                throw new _errors.AuthError();
            }
            throw error;
        }
    }
}
