/* Default server for localhost */
(function () {
	var LocalServer = HTTPApplication.extend();

	LocalServer.prototype.processRequest = function (request) {
		/* Serve a static file, if it exists */
		file = new File('httpdocs' + request.resource);
		if (file.exists() && !file.isDirectory()) {
			if (/.jsv$/.test(request.resource)) {
				this.serveView('httpdocs' + request.resource, request);
			} else {
				HTTPServer.serveFile(request, file);
			}

			return;
		}

		/* Serve a dynamic/debug message */
		var message = [], key, value;
		message.push('Hello, browser!');
		message.push('');
		
		for ([key, value] in JSON.parse(request.toJSON())) {
			message.push(key + ' = ' + (typeof value === 'object' && JSON.stringify(value) || value));
		}

		message = message.join('<br/>');
		
		this.sendResponseHeaders(200, {'content-type': 'text/html'}, request, message.length);
		request.output.print(message);
	};

	/* Serve PHP-like dynamic files */
	LocalServer.prototype.serveView = function (file, request) {
		var data, view, headers, out = new HTTPOutputStream();
		headers = {'content-type': 'text/html'};
		view = HTTPViewParser.parse(readFile(file));

		view(out, request, {}, headers, this);
		data = out.getBuffer();

		this.sendResponseHeaders(headers.httpCode || 200, headers, request, data.length);
		request.output.print(data);
	};

	/* Example WebSocket that echoes input */
	LocalServer.prototype.processWebSocketRequest = function (websocket) {
		websocket.loop(function (message) {
			this.write('ECHO: ' + message);
		});
	};

	HTTPServer.addApplication(LocalServer);
}());
