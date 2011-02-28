var output = java.lang.System.out;

load('viewtest.js');
print(instructions.join('\n'));
var view = eval(instructions.join('\n'));
view({}, output);
//print(output.join(''));
