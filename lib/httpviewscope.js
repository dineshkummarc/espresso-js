/* Anything on this prototype will be injected into the direct scope of a view */

function HTTPViewScope(output, request, context, headers, application) {
	this.output = output;
	this.request = request;
	this.context = context;
	this.headers = headers;
	this.application = application;
}

HTTPViewScope.prototype.echo = function (message) {
	this.output.print(message);
};

HTTPViewScope.prototype.setCookie = function (name, value, expires, path, domain, extra) {
	this.request.setCookie(name, value, expires, path, domain, extra);
};

HTTPViewScope.prototype.setHeader = function (header, value) {
	this.headers[String(header).toLowerCase()] = value;
};

HTTPViewScope.prototype.redirect = function (url, httpCode) {
	this.headers.Location = url;
	this.headers.httpCode = httpCode || 302;
};

HTTPViewScope.prototype.include = function (file) {
	if (/\.jsv$/.test(file)) {
		return this.includeDynamicView(file);
	}
	
	this.output.print(this.application.readFile(file));
};

HTTPViewScope.prototype.includeView = function (name) {
	this.output.print(this.application.bufferView(name, this.request, this.context, this.headers));
};

HTTPViewScope.prototype.includeDynamicView = function (file, context) {
	var data, view, headers, out = new HTTPOutputStream();
	view = HTTPViewParser.parse(this.application.readFile(file));

	view(out, context || this.context || {}, headers);
	this.output.print(out.getBuffer());
};
