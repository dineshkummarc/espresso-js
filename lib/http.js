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
	
	
	var mimes = JSON.parse(readFile('conf/http.mimes.json'));

	var handlers = {};
	handlers['post'] = handlers['get'] = function (request, client, input, output) {
		var message = [], key, value;
		message.push('Hello, browser!');
		message.push('');
		([
			{title: 'headers', obj: request},
			{title: 'query args', obj: request.query},
			{title: 'posted data', obj: request.data},
			{title: 'cookies', obj: request.cookie}
		]).forEach(function (obj) {
			message.push(obj.title + ':');
			for ([key, value] in obj.obj) {
				message.push(key + ' = ' + value);
			}
			message.push('');
		});
		
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
	
	function serveFile(request, output, file) {
		var ext = request.resource.match(/\.(\w+)$/), len = file.length(), data, buffer;
		ext = (ext && ext.length && mimes[ext[1]] && ext[1]) || 'default';
		output.print('HTTP/' + request.httpVersion + ' 200 OK\r\n');
		output.print('Content-type: ' + mimes[ext] + '\r\n');
		output.print('Content-length: ' + len + '\r\n');
		output.print('\r\n');
		
		data = new FileInputStream(file.getAbsolutePath());
		buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, Math.min(len, 1024*1024));
		while ((len = data.read(buffer, 0, buffer.length)) !== -1) {
			output.write(buffer, 0, len);
		}
		data.close();
		buffer = null;
	}
	
	function handleRequest(client) {
		var input, output, line, request, matches, buffer, file;
		input = new BufferedReader(new InputStreamReader(client.socket.getInputStream()));
		output = new PrintStream(client.socket.getOutputStream());
		request = {};
		
		while (line = input.readLine()) {
			print('[' + client.id + '] << ' + line);
			if (line.length() === 0) { // double line-feed (request is done)
			
				// Is there content (e.g. for POST)?
				if (request['content-length']) {
					buffer = java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, request['content-length']);
					if (input.read(buffer, 0, buffer.length) >= 0) {
						parseArgs('' + (new java.lang.String(buffer)), request.data);
					}
				}
				
				request.cookie = parseCookies(request.cookie);
				
				request.resource = request.resource.replace(/\.\.\//g, '');
				file = new File('httpdocs' + request.resource);
				if (file.exists() && !file.isDirectory()) {
					serveFile(request, output, file);
				} else {
					
					if (handlers[request.method]) {
						handlers[request.method](request, client, input, output);
					} else {
						print('No handler for request method: "' + request.method + '"');
					}
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
	var server = new ServerSocket(1234), count = 0;
	while (true) {
		(function (client) {
			print('Client ' + client.id + ' connected');
			var thread = spawn(function () {
				try {
					handleRequest(client);
					thread.join(1000);
					thread = null;
					client.socket.close();
					print('Client ' + client.id + ' disconnected');
					client = null;
					gc();
				}
				catch (e) {
					print(e.message);
				}
			});
		}({socket: server.accept(), id: count++}));
	}
}());