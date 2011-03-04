function HTTPRequest(client, input, output) {
	this.client = client;
	this.input = input;
	this.output = output;
}

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
