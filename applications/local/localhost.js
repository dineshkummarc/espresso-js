/* Default server for localhost */
(function () {
	var LocalServer = HTTPApplication.extend();

	LocalServer.prototype.processRequest = function (request) {
		if (/^\/$/.test(request.resource)) {
			request.resource = '/index.jsv';
		}

		/* Serve a static file, if it exists */
		file = new File(this.getFilePath('httpdocs' + request.resource));
		if (file.exists() && !file.isDirectory()) {
			this.serveRoot(request);
			return;
		}

	};

	/* Example WebSocket that echoes input */
	LocalServer.prototype.processWebSocketRequest = function (websocket) {
		websocket.loop(function (message) {
			this.write('ECHO: ' + message);
		});
	};

	HTTPServer.addApplication(LocalServer);
}());
