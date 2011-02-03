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
		([
			{title: 'headers', obj: request},
			{title: 'query args', obj: request.query},
			{title: 'posted data', obj: request.data},
			{title: 'cookies', obj: request.cookie}
		]).forEach(function (obj) {
			message.push(obj.title + ':');
			for ([key, value] in obj.obj) {
				message.push(key + ' = ' + value);
			}
			message.push('');
		});
		
		message = message.join('<br/>');
		
		output.print('HTTP/1.1 200 OK\r\n');
		output.print('Content-type: text/html\r\n');
		output.print('Content-length: ' + message.length + '\r\n');
		output.print('\r\n');
		output.print(message);
	};

	HTTPServer.addApplication(LocalServer);
}());
