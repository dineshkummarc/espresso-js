/* Wrapper to Java OutputStream used by views */
function HTTPOutputStream(output) {
	this.buffer = '';
	this.output = output;
	this.buffering = true;
}

HTTPOutputStream.prototype.print = function (data) {
	if (this.buffering) {
		this.buffer += data;
	} else {
		this.output.print(data);
	}
};

HTTPOutputStream.prototype.println = function (data) {
	if (this.buffering) {
		this.buffer += data;
	} else {
		this.output.println(data);
	}
};

HTTPOutputStream.prototype.beginBuffer = function () {
	this.buffer = '';
	this.buffering = true;
};

HTTPOutputStream.prototype.endBuffer = function () {
	this.buffering = false;
	return this.buffer;
};
