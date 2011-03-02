importPackage(java.io);
importPackage(java.net);
importPackage(java.security);
load('lib/init.js');
load('lib/utf8.js');
load('lib/json.js');
load('lib/websocket.js');
load('lib/httpoutputstream.js');
load('lib/httpviewscope.js');
load('lib/httpviewparser.js');
load('lib/httpapplication.js');

var HTTPServer = {};

HTTPServer.httpCodes = JSON.parse(readFile('conf/http.codes.json'));

(function (args) {
	var applications = [];
	var hosts = {};
	var regex = {
		request: /^(GET|POST)\s([^\s]+)\sHTTP\/(.+)$/i,
		parameters: /^([^:]+)\s*:\s*(.+)$/,
		query: /^([^?]+)\?/,
		keyval: /([^=]+)=(.*)/,
		ext: /\.(\w+)$/,
		host: /([^:]+):?(\d*)/
	};	
	
	var mimes = JSON.parse(readFile('conf/http.mimes.json'));
	mimes['default'] = 'application/octet-stream';

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
		var input, output, line, request, matches, buffer, file, websocket;
		input = new UTF8Reader(client.socket.getInputStream());
		output = new PrintStream(client.socket.getOutputStream());
		request = {};
		
		while ((line = input.readLine()) !== null) {
			print('[' + client.id + '] << ' + line);
			if (line.length() === 0) { // double line-feed (request is done)
				request.cookie = parseCookies(request.cookie);
				request.resource = request.resource.replace(/\.\.\//g, '');
				
				// Is this a WebSocket?
				if (WebSocket.isWebSocketRequest(request)) {
					websocket = new WebSocket(request, client, input, output);
				}
				
				// Is there content (e.g. for POST)?
				if (request['content-length']) {
					parseArgs('' + new java.lang.String(input.read(request['content-length']), 'UTF-8'), request.data);
				}
				
				/* Determine host and port */
				request.host = request.host || 'localhost';
				matches = request.host.match(regex.host);
				if (!matches || matches.length < 3) {
					matches = ['', 'localhost', '80'];
				}

				request.host = matches[1];
				request.port = isNaN(matches[2]) && 80 || matches[2];

				if (typeof hosts[request.host] === 'undefined') {
					print('Warning: no applications for host ' + request.host);
					return;
				}

				/* Trigger application to handle request */
				(function () {
					var handled = false; // Allows an application opt out of handling the request
					hosts[request.host].forEach(function (application) {
						if (handled === false) {
							if (websocket) {
								handled = application.processWebSocketRequest(websocket);
							} else {
								handled = application.processRequest(request, client, input, output);
							}
						}
					});
				}());
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

	HTTPServer.serveFile = function (request, output, file) {
		var ext = ('' + file.getName()).match(regex['ext']), len = file.length(), data, buffer;
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
	
	HTTPServer.addApplication = function (application) {
		applications.push(application);
	};

	/* Load extensions */
	(function loadExtensions(dir) {
		Array.prototype.forEach.apply(dir.listFiles(), [function (file) {
			if (file.isDirectory()) {
				return loadExtensions(file);
			}

			file = ('' + file.toString());
			if (/.js$/.test(file)) {
				print('Loading extension: ' + file.replace(/^extensions\//, ''));
				load(file);
			}
		}]);
	}(new File('extensions/')));

	/* Load applications */
	(function () {
		var apps = JSON.parse(readFile('conf/http.applications.json'));
		apps.forEach(function (app) {
			var length = applications.length, application, path, matches, instance;
			if (typeof app.hosts === 'undefined' || !app.hosts.length || typeof app.application === 'undefined') {
				print('There is a missing hosts or application property in http.applications.json');
				return;
			}

			path = app.application.replace(/^~/, environment['user.home'] || '~');
			load(path);

			if (applications.length === length) {
				print('Warning: ' + app.application + ' did not call HTTPServer.addApplication');
				return;
			}
			application = applications[applications.length - 1];

			/* Wrap a single host into an array */
			if (typeof app.hosts === 'string') {
				app.hosts = [app.hosts];
			}

			/* Determine absolute file path for the application */
			var path = '' + path.replace(/\/?([^\/]*)$/, '/')
			path = new File(path).getAbsolutePath();

			/* Initialize application */
			instance = new application(path, app.hosts);

			/* Register application to each specified */
			app.hosts.forEach(function (host) {
				if (typeof hosts[host] === 'undefined') {
					hosts[host] = [];
				}
				hosts[host].push(instance);
			});
		});
	}());

	/* Main server/listener loop */
	spawn(function () {
		var server, count = 0, port = args.length && args[0] || 80;
		port = isNaN(port) && 80 || port;
		server = new ServerSocket(port);
		print('Listening on port ' + port);
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
	});
}(arguments));
