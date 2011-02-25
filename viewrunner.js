var output = [];
function echo(s) {
	output.push(s);
}

load('viewtest.js');

eval(instructions.join('\n'));
print(output.join(''));
