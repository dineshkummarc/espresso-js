var WebSocket = WebSocket || {};

/* As described in WebSocket protocol draft 76,
* security keys are decoded by concatenating all digits
* then dividing the resulting number by the number of spaces
*/
WebSocket.decodeKey = function (key) {
	var n = parseInt(key.replace(/[^\d]+/g, ''), 10) / key.replace(/[^\s]+/g, '').length;

	 return (String.fromCharCode(n >> 24 & 0xFF)
	+ String.fromCharCode(n >> 16 & 0xFF)
	+ String.fromCharCode(n >> 8 & 0xFF)
	+ String.fromCharCode(n & 0xFF));
};