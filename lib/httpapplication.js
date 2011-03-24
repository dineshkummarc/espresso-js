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

/** Return a file path relative to the application directory
* The relativity can be overridden by absolute paths that begin with '/'
*/
HTTPApplication.prototype.getFilePath = function (file) {
	if (/^\//.test(file)) {
		return file; // Absolute path
	}

	return this.path + '/' + file; // Relative path
};

HTTPApplication.prototype.readFile = function (file) {
	return readFile(this.getFilePath(file));
};

HTTPApplication.prototype.loadScript = function (file) {
	return load(this.getFilePath(file));
};

/** Serves files stored in a root directory (default: 'httpdocs' in application root) */
HTTPApplication.prototype.serveRoot = function (request, root) {
	var file, resource;

	/* Avoid requests that try to request outside the root directory */
	resource = request.resource.replace(/\.{1,2}\/g/, '');

	file = new File(this.getFilePath((root || 'httpdocs') + request.resource));
	if (file.exists() && !file.isDirectory()) {
		if (/\.jsv$/.test(request.resource)) {
			/* Serve a dynamic view */
			this.serveView(request, file);
			return;
		}

		this.serveFile(request, file);
	} else {
		this.sendResponseHeaders(404, {}, request, 0);
	}
};

HTTPApplication.prototype.serveFile = function (request, file, cache) {
	var ext = String(file.getName()).match(HTTPServer.regex['ext']), len = file.length(), data, buffer, cacheTime, expires, headers = {};
	if (!cache && +cache !== 0) {
		cacheTime = 30 * 24 * 60 * 60; // Default cache = 30 days
	} else {
		cacheTime = cache;
	}
	expires = new Date(Date.now() + cacheTime * 1000).toGMTString();

	if (request.gzip) {
		len = -1;
	}

	ext = (ext && ext.length && HTTPServer.mimes[ext[1]] && ext[1]) || 'default';
	headers['content-type'] = HTTPServer.mimes[ext];
	headers['expires'] = expires;
	headers['cache-control'] = 'no-cache, max-age=0, must-revalidate';

	if (cacheTime) {
		headers['cache-control'] = 'private, max-age=' + cacheTime + ', must-revalidate';
	}

	this.sendResponseHeaders(200, headers, request, len);

	data = new FileInputStream(file.getAbsolutePath());
	buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, Math.max(1024, Math.min(len, 1024*1024)));
	while ((len = data.read(buffer, 0, buffer.length)) !== -1) {
		request.output.write(buffer, 0, len);
	}
	data.close();
	buffer = null;
};

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

	view = HTTPViewParser.parse(this.readFile(String(file)));

	view(out, request, {}, headers, this);
	data = out.getBuffer();

	this.sendResponseHeaders(headers.httpCode || 200, headers, request, data.length);
	request.output.print(data);
};


HTTPApplication.prototype.addView = function (name, file) {
	this.views[name] = HTTPViewParser.parse(this.readFile(file)).bind(this);
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
	} else if (length === -1) {
		delete h['content-length'];
	}

	request.gzip = request.gzip && (request['accept-encoding'] || '').indexOf('gzip') !== -1;
	if (request.gzip) {
		h['content-encoding'] = 'gzip';
		h['transfer-encoding'] = 'chunked';
		delete h['content-length'];
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

	if (request.gzip && !request.gzip.finish) {
		request.output = new PrintStream(request.gzip = new GZIPOutputStream(request.gzipBuffer = new ByteArrayOutputStream()));
	}
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

/** Flushes GZIP through a chunked transfer to avoid having
* to kill the connection when output is complete.
*/
HTTPApplication.prototype.flushGZIP = function (request) {
	if (request.gzip && request.gzip.finish) {
		request.gzip.finish();
		request.output = new PrintStream(request.getSocket().getOutputStream());
		request.output.print((request.gzipBuffer.size()).toString(16) + '\r\n');
		request.gzipBuffer.writeTo(request.output);
		request.output.print('\r\n0\r\n\r\n');
	}
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

/** Override this to do any special cleanup when a request ends
* Note: this is called when a *request* ends, not when the application is killed
*/
HTTPApplication.prototype.completeRequest = function (request) {
	this.flushGZIP(request);
};
