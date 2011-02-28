/* Base HTTP Application class that all Applications should extend */
function HTTPApplication(path, hosts) {
	this.path = path;
	this.hosts = hosts;
	this.views = [];
	this.init();
}

HTTPApplication.extend = function () {
	var child = function () {
		this.__proto__.constructor.apply(this, arguments);
	};
	
	/* Create a prototype that child can safely modify
	* without affecting parent's prototype
	*/
	function F() {}
	F.prototype = HTTPApplication.prototype;
	child.prototype = new F();
	child.prototype.constructor = HTTPApplication;
	
	return child;
};

HTTPApplication.prototype.init = function () {};

HTTPApplication.prototype.getFilePath = function (file) {
	return this.path + file.replace(/^\/?(.*)/, '/$1');
};

HTTPApplication.prototype.readFile = function (file) {
	return readFile(this.getFilePath(file));
};

HTTPApplication.prototype.sendResponseHeaders = function (httpCode, response, output, length) {
	var r = response || {}, code, statusMessage;
	r['content-type'] = r['content-type'] || 'text/html';
	code = httpCode || 200;

	if (typeof HTTPServer.httpCodes[code] === 'undefined') {
		statusMessage = 'Unknown';
	} else {
		statusMessage = HTTPServer.httpCodes[code];
	}

	if (typeof length !== 'undefined') {
		r['content-length'] = length;
	}

	output.print('HTTP/1.1 ' + code + ' ' + statusMessage + '\r\n');
	Object.keys(r).forEach(function (key) {
		// Convert lower-case to Upper-Case
		var header = key.replace(/(\b[\w])/g, function (x) { return x.toUpperCase(); });

		output.print(header + ': ' + r[key] + '\r\n');
	});

	output.print('\r\n');
};

/**
 * Override this to handle requests.
 * Return false to pass the request off to
 * the next Application in the fall-through chain instead
 */
HTTPApplication.prototype.processRequest = function (request, client, input, output) {
	return false;
};

/** Same as above, except specifically for WebSocket requests */
HTTPApplication.prototype.processWebSocketRequest = function (websocket) {
	return false;
};
