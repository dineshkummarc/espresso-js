importPackage(java.io);
importPackage(java.net);
load('lib/json.js');

(function () {
	var regex = {
		request: /^(GET|POST)\s([^\s]+)\sHTTP\/(.+)$/i,
		parameters: /^([^:]+)\s*:\s*(.+)$/,
		query: /^([^?]+)\?/,
		keyval: /([^=]+)=(.*)/
	};
	
	
	var mimes = JSON.parse(readFile('lib/http.mimes.json'));
	print(mimes['jpg']);

	var handlers = {};
	handlers['post'] = handlers['get'] = function (request, client, input, output) {
		var message = [], key, value;
		message.push('Hello, browser!');
		message.push('');
		message.push('Here are your headers:');
		
		for ([key, value] in request) {
			message.push(key + ' = ' + value);
		}
		
		message.push('');
		message.push('And here are your query args:');
		for ([key, value] in request.query) {
			message.push(key + ' = ' + value);
		}
		
		message.push('');
		message.push('And here is your posted data:');
		for ([key, value] in request.data) {
			message.push(key + ' = ' + value);
		}
		
		message.push('');
		message.push('And here are your cookies:');
		for ([key, value] in request.cookie) {
			message.push(key + ' = ' + value);
		}
		
		message = message.join('<br/>');
		
		output.print('HTTP/1.1 200 OK\r\n');
		output.print('Content-type: text/html\r\n');
		output.print('Content-length: ' + message.length + '\r\n');
		output.print('\r\n');
		output.print(message);
	};

	function parseArgs(str, target) {
		var matches;
		str.split('&').forEach(function (arg) {
			matches = arg.match(regex['keyval']);
			if (matches && matches.length === 3) {
				target[matches[1]] = decodeURIComponent(('' + matches[2]).replace(/\+/g, '%20'));
			}
		});
	}
	
	function parseCookies(cookies) {
		var result = {}, matches;
		('' + cookies).split(/\s*;\s*/).forEach(function (cookie) {
			matches = cookie.match(regex['keyval']);
			if (matches && matches.length === 3) {
				result[matches[1]] = matches[2];
			}
		});
		
		return result;
	}
	
	function handleRequest(client) {
		var input, output, line, request, matches, buffer;
		input = new BufferedReader(new InputStreamReader(client.getInputStream()));
		output = new PrintStream(client.getOutputStream());
		request = {};
		
		while (line = input.readLine()) {
			print('<< ' + line);
			if (line.length() === 0) { // double line-feed
			
				// Is there content (e.g. for POST)?
				if (request['content-length']) {
					buffer = java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, request['content-length']);
					if (input.read(buffer, 0, buffer.length) >= 0) {
						parseArgs('' + (new java.lang.String(buffer)), request.data);
					}
				}
				
				request.cookie = parseCookies(request.cookie);
				
				if (handlers[request.method]) {
					handlers[request.method](request, client, input, output);
				} else {
					print('No handler for request method: "' + request.method + '"');
				}
			} else {
				if (!regex['request'].test(line)) { // This is an HTTP header
					matches = line.match(regex['parameters']);
					if (matches.length === 3) {
						request[matches[1].toLowerCase()] = matches[2];
					}
				} else { // This is the request line (GET /... HTTP/1.x)
					matches = line.match(regex['request']);
					if (matches && matches.length === 4) {
						request = {
							data: {},
							query: {},
							cookie: '',
							method: matches[1].toLowerCase(),
							resource: matches[2].toLowerCase(),
							httpVersion: matches[3].toLowerCase()
						};
						
						/* Populate 'get' args (from query string) */						
						parseArgs(request.resource.replace(regex['query'], function (match, group) {
							// This removes the ?query=string from resource to be moved into another property
							request.resource = group;
							return '';
						}), request.query);
					}
				}
			}
		}
	}

	/* Main server/listener loop */
	var server = new ServerSocket(1234);
	while (true) {
		(function (client) {
			var thread = spawn(function () {
				var error = false;
				while (!error) {
					try {
						handleRequest(client);
					} catch (e) {
						print(e.message);
						error = true;
					}
				}
				thread.join(1000);
			});
		}(server.accept()));
	}
}());