importPackage(java.io);
importPackage(java.net);

function foo() {
	var sock = new Socket('localhost', 1234);
	var output = new PrintStream(sock.getOutputStream());
	var input = new BufferedReader(new InputStreamReader(sock.getInputStream()));
	
	output.print('GET /showdown.html HTTP/1.1\r\n');
	output.print('User-Agent: GRIND\r\n');
	output.print('Host: localhost:1234\r\n');
	output.print('\r\n');
	//output.print('Accept: text/html, image/gif, image/jpeg, *; q=.2, */*; q=.2');
	//output.print('Connection: keep-alive');
	
	var s = ' ', m, len = 0;
	while ((s = input.readLine()) && s.length() !== 0) {
		print(s);
		m = ('' + s).match(/length: (\d+)$/i);
		if (m) {
			len = parseInt(m[1]);
		}
	}
	
	var buffer = java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, len);
	if (input.read(buffer, 0, buffer.length)) {
		print(new java.lang.String(buffer));
	}
	sock.close();
}

for (var x = 0;x < 25; x+= 1) {
	spawn(function () {
		for (var j = 0;j < 4;j += 1) {
			foo();
		}
	});
}