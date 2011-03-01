/* Anything on this prototype will be injected into the direct scope of a view */

function HTTPViewScope(output, headers) {
	this.output = output;
	this.headers = headers;
}

HTTPViewScope.prototype.echo = function (message) {
	this.output.print(message);
};

HTTPViewScope.prototype.redirect = function (url, httpCode) {
	this.headers.Location = url;
	this.headers.httpCode = httpCode || 302;
};

