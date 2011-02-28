String.prototype.escapeQuotes = function () {
	var pattern = /([^\\])(["'])/g, self = '' + this;
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

var input = readFile('view.js');
var modes = {
	OUTPUT: 0,
	SCRIPT: 1,
};
var outputBuffer = '';
var instructions = [];

var mode = modes.OUTPUT;

var position = 0;
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

instructions.unshift('function (context, output) {');
instructions.push('}');

//print(instructions.join('\n'));
