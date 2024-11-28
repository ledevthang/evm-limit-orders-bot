"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    infinitely: function() {
        return infinitely;
    },
    sleep: function() {
        return sleep;
    }
});
const _axios = require("axios");
const _tsretrypromise = require("ts-retry-promise");
function sleep(duration) {
    return new Promise((res)=>setTimeout(res, duration));
}
async function infinitely(thunk) {
    return (0, _tsretrypromise.retry)(thunk, {
        timeout: "INFINITELY",
        retries: "INFINITELY",
        delay: 3000,
        retryIf: (error)=>{
            if ((0, _axios.isAxiosError)(error)) {
                console.error(`Http request Error: ${JSON.stringify({
                    code: error?.code,
                    message: error?.message,
                    response: error?.response?.data
                }, null, 1)}`);
            } else if (error?.lastError && (0, _axios.isAxiosError)(error.lastError)) {
                console.error(`Http request Error: ${JSON.stringify({
                    code: error.lastError?.code,
                    message: error.lastError?.message,
                    response: error.lastError?.response?.data
                }, null, 1)}`);
            } else {
                console.error(error);
            }
            return true;
        }
    });
}
