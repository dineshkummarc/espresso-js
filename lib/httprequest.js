function HTTPRequest(client, input, output) {
	this.client = client;
	this.input = input;
	this.output = output;
	this.data = {};
	this.query = {};
	this.cookie = '';
	this.newCookies = {};
}

HTTPRequest.prototype.setCookie = function (name, value, expires, path, domain, extra) {
	var cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value);
	cookie += (path && '; path=' + path) || '';
	cookie += (expires && expires.toGMTString && '; expires=' + expires.toGMTString()) || '';
	cookie += (domain && '; domain=' + domain) || '';
	cookie += (extra && '; ' + extra) || '';

	this.newCookies[name] = cookie;
};

HTTPRequest.prototype.getSocket = function () {
	return this.client.socket;
};

HTTPRequest.prototype.toJSON = function () {
	var result = {}, key, val;
	for ([key, val] in this) {
		if (typeof this[key] !== 'function') {
			try {
				JSON.stringify(this[key]);
				result[key] = this[key];
			} catch (e) {
				// Non-JSONable object (e.g. a Java object)
			}
		}
	}

	return JSON.stringify(result);
};

HTTPRequest.prototype.toString = function () {
	return this.toJSON();
};
