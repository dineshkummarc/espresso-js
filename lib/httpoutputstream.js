/* Wrapper to Java OutputStream used by views */
function HTTPOutputStream() {
	this.buffer = '';
}

HTTPOutputStream.prototype.print = function (data) {
	this.buffer += data;
};

HTTPOutputStream.prototype.println = function (data) {
	this.buffer += data + '\r\n';
};

/* Returns what has been output so far */
HTTPOutputStream.prototype.getBuffer = function () {
	return this.buffer;
};
