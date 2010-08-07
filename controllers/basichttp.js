load('../lib/httpcontroller.js');

var BasicHTTP = HTTPController.extend();

BasicHTTP.prototype.processRequest = function () {
	return 'override';
};