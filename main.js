importPackage(java.sql);

java.lang.Class.forName('com.mysql.jdbc.Driver');

var Database = {};
Database.open = function () {
	var conn = DriverManager.getConnection('jdbc:mysql://localhost/wikiteks', 'root', '');
	return ({
		query: function (sql) {
			var result;
			try {
				result = conn.prepareStatement(sql).executeQuery(sql);
			} catch (e) {
				result = false;
			}
			
			return result;
		},
		
		close: function () {
			conn.close();
		}
	});
};
	

var db = Database.open();

var result = db.query('select foo from test');
while (result.next()) {
	print(result.getString('foo'));
}

db.close();