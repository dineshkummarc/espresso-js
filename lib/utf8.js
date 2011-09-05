importPackage(java.io);
importPackage(java.nio);
importPackage(java.net);

Array.prototype.toJavaByteArray = function () {
	if (!this.length) {
		return new java.lang.String();
	}
	
	var result = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, this.length);
	this.map(function (x, y) {
		result[y] = x;
	});
	
	// Clear
	while (this.length) {
		this.shift();
	}
	
	return result;
};

function UTF8Reader(stream) {
	this.input = stream;
	this.byteBuffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 1024);
	this.buffer = [];
	this.lines = [];
	this.openFrame = false;
}

UTF8Reader.prototype.clearBuffer = function () {
	return this.buffer.toJavaByteArray();
};

UTF8Reader.prototype.readLine = function () {
	var len, j;
	while (!this.lines.length && (len = this.input.read(this.byteBuffer, 0, this.byteBuffer.length)) !== -1) {
		for (j = 0; j < len; j += 1) {
			this.buffer.push(this.byteBuffer[j]);
			if (j > 0 && this.byteBuffer[j - 1] === 13 && this.byteBuffer[j] === 10) { // CRLF
				this.lines.push(this.clearBuffer());
			}
		}
	}
	
	if (this.lines.length) {
		return new java.lang.String(this.lines.shift(), 'UTF-8').replaceAll('\\r\\n$', '');
	}
	
	if (this.buffer.length) {
		return this.clearBuffer();
	}
	
	return null;
};

UTF8Reader.prototype.read = function (amount) {
	var result, count, len;

	if (!amount) {
		return new java.lang.String('');
	}
	
	result = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, amount);
	count = 0;
	while (count < amount && this.buffer.length) {
		result[count += 1] = this.buffer.shift();
	}
	
	len = 0;
	while (count < amount) {
		len = this.input.read(result, count, amount - count);
		if (len !== -1) {
			count += len;
		}
	}
	
	return result;
};

/* Reads a WebSocket data frame */
UTF8Reader.prototype.readDataFrame = function () {
	var b, frame, len;
	while (true) {
		if (!this.buffer.length) {
			len = this.input.read(this.byteBuffer, 0, this.byteBuffer.length);
			if (len === -1) {
				return null;
			}
			for (b = 0; b < len; b += 1) {
				this.buffer.push(this.byteBuffer[b]);
			}
		}
			
		b = this.buffer.shift();
		if (!this.openFrame && (b & 0xFF) === 0x00) {
			this.openFrame = true;
			frame = [];
			continue;
		}
		if (this.openFrame && (b & 0xFF) === 0xFF) {
			this.openFrame = false;
			return new java.lang.String(frame, 'UTF-8');
		}
		frame.push(b);
	}
};
