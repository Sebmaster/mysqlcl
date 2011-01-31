MySQL Client for node.js
===

This MySQL implementation supports some basic MySQL protocol commands. I plan to support the full MySQL protocol except the deprecated parts.

Basic Usage
---
	var Connection = require('./lib/Connection').Connection;
	var myCon = new Connection('user', 'pass');
	
	myCon.on('authenticated', function() {
		myCon.selectDb('test'); // Even tough the querys are asynchronous, this is possible (through query-queue)
		myCon.query('SELECT * FROM foo', function(err, packet) {
			console.log(packet);
		});
	});

Options
---
	boolean Connection.prototype.options.bufferRows
Decides, if rows should get buffered

	boolean Connection.prototype.options.autoBox
Converts the MySQL datatypes to javascript datatypes automatically.

	{0, 1, 2} Connection.prototype.options.fetchMode
Decides the fetchmode.

* 0 ... Fetch numeric. Just a basic array. Accessible through row[0]
* 1 ... Fetch assoc. An object, every column is a key. Accessible through row['column']
* 2 ... Fetch array. A combination of the two above. Accessible through both ways.

API
---
	Connection([string user[, string password[, string host[, number port]]]])
Creates a connection and tries to connect/authorize to the database

	Connection.prototype.connect()
Connects to the database, if the first attempt wasn't successful/the connection got destroyed

	Connection.prototype.close(function(string err, ParseablePacket pp) listener)
Closes the connection to the database through the mysql_close command. Fires off listener, after a result.

	Connection.prototype.destroy()
Destroys the socket to the database immediatly. No more reads/writes will be possible.

	Connection.prototype.selectDb(string db, function(string err, ParseablePacket pp) listener)
Selects a database. Fires off listener after a result of the database.

	Connection.prototype.query(string cmd, function(string err, Array.<Object.<*>> rows) listener, function(ColumnPacket cp) columnCb, function(Object.<*> data) rowCb)
Sends a query to the database. Fires off listener after a full result/error of the database. If no error occured and buffering rows is activated, rows contains every row.
Fires columnCb for every received column entry; fires rowCb for every received row.

Events
---
	drain
Fired, when all querys are executed and all result sets are received.

	authenticated
Fired, when the authentication was successful.

	error
Fired, when the authentication wasn't successful (will maybe have more meanings; for example when the connection is destroyed/not accessible anymore)