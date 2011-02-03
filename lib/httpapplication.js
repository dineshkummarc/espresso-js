/* Base HTTP Application class that all Applications should extend */
function HTTPApplication(path, hosts) {
	this.path = path;
	this.hosts = hosts;
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
