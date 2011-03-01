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

HTTPApplication.prototype.addView = function (name, file) {
	this.views[name] = HTTPViewParser.parse(readFile(file));
};

/* "Renders" a view to a variable and returns it */
HTTPApplication.prototype.bufferView = function (name, context, headers) {
	var out = new HTTPOutputStream();
	this.views[name](out, context || {}, headers || {});
	return out.getBuffer();
};

/* Renders view directly to the output stream */
HTTPApplication.prototype.renderView = function (name, output, context, httpCode, headers) {
	headers = headers || {};
	headers['content-type'] = headers['content-type'] || 'text/html';
	headers.httpCode = httpCode || 200;
	var data = this.bufferView(name, context || {}, headers);

	this.sendResponseHeaders(headers.httpCode, headers, output, data.length);
	output.print(data);
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
		if (/httpCode/.test(key)) { // Not a real header - ignore
			return;
		}

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
