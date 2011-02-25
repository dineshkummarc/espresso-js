(function () {
	function copy(src, dest) {
		var input, output, buffer, len;
		input = new FileInputStream(src);
		output = new FileOutputStream(dest);

		buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 1024);
		while ((len = input.read(buffer, 0, buffer.length)) !== -1) {
			output.write(buffer, 0, len);
		}
		input.close();
		output.close();
		buffer = null;
	}

	var conf = new File('conf/http.applications.json');

	/* Make sure conf file exists */
	if (!conf.exists()) {
		/* If not, copy the example file */
		copy('conf/http.applications.json.example', 'conf/http.applications.json');
	}
}());
