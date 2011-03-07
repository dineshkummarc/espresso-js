/* Base HTTP Application class that all Applications should extend */
function HTTPApplication(path, hosts) {
	this.path = path;
	this.hosts = hosts;
	this.views = {};
	this.routes = [];
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

/** Serves files stored in a root directory (default: 'httpdocs' in application root) */
HTTPApplication.prototype.serveRoot = function (request, root) {
	var file = new File(this.getFilePath('/' + (root && root.replace(/^\/*/g, '') || 'httpdocs') + request.resource));
	if (file.exists()) {
		if (/\.jsv$/.test(request.resource)) {
			/* Serve a dynamic view */
			this.serveView(request, file);
			return;
		}

		HTTPServer.serveFile(request, file);
	} else {
		this.sendResponseHeaders(404, {}, request, 0);
	}
}

/** Serve PHP-like dynamic file
* This is different from addView/renderView because the view
* is not cached/compiled into a resuable function (the file must be read each time)
*/
HTTPApplication.prototype.serveView = function (request, file) {
	var data, view, headers, out = new HTTPOutputStream();
	headers = {
		'content-type': 'text/html',
		'cache-control': 'no-cache, max-age=0, must-revalidate',
		'expires': new Date().toGMTString()
	};

	view = HTTPViewParser.parse(readFile('' + file));

	view(out, request, {}, headers, this);
	data = out.getBuffer();

	this.sendResponseHeaders(headers.httpCode || 200, headers, request, data.length);
	request.output.print(data);
};


HTTPApplication.prototype.addView = function (name, file) {
	this.views[name] = HTTPViewParser.parse(readFile(this.path + file)).bind(this);
};

/* "Renders" a view to a variable and returns it */
HTTPApplication.prototype.bufferView = function (name, request, context, headers) {
	var out = new HTTPOutputStream();
	this.views[name](out, request, context || {}, headers || {});
	return out.getBuffer();
};

/* Renders view directly to the output stream */
HTTPApplication.prototype.renderView = function (name, request, context, httpCode, headers) {
	headers = headers || {};
	headers['content-type'] = headers['content-type'] || 'text/html';
	headers.httpCode = httpCode || 200;
	var data = this.bufferView(name, request, context || {}, headers);

	this.sendResponseHeaders(headers.httpCode, headers, request, data.length);
	request.output.print(data);
};

HTTPApplication.prototype.sendResponseHeaders = function (httpCode, headers, request, length) {
	var h = headers || {}, code, statusMessage;
	h['content-type'] = h['content-type'] || 'text/html';
	code = httpCode || 200;

	if (typeof HTTPServer.httpCodes[code] === 'undefined') {
		statusMessage = 'Unknown';
	} else {
		statusMessage = HTTPServer.httpCodes[code];
	}

	if (typeof length !== 'undefined') {
		h['content-length'] = length;
	}

	request.output.print('HTTP/1.1 ' + code + ' ' + statusMessage + '\r\n');

	/* Output main headers */
	Object.keys(h).forEach(function (key) {
		if (/httpCode/.test(key)) { // Not a real header - ignore
			return;
		}

		// Convert lower-case to Upper-Case
		var header = key.replace(/(\b[\w])/g, function (x) { return x.toUpperCase(); });

		request.output.print(header + ': ' + h[key] + '\r\n');
	});

	/* Output cookie headers */
	Object.keys(request.newCookies).forEach(function (name) {
		request.output.print('Set-Cookie: ' + request.newCookies[name] + '\r\n');
	});

	request.output.print('\r\n');
};

/** Checks request URL against a set of regular expressions and dispatches to the associated function
* A matching function will be passed the request/output objects as well as the regex match
* A matching function can return false to pass the route off to the next matching function
*/
HTTPApplication.prototype.route = function (request) {
	var routed = false, path = request.resource;
	this.routes.forEach(function (route) {
		if (routed !== false || !route.path.test(path)) {
			return;
		}

		/* The concat/slice below is used to pass regex capture groups to the function */ 
		routed = route.func.apply(this, [request].concat(path.match(route.path).slice(1)));
	}, this);

	return routed !== false;
};

HTTPApplication.prototype.addRoute = function (path, func) {
	this.routes.push({ path: path, func: func });
};

/**
 * Override this to handle requests.
 * Return false to pass the request off to
 * the next Application in the fall-through chain instead
 */
HTTPApplication.prototype.processRequest = function (request) {
	return false;
};

/** Same as above, except specifically for WebSocket requests */
HTTPApplication.prototype.processWebSocketRequest = function (websocket) {
	return false;
};
