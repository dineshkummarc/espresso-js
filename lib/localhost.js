/* Default server for localhost */
(function () {
	var LocalServer = HTTPApplication.extend();

	LocalServer.prototype.processRequest = function (request, client, input, output) {
		/* Serve a static file, if it exists */
		file = new File('httpdocs' + request.resource);
		if (file.exists() && !file.isDirectory()) {
			HTTPServer.serveFile(request, output, file);
			return;
		}

		/* Serve a dynamic/debug message */
		var message = [], key, value;
		message.push('Hello, browser!');
		message.push('');
		for ([key, value] in request) {
			message.push(key + ' = ' + (typeof value === 'object' && JSON.stringify(value) || value));
		}
		
		message = message.join('<br/>');
		
		output.print('HTTP/1.1 200 OK\r\n');
		output.print('Content-type: text/html\r\n');
		output.print('Content-length: ' + message.length + '\r\n');
		output.print('\r\n');
		output.print(message);
	};

	/* Example WebSocket that echoes input */
	LocalServer.prototype.processWebSocketRequest = function (websocket) {
		websocket.loop(function (message) {
			this.write('ECHO: ' + message);
		});
	};

	HTTPServer.addApplication(LocalServer);
}());
