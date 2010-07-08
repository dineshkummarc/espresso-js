var WebSocket = WebSocket || {};

/* As described in WebSocket protocol draft 76,
* security keys are decoded by concatenating all digits
* then dividing the resulting number by the number of spaces
*/
WebSocket.decodeKey = function (key) {
	key = '' + key;
	var n = parseInt(key.replace(/[^\d]+/g, ''), 10) / key.replace(/[^\s]+/g, '').length;
	var buffer = new ByteArrayOutputStream();
	buffer.write(n >> 24 & 0xFF)
	buffer.write(n >> 16 & 0xFF)
	buffer.write(n >> 8 & 0xFF)
	buffer.write(n & 0xFF);

	return buffer.toByteArray();
};

WebSocket.isWebSocketRequest = function (request) {
	return (
		request.upgrade && request.upgrade === 'WebSocket'
		&& request.connection && request.connection === 'Upgrade'
	);
};

/* This function implements the WebSocket protocol as described in Draft 76
*  http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76#section-1.3
*/
WebSocket.process = function (request, client, input, output) {
	// We have to pull the last 8 bytes of content to be hashed for the handshake
	request.data = input.read(8);
	
	var buffer = new ByteArrayOutputStream();
	var key1 = WebSocket.decodeKey(request['sec-websocket-key1']);
	var key2 = WebSocket.decodeKey(request['sec-websocket-key2']);
	buffer.write(key1, 0, key1.length);
	buffer.write(key2, 0, key1.length);
	buffer.write(request.data, 0, request.data.length);
	var token = MessageDigest.getInstance('MD5').digest(buffer.toByteArray());
	buffer.reset();
	buffer.write(token, 0, token.length);
		
	output.print('HTTP/1.1 101 WebSocket Protocol Handshake\r\n');
	output.print('Upgrade: WebSocket\r\n');
	output.print('Connection: Upgrade\r\n');
	output.print('Sec-WebSocket-Origin: ' + request.origin + '\r\n');
	output.print('Sec-WebSocket-Location: ws://' + request.host + '' + request.resource + '\r\n');
	output.print('\r\n');
	
	buffer.writeTo(output);
	
	/* WebSocket handshake is complete, now enter i/o loop */
	while ((line = input.readDataFrame()) !== null) {
		print(line);
	}
}