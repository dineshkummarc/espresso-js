/* Base HTTP Controller class that all Controllers should extend */
function HTTPController(path, hosts) {
	this.path = path;
	this.hosts = hosts;
}

HTTPController.extend = function () {
	var child = function () {
		this.__proto__.constructor.apply(this, arguments);
	};
	
	/* Create a prototype that child can safely modify
	* without affecting parent's prototype
	*/
	function F() {}
	F.prototype = HTTPController.prototype;
	child.prototype = new F();
	child.prototype.constructor = HTTPController;
	
	return child;
};

HTTPController.prototype.getFilePath = function (file) {
	return this.path + file.replace(/^\/?(.*)/, '/$1');
};

HTTPController.prototype.readFile = function (file) {
	return readFile(this.getFilePath(file));
};

/**
 * Override this to handle requests.
 * Return false to pass the request off to
 * the next controller in the fall-through chain instead
 */
HTTPController.prototype.processRequest = function (request) {
	return false;
}
