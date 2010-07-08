importPackage(java.io);
importPackage(java.net);
importPackage(java.security);
load('lib/utf8.js');
load('lib/json.js');
load('lib/websocket.js');

var Stampede = {};

Stampede.regex = {
	request: /^(GET|POST)\s([^\s]+)\sHTTP\/(.+)$/i,
	parameters: /^([^:]+)\s*:\s*(.+)$/,
	query: /^([^?]+)\?/,
	keyval: /([^=]+)=(.*)/,
	ext: /\.(\w+)$/
};

(function () {
	
	
	
	var mimes = JSON.parse(readFile('conf/http.mimes.json'));
	mimes['default'] = 'application/octet-stream';
	
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
			matches = arg.match(Stampede.regex['keyval']);
			if (matches && matches.length === 3) {
				target[matches[1]] = decodeURIComponent(('' + matches[2]).replace(/\+/g, '%20'));
			}
		});
	}
	
	function parseCookies(cookies) {
		var result = {}, matches;
		('' + cookies).split(/\s*;\s*/).forEach(function (cookie) {
			matches = cookie.match(Stampede.regex['keyval']);
			if (matches && matches.length === 3) {
				result[matches[1]] = matches[2];
			}
		});
		
		return result;
	}
	
	function serveFile(request, output, file) {
		var ext = request.resource.match(Stampede.regex['ext']), len = file.length(), data, buffer;
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
		input = new UTF8Reader(client.socket.getInputStream());
		output = new PrintStream(client.socket.getOutputStream());
		request = {};
		
		while ((line = input.readLine()) !== null) {
			line = new java.lang.String(line, 'UTF-8').replaceAll('\\r\\n$', '')
			print('[' + client.id + '] << ' + line);
			if (line.length() === 0) { // double line-feed (request is done)
				request.cookie = parseCookies(request.cookie);
				request.resource = request.resource.replace(/\.\.\//g, '');
				
				// Is this a WebSocket?
				if (WebSocket.isWebSocketRequest(request)) {
					WebSocket.process(request, client, input, output);
					break;
				}
				
				// Is there content (e.g. for POST)?
				if (request['content-length']) {
					parseArgs('' + new java.lang.String(input.read(request['content-length']), 'UTF-8'), request.data);
				}
				
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
				if (!Stampede.regex['request'].test(line)) { // This is an HTTP header
					matches = line.match(Stampede.regex['parameters']);
					if (matches.length === 3) {
						request[matches[1].toLowerCase()] = matches[2];
					}
				} else { // This is the request line (GET /... HTTP/1.x)
					matches = line.match(Stampede.regex['request']);
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
						parseArgs(request.resource.replace(Stampede.regex['query'], function (match, group) {
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
				} catch (e) {
					print(e.message);
				}
				
				try {
					print('Client ' + client.id + ' disconnected');
					thread.join(1000);
					client.socket.close();
					thread = null;
					client = null;
				} catch (e) {}
				gc();
			});
		}({socket: server.accept(), id: count++}));
	}
}());