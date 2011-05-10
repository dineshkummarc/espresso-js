importPackage(java.io);
importPackage(java.net);
importPackage(java.security);
importPackage(java.util.zip);

this.load = function (file) {
	eval.apply(this, [readFile(file)]);
}.bind(this);

load('lib/utf8.js');
load('lib/json.js');
load('lib/websocket.js');
load('lib/httprequest.js');
load('lib/httpoutputstream.js');
load('lib/httpviewscope.js');
load('lib/httpviewparser.js');
load('lib/httpapplication.js');

var HTTPServer = {};

HTTPServer.httpCodes = JSON.parse(readFile('conf/http.codes.json'));

(function (args) {
	var serverPorts = {};
	var securePorts = {};
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
	HTTPServer.regex = regex;

	var mimes = JSON.parse(readFile('conf/http.mimes.json'));
	mimes['default'] = 'application/octet-stream';
	HTTPServer.mimes = mimes;

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
		client.socket.setSoTimeout(90000);
		input = new UTF8Reader(client.socket.getInputStream());
		output = new PrintStream(client.socket.getOutputStream());
		request = new HTTPRequest(client, input, output);
		
		while ((line = input.readLine()) !== null) {
			print('[' + client.id + '] << ' + line);
			if (line.length() === 0) { // double line-feed (request is done)
				request.cookie = parseCookies(request.cookie);
				request.resource = request.resource.replace(/\.\.\//g, '');
				
				// Is this a WebSocket?
				if (WebSocket.isWebSocketRequest(request)) {
					websocket = new WebSocket(request);
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

				if (request.port !== client.port) {
					print('Error: request for ' + request.host + ':' + request.port + ' came from port ' + client.port);
					client.socket.close();
					break;
				}

				if (typeof hosts[request.host + ':' + request.port] === 'undefined') {
					print('Warning: no applications for host ' + request.host + ':' + request.port);
					client.socket.close();
					break;
				}

				/* Trigger application to handle request */
				(function () {
					var chosen, handled = false; // Allows an application opt out of handling the request
					hosts[request.host + ':' + request.port].forEach(function (application) {
						if (handled === false) {
							chosen = application;
							if (websocket) {
								handled = application.processWebSocketRequest(websocket);
							} else {
								handled = application.processRequest(request);
							}
						}
					});

					if (handled !== false) {
						chosen.completeRequest(request); // Give application a chance to clean up
					}
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
						request = new HTTPRequest(request.client, request.input, request.output); // Clear out request data from previous request
						request.method = matches[1].toLowerCase();
						request.resource = matches[2];
						request.httpVersion = matches[3].toLowerCase();
						
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
			if (/\.js$/.test(file)) {
				print('Loading extension: ' + file.replace(/^extensions\//, ''));
				this.extensionPath = file.replace(/(.*\/).*$/, '$1');
				load(file);
			}
		}]);
	}(new File('extensions/')));

	/* Load applications */
	(function () {
		var dir = new File('applications/');
		
		function loadApp(path, settings) {
			var length = applications.length, application, path, matches, instance, file;
			if (typeof settings.hosts === 'undefined' || !settings.hosts.length || typeof settings.application === 'undefined') {
				print('There is a missing hosts or application property in ' + path + '/app.json');
				return;
			}

			file = path + '/' + settings.application;
			print('Loading application: ' + (settings.name || file));
			load(file);

			if (applications.length === length) {
				print('Warning: ' + file + ' did not call HTTPServer.addApplication');
				return;
			}
			application = applications[applications.length - 1];

			/* Wrap a single host into an array */
			if (typeof settings.hosts === 'string') {
				settings.hosts = [settings.hosts];
			}

			/* Determine absolute file path for the application */
			path = new File(path).getAbsolutePath();

			/* Initialize application */
			instance = new application(path, settings.hosts);

			/* Register application to each specified */
			settings.hosts.forEach(function (host) {
				if (!host.hostname) {
					print('Missing required "hostname" property in ' + path + '/app.json');
					return;
				}

				if (!host.ports || !host.ports.length) {
					print('Missing required "ports" property in ' + path + '/app.json');
					return;
				}

				host.ports.forEach(function (port) {
					serverPorts[port] = true;
					var fullHost = host.hostname + ':' + port;

					if (typeof hosts[fullHost] === 'undefined') {
						hosts[fullHost] = [];
					}
					hosts[fullHost].push(instance);
				});
			});
		}

		Array.prototype.forEach.apply(dir.listFiles(), [function (file) {
			if (file.isDirectory()) {
				var settings = Array.prototype.filter.apply(file.listFiles(), [function (file) {
					return /\/app\.json$/.test(file.toString());
				}]);

				if (settings.length) {
					loadApp(file.toString(), JSON.parse(readFile(settings[0])));
				}
			}
		}]);
	}());

	/* Listen for requests on a given port */
	function listen(port) {
		var server, count = 0;

		try {
			server = new ServerSocket(port);
		} catch (error) {
			print('Could not listen on port ' + port + ': '+ error.message);
			return;
		}

		print('Listening on port ' + port);
		while (true) {
			(function (client) {
				print('[' + port + '] Client ' + client.id + ' connected');
				var thread = spawn(function () {
					try {
						handleRequest(client);
					} catch (e) {
						print(e.message);
					}
					
					try {
						print('[' + port + '] Client ' + client.id + ' disconnected');
						thread.join(1000);
						client.socket.close();
						thread = null;
						client = null;
					} catch (e) {}
					gc();
				});
			}({socket: server.accept(), id: count++, port: port}));
		}
	}

	/* Spawn a server thread for each port needed */
	Object.keys(serverPorts).forEach(function (port) {
		spawn(function () {
			listen(port);
		});
	})
}(arguments));
