"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AuthError", {
    enumerable: true,
    get: function() {
        return AuthError;
    }
});
class AuthError extends Error {
    constructor(){
        super('Auth error, please use token from https://portal.1inch.dev/');
    }
}
