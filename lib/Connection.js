var createConnection = require("net").createConnection,
	inherits = require("util").inherits,
	EventEmitter = require("events").EventEmitter,
	createHash = require("crypto").createHash,
	Server = require("./Server").Server,
	MySqlError = require("./MySqlError").MySqlError,
	Packet = require("./Packet").Packet,
	OutgoingPacket = require("./OutgoingPacket").OutgoingPacket,
	HandshakePacket = require("./packets/HandshakePacket").HandshakePacket,
	ParseablePacket = require("./packets/ParseablePacket").ParseablePacket,
	PreparePacket = require("./packets/PreparePacket").PreparePacket,
	HeaderPacket = require("./packets/HeaderPacket").HeaderPacket,
	ColumnPacket = require("./packets/ColumnPacket").ColumnPacket,
	RowPacket = require("./packets/RowPacket").RowPacket;

/**
 * A connection to a MySQL server
 * 
 * @constructor
 * @extends EventEmitter
 * @param {string} user the user
 * @param {?string=} password the password
 * @param {string=} host the host to connect to
 * @param {number=} port the port to use
 */
function Connection(user, password, host, port) {
	EventEmitter.call(this);
	
	this.host = host;
	this.user = user;
	this.password = password ? createHash("sha1").update(password).digest("binary") : null;
	this.port = port ? port : 3306;
	this.listeners = [];
	this.queue = [];
	this.packetQueue = [];
	this.options = {
		bufferRows: false,
		fetchMode: 0, // 0 = num, 1 = assoc, 2 = array
		autoBox: false
	};
	
	this.conn = createConnection(this.port, this.host);
	this.conn.mysql = this;
	this.conn.on("data", this.data);
}

inherits(Connection, EventEmitter);

/**
 * An enum for the connection states.
 * 
 * @enum {number}
 */
Connection.States = {
	HANDSHAKE: 0,
	AUTHENTICATE: 1,
	CONNECTED: 2,
	QUERYING: 3
};

/**
 * Fetchstates of a query
 * 
 * @enum {number}
 */
Connection.Fetchstate = {
	HEADER: 1,
	FIELD: 2,
	ROW: 3,
	END: 4
};

/**
 * A tcp connection
 * 
 * @type {net.Stream}
 */
Connection.prototype.conn = null;

/**
 * The host to connect to
 * 
 * @type {string}
 */
Connection.prototype.host = null;

/**
 * The port to use
 * 
 * @type {number}
 */
Connection.prototype.port = null;

/**
 * A user
 * 
 * @type {string}
 */
Connection.prototype.user = process.env["USER"];

/**
 * A hashed password
 * 
 * @type {?string}
 */
Connection.prototype.password = null;

/**
 * Cache the scramble for a re-login
 * 
 * @type {string}
 */
Connection.prototype.scramble = null;

/**
 * The connection state
 * 
 * @type {Connection.States}
 */
Connection.prototype.state = Connection.States.HANDSHAKE;

/**
 * A server information object
 * 
 * @type {Server}
 */
Connection.prototype.server = null;

/**
 * The current packet number
 * 
 * @type {number}
 */
Connection.prototype.packetNo = 0;

/**
 * The current query-queue
 * 
 * @type {Array.<{opcode: number, cmd: string, listener: function(ParseablePacket), state: Connection.Fetchstate, fields: Array.<ColumnPacket>, rows: Array.<Object.<*>>}>}
 */
Connection.prototype.queue = null;

/**
 * Options for the connection
 * 
 * @type {Object.<*, *>}
 */
Connection.prototype.options = null;

/**
 * A queue for packets which are out of order
 * 
 * @type {Array.<Packet>}
 */
Connection.prototype.packetQueue = null;

/**
 * The number of the last processed packet
 * 
 * @type {number}
 */
Connection.prototype.lastPacket = 0;

/**
 * A partial buffer of a packet
 * 
 * @type {Buffer}
 */
Connection.prototype.partial = null;

/**
 * Connects to a server after the connection was destroyed
 */
Connection.prototype.connect = function() {
	this.conn.connect(this.port, this.host);
};

/**
 * Function for handling all incoming data packets.
 * 
 * @param {Buffer} data the incoming data
 */
Connection.prototype.data = function(data) {
	var that = this.mysql;
	if (that.partial) {
		var temp = new Buffer(that.partial.length+data.length);
		that.partial.copy(temp);
		data.copy(temp, that.partial.length);
		data = temp;
		that.partial = null;
	}
	var packet;
	for (var i=0; i < data.length;) {
		try {
			packet = new Packet(data.slice(i, data.length));
			that.packetQueue[packet.nr] = packet;
		} catch (e) {
			that.partial = data.slice(i, data.length);
			break;
		}
		i += packet.length+4;
	}
	for (var i=that.lastPacket; (packet = that.packetQueue[i]) instanceof Packet; ++i)  {
		switch (that.state) {
			case Connection.States.HANDSHAKE:
				var processedPacket = new HandshakePacket(packet);
				that.scramble = processedPacket.scramble;
				that.server = processedPacket.server;
				that.authorize();
				that.state = Connection.States.AUTHENTICATE;
				that.lastPacket = 2;
				that.packetQueue = [];
				break;
			case Connection.States.AUTHENTICATE:
				if (packet.data[0] === 0x00) {
					that.state = Connection.States.CONNECTED;
					that.emit("authenticated", new ParseablePacket(packet));
				} else if (packet.data[0] === 0xFF) {
					var processedPacket = new ParseablePacket(packet);
					that.emit("error", new MySqlError(processedPacket.errNo, processedPacket.sqlState, processedPacket.message), processedPacket);
				} else {
					that.emit("error", new Error("Got an unknown packet during authentication."), packet);
				}
				break;
			case Connection.States.QUERYING:
				var q = that.queue[0];
				if (q.opcode === 0x17 && q.state === Connection.Fetchstate.ROW) { // REALLY hacky workaround for row data packet (binary)
					var tempbyte = packet.data[0]; 								  // Need better method
					packet.data[0] = 1;
					packet.isBinaryRow = true;
				}
				switch (packet.data[0]) {
					case 0x00:
					case 0xFF:
						that.state = Connection.States.CONNECTED;
						that.queue.shift();
						if (packet.data[0] === 0x00 && q.opcode === 0x16) {
							var prepareInfo = new PreparePacket(packet);
							if (q.listener) {
								q.listener(null, prepareInfo);
							}
						} else {
							var processedPacket = new ParseablePacket(packet);
							if (q.listener) {
								q.listener(processedPacket.errNo ? processedPacket.message : null, processedPacket);
							}
						}
						that.request();
						break;
					default:
						switch (q.state) {
							case undefined:
								if (q.opcode === 0x09) {
									that.queue.shift();
									if (q.listener)
										q.listener(null, packet.data.toString("ascii"));
									that.request();
									continue;
								}
								q.state = Connection.Fetchstate.FIELD;
								break;
							case Connection.Fetchstate.FIELD:
								if (packet.data[0] == 0xFE) {
									q.state = Connection.Fetchstate.ROW;
									if (q.opcode === 0x04) {
										that.queue.shift();
										if (q.listener)
											q.listener(null, q.fields);
										that.request();
									}
									continue;
								}
								var processedPacket = new ColumnPacket(packet);
								q.fields[q.fields.length] = processedPacket;
								if (q.columnCb) {
									q.columnCb(processedPacket);
								}
								break;
							case Connection.Fetchstate.ROW:
								if (packet.isBinaryRow) { // Second part of row data packet (binary) workaround.
									packet.data[0] = tempbyte;
								}
								if (packet.data[0] == 0xFE) {
									var q = that.queue.shift();
									that.state = Connection.States.CONNECTED;
									if (q.listener)
										q.listener(null, that.options.bufferRows ? q.rows : null);
									that.request();
									continue;
								}
								var processedPacket = new RowPacket(packet, q.fields, packet.isBinaryRow ? true : false, that.options.autoBox),
									dict = processedPacket.data;
								switch (that.options.fetchMode) {
									case 1:
										dict = {};
										for (var j=0; j < q.fields.length; ++j) {
											dict[q.fields[j].name] = processedPacket.data[j];
										}
										break;
									case 2:
										for (var j=0; j < q.fields.length; ++j) {
											dict[q.fields[j].name] = dict[j];
										}
										break;
								}
								if (that.options.bufferRows) {
									q.rows[q.rows.length] = dict;
								}
								if (q.rowCb) {
									q.rowCb(dict);
								}
								break;
						}
						break;
				}
				break;
		}
	}
};

/**
 * Authorizes the client with the password.
 */
Connection.prototype.authorize = function() {
	var out = new OutgoingPacket();
	out.writeFixedNumber(Server.defaultCapabilities, 4);
	out.writeFixedNumber(4294967295, 4);
	out.writeFixedNumber(192, 1);
	out.writeFiller(23);
	out.writeString(this.user);
	out.writeLengthString(Connection.createScramble(this.scramble, this.password));
	this.conn.write(out.getBuffer(1), "ascii");
};

/**
 * Creates a full authentication scramble out of the server sent scramble and the users password.
 * 
 * @param {Buffer} scramble the server sent scramble
 * @param {?string} password the password of the user
 */
Connection.createScramble = function(scramble, password) {
	if (password === null) return '';
	var hashed = createHash("sha1").update(scramble.toString("binary") + createHash("sha1").update(password).digest("binary")).digest("binary");
	hashed = new Buffer(hashed, "binary");
	var b = new Buffer(password, "binary");
	var i = hashed.length;
	while (i--) {
		hashed[i] = hashed[i] ^ b[i];
	}
	return hashed.toString("binary");
};

/**
 * Selects a database.
 * 
 * @param {string} db the database to select
 * @param {function(?string, ParseablePacket)} cb a callback to call after the query execution
 */
Connection.prototype.close = function(cb) {
	this.queue.push({opcode: 0x01, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Immediately destroys the connection.
 */
Connection.prototype.destroy = function() {
	this.conn.destroy();
	this.state = Connection.States.HANDSHAKE;
};

/**
 * Selects a database.
 * 
 * @param {string} db the database to select
 * @param {function(ParseablePacket)} cb a callback to call after the query execution
 */
Connection.prototype.selectDb = function(db, cb) {
	this.queue.push({opcode: 0x02, cmd: db, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Sends a query to the database
 * 
 * @param {string} cmd the command to send
 * @param {function(string, Object.<*, *>)} cb a callback to call after query execution
 * @param {function(string, ColumnPacket)} columnCb a callback to call for each column
 * @param {function(string, RowPacket)} rowCb a callback to call for each row/buffered
 */
Connection.prototype.query = function(cmd, cb, columnCb, rowCb) {
	this.queue.push({opcode: 0x03, cmd: cmd, listener: cb, columnCb: columnCb, rowCb: rowCb, fields: [], rows: []});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * List the fields of a table
 * 
 * @param {string} table the table to select the fields from
 * @param {?string} column a selector for the column
 * @param {function(string, Object.<*, *>)} cb a callback to call after query execution
 * @param {function(string, ColumnPacket)} columnCb a callback to call for each column
 * @param {function(string, RowPacket)} rowCb a callback to call for each row/buffered
 */
Connection.prototype.listFields = function(table, column, cb, columnCb) {
	if (typeof column === "function") {
		rowCb = columnCb;
		columnCb = cb;
		cb = column;
		column = '';
	}
	this.queue.push({opcode: 0x04, cmd: [table, column], state: Connection.Fetchstate.FIELD, listener: cb, columnCb: columnCb, fields: [], rows: []});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Refresh data of the server
 * 
 * @param {number} type the type of the refresh (0x01...REFRESH_GRANT, 0x02...REFRESH_LOG, 0x04...REFRESH_TABLES, 0x08...REFRESH_HOSTS, 0x10...REFRESH_STATUS, 0x20...REFRESH_THREADS, 0x40...REFRESH_SLAVE, 0x80...REFRESH_MASTER)
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.refresh = function(type, cb) {
	this.queue.push({opcode: 0x07, cmd: type, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Shuts down the server.
 * 
 * @param {number} type the type of the refresh (0x00...SHUTDOWN_DEFAULT, 0x01...SHUTDOWN_WAIT_CONNECTIONS, 0x02...SHUTDOWN_WAIT_TRANSACTIONS, 0x08...SHUTDOWN_WAIT_UPDATES, 0x10...SHUTDOWN_WAIT_ALL_BUFFERS, 0x11...SHUTDOWN_WAIT_CRITICAL_BUFFERS, 0xFE...KILL_QUERY, 0xFF... KILL_CONNECTION)
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.shutdown = function(type, cb) {
	this.queue.push({opcode: 0x08, cmd: type, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Gets some statistics from the server
 * 
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.stats = function(cb) {
	this.queue.push({opcode: 0x09, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Equals to the command SHOW PROCESSLIST
 * 
 * @param {function(string, Object.<*, *>)} cb a callback to call after query execution
 * @param {function(string, ColumnPacket)} columnCb a callback to call for each column
 * @param {function(string, RowPacket)} rowCb a callback to call for each row/buffered
 */
Connection.prototype.processList = function(cb, columnCb, rowCb) {
	this.queue.push({opcode: 0x0A, listener: cb, columnCb: columnCb, rowCb: rowCb, fields: [], rows: []});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Equals to the command SHOW PROCESSLIST
 * 
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.processKill = function(id, cb) {
	this.queue.push({opcode: 0x0C, cmd: id, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

// TODO: Doesn't work yet, got EOF packet. Need more information/other server.
/**
 * Dumps some debug information.
 * 
 * @param {function(string, string)} cb a callback to call after query execution
 */
Connection.prototype.debugServer = function(cb) {
	throw "Method not implemented!";
	this.queue.push({opcode: 0x0D, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Pings the mysql server
 * 
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.ping = function(cb) {
	this.queue.push({opcode: 0x0E, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Re-login to the server without closing the connection. Also cleans up data like temporary tables etc.
 * 
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.changeUser = function(user, pw, db, cb) {
	this.user = user;
	this.password = pw ? createHash("sha1").update(pw).digest("binary") : null;
	this.queue.push({opcode: 0x11, cmd: [user, Connection.createScramble(this.scramble, this.password), db, 192], listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Prepares a statement
 * 
 * @param {function(string, ParseablePacket|PreparePacket)} cb a callback to call after query execution
 */
Connection.prototype.prepare = function(cmd, cb) {
	this.queue.push({opcode: 0x16, cmd: cmd, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Executes a prepared statement
 * 
 * @param {function(string, ParseablePacket|PreparePacket)} cb a callback to call after query execution
 */
Connection.prototype.execute = function(handle, flags, params, cb, columnCb, rowCb) {
	this.queue.push({opcode: 0x17, cmd: [handle, flags, params], fields: [], rows: [], listener: cb, columnCb: columnCb, rowCb: rowCb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Fires off the next query, or a drain event, if no more querys in the queue.
 */
Connection.prototype.request = function() {
	if (this.state === Connection.States.QUERYING) return;
	if (this.queue.length === 0) {
		this.emit('drain');
	} else {
		var out = new OutgoingPacket();
		out.writeFixedNumber(this.queue[0].opcode, 1);
		switch (this.queue[0].opcode) {
			case 0x02:
			case 0x03:
			case 0x16:
				out.writeString(this.queue[0].cmd, true);
				break;
			case 0x04:
				out.writeString(this.queue[0].cmd[0]);
				out.writeString(this.queue[0].cmd[1], true);
				break;
			case 0x07:
			case 0x08:
				out.writeFixedNumber(this.queue[0].cmd, 1);
				break;
			case 0x0C:
				out.writeFixedNumber(this.queue[0].cmd, 4);
				break;
			case 0x11:
				out.writeString(this.queue[0].cmd[0]);
				out.writeLengthString(this.queue[0].cmd[1]);
				out.writeString(this.queue[0].cmd[2]);
				out.writeFixedNumber(this.queue[0].cmd[3], 2);
				break;
			case 0x11:
				out.writeString(this.queue[0].cmd[0]);
				out.writeLengthString(this.queue[0].cmd[1]);
				out.writeString(this.queue[0].cmd[2]);
				out.writeFixedNumber(this.queue[0].cmd[3], 2);
				break;
			case 0x17:
				out.writeFixedNumber(this.queue[0].cmd[0], 4);
				out.writeFixedNumber(this.queue[0].cmd[1], 1);
				out.writeFixedNumber(1, 4);
				
				var params = this.queue[0].cmd[2];
				if (params.length > 0) {
					var bytes = 0;
					var num = 0;
					for (var i=0; i < params.length; i+=8) {
						for (var j=i+8; j > i; --j) {
							if (params[j] === null) {
								++num;
							}
							num <<= 1;
						}
						++bytes;
					}
					out.writeFixedNumber(num, bytes);
					out.writeFixedNumber(1, 1);
					for (var i=0; i < params.length; ++i) {
						out.writeFixedNumber(0xFE, 2); // Always write strings
					}
					for (var i=0; i < params.length; ++i) {
						out.writeLengthString(params[i].toString());
					}
				} else {
					out.writeFixedNumber(0, 1);
				}
				break;
		}
		this.lastPacket = 1;
		this.packetQueue = [];
		this.state = Connection.States.QUERYING;
		this.conn.write(out.getBuffer(0), "ascii");
	}
};

exports.Connection = Connection;