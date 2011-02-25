var output = [];
function echo(s) {
	output.push(s);
}

load('viewtest.js');

print(instructions.join('\n'));
eval(instructions.join('\n'));
print(output.join(''));
