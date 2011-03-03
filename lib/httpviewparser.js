/* Parses a view string and returns it as a function */
(function () {
	String.prototype.escapeQuotes = function () {
		var pattern, self;
		pattern = /([^\\])(["'])/g;
		self = this.toString();

		while (pattern.test(self)) {
			self = self.replace(pattern, '$1\\$2');
		}

		return self;
	};

	String.prototype.escapeNewlines = function () {
		return (
			this.replace(/\r?\n$/, '') // remove trailing newline
			.replace(/(\r?\n)/g, '\\r\\n\\$1') // escape other newlines
		);
	};

	var modes = {
		OUTPUT: 0,
		SCRIPT: 1
	};

	/* Converts view code into a JavaScript snippet to be eval'd */
	function convert(input) {
		var outputBuffer, instructions, mode, position;
		outputBuffer = '';
		instructions = [];
		mode = modes.OUTPUT;
		position = 0;

		function flushOutput() {
			var output = outputBuffer.escapeQuotes().escapeNewlines();
			if (output.length) {
				instructions.push("output.print('" + output + "');");
				outputBuffer = '';
			}
		}

		function flushScript() {
			var script = outputBuffer.replace(/^\s+/, '');
			if (script.length) {
				instructions.push(script);
				outputBuffer = '';
			}
		}

		while (position < input.length) {
			if (mode === modes.OUTPUT) {
				if (input.substr(position, 2) === '<?') {
					flushOutput();
					mode = modes.SCRIPT;
					position += 1;
				} else {
					outputBuffer += input.charAt(position);
				}
			} else if (mode === modes.SCRIPT) {
				if (input.substr(position, 2) === '?>') {
					flushScript();
					mode = modes.OUTPUT;
					position += 1;
				} else {
					outputBuffer += input.charAt(position);
				}
			}

			position += 1;
		}

		if (mode === modes.OUTPUT) {
			flushOutput();
		} else {
			flushScript();
		}

		instructions.unshift('with (new HTTPViewScope(output, headers, application)) {');
		instructions.unshift('function (output, context, headers, application) {');
		instructions.push('}}');

		return instructions.join('');
	}

	this.HTTPViewParser = {
		parse: function (view) {
			return eval(convert(view));
		}
	};
}());
