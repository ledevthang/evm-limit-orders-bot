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
            console.error(`OneInch Error: ${JSON.stringify({
                code: error?.lastError?.code,
                message: error?.lastError?.message,
                response: error?.lastError?.response?.data
            }, null, 1)}`);
            return true;
        }
    });
}
