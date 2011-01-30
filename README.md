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

API
---
Connection([string user[, string password[, string host[, number port]]]])
	Creates a connection and tries to connect/authorize to the database

Connection.prototype.connect()
	Connects to the database, if the first attempt wasn't successful/the connection got destroyed

Connection.prototype.close(function(string err, ParseablePacket pp) cb)
	Closes the connection to the database through the mysql_close command. Fires off the callback, after a result.

Connection.prototype.destroy()
	Destroys the socket to the database immediatly. No more reads/writes will be possible.

Connection.prototype.selectDb(string db, function(string err, ParseablePacket pp) callback)
	Selects a database. Fires off callback after a result of the database.

Connection.prototype.query(string cmd, function(string err, ParseablePacket pp) callback)
	Sends a query to the database. Fires off callback after a result of the database.



Events
---
drain
	Fired, when all querys are executed and all result sets are received.

authenticated
	Fired, when the authentication was successful.

error
	Fired, when the authentication wasn't successful (will maybe have more meanings; for example when the connection is destroyed/not accesible anymore)