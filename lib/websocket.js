/* This function implements the WebSocket protocol as described in Draft 76
*  http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76#section-1.3
*/
function WebSocket(request) {
	this.request = request;
	this.input = request.input;
	this.output = request.output;

	var buffer = new ByteArrayOutputStream();
	buffer.write(WebSocket.decodeKey(request['sec-websocket-key1']));
	buffer.write(WebSocket.decodeKey(request['sec-websocket-key2']));

	// We have to pull the last 8 bytes of content to be hashed for the handshake
	buffer.write(input.read(8));
	
	var token = MessageDigest.getInstance('MD5').digest(buffer.toByteArray());
	buffer.reset();
	buffer.write(token); // buffer now contains the hash to be sent back
		
	output.print('HTTP/1.1 101 WebSocket Protocol Handshake\r\n');
	output.print('Upgrade: WebSocket\r\n');
	output.print('Connection: Upgrade\r\n');
	output.print('Sec-WebSocket-Origin: ' + request.origin + '\r\n');
	output.print('Sec-WebSocket-Location: ws://' + request.host + '' + request.resource + '\r\n');
	output.print('\r\n');
	buffer.writeTo(output);
};

/* Writes a WebSocket data frame */
WebSocket.prototype.write = function (message) {
	var buffer = new ByteArrayOutputStream();
	buffer.write(0x00);
	buffer.write(new java.lang.String(message).getBytes('UTF-8'));
	buffer.write(0xFF);
	buffer.writeTo(this.output);
};

/* Calls a function each time a WebSocket dataframe is received */
WebSocket.prototype.loop = function (callback) {
	var line;
	while ((line = this.input.readDataFrame()) !== null) {
		print(line);
		callback.apply(this, [line]);
	}
};

/* As described in WebSocket protocol draft 76,
* security keys are decoded by concatenating all digits
* then dividing the resulting number by the number of spaces
*/
WebSocket.decodeKey = function (key) {
	key = '' + key;
	var n = parseInt(key.replace(/[^\d]+/g, ''), 10) / key.replace(/[^\s]+/g, '').length;
	var buffer = new ByteArrayOutputStream();
	buffer.write(n >> 24 & 0xFF);
	buffer.write(n >> 16 & 0xFF);
	buffer.write(n >> 8 & 0xFF);
	buffer.write(n & 0xFF);

	return buffer.toByteArray();
};

WebSocket.isWebSocketRequest = function (request) {
	return (
		request.upgrade && request.upgrade === 'WebSocket'
		&& request.connection && request.connection === 'Upgrade'
	);
};
