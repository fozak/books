import fetch from 'node-fetch';
export async function sendAPIRequest(endpoint, options) {
    return (await fetch(endpoint, options)).json();
}
//# sourceMappingURL=api.js.map